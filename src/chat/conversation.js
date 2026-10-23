/**
 * How a conversation with the chat moves along.
 *
 * Typing asks for something. Picking in a reply makes the change on the
 * site, and the button under the picker keeps it, or Cancel puts it back.
 * Some pickers, like adding a section, save each pick as it is made, and
 * picking again swaps it.
 * Once kept, it can be undone.
 *
 * Messages are `{ id, role, text, status }`. An assistant's message moves
 * from `thinking` to `streaming` to `ready`, and one with a picker then to
 * `committed` once its pick is sent, or `expired` when the conversation
 * moves on without one.
 *
 * What is typed is answered from a script, unless a language model is
 * connected. Then the model answers it, showing the same pickers, except
 * where a picker answers it in full, like "change my colours", which the
 * script still answers, as it is quicker. Choices are always answered from
 * the script. See `model.js` and `router.js`.
 */

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { isConfirmation, matchRequest } from './engine';
import { buildHistory } from './model-tools';
import { hasModel, runModelTurn, stopModel } from './model';
import { getRecentConversation, routeRequest } from './router';
import {
	hasEdits,
	restoreSnapshot,
	revertSnapshot,
	saveEntity,
	takeSnapshot,
} from './entity-changes';
import { openRoute } from '../open-route';
import { getPatternTitle } from '../routes/content/page-layouts';
import { setCanvasMode } from '../site-canvas/mode';
import { FALLBACK_REPLY, SKILLS } from './skills';
import { chatActions, createMessageId, getChat } from './store';

// How long the chat seems to think before it answers.
const THINKING_MS = 650;

function wait( ms ) {
	return new Promise( ( resolve ) => window.setTimeout( resolve, ms ) );
}

function addMessage( message ) {
	const id = createMessageId();
	chatActions().addMessage( { id, ...message } );
	return id;
}

function update( id, patch ) {
	chatActions().updateMessage( id, patch );
}

function getErrorText( error ) {
	return error?.message || __( 'Something went wrong.' );
}

/**
 * @param {Object[]} messages The conversation.
 * @return {boolean} Whether the chat is still answering.
 */
export function isBusy( messages = getChat().getMessages() ) {
	return messages.some(
		( message ) =>
			[ 'thinking', 'streaming', 'saving' ].includes( message.status ) ||
			[ 'saving', 'saved', 'closing' ].includes( message.saveState )
	);
}

/*
 * Only the newest picker can be used. Earlier ones are put away once the
 * conversation moves on, so they can't change the site behind its back.
 */
function expireOpenPickers() {
	getChat()
		.getMessages()
		.filter(
			( message ) => message.hasWidget && message.status === 'ready'
		)
		.forEach( ( message ) => {
			const skill = SKILLS[ message.skillId ];

			// A pick already saved stays, and says so, with its undo.
			update(
				message.id,
				message.undo
					? {
							status: 'committed',
							summary: skill.chip( {
								label: message.pickedLabel,
							} ),
						}
					: { status: 'expired' }
			);
		} );
}

/**
 * Show a skill's reply, and its picker if it has one, in a message.
 *
 * @param {string}  id      The message.
 * @param {?string} skillId The skill, if one matched.
 * @param {Object}  params  What the request said.
 * @param {Object}  reply   The skill's reply.
 */
function showReply( id, skillId, params, reply ) {
	const skill = SKILLS[ skillId ];

	update( id, {
		actions: reply.actions,
		hasWidget: !! skill?.Widget && reply.widget !== false,
		params: { ...params, ...reply.params },
		skillId,
		status: 'streaming',
		suggestions: reply.suggestions,
		text: reply.text,
	} );
}

/**
 * Answer from the script.
 *
 * @param {string}  text          What was typed, or the choice made.
 * @param {?Object} match         What it asks for, from `matchRequest()`.
 * @param {Object}  options       Options.
 * @param {string}  options.id    A message already thinking, to answer in.
 * @param {number}  options.since When it started thinking.
 */
