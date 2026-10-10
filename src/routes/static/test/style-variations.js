/**
 * Internal dependencies
 */
import {
	COLOR_PROPERTIES,
	TYPOGRAPHY_PROPERTIES,
	applyPreset,
	areStyleConfigsEqual,
	findActiveLook,
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

	test( 'matches a palette by its colors when a look styled more with them', () => {
		const config = applyPreset(
			{
				settings: eveningLook.settings,
				styles: {
					...eveningLook.styles,
					blocks: {
						'core/group': {
							color: { background: 'var(--accent)' },
						},
					},
				},
			},
			null,
			TYPOGRAPHY_PROPERTIES
		);

		expect(
			findActivePreset( config, [ evening ], COLOR_PROPERTIES )
		).toBe( evening );
	} );

	test( 'matches no palette when the theme colors are in use', () => {
		expect(
			findActivePreset( {}, [ evening ], COLOR_PROPERTIES )
		).toBeUndefined();
	} );

	describe( 'findActiveLook', () => {
		const themeDefault = {};
		const looks = [ themeDefault, eveningLook ];

		test( 'finds the look in use, unchanged', () => {
			expect( findActiveLook( eveningLook, looks ) ).toEqual( {
				hasColorChanges: false,
				hasFontChanges: false,
				look: eveningLook,
			} );
			expect( findActiveLook( {}, looks ) ).toEqual( {
				hasColorChanges: false,
				hasFontChanges: false,
				look: themeDefault,
			} );
		} );

		test( 'keeps the look when only its colors were changed', () => {
			const config = applyPreset( {}, evening, COLOR_PROPERTIES );

			expect( findActiveLook( config, looks ) ).toEqual( {
				hasColorChanges: true,
				hasFontChanges: false,
				look: themeDefault,
			} );
		} );

		test( 'keeps the look when only its fonts were changed', () => {
			const config = applyPreset(
				eveningLook,
				literata,
				TYPOGRAPHY_PROPERTIES
			);

			expect( findActiveLook( config, looks ) ).toEqual( {
				hasColorChanges: false,
				hasFontChanges: true,
				look: eveningLook,
			} );
		} );

		test( 'tells apart looks that differ only in colors', () => {
			expect(
				findActiveLook( evening, [ themeDefault, evening ] )
			).toEqual( {
				hasColorChanges: false,
				hasFontChanges: false,
				look: evening,
			} );
		} );

		test( 'finds no look when the rest of the styles match none', () => {
			const config = {
				styles: {
					blocks: { 'core/image': { border: { radius: '9px' } } },
				},
			};

			expect( findActiveLook( config, looks ) ).toBeNull();
		} );
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
