/**
 * External dependencies
 */
import { describe, expect, test } from 'vitest';

/**
 * Internal dependencies
 */
import {
	getPageTitleFromText,
	getSectionSearchFromText,
	getSiteNameFromText,
	isConfirmation,
	matchRequest,
} from '../engine';

describe( 'matchRequest', () => {
	test.each( [
		[ 'update my site colours', 'colors' ],
		[ 'Can you make it darker?', 'colors' ],
		[ 'change the palette', 'colors' ],
		[ 'I want different fonts', 'fonts' ],
		[ 'Try a new look', 'look' ],
		[ 'restyle my site', 'look' ],
		[ 'change my header', 'header' ],
		[ 'a new footer please', 'footer' ],
		[ 'Rename my site to Fernhouse', 'identity' ],
		[ 'add a logo', 'identity' ],
		[ 'add a contact page', 'add-page' ],
		[ 'Create a new page called Our story', 'add-page' ],
		[ 'add a testimonials section', 'add-section' ],
		[ 'add a section to my about page', 'add-section' ],
		[ 'change my menu', 'menu' ],
		[ 'add the About page to my navigation', 'menu' ],
		[ 'make my header colors warmer', 'colors' ],
		[ 'hi', 'greeting' ],
		[ 'Hello there!', 'greeting' ],
		[ 'hi, change my colours', 'colors' ],
		[ 'thanks!', 'thanks' ],
		[ 'undo that', 'undo' ],
	] )( '"%s" asks for %s', ( text, skill ) => {
		expect( matchRequest( text )?.skill ).toBe( skill );
	} );

	test( 'returns null for what it cannot do', () => {
		expect( matchRequest( 'book me a flight to Lisbon' ) ).toBeNull();
		expect( matchRequest( '   ' ) ).toBeNull();
	} );

	test( 'passes on what it found in the message', () => {
		expect( matchRequest( 'rename my site to Fernhouse' ) ).toEqual( {
			skill: 'identity',
			params: { name: 'Fernhouse' },
		} );
		expect( matchRequest( 'add a contact page' ) ).toEqual( {
			skill: 'add-page',
			params: { title: 'Contact' },
		} );
		expect( matchRequest( 'add a testimonials section' ) ).toEqual( {
			skill: 'add-section',
			params: { search: 'testimonials' },
		} );
	} );
} );

describe( 'getSiteNameFromText', () => {
	test.each( [
		[ 'rename my site to Fernhouse', 'Fernhouse' ],
		[ 'Call my website “The Potting Shed”', 'The Potting Shed' ],
		[
			'change the name of my site to Mill Lane Plants.',
			'Mill Lane Plants',
		],
		[ 'set my site’s name to Fern & Co', 'Fern & Co' ],
		[ 'rename my site', '' ],
		[ 'add a logo', '' ],
	] )( '"%s" names the site "%s"', ( text, name ) => {
		expect( getSiteNameFromText( text ) ).toBe( name );
	} );
} );

describe( 'getPageTitleFromText', () => {
	test.each( [
		[ 'add a contact page', 'Contact' ],
		[ 'create a new about us page', 'About Us' ],
		[ 'make a page called Opening hours', 'Opening hours' ],
		[ 'add a page', '' ],
		[ 'add a new page', '' ],
	] )( '"%s" asks for a page called "%s"', ( text, title ) => {
		expect( getPageTitleFromText( text ) ).toBe( title );
	} );
} );

describe( 'getSectionSearchFromText', () => {
	test.each( [
		[ 'add a testimonials section', 'testimonials' ],
		[ 'Add an FAQ section to this page', 'FAQ' ],
		[ 'add a section with our team', 'team' ],
		[ 'add a section', '' ],
		[ 'add a new section', '' ],
	] )( '"%s" searches for "%s"', ( text, search ) => {
		expect( getSectionSearchFromText( text ) ).toBe( search );
	} );
} );

describe( 'isConfirmation', () => {
	test.each( [ 'yes', 'Save it', 'looks good!', 'ok', 'that one' ] )(
		'"%s" confirms',
		( text ) => {
			expect( isConfirmation( text ) ).toBe( true );
		}
	);

	test.each( [ 'yes, and change my fonts', 'change my header' ] )(
		'"%s" asks for more',
		( text ) => {
			expect( isConfirmation( text ) ).toBe( false );
		}
	);
} );