async function respond( text, match, { id: thinkingId, since } = {} ) {
	const id =
		thinkingId || addMessage( { role: 'assistant', status: 'thinking' } );

	await wait(
		Math.max( 0, ( since || Date.now() ) + THINKING_MS - Date.now() )
	);

	if ( match?.skill === 'undo' ) {
		await undoLatest( id );
		return;
	}

	const skill = match && SKILLS[ match.skill ];
	const reply = skill
		? await skill.reply( match.params, text )
		: FALLBACK_REPLY;

	showReply( id, match?.skill, match?.params, reply );
}

/**
 * Answer what was typed when a language model is connected: from the
 * script, or a decision model, when one is sure the request only asks for
 * a picker, as that is quicker, and otherwise with the language model.
 *
 * @param {string} text    What was typed.
 * @param {Object} context What it might refer to, for `routeRequest()`.
 */
async function respondToTyped( text, context ) {
	const since = Date.now();
	const id = addMessage( { role: 'assistant', status: 'thinking' } );
	const route = await routeRequest( text, context );

	if ( route ) {
		await respond( text, route, { id, since } );
	} else {
		await respondWithModel( text, context.picked, id );
	}
}

/**
 * Answer what was typed with the language model.
 *
 * The model can say something, change the canvas, and show a skill's
 * picker, over several rounds. Each thing it says, and each picker, is a
 * message of its own. The turn is kept on its first message for the model
 * to see next time, and its messages are marked `fromModel` so they aren't
 * sent twice.
 *
 * @param {string} text    What was typed.
 * @param {string} picked  What was picked in the chat, from `describePick()`.
 * @param {string} firstId A message already thinking, to answer in.
 */
async function respondWithModel( text, picked, firstId ) {
	const history = buildHistory( getChat().getMessages() );

	update( firstId, { fromModel: true } );
	// The message thinking, waiting for whatever the model does next.
	let thinkingId = firstId;

	const takeMessage = () => {
		const id =
			thinkingId || addMessage( { fromModel: true, role: 'assistant' } );
		thinkingId = null;
		return id;
	};

	try {
		const wire = await runModelTurn( {
			history,
			typed: text,
			picked,
			onRound: () => {
				thinkingId ||= addMessage( {
					fromModel: true,
					role: 'assistant',
					status: 'thinking',
				} );
			},
			onText: ( said ) =>
				update( takeMessage(), { status: 'streaming', text: said } ),
			showSkill: async ( skillId, params, request ) => {
				const id = takeMessage();

				expireOpenPickers();

				if ( skillId === 'undo' ) {
					await undoLatest( id );
					return getChat().getMessage( id )?.text;
				}

				const reply = await SKILLS[ skillId ].reply( params, request );

				showReply( id, skillId, params, reply );

				if ( params.designs ) {
					showWrittenDesign( id );
				}

				return getChat().getMessage( id ).text;
			},
		} );

		if ( ! wire ) {
			return;
		}

		update( firstId, { wire } );

		// The model finished without a word, having only changed the canvas.
		if ( thinkingId ) {
			update( thinkingId, { status: 'streaming', text: __( 'Done.' ) } );
		}
	} catch ( error ) {
		update( takeMessage(), {
			status: 'error',
			text: sprintf(
				/* translators: %s: error message. */
				__( 'I couldn’t answer that. %s' ),
				getErrorText( error )
			),
		} );
	}
}

/**
 * What the newest picker has picked, for the model to know what "this" is
 * in "make this about sock puppets". Read before the conversation moves on,
 * which puts back or folds away what is picked.
 *
 * @return {string} What was picked, or ''.
 */
