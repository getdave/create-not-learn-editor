/**
 * A page's sections, opened from its details. The address says so, with
 * `view` set to `SECTIONS_VIEW`, so the breadcrumbs can lead back to the
 * details, and the canvas zooms out to the sections while it is set.
 */

export const SECTIONS_VIEW = 'sections';

/**
 * The search string for a page's details, without its sections open.
 *
 * @param {Object} searchParams The route's search params.
 * @return {string} The search string, without a leading `?`.
 */
export function getPageSearchString( searchParams ) {
	const params = new URLSearchParams();

	Object.entries( searchParams ).forEach( ( [ key, value ] ) => {
		if ( key !== 'view' && value !== undefined && value !== null ) {
			params.set( key, String( value ) );
		}
	} );

	return params.toString();
}
