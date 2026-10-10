/**
 * The addresses the site canvas works with: the preview's, the live site's,
 * and the full-screen editor's route for what is being edited.
 */

export const PREVIEW_PARAM = 'cnl-editor-preview';

// A layout to show a page in before it is saved. Read by the preview's PHP.
export const TEMPLATE_PARAM = 'cnl-editor-template';

// Query args that say how a page is being looked at, not which page it is.
const VIEWING_PARAMS = [
	PREVIEW_PARAM,
	'cnl-editor-preview-refresh',
	'preview',
];

function parse( url, base ) {
	try {
		return new URL( url, base || window.location.href );
	} catch {
		return null;
	}
}

/**
 * The address to load in the preview, for a page on this site.
 *
 * @param {string} url  Page URL, possibly relative.
 * @param {string} base URL to resolve a relative one against.
 * @return {string} The preview URL, or an empty string for anything that
 *                  isn't a web page on this site.
 */
export function getPreviewFrameUrl( url, base ) {
	const parsed = url && parse( url, base );

	if (
		! parsed ||
		! [ 'http:', 'https:' ].includes( parsed.protocol ) ||
		parsed.origin !== window.location.origin
	) {
		return '';
	}

	parsed.searchParams.set( PREVIEW_PARAM, '1' );

	return parsed.href;
}

/**
 * @param {string} url URL.
 * @return {boolean} Whether the URL loads as a preview.
 */
export function isPreviewFrameUrl( url ) {
	return parse( url )?.searchParams.get( PREVIEW_PARAM ) === '1';
}

/**
 * The address a visitor would use for what the preview shows.
 *
 * @param {string} url Preview URL.
 * @return {string} The URL without the preview's query args.
 */
export function getLiveUrl( url ) {
	const parsed = url && parse( url );

	if ( ! parsed ) {
		return '';
	}

	parsed.searchParams.delete( PREVIEW_PARAM );
	parsed.searchParams.delete( 'cnl-editor-preview-refresh' );
	parsed.searchParams.delete( TEMPLATE_PARAM );

	return parsed.href;
}

function getLocationKey( url ) {
	const parsed = url && parse( url );

	if ( ! parsed ) {
		return '';
	}

	VIEWING_PARAMS.forEach( ( param ) => parsed.searchParams.delete( param ) );
	parsed.searchParams.sort();

	return (
		parsed.origin + parsed.pathname.replace( /\/+$/, '' ) + parsed.search
	);
}

/**
 * Whether two addresses show the same page, however each is being viewed.
 *
 * @param {string} a URL.
 * @param {string} b URL.
 * @return {boolean} Whether they are the same page.
 */
export function isSameLocation( a, b ) {
	const key = getLocationKey( a );

	return !! key && key === getLocationKey( b );
}

/**
 * Where the full-screen editor opens a record.
 *
 * @param {Object} entity `{ postType, postId }`.
 * @return {Object|null} Route options for `navigate`, or `null`.
 */
export function getEditRoute( entity ) {
	if ( ! entity?.postType || ! entity?.postId ) {
		return null;
	}

	if ( entity.postType === 'wp_template' ) {
		return { search: { postId: entity.postId }, to: '/wp_template' };
	}

	return { to: `/types/${ entity.postType }/edit/${ entity.postId }` };
}
