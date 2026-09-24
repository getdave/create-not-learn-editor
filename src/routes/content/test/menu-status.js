jest.mock( '@wordpress/blocks', () => ( {
	createBlock: jest.fn(),
} ) );

/**
 * Internal dependencies
 */
import { getMenuPages, isPageInMenu } from '../menu-status';

describe( 'menu status', () => {
	test( 'collects linked page IDs, including inside submenus', () => {
		const menuPages = getMenuPages(
			[
				'<!-- wp:navigation-link {"label":"About","type":"page","id":12,"kind":"post-type","url":"/about"} /-->',
				'<!-- wp:navigation-submenu {"label":"More","type":"page","id":13,"kind":"post-type"} -->',
				'<!-- wp:navigation-link {"label":"Contact","type":"page","id":14,"kind":"post-type"} /-->',
				'<!-- /wp:navigation-submenu -->',
				'<!-- wp:navigation-link {"label":"Blog","url":"https://example.com","kind":"custom"} /-->',
			].join( '' )
		);

		expect( menuPages.listsAllPages ).toBe( false );
		expect( [ ...menuPages.pageIds ] ).toEqual( [ 12, 13, 14 ] );
		expect( isPageInMenu( { id: 14 }, menuPages ) ).toBe( true );
		expect( isPageInMenu( { id: 15 }, menuPages ) ).toBe( false );
	} );

	test( 'treats a Page List as listing published top-level pages', () => {
		const menuPages = getMenuPages( '<!-- wp:page-list /-->' );

		expect( menuPages.listsAllPages ).toBe( true );
		expect(
			isPageInMenu( { id: 1, parent: 0, status: 'publish' }, menuPages )
		).toBe( true );
		expect(
			isPageInMenu( { id: 2, parent: 0, status: 'draft' }, menuPages )
		).toBe( false );
		expect(
			isPageInMenu( { id: 3, parent: 1, status: 'publish' }, menuPages )
		).toBe( false );
	} );

	test( 'handles an empty or missing menu', () => {
		expect( isPageInMenu( { id: 1 }, getMenuPages( '' ) ) ).toBe( false );
		expect( isPageInMenu( { id: 1 }, null ) ).toBe( false );
	} );
} );
