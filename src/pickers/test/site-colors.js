/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { getSiteColors, withSiteColor } from '../site-colors';

const BASE = {
	settings: {
		color: {
			palette: {
				theme: [
					{ slug: 'base', name: 'Base', color: '#ffffff' },
					{ slug: 'contrast', name: 'Contrast', color: '#111111' },
					{ slug: 'accent', name: 'Accent', color: '#2e6b4f' },
				],
			},
		},
	},
	styles: {
		color: {
			background: 'var:preset|color|base',
			text: 'var(--wp--preset--color--contrast)',
		},
		elements: {
			button: {
				color: {
					background: 'var:preset|color|accent',
					text: 'var:preset|color|base',
				},
			},
		},
	},
};

describe( 'getSiteColors', () => {
	it( 'reads the page and button colours as presets', () => {
		expect( getSiteColors( {}, BASE ) ).toEqual( {
			background: 'var:preset|color|base',
			button: 'var:preset|color|accent',
			text: 'var:preset|color|contrast',
		} );
	} );
} );

describe( 'withSiteColor', () => {
	it( 'changes the palette colour behind it', () => {
		const next = withSiteColor( {}, BASE, 'background', '#fdf6e3' );

		expect( next.settings.color.palette.theme[ 0 ] ).toEqual( {
			slug: 'base',
			name: 'Base',
			color: '#fdf6e3',
		} );
		expect( next.styles ).toEqual( {} );
	} );

	it( 'gives button words a colour that reads on a new button', () => {
		const next = withSiteColor( {}, BASE, 'button', '#f2c14e' );

		expect( next.settings.color.palette.theme[ 2 ].color ).toBe(
			'#f2c14e'
		);
		expect( next.styles.elements.button.color.text ).toBe(
			'var:preset|color|contrast'
		);
	} );

	it( 'sets a button sharing the text’s colour on its own', () => {
		const shared = {
			...BASE,
			styles: {
				...BASE.styles,
				elements: {
					button: {
						color: { background: 'var:preset|color|contrast' },
					},
				},
			},
		};
		const next = withSiteColor( {}, shared, 'button', '#2255ff' );

		expect( next.settings ).toEqual( {} );
		expect( next.styles.elements.button.color.background ).toBe(
			'#2255ff'
		);

		const text = withSiteColor( {}, shared, 'text', '#333333' );

		expect( text.settings.color.palette.theme[ 1 ].color ).toBe(
			'#333333'
		);
		// The button keeps the colour it had.
		expect( text.styles.elements.button.color.background ).toBe(
			'#111111'
		);
	} );
} );
