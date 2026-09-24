/**
 * Internal dependencies
 */
import {
	buildPageTree,
	countPageTree,
	filterPageTree,
	getPageAncestorTitles,
	getPageDropTarget,
	getPageKeyboardTarget,
	getPageMoveChanges,
} from '../page-tree';

const getTitle = ( page ) => page.title;
const pages = [
	{ id: 1, menu_order: 2, parent: 0, title: 'Services' },
	{ id: 2, menu_order: 1, parent: 0, title: 'About' },
	{ id: 3, menu_order: 0, parent: 2, title: 'Team' },
	{ id: 4, menu_order: 0, parent: 1, title: 'Design' },
	{ id: 5, menu_order: 0, parent: 0, title: 'Home' },
	{ id: 6, menu_order: 0, parent: 99, title: 'Orphan' },
];

function titles( tree ) {
	return tree.map( ( node ) =>
		node.children.length
			? [ node.page.title, titles( node.children ) ]
			: node.page.title
	);
}

describe( 'page tree', () => {
	test( 'nests pages under parents and leads with the homepage', () => {
		const tree = buildPageTree( pages, { frontPageId: 5 } );

		expect( titles( tree ) ).toEqual( [
			'Home',
			'Orphan',
			[ 'About', [ 'Team' ] ],
			[ 'Services', [ 'Design' ] ],
		] );
		expect( countPageTree( tree ) ).toBe( 6 );
	} );

	test( 'does not loop on a page that is its own ancestor', () => {
		const tree = buildPageTree( [
			{ id: 1, parent: 2, title: 'A' },
			{ id: 2, parent: 1, title: 'B' },
			{ id: 3, parent: 3, title: 'C' },
		] );

		expect( titles( tree ) ).toEqual( [ 'C' ] );
	} );

	test( 'keeps matches and the parents leading to them', () => {
		const tree = filterPageTree( buildPageTree( pages ), 'des', getTitle );

		expect( titles( tree ) ).toEqual( [ [ 'Services', [ 'Design' ] ] ] );
	} );

	test( 'lists ancestor titles, nearest last', () => {
		const nested = [ ...pages, { id: 7, parent: 3, title: 'Leaders' } ];

		expect( getPageAncestorTitles( nested, 7, getTitle ) ).toEqual( [
			'About',
			'Team',
		] );
		expect( getPageAncestorTitles( nested, 2, getTitle ) ).toEqual( [] );
	} );

	describe( 'moving pages', () => {
		// Home, Orphan, About > [Team], Services > [Design]
		const tree = buildPageTree( pages, { frontPageId: 5 } );

		test( 'drops beside, inside, and first under an open parent', () => {
			expect( getPageDropTarget( tree, 6, 1, 'before' ) ).toEqual( {
				index: 2,
				parent: 0,
			} );
			expect( getPageDropTarget( tree, 5, 1, 'after' ) ).toEqual( {
				index: 0,
				parent: 1,
			} );
			expect( getPageDropTarget( tree, 5, 1, 'after', false ) ).toEqual( {
				index: 3,
				parent: 0,
			} );
			expect( getPageDropTarget( tree, 3, 1, 'inside' ) ).toEqual( {
				index: 1,
				parent: 1,
			} );
		} );

		test( 'refuses to drop a page into itself or its sub-pages', () => {
			expect( getPageDropTarget( tree, 2, 2, 'inside' ) ).toBeNull();
			expect( getPageDropTarget( tree, 2, 3, 'inside' ) ).toBeNull();
			expect( getPageDropTarget( tree, 2, 3, 'before' ) ).toBeNull();
		} );

		test( 'moves with the keyboard', () => {
			expect( getPageKeyboardTarget( tree, 5, 'ArrowUp' ) ).toBeNull();
			expect( getPageKeyboardTarget( tree, 6, 'ArrowUp' ) ).toEqual( {
				index: 0,
				parent: 0,
			} );
			expect( getPageKeyboardTarget( tree, 1, 'ArrowRight' ) ).toEqual( {
				index: 1,
				parent: 2,
			} );
			expect( getPageKeyboardTarget( tree, 4, 'ArrowLeft' ) ).toEqual( {
				index: 4,
				parent: 0,
			} );
			expect( getPageKeyboardTarget( tree, 5, 'ArrowLeft' ) ).toBeNull();
		} );

		test( 'numbers the pages beside a moved page as they now appear', () => {
			// Design moves out of Services, to sit between About and Services.
			expect(
				getPageMoveChanges( tree, 4, { index: 3, parent: 0 } )
			).toEqual( [
				{ id: 6, menu_order: 1, parent: 0 },
				{ id: 2, menu_order: 2, parent: 0 },
				{ id: 4, menu_order: 3, parent: 0 },
				{ id: 1, menu_order: 4, parent: 0 },
			] );
		} );
	} );
} );
