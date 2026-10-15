jest.mock( '../wordpress-packages', () => ( {
	__: ( text ) => text,
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
	getErrorMessage,
	getNavigationMenuItemCount,
	getTemplateAuthorText,
	getTemplateDisplayTitle,
	getTitleText,
} from '../records';

describe( 'record helpers', () => {
	test( 'reads a plain title from a string, rendered or raw title', () => {
		expect( getTitleText( 'About &amp; us' ) ).toBe( 'About & us' );
		expect( getTitleText( { rendered: '<b>Home</b>' } ) ).toBe( 'Home' );
		expect( getTitleText( { raw: 'Draft' } ) ).toBe( 'Draft' );
		expect( getTitleText( undefined ) ).toBe( 'Untitled' );
	} );

	test( 'gives templates plain-language names', () => {
		expect( getTemplateDisplayTitle( { slug: 'home' } ) ).toBe(
			'Posts Listing'
		);
		expect( getTemplateDisplayTitle( { slug: 'single' } ) ).toBe(
			'Single Post'
		);
		expect( getTemplateDisplayTitle( { slug: 'index' } ) ).toBe(
			'Fallback'
		);
		expect( getTemplateDisplayTitle( { slug: 'front-page' } ) ).toBe(
			'Homepage'
		);
		expect( getTemplateDisplayTitle( { slug: '404' } ) ).toBe(
			'Page not found'
		);
		expect(
			getTemplateDisplayTitle( {
				slug: 'archive',
				title: { rendered: 'Archives' },
			} )
		).toBe( 'Archives' );
	} );

	test( 'credits a template to its plugin or theme', () => {
		expect(
			getTemplateAuthorText( {
				plugin: 'my-shop-plugin',
				source: 'plugin',
			} )
		).toBe( 'My Shop Plugin' );
		expect( getTemplateAuthorText( { theme: 'mainstay' } ) ).toBe(
			'Mainstay'
		);
		expect( getTemplateAuthorText( {} ) ).toBe( 'Site editor' );
	} );

	test( 'counts the blocks in a menu', () => {
		expect(
			getNavigationMenuItemCount( {
				content: {
					raw: '<!-- wp:navigation-link /-->\n<!-- wp:navigation-submenu --><!-- wp:navigation-link /--><!-- /wp:navigation-submenu -->',
				},
			} )
		).toBe( 3 );
		expect(
			getNavigationMenuItemCount( {
				content: { rendered: '<!-- wp:page-list /-->' },
			} )
		).toBe( 1 );
		expect( getNavigationMenuItemCount( {} ) ).toBe( 0 );
	} );

	test( 'reads an error message, with a fallback', () => {
		expect( getErrorMessage( new Error( 'Nope' ) ) ).toBe( 'Nope' );
		expect( getErrorMessage( {} ) ).toBe( 'Request failed.' );
	} );
} );
