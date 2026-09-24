/**
 * Internal dependencies
 */
import {
	COLOR_PROPERTIES,
	TYPOGRAPHY_PROPERTIES,
	applyPreset,
	areStyleConfigsEqual,
	findActivePreset,
	groupStyleVariations,
	setValueAtPath,
} from '../style-variations';

const evening = {
	title: 'Evening',
	settings: {
		color: { palette: { theme: [ { slug: 'base', color: '#000' } ] } },
	},
	styles: { color: { background: '#000' } },
};
const eveningLook = {
	title: 'Evening',
	settings: evening.settings,
	styles: {
		...evening.styles,
		elements: { button: { border: { radius: '4px' } } },
	},
};
const literata = {
	title: 'Literata',
	settings: { typography: { fontFamilies: { theme: [ { slug: 'lit' } ] } } },
	styles: { typography: { fontFamily: 'var(--lit)' } },
};
const noon = {
	title: 'Noon',
	settings: { ...evening.settings, ...literata.settings },
	styles: { ...evening.styles, ...literata.styles },
};

describe( 'style variations', () => {
	test( 'sorts variations into looks, colors, and fonts', () => {
		const groups = groupStyleVariations( [
			eveningLook,
			noon,
			evening,
			literata,
			{ ...noon },
		] );

		expect( groups.looks.map( ( v ) => v.title ) ).toEqual( [
			'Evening',
			'Noon',
		] );
		expect( groups.colors.map( ( v ) => v.title ) ).toEqual( [
			'Evening',
		] );
		expect( groups.fonts.map( ( v ) => v.title ) ).toEqual( [
			'Literata',
		] );
	} );

	test( 'applies a color preset without touching fonts', () => {
		const config = applyPreset( literata, evening, COLOR_PROPERTIES );

		expect( areStyleConfigsEqual( config, noon ) ).toBe( true );
		expect(
			findActivePreset( config, [ evening ], COLOR_PROPERTIES )
		).toBe( evening );
		expect(
			findActivePreset( config, [ literata ], TYPOGRAPHY_PROPERTIES )
		).toBe( literata );
	} );

	test( 'resets a group of properties when no preset is given', () => {
		expect(
			areStyleConfigsEqual(
				applyPreset( noon, null, TYPOGRAPHY_PROPERTIES ),
				evening
			)
		).toBe( true );
	} );

	test( 'sets and clears single values', () => {
		const config = setValueAtPath(
			{},
			[ 'styles', 'spacing', 'blockGap' ],
			'2rem'
		);

		expect( config ).toEqual( {
			settings: {},
			styles: { spacing: { blockGap: '2rem' } },
		} );
		expect(
			setValueAtPath(
				config,
				[ 'styles', 'spacing', 'blockGap' ],
				undefined
			)
		).toEqual( { settings: {}, styles: {} } );
	} );
} );
