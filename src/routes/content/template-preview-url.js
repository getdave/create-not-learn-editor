/**
 * Internal dependencies
 */
import { LAYOUT_PARAM, SHOW_ON_FRONT_PARAM } from '../../site-canvas/urls';

// Layouts for one post or page, rather than a list of them.
const SINGULAR_SLUG = /^(single|page|singular|attachment)(-|$)/;

/**
 * @param {Object} template Template record.
 * @return {boolean} Whether the layout shows one post or page at a time.
 */
export function isSingularTemplate( template ) {
	return (
		Boolean( template?.is_custom ) ||
		SINGULAR_SLUG.test( template?.slug || '' )
	);
}

/**
 * A published post or page to show a layout for one of them on: one that
 * uses it if there is one, then one that leaves it to the theme.
 *
 * @param {Object}   template Template record.
 * @param {Object[]} records  Posts or pages to choose from.
 * @return {?Object} The record, or `null` for a layout of lists.
 */
export function getTemplateSample( template, records = [] ) {
	if ( ! isSingularTemplate( template ) ) {
		return null;
	}

	const published = records.filter(
		( record ) => record?.status === 'publish' && record.link
	);

	return (
		published.find( ( record ) => record.template === template.slug ) ||
		published.find( ( record ) => ! record.template ) ||
		published[ 0 ] ||
		null
	);
}

/**
 * Where to preview a layout: a post or page that would use it, or the site's
 * address for a layout of lists, like Posts Listing. The layout is passed
 * along too, so the preview shows that one even where WordPress would pick a
 * more specific one. A layout of lists is shown with the homepage listing the
 * latest posts, so it has posts to list even when the homepage is a page. The
 * homepage's own layout is shown on the homepage as it is.
 *
 * @param {Object}   args
 * @param {string}   args.homeUrl  The site's address.
 * @param {Object[]} args.records  Posts or pages to show a layout for one on.
 * @param {?Object}  args.template Template record.
 * @return {string} The URL, or an empty string with nothing to show.
 */
export function getTemplatePreviewUrl( { homeUrl, records, template } ) {
	const sample = getTemplateSample( template, records );
	const link = sample?.link || homeUrl;

	if ( ! template?.slug || ! link ) {
		return '';
	}

	const url = new URL( link, window.location.origin );

	if ( ! sample && template.slug !== 'front-page' ) {
		url.searchParams.set( SHOW_ON_FRONT_PARAM, 'posts' );
	}

	url.searchParams.set( LAYOUT_PARAM, template.slug );

	return url.href;
}
