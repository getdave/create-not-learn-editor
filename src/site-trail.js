/**
 * Screens opened from the "Your site" checklist start their breadcrumbs with
 * "Your site", so every step has a way back to the list. The screens stay
 * where they live in the editor; only the trail changes, and only on visits
 * that began at the checklist.
 *
 * The Header and Footer screens, themselves steps on the checklist, lead on
 * to other screens in the same way: those carry the part in their trail too.
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
 * Search params the checklist adds to the screens it opens.
 */
export const FROM_SITE_SEARCH = { from: 'site' };

const SITE_PART_CRUMBS = {
	footer: () => ( { label: __( 'Footer' ), to: '/design/footer' } ),
	header: () => ( { label: __( 'Header' ), to: '/design/header' } ),
};

/**
 * Search params the Header or Footer screen adds to the screens it opens.
 *
 * @param {string} area `header` or `footer`.
 * @return {Object} Search params.
 */
export function getFromSitePartSearch( area ) {
	return { from: area };
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
 * The breadcrumbs leading back to where the visit began: "Your site", and
 * the Header or Footer screen when it began there. Empty for visits that
 * began anywhere else.
 *
 * @return {Object[]} Breadcrumb items, to put before the screen's own.
 */
export function useSiteTrail() {
	const { from } = useSearch( { strict: false } );

	return useMemo( () => {
		if ( from === FROM_SITE_SEARCH.from ) {
			return [ getSiteCrumb() ];
		}

		if ( Object.hasOwn( SITE_PART_CRUMBS, from ) ) {
			return [ getSiteCrumb(), SITE_PART_CRUMBS[ from ]() ];
		}

		return EMPTY_ARRAY;
	}, [ from ] );
}
