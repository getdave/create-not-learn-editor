/**
 * The page the chat adds sections to: the one on the canvas.
 */

/**
 * WordPress dependencies
 */
import { store as coreDataStore } from '@wordpress/core-data';
import { select as selectFromRegistry } from '@wordpress/data';
import { decodeEntities } from '@wordpress/html-entities';

/**
 * The page the canvas shows, if it shows one.
 *
 * The canvas keeps its editor open underneath the preview, so the editor's
 * post is the page on show. Before the editor has loaded, the Pages screen's
 * address says which page it shows, and every other screen shows the
 * homepage.
 *
 * @param {Function} select Registry `select`.
 * @return {?Object} `{ id, title }`, or `null` when no page is on show.
 */
export function findTargetPage( select = selectFromRegistry ) {
	const editor = select( 'core/editor' );
	const core = select( coreDataStore );
	let id = null;

	if ( editor?.getCurrentPostType?.() === 'page' ) {
		id = editor.getCurrentPostId();
	}

	if ( ! id ) {
		// The route's search params are inside `p`, after its path.
		const route = new URL( window.location.href ).searchParams.get( 'p' );
		const search = new URLSearchParams( route?.split( '?' )[ 1 ] || '' );
		const fromAddress = Number(
			search.get( 'postId' ) || search.get( 'previewId' )
		);

		if ( fromAddress ) {
			id = fromAddress;
		}
	}

	if ( ! id ) {
		const site = core.getEntityRecord( 'root', 'site' );

		if ( site?.show_on_front === 'page' && site.page_on_front ) {
			id = site.page_on_front;
		}
	}

	if ( ! id ) {
		return null;
	}

	const page = core.getEditedEntityRecord( 'postType', 'page', id );
	const title =
		typeof page?.title === 'string' ? page.title : page?.title?.raw;

	return { id, title: decodeEntities( title || '' ) };
}
