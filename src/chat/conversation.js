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
 */

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { isConfirmation, matchRequest } from './engine';
import {
	hasEdits,
	restoreSnapshot,
	revertSnapshot,
	saveEntity,
	takeSnapshot,
} from './entity-changes';
import { setCanvasMode } from '../site-canvas/mode';
import { FALLBACK_REPLY, SKILLS, openRoute } from './skills';
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

async function respond( text ) {
	const match = matchRequest( text );
	const id = addMessage( { role: 'assistant', status: 'thinking' } );

	await wait( THINKING_MS );

	if ( match?.skill === 'undo' ) {
		await undoLatest( id );
		return;
	}

	const skill = match && SKILLS[ match.skill ];
	const reply = skill
		? await skill.reply( match.params, text )
		: FALLBACK_REPLY;

	update( id, {
		actions: reply.actions,
		hasWidget: !! skill?.Widget && reply.widget !== false,
		params: { ...match?.params, ...reply.params },
		skillId: match?.skill,
		status: 'streaming',
		suggestions: reply.suggestions,
		text: reply.text,
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
 * @param {string} text What was typed.
 */
export async function sendMessage( text ) {
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

	if ( pending ) {
		cancelPending();
		update( pending.messageId, { isNotKept: true } );
	}

	addMessage( { role: 'user', text: typed } );
	expireOpenPickers();
	await respond( typed );
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
	cancelPending();
	chatActions().reset();
}
