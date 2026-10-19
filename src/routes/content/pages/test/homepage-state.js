/**
 * External dependencies
 */
import { describe, expect, test, vi } from 'vitest';

/**
 * Internal dependencies
 */
import { getParsedBlocks } from '../../../navigation-edit/navigation-blocks';
import {
	findDefaultHomepagePage,
	findHomeMenuItem,
	getHomepageState,
	isHomeMenuItem,
	isHomeUrl,
	replacePageLinksWithHomeLinks,
} from '../homepage-state';

vi.mock( '@wordpress/blocks', () => ( { createBlock: vi.fn() } ) );

const HOME_URL = 'https://example.com/';
const welcome = { id: 7, status: 'publish' };

describe( 'getHomepageState', () => {
	test( 'shows the latest posts when set to', () => {
		expect(
			getHomepageState( { pageOnFront: 0, showOnFront: 'posts' } )
		).toEqual( {
			pageId: 0,
			problem: '',
			rememberedId: 0,
			shows: 'posts',
		} );
	} );

	test( 'remembers the page while the latest posts show', () => {
		expect(
			getHomepageState( {
				frontPage: welcome,
				pageOnFront: 7,
				showOnFront: 'posts',
			} )
		).toMatchObject( { pageId: 0, rememberedId: 7, shows: 'posts' } );
	} );

	test( 'shows the latest posts when set to a page but none is picked', () => {
		expect(
			getHomepageState( { pageOnFront: 0, showOnFront: 'page' } )
		).toMatchObject( { pageId: 0, problem: '', shows: 'posts' } );
	} );

	test( 'shows a published page', () => {
		expect(
			getHomepageState( {
				frontPage: welcome,
				pageOnFront: '7',
				showOnFront: 'page',
			} )
		).toEqual( {
			pageId: 7,
			problem: '',
			rememberedId: 7,
			shows: 'page',
		} );
	} );

	test( 'reports a page visitors can’t see', () => {
		[ 'draft', 'pending', 'private', 'future' ].forEach( ( status ) => {
			expect(
				getHomepageState( {
					frontPage: { ...welcome, status },
					pageOnFront: 7,
					showOnFront: 'page',
				} )
			).toMatchObject( {
				pageId: 7,
				problem: 'unpublished',
				shows: 'page',
			} );
		} );
	} );

	test( 'reports a page that has gone', () => {
		[ null, { ...welcome, status: 'trash' } ].forEach( ( frontPage ) => {
			expect(
				getHomepageState( {
					frontPage,
					pageOnFront: 7,
					showOnFront: 'page',
				} )
			).toMatchObject( { pageId: 0, problem: 'missing', shows: 'page' } );
		} );
	} );

	test( 'reports nothing while the page loads', () => {
		expect(
			getHomepageState( { pageOnFront: 7, showOnFront: 'page' } )
		).toMatchObject( { pageId: 7, problem: '', shows: 'page' } );
	} );

	test( 'lets the theme’s front-page layout win', () => {
		expect(
			getHomepageState( {
				frontPage: { ...welcome, status: 'draft' },
				hasFrontPageTemplate: true,
				pageOnFront: 7,
				showOnFront: 'page',
			} )
		).toMatchObject( { pageId: 7, problem: '', shows: 'theme' } );
		expect(
			getHomepageState( {
				hasFrontPageTemplate: true,
				pageOnFront: 0,
				showOnFront: 'posts',
			} )
		).toMatchObject( { pageId: 0, shows: 'theme' } );
	} );
} );

describe( 'isHomeUrl', () => {
	test( 'matches the site’s address, however it is written', () => {
		expect( isHomeUrl( 'https://example.com', HOME_URL ) ).toBe( true );
		expect( isHomeUrl( 'https://example.com/', HOME_URL ) ).toBe( true );
		expect( isHomeUrl( '/', HOME_URL ) ).toBe( true );
	} );

	test( 'leaves out other pages, parts of the homepage and other sites', () => {
		expect( isHomeUrl( '/about/', HOME_URL ) ).toBe( false );
		expect( isHomeUrl( '/#contact', HOME_URL ) ).toBe( false );
		expect( isHomeUrl( '/?s=hello', HOME_URL ) ).toBe( false );
		expect( isHomeUrl( 'https://other.com/', HOME_URL ) ).toBe( false );
		expect( isHomeUrl( '', HOME_URL ) ).toBe( false );
	} );

	test( 'respects a site in a subdirectory', () => {
		const home = 'https://example.com/blog/';

		expect( isHomeUrl( '/blog', home ) ).toBe( true );
		expect( isHomeUrl( '/', home ) ).toBe( false );
	} );
} );

