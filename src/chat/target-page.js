/**
 * The page the chat adds sections to: the one being worked on, or one named
 * in the request.
 */

/**
 * WordPress dependencies
 */
import { store as coreDataStore } from '@wordpress/core-data';
import { select as selectFromRegistry } from '@wordpress/data';
import { decodeEntities } from '@wordpress/html-entities';

// The pages the chat offers, in the order the Pages screen lists them.
export const PAGES_QUERY = {
	context: 'edit',
	order: 'asc',
	orderby: 'menu_order',
	per_page: 100,
	status: [ 'publish', 'draft', 'private' ],
};

function getTitle( page ) {
	const title =
		typeof page?.title === 'string' ? page.title : page?.title?.raw;

	return decodeEntities( title || '' );
}

function getHomepageId( select ) {
	const site = select( coreDataStore ).getEntityRecord( 'root', 'site' );

	return site?.show_on_front === 'page' ? site.page_on_front || null : null;
}

function toTarget( id, select ) {
	if ( ! id ) {
		return null;
	}

	const page = select( coreDataStore ).getEditedEntityRecord(
		'postType',
		'page',
		id
	);

	return { id, title: getTitle( page ) };
}

/**
 * The route on show: its path, and the search params boot keeps inside `p`.
 *
 * @return {Object} `{ path, search }`.
 */
function getRoute() {
	const route =
		new URL( window.location.href ).searchParams.get( 'p' ) || '/';
	const [ path, query = '' ] = route.split( '?' );

	return { path, search: new URLSearchParams( query ) };
}

/**
 * The page being worked on, if there is one: the page open on the Pages
 * screen, or in the editor. Every other screen is about the site as a whole,
 * so there the chat asks which page.
 *
 * @param {Function} select Registry `select`.
 * @return {?Object} `{ id, title }`, or `null`.
 */
export function findTargetPage( select = selectFromRegistry ) {
	const { path, search } = getRoute();
	const editing = path.match( /^\/types\/page\/edit\/(\d+)/ );

	if ( editing ) {
		return toTarget( Number( editing[ 1 ] ), select );
	}

	if ( ! path.startsWith( '/types/page' ) ) {
		return null;
	}

	const fromAddress = search.get( 'postId' ) || search.get( 'previewId' );

	if ( fromAddress === 'home' ) {
		return toTarget( getHomepageId( select ), select );
	}

	if ( Number( fromAddress ) ) {
		return toTarget( Number( fromAddress ), select );
	}

	// The Pages screen with nothing picked shows what the editor has open.
	const editor = select( 'core/editor' );

	return editor?.getCurrentPostType?.() === 'page'
		? toTarget( editor.getCurrentPostId(), select )
		: null;
}

/**
 * The site's pages, for the chat to offer.
 *
 * @param {Function} select Registry `select`.
 * @return {Object[]} `{ id, status, title }` items.
 */
export function getPages( select = selectFromRegistry ) {
	return toPages(
		select( coreDataStore ).getEntityRecords(
			'postType',
			'page',
			PAGES_QUERY
		)
	);
}

/**
 * @param {?Object[]} records Page records.
 * @return {Object[]} `{ id, status, title }` items.
 */
export function toPages( records ) {
	return ( records || [] ).map( ( page ) => ( {
		id: page.id,
		status: page.status,
		title: getTitle( page ),
	} ) );
}

function escapeRegExp( value ) {
	return value.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
}

/**
 * The page a request names, like "my About page" or "the homepage".
 *
 * @param {string}   text   The request.
 * @param {Object[]} pages  `{ id, title }` items.
 * @param {?number}  homeId The homepage's ID, if it is a page.
 * @return {?Object} `{ id, title }`, or `null`.
 */
export function findPageInText( text, pages, homeId = null ) {
	if ( homeId && /\bhome ?page\b/i.test( text ) ) {
		return pages.find( ( page ) => page.id === homeId ) || null;
	}

	/*
	 * A title only counts where a page is meant: after "to", "on" or "in",
	 * or before "page". "A section about our team" isn't the About page.
	 */
	const names = ( title ) => {
		const name = escapeRegExp( title );
		const end = '(?=$|[^\\p{L}\\p{N}])';

		return new RegExp(
			`(?:\\b(?:to|on|in|onto|into)\\s+(?:my\\s+|the\\s+|our\\s+)?${ name }${ end })|(?:(?:^|[^\\p{L}\\p{N}])${ name }\\s+page\\b)`,
			'iu'
		);
	};

	return (
		[ ...pages ]
			.filter( ( page ) => page.title )
			// The longest first, so "About us" wins over "About".
			.sort( ( a, b ) => b.title.length - a.title.length )
			.find( ( page ) => names( page.title ).test( text ) ) || null
	);
}

/**
 * The page a request names, once the site's pages have loaded.
 *
 * @param {string}   text   The request.
 * @param {Function} select Registry `select`.
 * @return {?Object} `{ id, title }`, or `null`.
 */
export function findNamedPage( text, select = selectFromRegistry ) {
	return findPageInText( text, getPages( select ), getHomepageId( select ) );
}
