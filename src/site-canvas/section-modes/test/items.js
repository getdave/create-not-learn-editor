/**
 * External dependencies
 */
import { describe, expect, it, vi } from 'vitest';

/**
 * Internal dependencies
 */
import {
	canHoldItems,
	findPlace,
	followPath,
	getAppendPlace,
	getEditableId,
	getItems,
	getRemovalTarget,
} from '../items';

vi.mock( '@wordpress/blocks', () => ( { createBlock: vi.fn() } ) );

let nextId = 0;

function block( name, innerBlocks = [] ) {
	nextId += 1;

	return { clientId: `${ name }-${ nextId }`, innerBlocks, name };
}

function card() {
	return block( 'core/column', [
		block( 'core/image' ),
		block( 'core/heading' ),
		block( 'core/paragraph' ),
	] );
}

/*
 * A section like the theme's: a heading and intro, then a row of three
 * cards, each an image and its words.
 */
function cardsSection() {
	return block( 'core/group', [
		block( 'core/heading' ),
		block( 'core/paragraph' ),
		block( 'core/columns', [ card(), card(), card() ] ),
	] );
}

/*
 * A hero: words and buttons in one column, a picture in the other.
 */
function heroSection() {
	return block( 'core/group', [
		block( 'core/columns', [
			block( 'core/column', [
				block( 'core/heading' ),
				block( 'core/paragraph' ),
				block( 'core/buttons', [ block( 'core/button' ) ] ),
			] ),
			block( 'core/column', [ block( 'core/image' ) ] ),
		] ),
		block( 'core/spacer' ),
	] );
}

describe( 'getItems', () => {
	it( 'takes cards whole, and the words around them one by one', () => {
		const section = cardsSection();
		const [ heading, intro, columns ] = section.innerBlocks;

		expect( getItems( section ).map( ( item ) => item.clientId ) ).toEqual(
			[
				heading.clientId,
				intro.clientId,
				...columns.innerBlocks.map( ( item ) => item.clientId ),
			]
		);
	} );

	it( 'leaves out spacers, and keeps a row of buttons as one item', () => {
		const section = heroSection();
		const [ text, media ] = section.innerBlocks[ 0 ].innerBlocks;

		expect( getItems( section ).map( ( item ) => item.block ) ).toEqual( [
			...text.innerBlocks,
			media.innerBlocks[ 0 ],
		] );
	} );

	it( 'does not take a lone column with a picture as a card', () => {
		const section = block( 'core/group', [
			block( 'core/columns', [ card(), block( 'core/column' ) ] ),
		] );

		expect(
			getItems( section ).map( ( item ) => item.block.name )
		).toEqual( [
			'core/image',
			'core/heading',
			'core/paragraph',
			'core/column',
		] );
	} );
} );

describe( 'findPlace and followPath', () => {
	it( 'finds a block by the path to its parent, and follows it back', () => {
		const section = heroSection();
		const text = section.innerBlocks[ 0 ].innerBlocks[ 0 ];
		const place = findPlace( section, text.innerBlocks[ 1 ].clientId );

		expect( place ).toEqual( {
			index: 1,
			parentId: text.clientId,
			path: [ 0, 0 ],
		} );
		expect( followPath( section, place.path ) ).toBe( text );
	} );

	it( 'falls back to the section when the path no longer leads anywhere', () => {
		const section = heroSection();

		expect( followPath( section, [ 4, 0 ] ) ).toBe( section );
	} );

	it( 'knows nothing of a block outside the section', () => {
		expect( findPlace( heroSection(), 'elsewhere' ) ).toBeNull();
	} );
} );

describe( 'getRemovalTarget', () => {
	it( 'takes the column an item leaves empty along with it', () => {
		const section = heroSection();
		const media = section.innerBlocks[ 0 ].innerBlocks[ 1 ];

		expect(
			getRemovalTarget( section, media.innerBlocks[ 0 ].clientId )
		).toBe( media.clientId );
	} );

	it( 'takes only the item when there is more beside it', () => {
		const section = heroSection();
		const heading =
			section.innerBlocks[ 0 ].innerBlocks[ 0 ].innerBlocks[ 0 ];

		expect( getRemovalTarget( section, heading.clientId ) ).toBe(
			heading.clientId
		);
	} );

	it( 'stops at the section', () => {
		const lone = block( 'core/paragraph' );
		const section = block( 'core/group', [ lone ] );

		expect( getRemovalTarget( section, lone.clientId ) ).toBe(
			lone.clientId
		);
	} );
} );

describe( 'getAppendPlace', () => {
	it( 'goes last, inside the groups that only wrap the content', () => {
		const inner = block( 'core/group', [
			block( 'core/heading' ),
			block( 'core/columns', [ card(), card() ] ),
		] );
		const section = block( 'core/group', [ inner ] );

		expect( getAppendPlace( section ) ).toEqual( {
			index: 2,
			parentId: inner.clientId,
		} );
	} );

	it( 'goes last in the section when it holds more than a wrapper', () => {
		const section = heroSection();

		expect( getAppendPlace( section ) ).toEqual( {
			index: 2,
			parentId: section.clientId,
		} );
	} );
} );

describe( 'canHoldItems', () => {
	it( 'takes a group, even an empty one, but not a lone block', () => {
		expect( canHoldItems( heroSection() ) ).toBe( true );
		expect( canHoldItems( block( 'core/group' ) ) ).toBe( true );
		expect( canHoldItems( block( 'core/paragraph' ) ) ).toBe( false );
	} );
} );

describe( 'getEditableId', () => {
	it( 'puts the caret in the button of a new row of buttons', () => {
		const row = block( 'core/buttons', [ block( 'core/button' ) ] );
		const heading = block( 'core/heading' );

		expect( getEditableId( row ) ).toBe( row.innerBlocks[ 0 ].clientId );
		expect( getEditableId( heading ) ).toBe( heading.clientId );
	} );
} );
