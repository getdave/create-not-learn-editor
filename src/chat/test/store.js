/**
 * External dependencies
 */
import { describe, expect, test, vi } from 'vitest';

/**
 * Internal dependencies
 */
import { reducer } from '../store';

vi.mock( '@wordpress/data', () => ( {
	createReduxStore: vi.fn(),
	dispatch: vi.fn(),
	register: vi.fn(),
	select: () => ( {} ),
	useSelect: vi.fn(),
} ) );

const initial = reducer( undefined, { type: '@@INIT' } );

describe( 'chat reducer', () => {
	test( 'starts closed and empty', () => {
		expect( initial ).toEqual( {
			isOpen: false,
			messages: [],
			pending: null,
			placement: 'stage',
		} );
	} );

	test( 'adds and updates messages', () => {
		let state = reducer( initial, {
			type: 'ADD_CHAT_MESSAGE',
			message: { id: 'a', role: 'user', text: 'hi' },
		} );
		state = reducer( state, {
			type: 'ADD_CHAT_MESSAGE',
			message: { id: 'b', role: 'assistant', status: 'thinking' },
		} );
		state = reducer( state, {
			type: 'UPDATE_CHAT_MESSAGE',
			id: 'b',
			patch: { status: 'ready', text: 'Hello' },
		} );

		expect( state.messages ).toEqual( [
			{ id: 'a', role: 'user', text: 'hi' },
			{ id: 'b', role: 'assistant', status: 'ready', text: 'Hello' },
		] );
	} );

	test( 'moves between the stage and the dock', () => {
		expect(
			reducer( initial, {
				type: 'SET_CHAT_PLACEMENT',
				placement: 'dock',
			} ).placement
		).toBe( 'dock' );
	} );

	test( 'a reset keeps the panel open but forgets the conversation', () => {
		const state = reducer(
			{
				isOpen: true,
				messages: [ { id: 'a' } ],
				pending: { messageId: 'a' },
				placement: 'dock',
			},
			{ type: 'RESET_CHAT' }
		);

		expect( state ).toEqual( {
			isOpen: true,
			messages: [],
			pending: null,
			placement: 'dock',
		} );
	} );
} );
