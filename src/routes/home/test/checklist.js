/**
 * Internal dependencies
 */
import {
	getCreationProgress,
	getCreationStepStatus,
	hasBeenEdited,
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
			homepage: false,
			identity: false,
			pages: false,
			styles: false,
		} );

		expect(
			getCreationStepStatus( {
				frontPage: {
					date_gmt: '2026-09-24T10:00:00',
					modified_gmt: '2026-09-25T10:00:00',
				},
				globalStyles: { styles: { spacing: { blockGap: '2rem' } } },
				publishedPageCount: 3,
				site: {
					description: 'Pottery classes',
					show_on_front: 'page',
				},
			} )
		).toEqual( {
			homepage: true,
			identity: true,
			pages: true,
			styles: true,
		} );
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
			percent: 50,
			total: 4,
		} );
	} );
} );