describe( 'isHomeMenuItem', () => {
	const context = { frontPageId: 7, homeUrl: HOME_URL };
	const [ homeLink, pageLink, otherPage, customHome, customOther, tag ] =
		getParsedBlocks(
			[
				'<!-- wp:home-link {"label":"Home"} /-->',
				'<!-- wp:navigation-link {"label":"Welcome","type":"page","id":7,"kind":"post-type"} /-->',
				'<!-- wp:navigation-link {"label":"About","type":"page","id":8,"kind":"post-type"} /-->',
				'<!-- wp:navigation-link {"label":"Start","url":"https://example.com/","kind":"custom"} /-->',
				'<!-- wp:navigation-link {"label":"Shop","url":"https://shop.com/","kind":"custom"} /-->',
				'<!-- wp:navigation-link {"label":"News","type":"tag","id":7,"kind":"taxonomy","url":"https://example.com/"} /-->',
			].join( '' )
		);

	test( 'counts every way of linking home', () => {
		expect( isHomeMenuItem( homeLink, context ) ).toBe( true );
		expect( isHomeMenuItem( pageLink, context ) ).toBe( true );
		expect( isHomeMenuItem( customHome, context ) ).toBe( true );
	} );

	test( 'leaves out other links', () => {
		expect( isHomeMenuItem( otherPage, context ) ).toBe( false );
		expect( isHomeMenuItem( customOther, context ) ).toBe( false );
		expect( isHomeMenuItem( tag, context ) ).toBe( false );
	} );

	test( 'only counts the page while the homepage shows it', () => {
		expect(
			isHomeMenuItem( pageLink, { frontPageId: 0, homeUrl: HOME_URL } )
		).toBe( false );
	} );
} );

describe( 'findHomeMenuItem', () => {
	test( 'finds the first link home, inside submenus too', () => {
		const blocks = getParsedBlocks(
			[
				'<!-- wp:navigation-link {"label":"About","type":"page","id":8,"kind":"post-type"} /-->',
				'<!-- wp:navigation-submenu {"label":"More","kind":"custom"} -->',
				'<!-- wp:navigation-link {"label":"Welcome","type":"page","id":7,"kind":"post-type"} /-->',
				'<!-- /wp:navigation-submenu -->',
				'<!-- wp:home-link {"label":"Home"} /-->',
			].join( '' )
		);

		expect(
			findHomeMenuItem( blocks, { frontPageId: 7, homeUrl: HOME_URL } )
				.attrs.label
		).toBe( 'Welcome' );
		expect(
			findHomeMenuItem( blocks, { frontPageId: 0, homeUrl: HOME_URL } )
				.attrs.label
		).toBe( 'Home' );
		expect(
			findHomeMenuItem( blocks.slice( 0, 1 ), {
				frontPageId: 7,
				homeUrl: HOME_URL,
			} )
		).toBeNull();
	} );
} );

describe( 'replacePageLinksWithHomeLinks', () => {
	test( 'swaps links to the page for Home links in the same place', () => {
		const blocks = getParsedBlocks(
			[
				'<!-- wp:navigation-link {"label":"About","type":"page","id":8,"kind":"post-type"} /-->',
				'<!-- wp:navigation-link {"label":"Welcome","type":"page","id":7,"kind":"post-type"} /-->',
			].join( '' )
		);
		const next = replacePageLinksWithHomeLinks( blocks, 7, 'Home' );

		expect( next[ 0 ] ).toBe( blocks[ 0 ] );
		expect( next[ 1 ] ).toEqual( {
			attributes: { label: 'Home' },
			innerBlocks: [],
			name: 'core/home-link',
		} );
	} );

	test( 'keeps a link with a submenu, and leaves other menus alone', () => {
		const blocks = getParsedBlocks(
			[
				'<!-- wp:navigation-submenu {"label":"Welcome","type":"page","id":7,"kind":"post-type"} -->',
				'<!-- wp:navigation-link {"label":"About","type":"page","id":8,"kind":"post-type"} /-->',
				'<!-- /wp:navigation-submenu -->',
			].join( '' )
		);

		expect( replacePageLinksWithHomeLinks( blocks, 7, 'Home' ) ).toBe(
			blocks
		);
	} );
} );

describe( 'findDefaultHomepagePage', () => {
	const getTitle = ( page ) => page.title;
	const options = { getTitle, homeTitle: 'Home' };
	const about = { id: 2, slug: 'about', title: 'About' };
	const start = { id: 3, slug: 'start', title: 'home' };
	const homeSlug = { id: 4, slug: 'home', title: 'Welcome' };

	test( 'goes back to the page the homepage showed last', () => {
		expect(
			findDefaultHomepagePage( [ about, homeSlug ], {
				...options,
				rememberedId: 2,
			} )
		).toBe( about );
	} );

	test( 'falls back to a page called Home, by address then title', () => {
		expect(
			findDefaultHomepagePage( [ about, start, homeSlug ], options )
		).toBe( homeSlug );
		expect( findDefaultHomepagePage( [ about, start ], options ) ).toBe(
			start
		);
		expect(
			findDefaultHomepagePage( [ about ], {
				...options,
				rememberedId: 99,
			} )
		).toBeNull();
	} );
} );