function describePick() {
	const message = [ ...getChat().getMessages() ]
		.reverse()
		.find( ( candidate ) => candidate.hasWidget );

	if ( message?.status !== 'ready' || ! message.pickedLabel ) {
		return '';
	}

	const { params = {}, pickedLabel, pickedPayload = {}, skillId } = message;

	if ( skillId === 'add-page' ) {
		return pickedPayload.pattern
			? `In the chat, the user picked the page design "${ getPatternTitle(
					pickedPayload.pattern
				) }" (design name: ${
					pickedPayload.pattern.name
				}) for a new page called "${
					pickedPayload.title
				}", and hasn't created the page yet.`
			: `In the chat, the user chose to start a new page called "${ pickedPayload.title }" blank, and hasn't created it yet.`;
	}

	if ( skillId === 'add-section' ) {
		return `In the chat, the user just added the section design "${ pickedLabel }" (design name: ${ pickedPayload.patternName }) to the page "${ params.pageTitle }".`;
	}

	return `In the chat, the user picked "${ pickedLabel }" in a picker, and hasn't kept it yet.`;
}

/**
 * Show a design the model wrote, first in a page or section picker.
 *
 * When the picker before it is the same, for the same page, as when the
 * model has rewritten what was picked there, it carries on from that one:
 * the designs written before stay, and a section already added is swapped
 * by the next pick, as picking again in that picker would.
 *
 * @param {string} id The message showing the picker.
 */
function showWrittenDesign( id ) {
	const message = getChat().getMessage( id );
	const { params, skillId } = message;

	if ( params.choosePage ) {
		return;
	}

	const previous = [ ...getChat().getMessages() ]
		.reverse()
		.find( ( candidate ) => candidate.id !== id && candidate.hasWidget );
	const isSame =
		previous?.skillId === skillId &&
		previous.params?.pageId === params.pageId;
	const carried = {};

	if ( isSame ) {
		carried.params = {
			...params,
			designs: [
				...params.designs,
				...( previous.params.designs || [] ),
			],
		};

		if ( skillId === 'add-section' && previous.undo ) {
			Object.assign( carried, {
				entity: previous.entity,
				pickedLabel: previous.pickedLabel,
				pickedPayload: previous.pickedPayload,
				snapshot: previous.snapshot,
				undo: previous.undo,
			} );
		}

		update( previous.id, {
			isNotKept: false,
			status: 'expired',
			summary: null,
			undo: null,
		} );
	}

	update( id, {
		...carried,
		text:
			skillId === 'add-page'
				? sprintf(
						/* translators: %s: page name. */
						__(
							'I’ve written a “%s” page for you. It’s first below, ready to create, or pick another design.'
						),
						params.title
					)
				: sprintf(
						/* translators: %s: page name. */
						__(
							'I’ve written a section for you. It’s first below. Pick it to put it on “%s”.'
						),
						params.pageTitle
					),
	} );
}

/*
 * How saving shows under the picker: long enough to be seen saving, then
 * saved, then the picker folds away. See `WidgetFooter` in `message.jsx`.
 */
const SAVING_MIN_MS = 700;
const SAVED_MS = 1200;
const CLOSING_MS = 300;

async function waitSince( start, ms ) {
	await wait( Math.max( 0, start + ms - Date.now() ) );
}

/**
 * Keep a pick: save it, show it saved under the picker, fold the picker
 * away to a line saying what was kept, and confirm it.
 *
 * Pressing the picker's button isn't something said, so it adds nothing to
 * the conversation on the person's side: the folded picker already says
 * what was picked.
 *
 * @param {Object} pending The pick, from the store.
 */
