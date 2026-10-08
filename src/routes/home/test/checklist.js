/**
 * Internal dependencies
 */
import {
	getCreationProgress,
	getCreationStepStatus,
	hasBeenEdited,
	hasCustomColors,
	hasCustomFonts,
	hasCustomGlobalStyles,
} from '../checklist';

describe( 'creation checklist', () => {
	test( 'treats empty global styles as the theme defaults', () => {
		expect( hasCustomGlobalStyles( undefined ) ).toBe( false );
		expect(
			hasCustomGlobalStyles( { settings: {}, styles: { color: {} } } )
		).toBe( false );
		expect(
			hasCustomGlobalStyles( {
				styles: { color: { background: '#fff' } },
			} )
		).toBe( true );
	} );

	test( 'tells a colour change apart from a font change', () => {
		const colors = { styles: { color: { background: '#fff' } } };
		const fonts = {
			settings: {
				typography: {
					fontFamilies: { theme: [ { slug: 'body' } ] },
				},
			},
		};

		expect( hasCustomColors( colors ) ).toBe( true );
		expect( hasCustomFonts( colors ) ).toBe( false );

		expect( hasCustomFonts( fonts ) ).toBe( true );
		expect( hasCustomColors( fonts ) ).toBe( false );

		expect( hasCustomColors( undefined ) ).toBe( false );
		expect( hasCustomFonts( undefined ) ).toBe( false );
	} );

	test( 'counts a whole-site look as both a colour and a font change', () => {
		const look = {
			settings: { color: { palette: { theme: [] } } },
			styles: {
				color: { background: '#fff' },
				typography: { fontFamily: 'var:preset|font-family|body' },
			},
		};

		expect( hasCustomColors( look ) ).toBe( true );
		expect( hasCustomFonts( look ) ).toBe( true );
	} );

	test( 'only counts a page as edited when saved after creation', () => {
		expect(
			hasBeenEdited( {
				date_gmt: '2026-09-24T10:00:00',
				modified_gmt: '2026-09-24T10:00:05',
			} )
		).toBe( false );
		expect(
			hasBeenEdited( {
				date_gmt: '2026-09-24T10:00:00',
				modified_gmt: '2026-09-24T12:00:00',
			} )
		).toBe( true );
		expect( hasBeenEdited( {} ) ).toBe( false );
	} );

	test( 'works out each step from site data', () => {
		expect( getCreationStepStatus() ).toEqual( {
			colors: false,
			fonts: false,
			homepage: false,
			identity: false,
			pages: false,
		} );

		expect(
			getCreationStepStatus( {
				frontPage: {
					date_gmt: '2026-09-24T10:00:00',
					modified_gmt: '2026-09-25T10:00:00',
				},
				globalStyles: {
					styles: {
						color: { background: '#fff' },
						typography: {
							fontFamily: 'var:preset|font-family|body',
						},
					},
				},
				publishedPageCount: 3,
				site: {
					description: 'Pottery classes',
					show_on_front: 'page',
				},
			} )
		).toEqual( {
			colors: true,
			fonts: true,
			homepage: true,
			identity: true,
			pages: true,
		} );
	} );

	test( 'leaves the fonts step open when only colors were changed', () => {
		const status = getCreationStepStatus( {
			globalStyles: { styles: { color: { background: '#fff' } } },
		} );

		expect( status.colors ).toBe( true );
		expect( status.fonts ).toBe( false );
	} );

	test( 'does not count the homepage step for a latest posts front page', () => {
		expect(
			getCreationStepStatus( {
				frontPage: {
					date_gmt: '2026-09-24T10:00:00',
					modified_gmt: '2026-09-25T10:00:00',
				},
				site: { show_on_front: 'posts' },
			} ).homepage
		).toBe( false );
	} );

	test( 'reports progress', () => {
		expect(
			getCreationProgress( { identity: true, pages: true } )
		).toEqual( {
			done: 2,
			percent: 40,
			total: 5,
		} );
	} );
} );
