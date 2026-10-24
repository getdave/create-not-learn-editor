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
 * The section Compose has picked is kept beside it, for the chat: Compose's
 * pick is its own, not core's block selection. So is the header or footer
 * open in Edit content or Freeform, for the editor extension that opens a
 * template part's blocks: how far they open depends on which. And so is a
 * request from outside the canvas, the chat's, to open the header or footer
 * as Edit header or Edit footer does, for the canvas to take up.
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

export const STORE_NAME = 'create-not-learn-editor/canvas-mode';

// How a header or footer is open: Edit content, its words and images only,
// or Freeform, core's full block tools.
export const PART_CONTENT = 'content';
export const PART_FREEFORM = 'freeform';

if ( ! select( STORE_NAME ) ) {
	register(
		createReduxStore( STORE_NAME, {
			reducer(
				state = {
					mode: MODE_BROWSE,
					openPart: null,
					partRequest: null,
					pickedSection: null,
				},
				action
			) {
				switch ( action.type ) {
					case 'SET_CANVAS_MODE':
						return { ...state, mode: action.mode };
					case 'SET_OPEN_PART':
						return { ...state, openPart: action.openPart };
					case 'SET_PICKED_SECTION':
						return { ...state, pickedSection: action.clientId };
					case 'SET_PART_REQUEST':
						return { ...state, partRequest: action.area };
				}

				return state;
			},
			actions: {
				setCanvasMode: ( mode ) => ( {
					mode,
					type: 'SET_CANVAS_MODE',
				} ),
				setOpenPart: ( openPart ) => ( {
					openPart,
					type: 'SET_OPEN_PART',
				} ),
				setPickedSection: ( clientId ) => ( {
					clientId,
					type: 'SET_PICKED_SECTION',
				} ),
				setPartRequest: ( area ) => ( {
					area,
					type: 'SET_PART_REQUEST',
				} ),
			},
			selectors: {
				getCanvasMode: ( state ) => state.mode,
				getOpenPart: ( state ) => state.openPart,
				getPickedSection: ( state ) => state.pickedSection,
				getPartRequest: ( state ) => state.partRequest,
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

/**
 * Note the section Compose has picked, or that none is.
 *
 * @param {?string} clientId The section's client ID, or null.
 */
export function setPickedSection( clientId ) {
	if ( clientId !== select( STORE_NAME ).getPickedSection() ) {
		dispatch( STORE_NAME ).setPickedSection( clientId );
	}
}

/**
 * Ask the canvas to open the header or footer, as Edit header or Edit
 * footer does, or stop asking. The canvas takes the request up, and clears
 * it, once it is in Edit or Compose with that part on it.
 *
 * @param {?string} area `header` or `footer`, or null.
 */
export function requestOpenPart( area ) {
	if ( area !== select( STORE_NAME ).getPartRequest() ) {
		dispatch( STORE_NAME ).setPartRequest( area );
	}
}

/**
 * Note the header or footer open in Edit content or Freeform, or that none
 * is. Set before core opens it, so its blocks open the right way from the
 * start.
 *
 * @param {?string} clientId The part's client ID, or null.
 * @param {?string} how      `PART_CONTENT` or `PART_FREEFORM`.
 */
export function setOpenPart( clientId, how = null ) {
	const current = select( STORE_NAME ).getOpenPart();
	const next = clientId && how ? { clientId, how } : null;

	if ( current?.clientId !== next?.clientId || current?.how !== next?.how ) {
		dispatch( STORE_NAME ).setOpenPart( next );
	}
}

/**
 * How a header or footer is open, kept up to date.
 *
 * @param {string} clientId The part's client ID.
 * @return {?string} `PART_CONTENT` or `PART_FREEFORM`, or null while the
 *                   section layer hasn't opened it, as when core's own tools
 *                   do.
 */
export function useOpenPart( clientId ) {
	return useSelect(
		( selectStore ) => {
			const openPart = selectStore( STORE_NAME ).getOpenPart();

			return openPart?.clientId === clientId ? openPart.how : null;
		},
		[ clientId ]
	);
}
