/**
 * Internal dependencies
 */
import {
	PAGE_ON_FRONT_PARAM,
	SHOW_ON_FRONT_PARAM,
	TEMPLATE_PARAM,
} from '../../../site-canvas/urls';
import { isHomeUrl } from './homepage-state';

/**
 * Where the Pages canvas previews a page, or the homepage.
 *
 * A page that isn't published only shows to those who can edit it, as a
 * preview. A layout chosen but not saved yet is passed along, so the preview
 * shows the page in it. So is an unsaved change to what the homepage shows,
 * which moves pages: the homepage is at the site's address whatever it shows,
 * and a page that stops being the homepage is back at an address of its own.
 *
 * @param {Object}  args
 * @param {?Object} args.page          Page record, with its unsaved edits. None
 *                                     when the homepage shows the latest posts.
 * @param {string}  args.savedTemplate The page's saved layout.
 * @param {string}  args.savedStatus   The page's saved status.
 * @param {boolean} args.isHomepage    Whether the homepage is being previewed.
 * @param {string}  args.homeUrl       The site's address.
 * @param {Object}  args.site          The site's settings, with unsaved edits.
 * @param {Object}  args.savedSite     The site's settings, as saved.
 * @return {string} The URL, or an empty string while there's nothing to show.
 */
export function getPagePreviewUrl( {
	page = null,
	savedTemplate = '',
	savedStatus = page?.status,
	isHomepage = false,
	homeUrl = '',
	site = {},
	savedSite = site,
} ) {
	let link = isHomepage ? homeUrl : page?.link;

	// Still saved as the homepage, but not about to be: it has an address of
	// its own, which WordPress only gives it once that is saved.
	if ( ! isHomepage && page?.id && isHomeUrl( link, homeUrl ) ) {
		link = `${ homeUrl }?page_id=${ page.id }`;
	}

	if ( ! link ) {
		return '';
	}

	const url = new URL( link, window.location.origin );

	if (
		site.show_on_front !== savedSite.show_on_front ||
		( Number( site.page_on_front ) || 0 ) !==
			( Number( savedSite.page_on_front ) || 0 )
	) {
		url.searchParams.set( SHOW_ON_FRONT_PARAM, site.show_on_front );
		url.searchParams.set(
			PAGE_ON_FRONT_PARAM,
			String( Number( site.page_on_front ) || 0 )
		);
	}

	if ( ! page ) {
		return url.href;
	}

	if ( page.status !== 'publish' || savedStatus !== 'publish' ) {
		url.searchParams.set( 'preview', 'true' );
	}

	if ( ( page.template || '' ) !== ( savedTemplate || '' ) ) {
		url.searchParams.set( TEMPLATE_PARAM, page.template || 'default' );
	}

	return url.href;
}
