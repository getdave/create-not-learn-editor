/**
 * External dependencies
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * Internal dependencies
 */
import { routeWithDecisionModel } from '../decision-model';
import { getRecentConversation, routeRequest } from '../router';

vi.mock( '../decision-model', () => ( {
	routeWithDecisionModel: vi.fn(),
} ) );

beforeEach( () => {
	routeWithDecisionModel.mockReset();
	routeWithDecisionModel.mockResolvedValue( null );
} );

describe( 'routeRequest', () => {
	test( 'asks the decision model, not the script', async () => {
		const route = {
			skill: 'section-design',
			params: { focus: 'color', pageId: 8, sectionIndex: 0 },
		};
		const context = { conversation: [], picked: '' };

		routeWithDecisionModel.mockResolvedValue( route );

		expect(
			await routeRequest( 'the photos bit looks too pale', context )
		).toBe( route );
		expect( routeWithDecisionModel ).toHaveBeenCalledWith(
			'the photos bit looks too pale',
			context
		);
	} );

	test( 'leaves a request the script would match to the model', async () => {
		expect( await routeRequest( 'add a mobile menu' ) ).toBeNull();
		expect( routeWithDecisionModel ).toHaveBeenCalled();
	} );

	test( 'asks nothing about an empty message', async () => {
		expect( await routeRequest( '  ' ) ).toBeNull();
		expect( routeWithDecisionModel ).not.toHaveBeenCalled();
	} );
} );

describe( 'getRecentConversation', () => {
	test( 'keeps the last six things said, without errors or thinking', () => {
		const messages = [
			{ role: 'user', text: 'one' },
			{ role: 'assistant', text: 'two', hasWidget: true },
			{ role: 'assistant', status: 'error', text: 'failed' },
			{ role: 'assistant', status: 'thinking' },
			...[ 3, 4, 5, 6, 7 ].map( ( n ) => ( {
				role: n % 2 ? 'user' : 'assistant',
				text: String( n ),
			} ) ),
		];

		expect( getRecentConversation( messages ) ).toEqual( [
			{ role: 'assistant', text: 'two' },
			{ role: 'user', text: '3' },
			{ role: 'assistant', text: '4' },
			{ role: 'user', text: '5' },
			{ role: 'assistant', text: '6' },
			{ role: 'user', text: '7' },
		] );
	} );
} );
