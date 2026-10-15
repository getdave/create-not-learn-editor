jest.mock( '@wordpress/route', () => ( {
	useSearch: jest.fn(),
} ) );
jest.mock( '../../../wordpress-packages', () => ( {
	...jest.requireActual( '@wordpress/i18n' ),
	useMemo: jest.fn(),
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
	getMenuContent,
	getMenuLocationsDescription,
	getMenuRowDescription,
	getMenuTitle,
	getNavigationMenuId,
	navigateToNavigationEditRoute,
} from '../menu-helpers';

describe( 'menu helpers', () => {
	test( 'titles a menu from its rendered title', () => {
		expect(
			getMenuTitle( { title: { rendered: 'Main &amp; more' } } )
		).toBe( 'Main & more' );
	} );

	test( 'reads menu content as a string or a raw field', () => {
		expect( getMenuContent( { content: '<!-- wp:a /-->' } ) ).toBe(
			'<!-- wp:a /-->'
		);
		expect( getMenuContent( { content: { raw: '<!-- wp:b /-->' } } ) ).toBe(
			'<!-- wp:b /-->'
		);
		expect( getMenuContent( null ) ).toBe( '' );
	} );

	test( 'reads a menu ID from a record, number or string', () => {
		expect( getNavigationMenuId( { id: 12 } ) ).toBe( '12' );
		expect( getNavigationMenuId( 12 ) ).toBe( '12' );
		expect( getNavigationMenuId( '12' ) ).toBe( '12' );
		// IDs that arrive JSON-encoded in the URL.
		expect( getNavigationMenuId( '"12"' ) ).toBe( '12' );
		expect( getNavigationMenuId( 'abc' ) ).toBe( 'abc' );
		expect( getNavigationMenuId( '' ) ).toBeUndefined();
		expect( getNavigationMenuId( null ) ).toBeUndefined();
		expect( getNavigationMenuId( { id: undefined } ) ).toBeUndefined();
	} );

	test( 'describes where a menu is shown', () => {
		expect( getMenuLocationsDescription( 1 ) ).toBe(
			'This menu is shown in 1 location on your site.'
		);
		expect( getMenuLocationsDescription( 3 ) ).toBe(
			'This menu is shown in 3 locations on your site.'
		);
		expect( getMenuLocationsDescription( 0 ) ).toBe(
			'Choose where this menu should appear, such as your header or footer.'
		);
	} );

	test( 'describes a menu row by its items and usage', () => {
		const menu = {
			content: {
				raw: '<!-- wp:navigation-link /--><!-- wp:navigation-link /-->',
			},
		};

		expect( getMenuRowDescription( menu, [], true ) ).toBe(
			'2 items · Checking usage…'
		);
		expect(
			getMenuRowDescription( { content: { raw: '' } }, [], false )
		).toMatch( /^0 items · / );
	} );

	test( 'opens a menu on its own screen, linking back to Menus', () => {
		jest.useFakeTimers();
		const navigate = jest.fn();

		navigateToNavigationEditRoute( navigate, { id: 'a b' } );
		navigateToNavigationEditRoute( navigate, '' );

		expect( navigate ).toHaveBeenCalledTimes( 1 );
		expect( navigate.mock.calls[ 0 ][ 0 ].to ).toBe(
			'/navigation/edit/a%20b'
		);
		expect( navigate.mock.calls[ 0 ][ 0 ].search ).toBeTruthy();
		jest.useRealTimers();
	} );
} );
