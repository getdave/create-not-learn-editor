/**
 * External dependencies
 */
import { describe, expect, test, vi } from 'vitest';

vi.mock( '@wordpress/route', () => ( {
	useNavigate: vi.fn(),
	useSearch: vi.fn(),
} ) );
vi.mock( '../../../wordpress-packages', async () => ( {
	...( await vi.importActual( '@wordpress/i18n' ) ),
	homeIcon: 'home',
	pageIcon: 'page',
	postIcon: 'post',
	postListIcon: 'post-list',
	storeIcon: 'store',
	useCallback: vi.fn(),
	useSelect: vi.fn(),
	addQueryArgs: vi.fn(),
	apiFetch: vi.fn(),
	createReduxStore: vi.fn( () => ( {} ) ),
	register: vi.fn(),
	select: vi.fn(),
} ) );

vi.mock( '../../../settings', () => ( {
	getPostType: ( name ) =>
		[ 'page', 'post' ].includes( name ) ? { name } : undefined,
	namespace: 'create-not-learn-editor/v1',
} ) );

/**
 * Internal dependencies
 */
import {
	getEditDestination,
	getItemCountLabel,
	getNodeIcon,
	getNodeKindLabel,
	hasNotableStatus,
	isDynamicNode,
} from '../data';
import {
	homeIcon,
	pageIcon,
	postIcon,
	postListIcon,
	storeIcon,
} from '../../../wordpress-packages';

describe( 'site overview data', () => {
	test( 'labels each kind of page', () => {
		expect( getNodeKindLabel( { kind: 'home' } ) ).toBe( 'Homepage' );
		expect( getNodeKindLabel( { kind: 'collection' } ) ).toBe(
			'Collection'
		);
		expect( getNodeKindLabel( { kind: 'single' } ) ).toBe( 'Single' );
		expect( getNodeKindLabel( { kind: 'page' } ) ).toBe( 'Page' );
		expect( getNodeKindLabel( undefined ) ).toBe( 'Page' );
	} );

	test( 'treats pages WordPress builds from content as dynamic', () => {
		expect( isDynamicNode( { kind: 'collection' } ) ).toBe( true );
		expect( isDynamicNode( { kind: 'single' } ) ).toBe( true );
		// A homepage showing the latest posts, rather than a page.
		expect( isDynamicNode( { kind: 'home' } ) ).toBe( true );
		expect( isDynamicNode( { kind: 'home', postId: 5 } ) ).toBe( false );
		expect( isDynamicNode( { kind: 'page', postId: 6 } ) ).toBe( false );
	} );

	test( 'picks an icon for each kind of page', () => {
		expect( getNodeIcon( { kind: 'home' } ) ).toBe( homeIcon );
		expect( getNodeIcon( { group: 'post', kind: 'collection' } ) ).toBe(
			postListIcon
		);
		expect( getNodeIcon( { group: 'product', kind: 'collection' } ) ).toBe(
			storeIcon
		);
		expect( getNodeIcon( { kind: 'single' } ) ).toBe( postIcon );
		expect( getNodeIcon( { kind: 'page' } ) ).toBe( pageIcon );
	} );

	test( 'counts a collection’s items in words', () => {
		const group = { label: 'Posts', singular: 'Post' };

		expect( getItemCountLabel( 1, group ) ).toBe( '1 post' );
		expect( getItemCountLabel( 12, group ) ).toBe( '12 posts' );
		expect( getItemCountLabel( 3, undefined ) ).toBe( '' );
	} );

	test( 'points out any status but published', () => {
		expect( hasNotableStatus( { status: 'draft' } ) ).toBe( true );
		expect( hasNotableStatus( { status: 'publish' } ) ).toBe( false );
		expect( hasNotableStatus( {} ) ).toBe( false );
	} );

	test( 'opens pages and layouts in a site canvas', () => {
		const pages = '/types/page/list/all';

		expect( getEditDestination( { canEdit: true, kind: 'home' } ) ).toEqual(
			{ search: { postId: 'home', previewId: 'home' }, to: pages }
		);
		expect( getEditDestination( { canEdit: false, kind: 'home' } ) ).toBe(
			null
		);
		expect(
			getEditDestination( { canEdit: true, kind: 'page', postId: 7 } )
		).toEqual( { search: { postId: 7, previewId: 7 }, to: pages } );
		expect(
			getEditDestination( {
				group: 'post',
				kind: 'single',
				template: { id: 'theme//single', slug: 'single' },
			} )
		).toEqual( {
			search: { content: 'templates', postIds: [ 'theme//single' ] },
			to: '/types/post/list/all',
		} );
		// A layout the posts' Layouts tab doesn't list falls back to the page
		// standing in for the collection.
		expect(
			getEditDestination( {
				canEdit: true,
				group: 'post',
				kind: 'collection',
				postId: 9,
				template: { id: 'theme//index', slug: 'index' },
			} )
		).toEqual( { search: { postId: 9, previewId: 9 }, to: pages } );
		expect(
			getEditDestination( {
				group: 'post',
				kind: 'collection',
				template: { id: 'theme//index', slug: 'index' },
			} )
		).toBe( null );
	} );
} );
