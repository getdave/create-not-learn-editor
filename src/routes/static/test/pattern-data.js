/**
 * External dependencies
 */
import { describe, expect, test, vi } from 'vitest';

vi.mock( '../../../wordpress-packages', () => ( {
	__: ( text ) => text,
} ) );

/**
 * Internal dependencies
 */
import {
	getPatternCategoryChips,
	getPatternCategoryLabels,
	getPatternDescription,
	getPatternsForTab,
	getPatternSyncStatusLabel,
	getPatternTitle,
	getPatternTypeLabel,
	normalizeThemePattern,
	normalizeUserPattern,
	PATTERN_SYNC_STATUS,
	PATTERN_TYPES,
} from '../pattern-data';

describe( 'pattern data', () => {
	test( 'titles and descriptions drop markup and decode entities', () => {
		expect( getPatternTitle( { title: '<em>Hero</em> &amp; CTA' } ) ).toBe(
			'Hero & CTA'
		);
		expect( getPatternTitle( {} ) ).toBe( 'Untitled pattern' );
		expect( getPatternDescription( { description: ' A&nbsp;row ' } ) ).toBe(
			'A row'
		);
		expect( getPatternDescription( null ) ).toBe( '' );
	} );

	test( 'labels the sync status and where a pattern comes from', () => {
		expect(
			getPatternSyncStatusLabel( PATTERN_SYNC_STATUS.unsynced )
		).toBe( 'Not synced' );
		expect( getPatternSyncStatusLabel( PATTERN_SYNC_STATUS.full ) ).toBe(
			'Synced'
		);
		expect( getPatternTypeLabel( PATTERN_TYPES.user ) ).toBe(
			'Saved by you'
		);
		expect( getPatternTypeLabel( PATTERN_TYPES.theme ) ).toBe(
			'From your theme'
		);
	} );

	test( 'lists category labels, falling back to the slug', () => {
		const categoryMap = new Map( [ [ 'hero', 'Hero' ] ] );

		expect(
			getPatternCategoryLabels(
				{ categories: [ 'hero', 'footer' ] },
				categoryMap
			)
		).toBe( 'Hero, footer' );
		expect( getPatternCategoryLabels( {}, categoryMap ) ).toBe(
			'Uncategorized'
		);
	} );

	test( 'normalizes a theme pattern', () => {
		expect(
			normalizeThemePattern( {
				categories: [ 'hero' ],
				content: '<!-- wp:paragraph /-->',
				name: 'mainstay/hero',
				title: 'Hero',
				viewportWidth: 1200,
			} )
		).toEqual( {
			categories: [ 'hero' ],
			content: '<!-- wp:paragraph /-->',
			description: '',
			id: 'theme:mainstay/hero',
			keywords: [],
			name: 'mainstay/hero',
			syncStatus: PATTERN_SYNC_STATUS.unsynced,
			title: 'Hero',
			type: PATTERN_TYPES.theme,
			viewportWidth: 1200,
		} );
		expect( normalizeThemePattern( { name: 'a/b' } ).title ).toBe( 'a/b' );
	} );

	test( 'normalizes a user pattern from its REST record', () => {
		const userCategories = [
			{ id: 3, name: 'Hero' },
			{ id: 4, name: 'Footer' },
		];

		expect(
			normalizeUserPattern(
				{
					content: { raw: '<!-- wp:group /-->' },
					excerpt: { raw: 'A saved hero' },
					id: 42,
					title: { raw: 'My hero' },
					wp_pattern_category: [ '4', 99 ],
				},
				userCategories
			)
		).toEqual( {
			categories: [ 'Footer' ],
			content: '<!-- wp:group /-->',
			description: 'A saved hero',
			id: 'user:42',
			keywords: [],
			name: '42',
			recordId: 42,
			syncStatus: PATTERN_SYNC_STATUS.full,
			title: 'My hero',
			type: PATTERN_TYPES.user,
		} );

		const unsynced = normalizeUserPattern(
			{
				content: 'raw string',
				id: 7,
				title: 'Plain',
				wp_pattern_sync_status: 'unsynced',
			},
			userCategories
		);

		expect( unsynced.categories ).toEqual( [] );
		expect( unsynced.content ).toBe( 'raw string' );
		expect( unsynced.syncStatus ).toBe( PATTERN_SYNC_STATUS.unsynced );
		expect( unsynced.title ).toBe( 'Plain' );
	} );

	test( 'filters patterns by tab', () => {
		const user = { type: PATTERN_TYPES.user };
		const theme = { type: PATTERN_TYPES.theme };
		const patterns = [ user, theme ];

		expect( getPatternsForTab( patterns, 'my-patterns' ) ).toEqual( [
			user,
		] );
		expect( getPatternsForTab( patterns, 'registered' ) ).toEqual( [
			theme,
		] );
		expect( getPatternsForTab( patterns, 'all' ) ).toBe( patterns );
	} );

	test( 'offers the ten most common categories as chips, sorted by label', () => {
		const categoryMap = new Map( [
			[ 'hero', 'Hero' ],
			[ 'about', 'About' ],
		] );
		const patterns = [
			{ categories: [ 'hero', 'about' ] },
			{ categories: [ 'hero' ] },
			...Array.from( { length: 10 }, ( _, index ) => ( {
				categories: [ `extra-${ index }`, 'hero', 'about' ],
			} ) ),
			{ categories: [ 'rare' ] },
		];

		const chips = getPatternCategoryChips( patterns, categoryMap );

		expect( chips ).toHaveLength( 10 );
		expect( chips[ 0 ] ).toEqual( { label: 'About', value: 'about' } );
		expect( chips.map( ( chip ) => chip.value ) ).toContain( 'hero' );
		expect( chips.map( ( chip ) => chip.value ) ).not.toContain( 'rare' );
	} );
} );
