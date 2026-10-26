/**
 * External dependencies
 */
import { describe, expect, it, vi } from 'vitest';

/**
 * Internal dependencies
 */
import {
	findQueryBlock,
	getCountOptions,
	getIncludedTermIds,
	getQueryLayout,
	getQueryPostType,
	withTerm,
} from '../posts-section';

vi.mock( '../../../wordpress-packages', () => ( {} ) );

function block( name, attributes = {}, innerBlocks = [] ) {
	return { attributes, clientId: name, innerBlocks, name };
}

function queryLoop( query = {}, layout = { type: 'default' } ) {
	return block( 'core/query', { query }, [
		block( 'core/post-template', { layout } ),
	] );
}

describe( 'findQueryBlock', () => {
	it( 'finds a query loop deep in a section', () => {
		const loop = queryLoop();
		const section = block( 'core/group', {}, [
			block( 'core/heading' ),
			block( 'core/group', {}, [ loop ] ),
		] );

		expect( findQueryBlock( section ) ).toBe( loop );
	} );

	it( 'finds none in a section without one', () => {
		expect(
			findQueryBlock(
				block( 'core/group', {}, [ block( 'core/image' ) ] )
			)
		).toBeNull();
		expect( findQueryBlock( null ) ).toBeNull();
	} );
} );

describe( 'getQueryPostType', () => {
	it( 'is the post type the loop lists', () => {
		expect( getQueryPostType( queryLoop( { postType: 'product' } ) ) ).toBe(
			'product'
		);
	} );

	it( 'is posts for a loop following the page', () => {
		expect(
			getQueryPostType(
				queryLoop( { inherit: true, postType: 'product' } )
			)
		).toBe( 'post' );
	} );
} );

describe( 'getQueryLayout', () => {
	it( 'reads a grid by how many sit side by side', () => {
		expect(
			getQueryLayout(
				queryLoop(
					{ order: 'asc', perPage: 6 },
					{ columnCount: 3, type: 'grid' }
				)
			)
		).toEqual( {
			inherit: false,
			order: 'asc',
			perPage: 6,
			perRow: 3,
			termIds: [],
		} );
	} );

	it( 'reads a list as having no row', () => {
		const layout = getQueryLayout( queryLoop( { perPage: 5 } ) );

		expect( layout.perRow ).toBeNull();
		expect( layout.perPage ).toBe( 5 );
		expect( layout.order ).toBe( 'desc' );
	} );
} );

describe( 'getCountOptions', () => {
	it( 'offers whole rows of a grid', () => {
		expect( getCountOptions( { perRow: 3 } ) ).toEqual( [ 3, 6, 9 ] );
		expect( getCountOptions( { perRow: 4 } ) ).toEqual( [ 4, 8, 12 ] );
	} );

	it( 'offers a few for a list', () => {
		expect( getCountOptions( { perRow: null } ) ).toEqual( [ 3, 5, 10 ] );
	} );
} );

describe( 'getIncludedTermIds', () => {
	it( 'reads the include shape and the older one', () => {
		expect(
			getIncludedTermIds( { include: { category: [ 4 ] }, exclude: {} } )
		).toEqual( [ 4 ] );
		expect( getIncludedTermIds( { category: [ '7' ] } ) ).toEqual( [ 7 ] );
		expect( getIncludedTermIds( undefined ) ).toEqual( [] );
	} );
} );

describe( 'withTerm', () => {
	it( 'limits the query to a term, keeping what is excluded', () => {
		expect(
			withTerm(
				{ perPage: 3, taxQuery: { exclude: { post_tag: [ 2 ] } } },
				'category',
				5
			)
		).toEqual( {
			perPage: 3,
			taxQuery: {
				exclude: { post_tag: [ 2 ] },
				include: { category: [ 5 ] },
			},
		} );
	} );

	it( 'drops the limit for every post', () => {
		expect(
			withTerm(
				{ taxQuery: { include: { category: [ 5 ] } } },
				'category',
				null
			)
		).toEqual( { taxQuery: undefined } );
	} );
} );
