/**
 * External dependencies
 */
import { describe, expect, test } from 'vitest';

/**
 * Internal dependencies
 */
import {
	getPageTitleFromText,
	getSectionFocusFromText,
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
		[ 'change my header', 'site-part' ],
		[ 'Edit footer', 'site-part' ],
		[ 'a new footer please', 'footer' ],
		[ 'show me header layouts', 'header' ],
		[ 'Change my footer layout', 'footer' ],
		[ 'update my socials', 'social-links' ],
		[ 'Change the social links in my footer', 'social-links' ],
		[ 'add my Instagram', 'social-links' ],
		[ 'Rename my site to Fernhouse', 'site-title' ],
		[ 'change my site title', 'site-title' ],
		[ 'add a logo', 'logo' ],
		[ 'change my site logo', 'logo' ],
		[ 'add a contact page', 'add-page' ],
		[ 'Create a new page called Our story', 'add-page' ],
		[ 'add a testimonials section', 'add-section' ],
		[ 'add a section to my about page', 'add-section' ],
		[ 'add a dark section', 'add-section' ],
		[ 'I need a contact section', 'add-section' ],
		[ 'make a new testimonials section', 'add-section' ],
		[ 'Change this section', 'section-design' ],
		[ 'Change a section', 'section-design' ],
		[ "change this section's colour", 'section-design' ],
		[ 'make this section darker', 'section-design' ],
		[ 'a different layout for the hero section', 'section-design' ],
		[ 'make the hero section brand', 'section-design' ],
		[ 'new colors for this section', 'section-design' ],
		[ 'change my menu', 'menu' ],
		[ 'add the About page to my navigation', 'menu' ],
		[ 'make my header colors warmer', 'colors' ],
		[ 'hi', 'greeting' ],
		[ 'Hello there!', 'greeting' ],
		[ 'hi, change my colours', 'colors' ],
		[ 'thanks!', 'thanks' ],
		[ 'undo that', 'undo' ],
		[ 'exit', 'exit' ],
		[ 'Close', 'exit' ],
		[ 'close the assistant', 'exit' ],
		[ 'quit please', 'exit' ],
		[ "I'm done", 'exit' ],
		[ "that's all, thanks", 'exit' ],
		[ 'thanks!', 'thanks' ],
		[ 'close my footer', 'site-part' ],
	] )( '"%s" asks for %s', ( text, skill ) => {
		expect( matchRequest( text )?.skill ).toBe( skill );
	} );

	test( 'returns null for what it cannot do', () => {
		expect( matchRequest( 'book me a flight to Lisbon' ) ).toBeNull();
		expect( matchRequest( 'change my tagline' ) ).toBeNull();
		expect( matchRequest( 'change the browser icon' ) ).toBeNull();
		expect( matchRequest( '   ' ) ).toBeNull();
	} );

	test( 'passes on what it found in the message', () => {
		expect( matchRequest( 'rename my site to Fernhouse' ) ).toEqual( {
			skill: 'site-title',
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
		[ 'change my site title to Fern & Co', 'Fern & Co' ],
		[ 'rename my site', '' ],
		[ 'add a logo', '' ],
	] )( '"%s" names the site "%s"', ( text, name ) => {
		expect( getSiteNameFromText( text ) ).toBe( name );
	} );
} );

describe( 'header and footer requests', () => {
	test.each( [
		[ 'Edit footer', 'footer' ],
		[ 'change my header', 'header' ],
		[ 'what is at the top of my site?', 'header' ],
		[ 'update my socials', 'footer' ],
		[ 'put my Instagram in the header', 'header' ],
	] )( '"%s" is about the %s', ( text, area ) => {
		expect( matchRequest( text ).params.area ).toBe( area );
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

describe( 'getSectionFocusFromText', () => {
	test.each( [
		[ "change this section's colour", 'color' ],
		[ 'make this section darker', 'color' ],
		[ 'give this section a background', 'color' ],
		[ 'change the layout of this section', 'layout' ],
		[ 'put the image on the right in this section', 'layout' ],
		[ 'change this section', 'both' ],
		[ 'restyle the hero section', 'both' ],
		[ 'change the colour and layout of this section', 'both' ],
	] )( '"%s" is about %s', ( text, focus ) => {
		expect( getSectionFocusFromText( text ) ).toBe( focus );
		expect( matchRequest( text ) ).toEqual( {
			skill: 'section-design',
			params: { focus },
		} );
	} );
} );
