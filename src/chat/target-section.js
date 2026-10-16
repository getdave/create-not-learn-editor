/**
 * The section the chat changes: the one the canvas's section layer has
 * picked, or is editing, in Edit or Compose. In Edit, failing that, the one
 * holding core's selection.
 *
 * Sections are the blocks of the editor's section root, as Compose has them,
 * and only count while the editor has the page open that the chat is
 * changing.
 */

/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import { select as selectFromRegistry } from '@wordpress/data';

/**
 * Internal dependencies
 */
import { unlock } from '../lock-unlock';
import { getSectionTitle } from '../routes/content/pages/page-sections';
import {
	MODE_COMPOSE,
	MODE_EDIT,
	STORE_NAME as CANVAS_STORE,
} from '../site-canvas/mode';

const EMPTY_ARRAY = [];

/**
 * @param {Function} select Registry `select`.
 * @param {?number}  pageId The page the chat is changing.
 * @return {boolean} Whether the editor has that page open.
 */
export function isEditingPage( select, pageId ) {
	const editor = select( 'core/editor' );

	return (
		!! pageId &&
		editor?.getCurrentPostType?.() === 'page' &&
		Number( editor.getCurrentPostId() ) === Number( pageId )
	);
}

/**
 * @param {Function} select Registry `select`.
 * @return {string[]} The client IDs of the page's sections, top to bottom.
 */
export function getSectionIds( select = selectFromRegistry ) {
	const store = unlock( select( blockEditorStore ) );
	const root = store.getSectionRootClientId?.();

	return root ? store.getBlockOrder( root ) : EMPTY_ARRAY;
}

/**
 * The page's sections, named as Compose names them.
 *
 * @param {Function} select Registry `select`.
 * @return {Object[]} `{ clientId, title }` items, top to bottom.
 */
export function getSections( select = selectFromRegistry ) {
	const store = select( blockEditorStore );

	return getSectionIds( select ).map( ( clientId ) => ( {
		clientId,
		title: getSectionTitle( store.getBlock( clientId ) ),
	} ) );
}

/**
 * The section selected on the canvas, if any.
 *
 * @param {Function} select Registry `select`.
 * @param {?number}  pageId The page the chat is changing.
 * @return {?string} The section's client ID, or null.
 */
export function getSelectedSection( select = selectFromRegistry, pageId ) {
	if ( ! isEditingPage( select, pageId ) ) {
		return null;
	}

	const mode = select( CANVAS_STORE ).getCanvasMode();

	if ( mode !== MODE_COMPOSE && mode !== MODE_EDIT ) {
		return null;
	}

	const sectionIds = getSectionIds( select );
	const picked = select( CANVAS_STORE ).getPickedSection();

	if ( sectionIds.includes( picked ) ) {
		return picked;
	}

	if ( mode !== MODE_EDIT ) {
		return null;
	}

	const store = select( blockEditorStore );
	const selectedId = store.getSelectedBlockClientId();

	if ( ! selectedId ) {
		return null;
	}

	return (
		[ selectedId, ...store.getBlockParents( selectedId, true ) ].find(
			( clientId ) => sectionIds.includes( clientId )
		) || null
	);
}
