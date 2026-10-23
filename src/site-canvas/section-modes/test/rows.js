/**
 * External dependencies
 */
import { describe, expect, it, vi } from 'vitest';

/**
 * Internal dependencies
 */
import { getRows, withItemAdded, withItemRemoved, withPerRow } from '../rows';

let nextId = 0;

vi.mock( '@wordpress/blocks', () => ( {
	createBlock: ( name, attributes = {}, innerBlocks = [] ) => {
		nextId += 1;

		return { attributes, clientId: `new-${ nextId }`, innerBlocks, name };
	},
	cloneBlock: ( original ) => {
		nextId += 1;

		return { ...original, clientId: `copy-${ nextId }` };
	},
} ) );

function block( name, innerBlocks = [], attributes = {} ) {
	nextId += 1;

	return { attributes, clientId: `${ name }-${ nextId }`, innerBlocks, name };
}

function card( attributes ) {
	return block(
		'core/column',
		[
			block( 'core/image' ),
			block( 'core/heading' ),
			block( 'core/paragraph' ),
		],
		attributes
	);
}

function section( innerBlocks ) {
	return block( 'core/group', innerBlocks );
}

describe( 'getRows', () => {
	it( 'finds a row of columns alike, inside groups', () => {
		const columns = block( 'core/columns', [ card(), card(), card() ] );
		const rows = getRows(
			section( [
				block( 'core/heading' ),
				block( 'core/group', [ columns ] ),
			] )
		);

		expect( rows ).toEqual( [
			expect.objectContaining( {
				canAdd: true,
				canRemove: true,
				clientId: columns.clientId,
				count: 3,
				kind: 'columns',
			} ),
		] );
	} );

	it( 'finds a grid group', () => {
		const grid = block(
			'core/group',
			[ block( 'core/image' ), block( 'core/image' ) ],
			{ layout: { type: 'grid', columnCount: 2 } }
		);

		expect( getRows( section( [ grid ] ) ) ).toEqual( [
			expect.objectContaining( { canRemove: false, kind: 'grid' } ),
		] );
	} );

	it( 'skips columns that are not alike, like an image beside its text', () => {
		const columns = block( 'core/columns', [
			block( 'core/column', [ block( 'core/image' ) ] ),
			block( 'core/column', [
				block( 'core/heading' ),
				block( 'core/paragraph' ),
			] ),
		] );

		expect( getRows( section( [ columns ] ) ) ).toEqual( [] );
	} );

	it( 'skips columns given different widths', () => {
		const columns = block( 'core/columns', [
			card( { width: '66%' } ),
			card( { width: '33%' } ),
		] );

		expect( getRows( section( [ columns ] ) ) ).toEqual( [] );
	} );

	it( 'stops adding at six columns', () => {
		const columns = block(
			'core/columns',
			Array.from( { length: 6 }, () => card() )
		);

		expect( getRows( section( [ columns ] ) )[ 0 ].canAdd ).toBe( false );
	} );
} );

describe( 'withItemAdded', () => {
	it( 'copies the last item to the end by default', () => {
		const columns = block( 'core/columns', [ card(), card() ] );
		const { addedId, blocks } = withItemAdded( columns );

		expect( blocks ).toHaveLength( 3 );
		expect( blocks[ 2 ].clientId ).toBe( addedId );
		expect( blocks[ 2 ].innerBlocks ).toBe(
			columns.innerBlocks[ 1 ].innerBlocks
		);
	} );

	it( 'copies an item in straight after it', () => {
		const columns = block( 'core/columns', [ card(), card(), card() ] );
		const { addedId, blocks } = withItemAdded( columns, 0 );

		expect( blocks.map( ( item ) => item.clientId ) ).toEqual( [
			columns.innerBlocks[ 0 ].clientId,
			addedId,
			columns.innerBlocks[ 1 ].clientId,
			columns.innerBlocks[ 2 ].clientId,
		] );
	} );

	it( 'lets go of equal column widths so the row shares out evenly', () => {
		const columns = block( 'core/columns', [
			card( { width: '50%' } ),
			card( { width: '50%' } ),
		] );
		const { blocks } = withItemAdded( columns );

		expect( blocks.every( ( item ) => ! item.attributes.width ) ).toBe(
			true
		);
	} );
} );

describe( 'withItemRemoved', () => {
	it( 'takes out the item asked for, or the last', () => {
		const columns = block( 'core/columns', [ card(), card(), card() ] );
		const [ first, second, third ] = columns.innerBlocks;

		expect( withItemRemoved( columns, 1 ) ).toEqual( [ first, third ] );
		expect( withItemRemoved( columns ) ).toEqual( [ first, second ] );
	} );
} );

describe( 'withPerRow', () => {
	it( 'changes how many sit side by side in a grid', () => {
		const grid = block( 'core/group', [ card(), card(), card() ], {
			layout: { type: 'grid', columnCount: 3 },
		} );

		expect( withPerRow( grid, 2 ).attributes.layout.columnCount ).toBe( 2 );
	} );

	it( 'turns a row of columns into a grid, so the rest can wrap', () => {
		const columns = block( 'core/columns', [ card(), card(), card() ] );
		const next = withPerRow( columns, 2 );

		expect( next.name ).toBe( 'core/group' );
		expect( next.attributes.layout ).toEqual(
			expect.objectContaining( { columnCount: 2, type: 'grid' } )
		);
		expect( next.innerBlocks ).toHaveLength( 3 );
	} );
} );
