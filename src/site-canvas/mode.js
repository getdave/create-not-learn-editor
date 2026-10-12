/**
 * The site canvas's mode, shared by every canvas.
 *
 * - Browse, the default: the saved site as visitors see it.
 * - Edit: the page in the editor, with every block open to change.
 * - Compose: the same editor zoomed out, to work on the page's sections.
 *
 * Kept outside any one canvas so the mode carries over from page to page and
 * screen to screen. Nothing is saved, so every visit starts in Browse.
 *
 * Kept in a data store, registered once by name, rather than in this module:
 * app init and each route are built separately, each with its own copy of
 * this module, and all of them have to agree on the mode.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * so the editor layer, mounted from app init, can read it without making the
 * editor a static dependency of page boot.
 */

/**
 * WordPress dependencies
 */
import {
	createReduxStore,
	dispatch,
	register,
	select,
	useSelect,
} from '@wordpress/data';

export const MODE_BROWSE = 'browse';
export const MODE_EDIT = 'edit';
export const MODE_COMPOSE = 'compose';

const STORE_NAME = 'create-not-learn-editor/canvas-mode';

if ( ! select( STORE_NAME ) ) {
	register(
		createReduxStore( STORE_NAME, {
			reducer( state = MODE_BROWSE, action ) {
				return action.type === 'SET_CANVAS_MODE' ? action.mode : state;
			},
			actions: {
				setCanvasMode: ( mode ) => ( {
					mode,
					type: 'SET_CANVAS_MODE',
				} ),
			},
			selectors: {
				getCanvasMode: ( state ) => state,
			},
		} )
	);
}

/**
 * @return {string} The current mode.
 */
export function getCanvasMode() {
	return select( STORE_NAME ).getCanvasMode();
}

/**
 * Switch every canvas to a mode. Only the canvas decides when a switch may
 * happen, for instance after asking about unsaved changes, so call it from
 * there.
 *
 * @param {string} next `MODE_BROWSE`, `MODE_EDIT` or `MODE_COMPOSE`.
 */
export function setCanvasMode( next ) {
	if ( next !== getCanvasMode() ) {
		dispatch( STORE_NAME ).setCanvasMode( next );
	}
}

/**
 * @return {string} The current mode, kept up to date.
 */
export function useCanvasMode() {
	return useSelect(
		( selectStore ) => selectStore( STORE_NAME ).getCanvasMode(),
		[]
	);
}
