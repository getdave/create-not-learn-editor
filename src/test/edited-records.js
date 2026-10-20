/**
 * External dependencies
 */
import { describe, expect, test } from 'vitest';

/**
 * Internal dependencies
 */
import { getEditedEntityRecords } from '../edited-records';

function createStore( records, edits = {} ) {
	return {
		getEntityRecordEdits: ( kind, name, id ) => edits[ id ],
		getEntityRecords: () => records,
	};
}

const QUERY = { _fields: 'id,title,status' };

describe( 'getEditedEntityRecords', () => {
	const records = [
		{
			id: 1,
			status: 'publish',
			title: { raw: 'About', rendered: 'About' },
		},
		{ id: 2, status: 'draft', title: { raw: 'Visit', rendered: 'Visit' } },
	];

	test( 'returns the saved list when nothing is edited', () => {
		expect(
			getEditedEntityRecords( createStore( records ), 'postType', 'page' )
		).toBe( records );
		expect(
			getEditedEntityRecords( createStore( null ), 'postType', 'page' )
		).toBeNull();
	} );

	test( 'shows an unsaved rename', () => {
		const edited = getEditedEntityRecords(
			createStore( records, { 1: { title: 'About us' } } ),
			'postType',
			'page',
			QUERY
		);

		expect( edited[ 0 ] ).toEqual( {
			id: 1,
			status: 'publish',
			title: 'About us',
		} );
		expect( edited[ 1 ] ).toBe( records[ 1 ] );
	} );

	test( 'leaves out fields the list did not fetch and edits worked out on save', () => {
		const store = createStore( records, {
			2: { blocks: [], content: () => '', meta: {} },
		} );

		expect(
			getEditedEntityRecords( store, 'postType', 'page', QUERY )
		).toBe( records );
	} );

	test( 'keeps the same list while the shown changes stay the same', () => {
		const edits = { 1: { title: 'About us' } };
		const store = createStore( records, edits );
		const first = getEditedEntityRecords( store, 'postType', 'page' );

		// Typing on the page changes its edits, but not its title.
		edits[ 1 ] = { blocks: [], title: 'About us' };

		expect( getEditedEntityRecords( store, 'postType', 'page' ) ).toBe(
			first
		);

		edits[ 1 ] = { title: 'About Fernhouse' };

		const renamed = getEditedEntityRecords( store, 'postType', 'page' );

		expect( renamed ).not.toBe( first );
		expect( renamed[ 0 ].title ).toBe( 'About Fernhouse' );
	} );
} );
