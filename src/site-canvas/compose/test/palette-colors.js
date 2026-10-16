/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import {
	getContrast,
	getPaletteColorSets,
	getPresetSlug,
	parseColor,
	resolveColor,
} from '../palette-colors';

function makePalette( colors ) {
	return Object.entries( colors ).map( ( [ slug, color ] ) => ( {
		color,
		name: slug.charAt( 0 ).toUpperCase() + slug.slice( 1 ),
		slug,
	} ) );
}

// Twenty Twenty-Four's and Twenty Twenty-Three's palettes.
const TT4 = makePalette( {
	base: '#f9f9f9',
	'base-2': '#ffffff',
	contrast: '#111111',
	'contrast-2': '#636363',
	'contrast-3': '#A4A4A4',
	accent: '#cfcabe',
	'accent-2': '#c2a990',
	'accent-3': '#d8613c',
	'accent-4': '#b1c5a4',
	'accent-5': '#b5bdbc',
} );
const TT3 = makePalette( {
	base: '#ffffff',
	contrast: '#000000',
	primary: '#9DFF20',
	secondary: '#345C00',
	tertiary: '#F6F6F6',
} );

const summarise = ( sets ) =>
	sets.map( ( { name, background, text, invertButton } ) => [
		name,
		background,
		text,
		invertButton,
	] );

describe( 'colours', () => {
	it( 'reads preset slugs written either way', () => {
		expect( getPresetSlug( 'var:preset|color|base' ) ).toBe( 'base' );
		expect( getPresetSlug( 'var(--wp--preset--color--base-2)' ) ).toBe(
			'base-2'
		);
		expect( getPresetSlug( '#fff' ) ).toBeNull();
	} );

	it( 'resolves presets against the palette', () => {
		expect( resolveColor( 'var:preset|color|primary', TT3 ) ).toBe(
			'#9DFF20'
		);
		expect( resolveColor( '#123', TT3 ) ).toBe( '#123' );
	} );

	it( 'parses hex and rgb colours', () => {
		expect( parseColor( '#fff' ) ).toEqual( [ 255, 255, 255 ] );
		expect( parseColor( '#d8613c' ) ).toEqual( [ 216, 97, 60 ] );
		expect( parseColor( 'rgb(1, 2, 3)' ) ).toEqual( [ 1, 2, 3 ] );
		expect( parseColor( 'color-mix(in srgb, red, blue)' ) ).toBeNull();
	} );

	it( 'measures contrast as WCAG does', () => {
		expect( getContrast( [ 0, 0, 0 ], [ 255, 255, 255 ] ) ).toBeCloseTo(
			21
		);
		expect( getContrast( [ 9, 9, 9 ], [ 9, 9, 9 ] ) ).toBe( 1 );
	} );
} );

describe( 'getPaletteColorSets', () => {
	it( 'makes a soft, a dark and an accent set from a light theme', () => {
		expect(
			summarise(
				getPaletteColorSets( {
					background: 'base',
					button: '#111111',
					palette: TT4,
					text: 'contrast',
				} )
			)
		).toEqual( [
			[ 'palette-soft', 'base-2', 'contrast', false ],
			// The theme's dark buttons would vanish on a dark background.
			[ 'palette-inverse', 'contrast', 'base', true ],
			[ 'palette-accent-accent-3', 'accent-3', 'contrast', false ],
		] );
	} );

	it( 'puts readable text on each accent', () => {
		expect(
			summarise(
				getPaletteColorSets( {
					background: 'base',
					button: '#9DFF20',
					palette: TT3,
					text: 'contrast',
				} )
			)
		).toEqual( [
			[ 'palette-soft', 'tertiary', 'contrast', false ],
			[ 'palette-inverse', 'contrast', 'base', false ],
			[ 'palette-accent-primary', 'primary', 'contrast', true ],
			[ 'palette-accent-secondary', 'secondary', 'base', false ],
		] );
	} );

	it( 'names the swapped set for the page it swaps', () => {
		const [ inverse ] = getPaletteColorSets( {
			background: 'contrast',
			palette: TT3,
			text: 'base',
		} ).filter( ( set ) => set.name === 'palette-inverse' );

		expect( inverse.label ).toBe( 'Light' );
	} );

	it( 'leaves out accents text can’t be read on', () => {
		const sets = getPaletteColorSets( {
			background: 'base',
			palette: makePalette( {
				base: '#ffffff',
				contrast: '#000000',
				mid: '#e00000',
			} ),
			text: 'contrast',
		} );

		expect( sets.map( ( set ) => set.name ) ).toEqual( [
			'palette-inverse',
			'palette-accent-mid',
		] );
		expect(
			getPaletteColorSets( {
				background: 'base',
				palette: makePalette( {
					base: '#ffffff',
					contrast: '#555555',
					mid: '#e04000',
				} ),
				text: 'contrast',
			} ).map( ( set ) => set.name )
		).toEqual( [ 'palette-inverse' ] );
	} );

	it( 'makes none without the page’s colours in the palette', () => {
		expect(
			getPaletteColorSets( {
				background: undefined,
				palette: TT3,
				text: 'contrast',
			} )
		).toEqual( [] );
	} );
} );
