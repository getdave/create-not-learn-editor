/**
 * Screens opened from the "Your site" checklist start their breadcrumbs with
 * "Your site", so every step has a way back to the list. The screens stay
 * where they live in the editor; only the trail changes, and only on visits
 * that began at the checklist.
 */

/**
 * WordPress dependencies
 */
import { useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { __ } from './wordpress-packages';

/**
 * Search params the checklist adds to the screens it opens.
 */
export const FROM_SITE_SEARCH = { from: 'site' };

/**
 * Whether the current screen was opened from the "Your site" checklist.
 *
 * @return {boolean} Whether the visit began at the checklist.
 */
export function useIsFromSite() {
	return useSearch( { strict: false } ).from === FROM_SITE_SEARCH.from;
}

/**
 * The breadcrumb back to the "Your site" screen.
 *
 * @return {Object} Breadcrumb item.
 */
export function getSiteCrumb() {
	return { label: __( 'Your site' ), to: '/' };
}
