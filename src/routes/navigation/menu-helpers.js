/**
 * Internal dependencies
 */
import { getFromNavigationSearch } from '../../site-trail';
import { getNavigationMenuItemCount, getTitleText } from '../../records';
import { __, _n, sprintf } from '../../wordpress-packages';
import { getLocationsSummary } from './navigation-locations';

export const NAVIGATION_MENUS_CHANGED_EVENT =
	'cnl-editor-navigation-menus-changed';
export const NAVIGATION_POST_TYPE = 'wp_navigation';
export const EMPTY_ARRAY = [];

export function getMenuTitle( menu ) {
	return getTitleText( menu?.title ) || __( 'Untitled menu' );
}

export function getMenuContent( menu ) {
	if ( typeof menu?.content === 'string' ) {
		return menu.content;
	}

	return menu?.content?.raw || '';
}

export function getNavigationMenuId( menuOrId ) {
	const rawId =
		typeof menuOrId === 'object' && menuOrId !== null
			? menuOrId.id
			: menuOrId;

	if ( rawId === undefined || rawId === null || rawId === '' ) {
		return undefined;
	}

	if ( typeof rawId === 'string' ) {
		try {
			const parsedId = JSON.parse( rawId );

			if (
				typeof parsedId === 'string' ||
				typeof parsedId === 'number'
			) {
				return String( parsedId );
			}
		} catch {
			return rawId;
		}
	}

	return String( rawId );
}

export function getMenuLocationsDescription( count ) {
	return count
		? sprintf(
				/* translators: %d: Number of locations where this navigation menu is shown. */
				_n(
					'This menu is shown in %d location on your site.',
					'This menu is shown in %d locations on your site.',
					count
				),
				count
			)
		: __(
				'Choose where this menu should appear, such as your header or footer.'
			);
}

export function navigateToNavigationEditRoute( navigate, menuOrId ) {
	const menuId = getNavigationMenuId( menuOrId );

	if ( ! menuId ) {
		return;
	}

	const route = `/navigation/edit/${ encodeURIComponent( menuId ) }`;
	// So the edit screen's breadcrumb can lead back to the Menus list.
	const search = getFromNavigationSearch();

	navigate( { search, to: route } );
	window.setTimeout( () => {
		const currentUrl = new URL( window.location.href );
		const currentRoute = currentUrl.searchParams.get( 'p' ) || '';

		if ( currentRoute.startsWith( route ) ) {
			return;
		}

		const routeSearch = new URLSearchParams( search ).toString();
		currentUrl.searchParams.set(
			'p',
			routeSearch ? `${ route }?${ routeSearch }` : route
		);
		window.location.assign( currentUrl.toString() );
	}, 100 );
}

export function getMenuRowDescription( menu, locations, isResolvingLocations ) {
	const itemCount = getNavigationMenuItemCount( menu );
	const itemsText = sprintf(
		/* translators: %d: Number of navigation blocks in the menu. */
		_n( '%d item', '%d items', itemCount ),
		itemCount
	);
	const usageText = isResolvingLocations
		? __( 'Checking usage…' )
		: getLocationsSummary( locations );

	return sprintf(
		/* translators: 1: Item count, e.g. "3 items". 2: Where the menu is shown, e.g. "2 locations". */
		__( '%1$s · %2$s' ),
		itemsText,
		usageText
	);
}
