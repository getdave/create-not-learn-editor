/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import {
	getBlockIndex,
	getWritingSections,
	isWritingType,
} from '../writing-mode';

const NAMES = {
	cover: 'core/cover',
	group: 'core/group',
	heading: 'core/heading',
	image: 'core/image',
	list: 'core/list',
	p1: 'core/paragraph',
	p2: 'core/paragraph',
	p3: 'core/paragraph',
};

const getName = ( clientId ) => NAMES[ clientId ];

describe( 'isWritingType', () => {
	it( 'puts posts in writing mode and leaves pages with sections', () => {
		expect( isWritingType( 'post' ) ).toBe( true );
		expect( isWritingType( 'page' ) ).toBe( false );
		expect( isWritingType( 'wp_template' ) ).toBe( false );
	} );
} );

describe( 'getWritingSections', () => {
	it( 'makes writing with no containers one section of text', () => {
		expect(
			getWritingSections( [ 'heading', 'p1', 'image', 'list' ], getName )
		).toEqual( [
			{ clientIds: [ 'heading', 'p1', 'image', 'list' ], isText: true },
		] );
	} );

	it( 'gives each container a section, and each run between them one', () => {
		expect(
			getWritingSections(
				[ 'p1', 'p2', 'cover', 'group', 'p3', 'image' ],
				getName
			)
		).toEqual( [
			{ clientIds: [ 'p1', 'p2' ], isText: true },
			{ clientIds: [ 'cover' ], isText: false },
			{ clientIds: [ 'group' ], isText: false },
			{ clientIds: [ 'p3', 'image' ], isText: true },
		] );
	} );

	it( 'has no sections without blocks', () => {
		expect( getWritingSections( [], getName ) ).toEqual( [] );
	} );
} );

describe( 'getBlockIndex', () => {
	// Blocks: a b | C | d e f | G
	const sections = [
		{ clientIds: [ 'a', 'b' ] },
		{ clientIds: [ 'C' ] },
		{ clientIds: [ 'd', 'e', 'f' ] },
		{ clientIds: [ 'G' ] },
	];

	it( 'moves a section up past a run of text', () => {
		// a b | C | G | d e f: G goes to where d was.
		expect( getBlockIndex( sections, 3, 2 ) ).toBe( 3 );
	} );

	it( 'moves a run of text down past a container', () => {
		// a b | C | G | d e f, counted without d e f.
		expect( getBlockIndex( sections, 2, 3 ) ).toBe( 4 );
	} );

	it( 'moves a section to the top', () => {
		expect( getBlockIndex( sections, 1, 0 ) ).toBe( 0 );
	} );

	it( 'places a new section between others', () => {
		expect( getBlockIndex( sections, -1, 2 ) ).toBe( 3 );
		expect( getBlockIndex( sections, -1, 4 ) ).toBe( 7 );
	} );
} );
