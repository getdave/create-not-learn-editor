/**
 * External dependencies
 */
import { describe, expect, test, vi } from 'vitest';

/**
 * Internal dependencies
 */
import { findPageInText } from '../target-page';

vi.mock( '@wordpress/core-data', () => ( { store: {} } ) );
vi.mock( '@wordpress/data', () => ( { select: vi.fn() } ) );
vi.mock( '@wordpress/html-entities', () => ( {
	decodeEntities: ( value ) => value,
} ) );

const PAGES = [
	{ id: 4, title: 'Home' },
	{ id: 7, title: 'About' },
	{ id: 8, title: 'About us' },
	{ id: 9, title: 'Café' },
];

describe( 'findPageInText', () => {
	test.each( [
		[ 'add a section to my about page', 7 ],
		[ 'add a testimonials section to About us', 8 ],
		[ 'put a gallery on the café page', 9 ],
		[ 'add a section to my homepage', 4 ],
		[ 'add a section to the home page', 4 ],
	] )( '"%s" names page %s', ( text, id ) => {
		expect( findPageInText( text, PAGES, 4 )?.id ).toBe( id );
	} );

	test( 'needs the whole title, not part of a word', () => {
		expect( findPageInText( 'add a section about cafés', PAGES, 4 ) ).toBe(
			null
		);
		expect( findPageInText( 'add a section', PAGES, 4 ) ).toBe( null );
	} );
} );
