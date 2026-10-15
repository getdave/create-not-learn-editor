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

const DEFAULT_STATE = {
	isOpen: false,
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
			return { ...DEFAULT_STATE, isOpen: state.isOpen };
	}

	return state;
}

if ( ! select( STORE_NAME ) ) {
	register(
		createReduxStore( STORE_NAME, {
			reducer,
			actions: {
				setOpen: ( isOpen ) => ( { isOpen, type: 'SET_CHAT_OPEN' } ),
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
 * @return {Object} `{ isOpen, messages, pending }`, kept up to date.
 */
export function useChat() {
	return useSelect( ( selectStore ) => {
		const store = selectStore( STORE_NAME );

		return {
			isOpen: store.isOpen(),
			messages: store.getMessages(),
			pending: store.getPending(),
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
