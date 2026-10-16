/**
 * Screens opened from the "Your site" screen start their breadcrumbs with
 * "Your site", so each one has a way back to where it was picked. The screens
 * stay where they live in the editor; only the trail changes, and only on
 * visits that began at "Your site".
 */

/**
 * WordPress dependencies
 */
import { useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { __, useMemo } from './wordpress-packages';

const EMPTY_ARRAY = [];

/**
 * Search params "Your site" adds to the screens it opens.
 */
export const FROM_SITE_SEARCH = { from: 'site' };

const NAVIGATION_FROM = 'navigation';

/**
 * Search params the Menus screen adds to the edit screen it opens.
 *
 * @return {Object} Search params.
 */
export function getFromNavigationSearch() {
	return { from: NAVIGATION_FROM };
}

/**
 * The breadcrumb back to the "Your site" screen.
 *
 * @return {Object} Breadcrumb item.
 */
export function getSiteCrumb() {
	return { label: __( 'Your site' ), to: '/' };
}

/**
 * The breadcrumbs leading back to where the visit began: "Your site". Visits
 * from the Menus screen lead back there instead, since it isn't linked from
 * "Your site". Empty for visits that began anywhere else.
 *
 * @return {Object[]} Breadcrumb items, to put before the screen's own.
 */
export function useSiteTrail() {
	const { from } = useSearch( { strict: false } );

	return useMemo( () => {
		if ( from === FROM_SITE_SEARCH.from ) {
			return [ getSiteCrumb() ];
		}

		if ( from === NAVIGATION_FROM ) {
			return [ { label: __( 'Menus' ), to: '/navigation' } ];
		}

		return EMPTY_ARRAY;
	}, [ from ] );
}
