jest.mock( '@wordpress/route', () => ( {
	useNavigate: jest.fn(),
	useSearch: jest.fn(),
} ) );
jest.mock( '../../../wordpress-packages', () => ( {
	...jest.requireActual( '@wordpress/i18n' ),
	homeIcon: 'home',
	pageIcon: 'page',
	postIcon: 'post',
	postListIcon: 'post-list',
	storeIcon: 'store',
	useCallback: jest.fn(),
	useSelect: jest.fn(),
	addQueryArgs: jest.fn(),
	apiFetch: jest.fn(),
	createReduxStore: jest.fn( () => ( {} ) ),
	register: jest.fn(),
	select: jest.fn(),
} ) );

/**
 * Internal dependencies
 */
import {
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
} );
