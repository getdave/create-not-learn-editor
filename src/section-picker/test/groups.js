jest.mock( '@wordpress/blocks', () => ( {
	createBlock: jest.fn(),
	parse: jest.fn(),
} ) );
jest.mock( '@wordpress/core-data', () => ( { store: {} } ) );

/**
 * Internal dependencies
 */
import {
	groupLayouts,
	groupSectionDesigns,
	searchSectionDesigns,
} from '../groups';
import { isLayoutPattern, isSectionPattern } from '../patterns';
import { getPlacementText } from '../placement';

function pattern( name, categories, extra = {} ) {
	return { name, title: name, categories, ...extra };
}

function summarise( groups ) {
	return groups.map( ( group ) => [
		group.name,
		group.patterns.map( ( { name } ) => name ),
	] );
}

describe( 'groupSectionDesigns', () => {
	it( 'groups core categories by purpose, in the order of the groups', () => {
		const groups = groupSectionDesigns(
			[
				pattern( 'quote', [ 'text' ] ),
				pattern( 'hero', [ 'banner' ] ),
				pattern( 'pricing', [ 'services' ] ),
				pattern( 'photos', [ 'gallery' ] ),
				pattern( 'form', [ 'contact' ] ),
				pattern( 'latest', [ 'posts' ] ),
			],
			'Twenty Twenty-Five'
		);

		expect( summarise( groups ) ).toEqual( [
			[ 'introduce', [ 'hero' ] ],
			[ 'sell', [ 'pricing' ] ],
			[ 'showcase', [ 'photos' ] ],
			[ 'write', [ 'quote' ] ],
			[ 'posts', [ 'latest' ] ],
			[ 'contact', [ 'form' ] ],
		] );
	} );

	it( 'puts each design in the first group that takes one of its categories', () => {
		const groups = groupSectionDesigns(
			[ pattern( 'hero', [ 'call-to-action', 'banner' ] ) ],
			'Theme'
		);

		expect( summarise( groups ) ).toEqual( [
			[ 'introduce', [ 'hero' ] ],
		] );
	} );

	it( 'puts theme categories and featured-only designs in the theme group', () => {
		const groups = groupSectionDesigns(
			[
				pattern( 'event', [ 'theme-events' ] ),
				pattern( 'pick', [ 'featured' ] ),
				pattern( 'hero', [ 'featured', 'banner' ] ),
			],
			'Twenty Twenty-Five'
		);

		expect( summarise( groups ) ).toEqual( [
			[ 'introduce', [ 'hero' ] ],
			[ 'theme', [ 'event', 'pick' ] ],
		] );
		expect( groups[ 1 ].label ).toBe( 'From Twenty Twenty-Five' );
	} );

	it( 'names the catch-all group without a theme name', () => {
		const [ group ] = groupSectionDesigns(
			[ pattern( 'event', [ 'theme-events' ] ) ],
			''
		);

		expect( group.label ).toBe( 'More designs' );
	} );

	it( 'leaves out empty groups', () => {
		expect( groupSectionDesigns( [], 'Theme' ) ).toEqual( [] );
	} );
} );

describe( 'searchSectionDesigns', () => {
	const patterns = [
		pattern( 'Hero with image', [ 'banner' ] ),
		pattern( 'Pricing table', [ 'services' ], {
			description: 'Three plans side by side',
		} ),
		pattern( 'Team grid', [ 'team' ], { keywords: [ 'staff', 'people' ] } ),
		pattern( 'Café menu', [ 'text' ] ),
	];
	const names = ( results ) => results.map( ( { name } ) => name );

	it( 'returns every design for an empty search', () => {
		expect( searchSectionDesigns( patterns, '  ' ) ).toBe( patterns );
	} );

	it( 'matches titles, descriptions and keywords', () => {
		expect( names( searchSectionDesigns( patterns, 'hero' ) ) ).toEqual( [
			'Hero with image',
		] );
		expect( names( searchSectionDesigns( patterns, 'plans' ) ) ).toEqual( [
			'Pricing table',
		] );
		expect( names( searchSectionDesigns( patterns, 'Staff' ) ) ).toEqual( [
			'Team grid',
		] );
	} );

	it( 'needs every word to match, ignoring accents', () => {
		expect(
			names( searchSectionDesigns( patterns, 'team people' ) )
		).toEqual( [ 'Team grid' ] );
		expect( searchSectionDesigns( patterns, 'team pricing' ) ).toEqual(
			[]
		);
		expect( names( searchSectionDesigns( patterns, 'cafe' ) ) ).toEqual( [
			'Café menu',
		] );
	} );
} );

describe( 'isSectionPattern', () => {
	it( 'leaves out site parts, menus and query loops', () => {
		expect( isSectionPattern( pattern( 'a', [ 'header' ] ) ) ).toBe(
			false
		);
		expect( isSectionPattern( pattern( 'b', [ 'navigation' ] ) ) ).toBe(
			false
		);
		expect( isSectionPattern( pattern( 'c', [ 'query' ] ) ) ).toBe( false );
		expect( isSectionPattern( pattern( 'd', [ 'banner' ] ) ) ).toBe( true );
	} );
} );

describe( 'groupLayouts', () => {
	it( 'groups layouts by shape, in the order of the groups', () => {
		const groups = groupLayouts( [
			pattern( 'intro', [ 'cnl-layouts', 'cnl-layouts-text' ] ),
			pattern( 'hero', [ 'cnl-layouts', 'cnl-layouts-banners' ] ),
			pattern( 'quote', [ 'cnl-layouts', 'cnl-layouts-text' ] ),
		] );

		expect( summarise( groups ) ).toEqual( [
			[ 'layout-banners', [ 'hero' ] ],
			[ 'layout-text', [ 'intro', 'quote' ] ],
		] );
	} );

	it( 'puts layouts without a known group last', () => {
		const groups = groupLayouts( [
			pattern( 'odd', [ 'cnl-layouts' ] ),
			pattern( 'hero', [ 'cnl-layouts', 'cnl-layouts-banners' ] ),
		] );

		expect( summarise( groups ) ).toEqual( [
			[ 'layout-banners', [ 'hero' ] ],
			[ 'layout-more', [ 'odd' ] ],
		] );
	} );
} );

describe( 'isLayoutPattern', () => {
	it( 'tells layouts apart from designs', () => {
		expect( isLayoutPattern( pattern( 'a', [ 'cnl-layouts' ] ) ) ).toBe(
			true
		);
		expect( isLayoutPattern( pattern( 'b', [ 'banner' ] ) ) ).toBe( false );
		expect( isLayoutPattern( pattern( 'c' ) ) ).toBe( false );
	} );

	it( 'counts layouts as sections', () => {
		expect( isSectionPattern( pattern( 'a', [ 'cnl-layouts' ] ) ) ).toBe(
			true
		);
	} );
} );

describe( 'getPlacementText', () => {
	it( 'says where the section will go', () => {
		expect( getPlacementText( null, null ) ).toBe(
			'It will be the first thing on the page.'
		);
		expect( getPlacementText( null, 'Hero' ) ).toBe(
			'It will go at the top, above “Hero”.'
		);
		expect( getPlacementText( 'Hero', 'Story' ) ).toBe(
			'It will go after “Hero”.'
		);
		expect( getPlacementText( 'Story', null ) ).toBe(
			'It will go at the end of the page.'
		);
	} );
} );