async function commit( pending ) {
	const skill = SKILLS[ pending.skillId ];
	const id = pending.messageId;
	const picked = getChat().getMessage( id );
	const start = Date.now();
	let undo;

	update( id, { saveError: null, saveState: 'saving' } );

	try {
		if ( skill.commit ) {
			undo = await skill.commit( pending, picked );
		} else {
			await saveEntity( picked.entity );
			undo = { entity: picked.entity, snapshot: picked.snapshot };
		}
	} catch ( error ) {
		await waitSince( start, SAVING_MIN_MS );
		update( id, {
			saveError: sprintf(
				/* translators: %s: error message. */
				__( 'Couldn’t save. %s' ),
				getErrorText( error )
			),
			saveState: 'error',
		} );
		return;
	}

	await waitSince( start, SAVING_MIN_MS );
	chatActions().setPending( null );
	update( id, { saveState: 'saved' } );
	await wait( SAVED_MS );
	await foldPicker( pending, undo );
}

/**
 * Fold a picker whose pick is kept away to a line saying what was kept, and
 * confirm it, with a way to undo it.
 *
 * @param {Object} kept `{ label, messageId, payload, skillId }`.
 * @param {Object} undo What undoing it needs.
 */
async function foldPicker( kept, undo ) {
	const skill = SKILLS[ kept.skillId ];
	const id = kept.messageId;

	update( id, { saveState: 'closing' } );
	await wait( CLOSING_MS );
	update( id, {
		saveState: null,
		status: 'committed',
		summary: skill.chip( kept ),
		undo: null,
	} );

	addMessage( {
		offersNext: true,
		role: 'assistant',
		skillId: kept.skillId,
		status: 'streaming',
		text: skill.done( kept, getChat().getMessage( id ) ),
		undo,
	} );
}

/**
 * Keep the change waiting in a reply's picker: what its button does.
 */
export async function commitPending() {
	const pending = getChat().getPending();

	if ( pending && ! isBusy() ) {
		await commit( pending );
	}
}

/**
 * Send what was typed.
 *
 * A change waiting in a picker is kept if the message only says so, like
 * "yes" or "save it". Asking for something else puts it back, as moving on
 * from it without keeping it.
 *
 * @param {string}  text             What was typed, or the choice made.
 * @param {Object}  options          Options.
 * @param {boolean} options.isChoice Whether it is one of the chat's choices,
 *                                   which the script always answers.
 */
export async function sendMessage( text, { isChoice = false } = {} ) {
	const typed = String( text || '' ).trim();

	if ( isBusy() || ! typed ) {
		return;
	}

	const pending = getChat().getPending();

	if ( pending && isConfirmation( typed ) ) {
		addMessage( { role: 'user', text: typed } );
		await commit( pending );
		return;
	}

	const conversation = getRecentConversation( getChat().getMessages() );
	// Before the pick is put back below.
	const picked = describePick();

	if ( pending ) {
		cancelPending();
		update( pending.messageId, { isNotKept: true } );
	}

	addMessage( { role: 'user', text: typed } );
	expireOpenPickers();

	if ( hasModel() && ! isChoice ) {
		await respondToTyped( typed, { conversation, picked } );
	} else {
		await respond( typed, matchRequest( typed ) );
	}
}

/**
 * A reply has finished appearing.
 *
 * @param {string} id Message ID.
 */
export function finishStreaming( id ) {
	const message = getChat().getMessage( id );

	if ( message?.status === 'streaming' ) {
		update( id, { status: message.undone ? 'done' : 'ready' } );
	}
}

/**
 * Note how the record a picker changes stands, before anything is picked.
 *
 * @param {string} id     The reply showing the picker.
 * @param {Array}  entity `[ kind, name, key ]`.
 */
export function prepareWidget( id, entity ) {
	const message = getChat().getMessage( id );
	const skill = SKILLS[ message?.skillId ];

	if ( ! message || message.snapshot || ! entity || ! skill?.keys ) {
		return;
	}

	update( id, {
		entity,
		snapshot: takeSnapshot( entity, skill.keys, skill.hasBlocks ),
	} );
}

/**
 * A page was chosen for a request about a section, like where to add one:
 * answer as if it had been asked for on that page, and show the page on the
 * canvas.
 *
 * @param {string} id   The reply that asked which page.
 * @param {Object} page `{ id, title }`.
 */
