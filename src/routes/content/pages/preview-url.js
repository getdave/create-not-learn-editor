/**
 * Internal dependencies
 */
import { SHOW_ON_FRONT_PARAM, TEMPLATE_PARAM } from '../../../site-canvas/urls';

/**
 * Where the preview shows a page. A page that isn't published only shows to
 * those who can edit it, as a preview. A layout chosen but not saved yet is
 * passed along, so the preview shows the page in it.
 *
 * The homepage is shown at the site's address instead, once it lists the
 * latest posts or is switched back from them, and what it shows is passed
 * along until it is saved.
 *
 * @param {?Object} page                      Page record, with its unsaved
 *                                            edits.
 * @param {string}  savedTemplate             The page's saved layout.
 * @param {?Object} homepage                  Only for the homepage's page.
 * @param {string}  homepage.homeUrl          The site's address.
 * @param {string}  homepage.showOnFront      What it shows, `page` or
 *                                            `posts`, with unsaved edits.
 * @param {string}  homepage.savedShowOnFront What it shows, as saved.
 * @return {string} The page's URL, or an empty string.
 */
export function getPagePreviewUrl( page, savedTemplate, homepage = null ) {
	const isChoiceUnsaved =
		Boolean( homepage ) &&
		homepage.showOnFront !== homepage.savedShowOnFront;
	const isAtHome = isChoiceUnsaved || homepage?.showOnFront === 'posts';
	const link = isAtHome ? homepage.homeUrl : page?.link;

	if ( ! link ) {
		return '';
	}

	const url = new URL( link, window.location.origin );

	if ( isChoiceUnsaved ) {
		url.searchParams.set( SHOW_ON_FRONT_PARAM, homepage.showOnFront );
	}

	// The page itself isn't on show, or hasn't loaded yet.
	if ( homepage?.showOnFront === 'posts' || ! page ) {
		return url.href;
	}

	if ( page.status !== 'publish' ) {
		url.searchParams.set( 'preview', 'true' );
	}

	if ( ( page.template || '' ) !== ( savedTemplate || '' ) ) {
		url.searchParams.set( TEMPLATE_PARAM, page.template || 'default' );
	}

	return url.href;
}
