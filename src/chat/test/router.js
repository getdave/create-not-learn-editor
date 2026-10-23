/**
 * External dependencies
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * Internal dependencies
 */
import { routeWithDecisionModel } from '../decision-model';
import { getRecentConversation, routeByScript, routeRequest } from '../router';

vi.mock( '../decision-model', () => ( {
	routeWithDecisionModel: vi.fn(),
} ) );

beforeEach( () => {
	routeWithDecisionModel.mockReset();
	routeWithDecisionModel.mockResolvedValue( null );
} );

describe( 'routeByScript', () => {
	test.each( [
		[ 'change my colours', 'colors' ],
		[ 'Can you show me some different palettes?', 'colors' ],
		[ 'I want new fonts', 'fonts' ],
		[ 'try a new look', 'look' ],
		[ 'change my header', 'header' ],
		[ 'show me footer layouts', 'footer' ],
		[ 'edit my menu', 'menu' ],
		[ 'upload a logo', 'logo' ],
		[ 'make this section darker', 'section-design' ],
		[ 'Change the selected section’s layout', 'section-design' ],
		[ 'undo that', 'undo' ],
		[ 'hi there', 'greeting' ],
		[ 'thanks so much', 'thanks' ],
		[ "I'm done", 'exit' ],
	] )( 'answers "%s" with %s', ( text, skill ) => {
		expect( routeByScript( text )?.skill ).toBe( skill );
	} );

	test( 'keeps the name a site is renamed to', () => {
		expect( routeByScript( 'rename my site to Waterfish Co' ) ).toEqual( {
			skill: 'site-title',
			params: { name: 'Waterfish Co' },
		} );
	} );

	test.each( [
		// More than the picker answers.
		'make my colours blue and orange',
		'make the header text say Welcome',
		'undo the heading I changed on the canvas',
		'thanks, now add a page',
		// Refers back to the conversation.
		'make it darker',
		// The model can write these.
		'add a contact page',
		'add a page called Waterfish',
		'add a testimonials section',
		// Asks for a name to be made up.
		'rename my site to something catchier',
		// Nothing the script knows.
		'what can you do?',
	] )( 'leaves "%s" to the model', ( text ) => {
		expect( routeByScript( text ) ).toBeNull();
	} );
} );

describe( 'routeRequest', () => {
	test( 'answers from the script first', async () => {
		expect( await routeRequest( 'change my colours' ) ).toEqual( {
			skill: 'colors',
			params: {},
		} );
		expect( routeWithDecisionModel ).not.toHaveBeenCalled();
	} );

	test( 'asks the decision model what the script can’t place', async () => {
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

	test( 'leaves the rest to the model', async () => {
		expect( await routeRequest( 'make my colours blue' ) ).toBeNull();
		expect( await routeRequest( '  ' ) ).toBeNull();
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