export async function choosePage( id, page ) {
	const asked = getChat().getMessage( id );
	const skillId = asked?.skillId || 'add-section';

	update( id, { status: 'committed', summary: page.title } );
	addMessage( { role: 'user', text: page.title } );
	openRoute( '/types/page/list/all', { previewId: page.id } );

	const replyId = addMessage( { role: 'assistant', status: 'thinking' } );

	await wait( THINKING_MS );

	const reply = await SKILLS[ skillId ].replyForPage(
		asked?.params || {},
		page
	);

	update( replyId, {
		hasWidget: true,
		params: reply.params,
		skillId,
		status: 'streaming',
		text: reply.text,
	} );
}

/**
 * Something was picked in a reply's picker, and the change made.
 *
 * @param {string} messageId The reply.
 * @param {string} label     What was picked, in a few words.
 * @param {Object} payload   Anything the skill needs to save it.
 */
export function pick( messageId, label, payload = {} ) {
	const message = getChat().getMessage( messageId );

	update( messageId, { pickedLabel: label, pickedPayload: payload } );
	chatActions().setPending( {
		entity: message.entity,
		label,
		messageId,
		payload,
		skillId: message.skillId,
	} );
}

/**
 * Something was picked in a picker that keeps each pick as it is made: save
 * it. The picker stays open, so another pick swaps it and saves again, until
 * Done or the conversation moves on.
 *
 * @param {string} messageId The reply.
 * @param {string} label     What was picked, in a few words.
 * @param {Object} payload   Anything the skill needs to save it.
 */
export async function savePick( messageId, label, payload = {} ) {
	const message = getChat().getMessage( messageId );

	update( messageId, {
		pickedLabel: label,
		pickedPayload: payload,
		saveError: null,
		saveState: 'saving',
	} );

	try {
		await saveEntity( message.entity );
	} catch ( error ) {
		update( messageId, {
			saveError: sprintf(
				/* translators: %s: error message. */
				__( 'Couldn’t save. %s' ),
				getErrorText( error )
			),
			saveState: 'error',
		} );
		return;
	}

	// Undoing puts the record back as it was before the first pick.
	update( messageId, {
		saveState: null,
		undo: { entity: message.entity, snapshot: message.snapshot },
	} );
}

/**
 * Take back what a picker that saves as it goes has saved, and leave the
 * picker open to pick again.
 *
 * @param {string} messageId The reply.
 */
export async function undoSavedPick( messageId ) {
	const message = getChat().getMessage( messageId );

	if ( ! message?.undo || isBusy() ) {
		return;
	}

	update( messageId, { saveError: null, saveState: 'saving' } );

	try {
		await restoreSnapshot( message.undo.entity, message.undo.snapshot );
	} catch ( error ) {
		update( messageId, {
			saveError: sprintf(
				/* translators: %s: error message. */
				__( 'I couldn’t undo that. %s' ),
				getErrorText( error )
			),
			saveState: 'error',
		} );
		return;
	}

	update( messageId, {
		pickedLabel: null,
		pickedPayload: null,
		saveState: null,
		undo: null,
	} );
}

/**
 * Done with a picker that saves as it goes: fold it away and confirm what
 * was kept.
 *
 * @param {string} messageId The reply.
 */
export async function finishSavedPick( messageId ) {
	const message = getChat().getMessage( messageId );

	if ( ! message?.undo || isBusy() ) {
		return;
	}

	await foldPicker(
		{
			label: message.pickedLabel,
			messageId,
			payload: message.pickedPayload,
			skillId: message.skillId,
		},
		message.undo
	);
}

/**
 * Cancel the pick waiting in the composer, and put the site back.
 */
export function cancelPending() {
	const pending = getChat().getPending();

	if ( ! pending ) {
		return;
	}

	const message = getChat().getMessage( pending.messageId );

	if ( message?.snapshot ) {
		revertSnapshot( message.entity, message.snapshot );
	}

	update( pending.messageId, { pickedLabel: null, pickedPayload: null } );
	chatActions().setPending( null );
}

