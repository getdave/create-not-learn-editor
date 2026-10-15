/**
 * What the site's homepage is, read from WordPress's Reading settings, and how
 * the main menu links to it.
 *
 * WordPress keeps the homepage in three settings that can disagree: whether it
 * shows a page or the latest posts, which page, and which page lists the
 * posts. A theme's `front-page` layout overrides all of them. This works out
 * what visitors actually get, so the rest of the screen can show one homepage
 * whatever is stored.
 */

/**
 * Internal dependencies
 */
import {
	getBlockAttributes,
	getBlockName,
} from '../../navigation-edit/navigation-blocks';

/**
 * The homepage's stand-in for a page ID in the Pages screen's address, so it
 * can be previewed and opened when no page is behind it.
 */
export const HOMEPAGE = 'home';

const LINK_BLOCKS = [ 'core/navigation-link', 'core/navigation-submenu' ];

/**
 * What the homepage shows.
 *
 * - `page`: the page `pageId`.
 * - `posts`: the latest posts. Stored as `posts`, or as a page with none
 *   picked, which WordPress shows the same way.
 * - `theme`: the theme's `front-page` layout, which wins over the setting.
 *
 * A page picked but not published, or gone, is reported as a `problem`, since
 * visitors get nothing there. The page picked is kept as `rememberedId` while
 * the latest posts show, so switching back offers it first.
 *
 * @param {Object}            args
 * @param {string}            args.showOnFront          `page` or `posts`.
 * @param {number|string}     args.pageOnFront          Page picked, if any.
 * @param {?Object|undefined} args.frontPage            That page's record: null
 *                                                      when it doesn't exist,
 *                                                      undefined while loading.
 * @param {boolean}           args.hasFrontPageTemplate Whether the theme has a
 *                                                      `front-page` layout.
 * @return {Object} `{ shows, pageId, rememberedId, problem }`.
 */
export function getHomepageState( {
	showOnFront,
	pageOnFront,
	frontPage,
	hasFrontPageTemplate = false,
} ) {
	const rememberedId = Number( pageOnFront ) || 0;
	const isStatic = showOnFront === 'page' && rememberedId > 0;
	let problem = '';

	if ( isStatic && frontPage !== undefined ) {
		if ( ! frontPage || frontPage.status === 'trash' ) {
			problem = 'missing';
		} else if ( frontPage.status !== 'publish' ) {
			problem = 'unpublished';
		}
	}

	let shows = isStatic ? 'page' : 'posts';

	if ( hasFrontPageTemplate ) {
		shows = 'theme';
		// The theme's layout shows whatever happens to the page.
		problem = '';
	}

	return {
		pageId: isStatic && problem !== 'missing' ? rememberedId : 0,
		problem,
		rememberedId,
		shows,
	};
}

/**
 * Whether a template ID is for the theme's `front-page` layout.
 *
 * @param {string} templateId Template ID, `theme//slug`.
 * @return {boolean} Whether it is.
 */
export function isFrontPageTemplateId( templateId ) {
	return String( templateId || '' ).endsWith( '//front-page' );
}

/**
 * Whether a template ID is for the `index` layout every archive falls back to.
 *
 * @param {string} templateId Template ID, `theme//slug`.
 * @return {boolean} Whether it is.
 */
export function isIndexTemplateId( templateId ) {
	return String( templateId || '' ).endsWith( '//index' );
}

function normalizeUrl( url, base ) {
	try {
		const parsed = new URL( url, base );

		return {
			hash: parsed.hash,
			path: `${ parsed.origin }${ parsed.pathname.replace( /\/+$/, '' ) }`,
			search: parsed.search,
		};
	} catch {
		return null;
	}
}

/**
 * Whether a link goes to the site's homepage. Links to a part of it, like
 * `/#contact`, or with a query, don't count.
 *
 * @param {string} url     Link URL, possibly relative.
 * @param {string} homeUrl The site's address.
 * @return {boolean} Whether it goes home.
 */
export function isHomeUrl( url, homeUrl ) {
	if ( ! url || ! homeUrl ) {
		return false;
	}

	const home = normalizeUrl( homeUrl );
	const link = normalizeUrl( url, homeUrl );

	return (
		Boolean( home && link ) &&
		! link.search &&
		! link.hash &&
		link.path === home.path
	);
}

