/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import {
	CUSTOM,
	getActiveColor,
	getBackdropColor,
	getColor,
	getColorAttributes,
	isHardToRead,
} from '../color-details';

const CHOICES = [
	{ name: 'Ink', slug: 'ink', color: '#1a1a1a' },
	{ name: 'Sun', slug: 'sun', color: '#e9c46a' },
	{ name: 'White', color: '#ffffff' },
];

describe( 'getActiveColor', () => {
	it( 'is null with no colour set', () => {
		expect( getActiveColor( CHOICES, {}, 'text' ) ).toBeNull();
	} );

	it( 'reads a preset slug of the kind asked for', () => {
		const attributes = { textColor: 'sun', backgroundColor: 'ink' };

		expect( getActiveColor( CHOICES, attributes, 'text' ) ).toBe(
			'preset:sun'
		);
		expect( getActiveColor( CHOICES, attributes, 'background' ) ).toBe(
			'preset:ink'
		);
	} );

	it( 'reads a preset reference in the style', () => {
		expect(
			getActiveColor(
				CHOICES,
				{ style: { color: { background: 'var:preset|color|ink' } } },
				'background'
			)
		).toBe( 'preset:ink' );
	} );

	it( 'matches a colour set by hand to a choice with the same colour', () => {
		expect(
			getActiveColor(
				CHOICES,
				{ style: { color: { text: '#FFF' } } },
				'text'
			)
		).toBe( '#ffffff' );
		expect(
			getActiveColor(
				CHOICES,
				{ style: { color: { background: '#1A1A1A' } } },
				'background'
			)
		).toBe( 'preset:ink' );
	} );

	it( 'is custom for a colour no choice has', () => {
		expect(
			getActiveColor(
				CHOICES,
				{ style: { color: { text: '#123456' } } },
				'text'
			)
		).toBe( CUSTOM );
	} );
} );

describe( 'getColor', () => {
	it( 'resolves a preset to its colour', () => {
		expect(
			getColor( CHOICES, { backgroundColor: 'ink' }, 'background' )
		).toBe( '#1a1a1a' );
	} );

	it( 'gives a colour set by hand as it is', () => {
		expect(
			getColor(
				CHOICES,
				{ style: { color: { text: '#123456' } } },
				'text'
			)
		).toBe( '#123456' );
	} );

	it( 'is null with no colour of that kind set', () => {
		expect(
			getColor( CHOICES, { textColor: 'ink' }, 'background' )
		).toBeNull();
	} );
} );

describe( 'getColorAttributes', () => {
	it( 'saves a palette colour by its slug', () => {
		expect( getColorAttributes( {}, 'text', { slug: 'sun' } ) ).toEqual( {
			textColor: 'sun',
			style: undefined,
		} );
		expect(
			getColorAttributes( {}, 'background', { slug: 'sun' } )
		).toEqual( {
			backgroundColor: 'sun',
			style: undefined,
		} );
	} );

	it( 'saves a colour without a slug in the style', () => {
		expect(
			getColorAttributes( { backgroundColor: 'sun' }, 'background', {
				color: '#fff',
			} )
		).toEqual( {
			backgroundColor: undefined,
			style: { color: { background: '#fff' } },
		} );
	} );

	it( 'clears a colour set by hand when a palette colour is picked', () => {
		expect(
			getColorAttributes(
				{
					style: {
						color: { text: '#123456', background: '#000' },
						typography: { fontStyle: 'italic' },
					},
				},
				'text',
				{ slug: 'ink' }
			)
		).toEqual( {
			textColor: 'ink',
			style: {
				color: { background: '#000' },
				typography: { fontStyle: 'italic' },
			},
		} );
	} );

	it( 'goes back to the default, keeping the other colour and styles', () => {
		expect(
			getColorAttributes(
				{
					backgroundColor: 'ink',
					style: {
						color: { text: '#123456', background: '#000' },
						typography: { fontStyle: 'italic' },
					},
				},
				'background',
				null
			)
		).toEqual( {
			backgroundColor: undefined,
			style: {
				color: { text: '#123456' },
				typography: { fontStyle: 'italic' },
			},
		} );
	} );
} );

describe( 'isHardToRead', () => {
	it( 'flags text without enough contrast', () => {
		expect( isHardToRead( '#e9c46a', '#ffffff' ) ).toBe( true );
	} );

	it( 'passes text with enough contrast', () => {
		expect( isHardToRead( '#1a1a1a', 'rgb(233, 196, 106)' ) ).toBe( false );
	} );

	it( 'passes when the background is not known', () => {
		expect( isHardToRead( '#e9c46a', null ) ).toBe( false );
	} );
} );

describe( 'getBackdropColor', () => {
	function render( html ) {
		document.body.innerHTML = html;
		return document.getElementById( 'text' );
	}

	it( 'finds the nearest solid background', () => {
		expect(
			getBackdropColor(
				render(
					'<div style="background-color: rgb(1, 2, 3)"><div style="background-color: rgba(0, 0, 0, 0)"><p id="text">Hi</p></div></div>'
				)
			)
		).toBe( 'rgb(1, 2, 3)' );
	} );

	it( 'is null over an image', () => {
		expect(
			getBackdropColor(
				render(
					'<div style="background-color: rgb(1, 2, 3)"><div style="background-image: url(a.jpg)"><p id="text">Hi</p></div></div>'
				)
			)
		).toBeNull();
	} );

	it( 'is null in a cover block', () => {
		expect(
			getBackdropColor(
				render(
					'<div style="background-color: rgb(1, 2, 3)"><div class="wp-block-cover"><p id="text">Hi</p></div></div>'
				)
			)
		).toBeNull();
	} );
} );