/**
 * Forget a pick whose change is no longer waiting, because it was saved or
 * discarded from the top bar.
 */
export function dropStalePending() {
	const pending = getChat().getPending();
	const message = pending && getChat().getMessage( pending.messageId );

	// Saving clears the record's changes too; that is the pick being kept.
	if ( message?.saveState ) {
		return;
	}

	if ( pending?.entity && ! hasEdits( pending.entity ) ) {
		update( pending.messageId, { pickedLabel: null, pickedPayload: null } );
		chatActions().setPending( null );
	}
}

/**
 * Undo a saved change.
 *
 * @param {string}  id      The message that confirmed it.
 * @param {?string} replyId A message to answer in, rather than a new one.
 */
export async function undoChange( id, replyId = null ) {
	const message = getChat().getMessage( id );
	const skill = SKILLS[ message?.skillId ];

	if ( ! message?.undo || message.undoState ) {
		return;
	}

	update( id, { undoState: 'undoing' } );
	const undoing = { status: 'saving', text: __( 'Putting it back…' ) };
	let answerId = replyId;

	if ( answerId ) {
		update( answerId, undoing );
	} else {
		answerId = addMessage( { role: 'assistant', ...undoing } );
	}

	try {
		if ( skill.undo ) {
			await skill.undo( message.undo );
		} else {
			await restoreSnapshot( message.undo.entity, message.undo.snapshot );
		}

		update( id, { undoState: 'undone' } );
		update( answerId, {
			offersNext: true,
			status: 'streaming',
			text: skill.undone || __( 'Done. I’ve put it back how it was.' ),
			undone: true,
		} );
	} catch ( error ) {
		update( id, { undoState: null } );
		update( answerId, {
			status: 'error',
			text: sprintf(
				/* translators: %s: error message. */
				__( 'I couldn’t undo that. %s' ),
				getErrorText( error )
			),
		} );
	}
}

async function undoLatest( replyId ) {
	const latest = [ ...getChat().getMessages() ]
		.reverse()
		.find( ( message ) => message.undo && ! message.undoState );

	if ( ! latest ) {
		update( replyId, {
			status: 'streaming',
			text: __( 'There’s nothing to undo yet.' ),
		} );
		return;
	}

	await undoChange( latest.id, replyId );
}

/**
 * Open the screen a picker comes from, and close the chat for it. A pick not
 * yet kept stays on the site, so the screen carries on from it.
 *
 * @param {Object}  screen            From the skill.
 * @param {string}  screen.path       Route path.
 * @param {Object}  screen.search     Route search params.
 * @param {?string} screen.canvasMode The canvas mode it is in, if it is one,
 *                                    like Compose.
 */
export function openScreen( { canvasMode, path, search } ) {
	openRoute( path, search );

	if ( canvasMode ) {
		setCanvasMode( canvasMode );
	}

	chatActions().setOpen( false );
}

/**
 * Run one of a reply's buttons.
 *
 * @param {string} action Action name.
 * @param {string} id     The message the button is on.
 */
export function runAction( action, id ) {
	if ( action === 'open-pages' ) {
		openRoute( '/types/page/list/all' );
		return;
	}

	// Answered, so the buttons go.
	update( id, { actions: null } );

	if ( action === 'close-assistant' ) {
		cancelPending();
		openRoute( '/' );
		chatActions().setOpen( false );
		return;
	}

	if ( action === 'stay' ) {
		addMessage( {
			offersNext: true,
			role: 'assistant',
			status: 'streaming',
			text: __( 'No problem, I’m still here.' ),
		} );
	}
}

/**
 * Start again, putting back anything picked and not sent.
 */
export function startNewChat() {
	stopModel();
	cancelPending();
	chatActions().reset();
}