/**
 * Whether a menu item takes visitors to the homepage: a Home link, a link to
 * the page the homepage shows, or a custom link to the site's address.
 *
 * @param {Object} block               Menu item, parsed or editor block.
 * @param {Object} context
 * @param {number} context.frontPageId Page the homepage shows, or 0.
 * @param {string} context.homeUrl     The site's address.
 * @return {boolean} Whether it does.
 */
export function isHomeMenuItem( block, { frontPageId = 0, homeUrl = '' } ) {
	const name = getBlockName( block );

	if ( name === 'core/home-link' ) {
		return true;
	}

	if ( ! LINK_BLOCKS.includes( name ) ) {
		return false;
	}

	const attributes = getBlockAttributes( block );

	if ( attributes.kind === 'post-type' ) {
		return (
			Boolean( frontPageId ) &&
			( ! attributes.type || attributes.type === 'page' ) &&
			Number( attributes.id ) === Number( frontPageId )
		);
	}

	if ( attributes.kind && attributes.kind !== 'custom' ) {
		return false;
	}

	return isHomeUrl( attributes.url, homeUrl );
}

/**
 * The first menu item, top to bottom, that takes visitors to the homepage.
 * That one stands for the homepage in the menu; any others are plain links.
 *
 * @param {Object[]} blocks  Menu items.
 * @param {Object}   context See `isHomeMenuItem`.
 * @return {?Object} The menu item, or null when the menu doesn't go home.
 */
export function findHomeMenuItem( blocks, context ) {
	for ( const block of blocks || [] ) {
		if ( isHomeMenuItem( block, context ) ) {
			return block;
		}

		const inner = findHomeMenuItem( block.innerBlocks, context );

		if ( inner ) {
			return inner;
		}
	}

	return null;
}

/**
 * Swap a menu's links to a page for Home links, in the same place. Used when
 * the homepage stops showing that page, so the menu still goes home. A link
 * with a submenu under it stays, as a Home link can't hold one.
 *
 * @param {Object[]} blocks Parsed menu blocks.
 * @param {number}   pageId The page that was the homepage.
 * @param {string}   label  The Home link's label.
 * @return {Object[]} The blocks, the same array if nothing linked the page.
 */
export function replacePageLinksWithHomeLinks( blocks, pageId, label ) {
	let hasChanged = false;
	const next = ( blocks || [] ).map( ( block ) => {
		const attributes = getBlockAttributes( block );

		if (
			getBlockName( block ) === 'core/navigation-link' &&
			! block.innerBlocks?.length &&
			attributes.kind === 'post-type' &&
			( ! attributes.type || attributes.type === 'page' ) &&
			Number( attributes.id ) === Number( pageId )
		) {
			hasChanged = true;

			return {
				attributes: { label },
				innerBlocks: [],
				name: 'core/home-link',
			};
		}

		const innerBlocks = replacePageLinksWithHomeLinks(
			block.innerBlocks,
			pageId,
			label
		);

		if ( innerBlocks === block.innerBlocks ) {
			return block;
		}

		hasChanged = true;

		return { ...block, innerBlocks };
	} );

	return hasChanged ? next : blocks;
}

/**
 * Remove the homepage's page from a list of pages, so it isn't listed as a
 * page as well as the homepage. Pages under it stay.
 *
 * @param {Object[]} pages  Page records.
 * @param {number}   pageId The page the homepage shows, or 0.
 * @return {Object[]} The other pages.
 */
export function withoutHomepagePage( pages, pageId ) {
	if ( ! pageId ) {
		return pages;
	}

	return pages.filter( ( page ) => Number( page.id ) !== Number( pageId ) );
}

/**
 * The page "A page" goes to: the one the homepage showed last, or else a page
 * called Home. Without either, a page has to be started.
 *
 * @param {Object[]} pages                Every page.
 * @param {Object}   options
 * @param {Function} options.getTitle     Returns a page's plain title.
 * @param {string}   options.homeTitle    What a homepage is usually called.
 * @param {number}   options.rememberedId The page the homepage showed last.
 * @return {?Object} The page, or null.
 */
export function findDefaultHomepagePage(
	pages,
	{ getTitle, homeTitle, rememberedId = 0 }
) {
	const home = String( homeTitle ).toLowerCase();

	return (
		pages.find(
			( page ) => Number( page.id ) === Number( rememberedId )
		) ||
		pages.find( ( page ) => page.slug === 'home' ) ||
		pages.find(
			( page ) => String( getTitle( page ) ).toLowerCase() === home
		) ||
		null
	);
}
