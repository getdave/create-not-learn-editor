/**
 * How a conversation with the chat moves along.
 *
 * Sending asks for something, or keeps what was picked. Picking in a reply
 * makes the change on the site and waits in the composer, until it is sent
 * or cancelled. Once sent, it can be undone.
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
import { FALLBACK_REPLY, SKILLS, getSectionsReply, openRoute } from './skills';
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
	return messages.some( ( message ) =>
		[ 'thinking', 'streaming', 'saving' ].includes( message.status )
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
		.forEach( ( message ) => update( message.id, { status: 'expired' } ) );
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

/**
 * Save what is waiting in the composer.
 *
 * @param {Object} pending The pick, from the store.
 * @param {string} typed   What was typed with it, if anything.
 */
async function commit( pending, typed = '' ) {
	const skill = SKILLS[ pending.skillId ];
	const picked = getChat().getMessage( pending.messageId );

	chatActions().setPending( null );
	addMessage( {
		chip: skill.chip( pending ),
		role: 'user',
		text: typed || skill.request( pending ),
	} );
	update( picked.id, {
		status: 'committed',
		summary: skill.chip( pending ),
	} );

	const id = addMessage( {
		role: 'assistant',
		status: 'saving',
		text: __( 'Saving…' ),
	} );

	await save( id, pending, picked );
}

async function save( id, pending, picked ) {
	const skill = SKILLS[ pending.skillId ];

	update( id, { retry: null, status: 'saving', text: __( 'Saving…' ) } );

	try {
		let undo;

		if ( skill.commit ) {
			undo = await skill.commit( pending, picked );
		} else {
			await saveEntity( picked.entity );
			undo = { entity: picked.entity, snapshot: picked.snapshot };
		}

		update( id, {
			offersNext: true,
			skillId: pending.skillId,
			status: 'streaming',
			text: skill.done( pending, picked ),
			undo,
		} );
	} catch ( error ) {
		update( id, {
			retry: { pending, pickedId: picked.id },
			status: 'error',
			text: sprintf(
				/* translators: %s: error message. */
				__( 'I couldn’t save that. %s' ),
				getErrorText( error )
			),
		} );
	}
}

/**
 * Try a failed save again.
 *
 * @param {string} id The message saying it failed.
 */
export function retrySave( id ) {
	const { retry } = getChat().getMessage( id ) || {};

	if ( retry ) {
		save( id, retry.pending, getChat().getMessage( retry.pickedId ) );
	}
}

/**
 * Send what is in the composer: the pick waiting there, a request, or both.
 *
 * @param {string} text What was typed.
 */
export async function sendMessage( text ) {
	const typed = String( text || '' ).trim();
	const pending = getChat().getPending();

	if ( isBusy() || ( ! typed && ! pending ) ) {
		return;
	}

	if ( pending ) {
		await commit( pending, typed );

		// Anything asked for alongside the pick gets its own answer.
		if ( ! typed || isConfirmation( typed ) || ! matchRequest( typed ) ) {
			return;
		}
	} else {
		addMessage( { role: 'user', text: typed } );
	}

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
 * A page was chosen for a section to go on: answer as if it had been asked
 * for, and show the page on the canvas.
 *
 * @param {string} id   The reply that asked which page.
 * @param {Object} page `{ id, title }`.
 */
export async function choosePage( id, page ) {
	const asked = getChat().getMessage( id );

	update( id, { status: 'committed', summary: page.title } );
	addMessage( { role: 'user', text: page.title } );
	openRoute( '/types/page/list/all', { previewId: page.id } );

	const replyId = addMessage( { role: 'assistant', status: 'thinking' } );

	await wait( THINKING_MS );

	update( replyId, {
		hasWidget: true,
		params: {
			search: asked?.params?.search || '',
			pageId: page.id,
			pageTitle: page.title,
		},
		skillId: 'add-section',
		status: 'streaming',
		text: getSectionsReply( asked?.params?.search, page.title ),
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
 * Run one of a reply's buttons.
 *
 * @param {string} action Action name.
 */
export function runAction( action ) {
	if ( action === 'open-pages' ) {
		openRoute( '/types/page/list/all' );
	}
}

/**
 * Start again, putting back anything picked and not sent.
 */
export function startNewChat() {
	cancelPending();
	chatActions().reset();
}
