/**
 * The chat's state: whether the panel is open, the conversation, and the
 * change waiting in the composer to be sent.
 *
 * Kept in a data store, registered once by name, so the top bar's toggle and
 * the panel, mounted separately, agree on it. Nothing is saved, so every visit
 * starts with an empty conversation.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * because the chat is mounted from app init. See `src/editor-layer/index.jsx`.
 */

/**
 * WordPress dependencies
 */
import {
	createReduxStore,
	dispatch,
	register,
	select,
	useSelect,
} from '@wordpress/data';

export const STORE_NAME = 'create-not-learn-editor/chat';

/*
 * Where the chat sits: in the stage, in place of the screen, or docked to the
 * right of the canvas. Both are being tried, so the last one picked is
 * remembered on this browser.
 */
export const PLACEMENT_STAGE = 'stage';
export const PLACEMENT_DOCK = 'dock';
const PLACEMENT_KEY = 'cnl-chat-placement';

function getSavedPlacement() {
	try {
		return window.localStorage.getItem( PLACEMENT_KEY ) === PLACEMENT_DOCK
			? PLACEMENT_DOCK
			: PLACEMENT_STAGE;
	} catch {
		return PLACEMENT_STAGE;
	}
}

export function savePlacement( placement ) {
	try {
		window.localStorage.setItem( PLACEMENT_KEY, placement );
	} catch {
		// Not remembered, then.
	}
}

const DEFAULT_STATE = {
	isOpen: false,
	placement: PLACEMENT_STAGE,
	messages: [],
	/*
	 * What has been picked and not yet sent: `{ messageId, skillId, label,
	 * entity, payload }`, or `null`.
	 */
	pending: null,
};

export function reducer( state = DEFAULT_STATE, action ) {
	switch ( action.type ) {
		case 'SET_CHAT_OPEN':
			return { ...state, isOpen: action.isOpen };
		case 'SET_CHAT_PLACEMENT':
			return { ...state, placement: action.placement };
		case 'ADD_CHAT_MESSAGE':
			return {
				...state,
				messages: [ ...state.messages, action.message ],
			};
		case 'UPDATE_CHAT_MESSAGE':
			return {
				...state,
				messages: state.messages.map( ( message ) =>
					message.id === action.id
						? { ...message, ...action.patch }
						: message
				),
			};
		case 'SET_CHAT_PENDING':
			return { ...state, pending: action.pending };
		case 'RESET_CHAT':
			return {
				...DEFAULT_STATE,
				isOpen: state.isOpen,
				placement: state.placement,
			};
	}

	return state;
}

if ( ! select( STORE_NAME ) ) {
	register(
		createReduxStore( STORE_NAME, {
			reducer: ( state, action ) =>
				reducer(
					state ?? {
						...DEFAULT_STATE,
						placement: getSavedPlacement(),
					},
					action
				),
			actions: {
				setOpen: ( isOpen ) => ( { isOpen, type: 'SET_CHAT_OPEN' } ),
				setPlacement: ( placement ) => ( {
					placement,
					type: 'SET_CHAT_PLACEMENT',
				} ),
				addMessage: ( message ) => ( {
					message,
					type: 'ADD_CHAT_MESSAGE',
				} ),
				updateMessage: ( id, patch ) => ( {
					id,
					patch,
					type: 'UPDATE_CHAT_MESSAGE',
				} ),
				setPending: ( pending ) => ( {
					pending,
					type: 'SET_CHAT_PENDING',
				} ),
				reset: () => ( { type: 'RESET_CHAT' } ),
			},
			selectors: {
				isOpen: ( state ) => state.isOpen,
				getPlacement: ( state ) => state.placement,
				getMessages: ( state ) => state.messages,
				getMessage: ( state, id ) =>
					state.messages.find( ( message ) => message.id === id ),
				getPending: ( state ) => state.pending,
			},
		} )
	);
}

export function getChat() {
	return select( STORE_NAME );
}

export function chatActions() {
	return dispatch( STORE_NAME );
}

/**
 * @return {Object} `{ isOpen, messages, pending, placement }`, kept up to
 *                  date.
 */
export function useChat() {
	return useSelect( ( selectStore ) => {
		const store = selectStore( STORE_NAME );

		return {
			isOpen: store.isOpen(),
			messages: store.getMessages(),
			pending: store.getPending(),
			placement: store.getPlacement(),
		};
	}, [] );
}

let lastId = 0;

/**
 * @return {string} A new message ID.
 */
export function createMessageId() {
	lastId += 1;
	return `cnl-chat-${ lastId }`;
}
