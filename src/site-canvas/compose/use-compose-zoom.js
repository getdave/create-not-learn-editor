/**
 * Zoom the editor out while the canvas is in Compose, and back in after.
 *
 * Core's zoom-out is used for its zoom alone: the canvas scaling down to fit,
 * keeping its place on the page. Core can't scale the canvas without also
 * turning on the rest of its zoom-out mode, its own section toolbars and
 * inserters, so the Compose layer takes every click and key over the canvas
 * to keep those from ever firing, and the stylesheet hides what they draw.
 *
 * Core lays the zoomed-out page out at the width the canvas had before
 * zooming, and only scales it down to fit. The canvas is narrower than a
 * desktop screen, so on its own the page would barely shrink, and be laid out
 * as on a tablet. So the editor is widened to a desktop's width for the few
 * frames core takes to measure it, then zoomed out, then let go. Core's own
 * zoom-out works the same way the other way round: the inserter opening
 * beside it is what narrows the canvas.
 *
 * The canvas's mode decides. Should core zoom back in by itself, Compose
 * zooms it out again.
 */

/**
 * Internal dependencies
 */
import { unlock } from '../../lock-unlock';
import {
	blockEditorStore,
	useEffect,
	useRegistry,
} from '../../wordpress-packages';
import { getCanvasFrame } from './use-block-rects';

const ZOOMED_OUT = 'auto-scaled';

// Sets the editor to a desktop's width while core measures it.
const WIDENING_CLASS = 'is-compose-widening';

// Frames for core to measure the widened canvas, and to start zooming
// before it is let go.
const MEASURE_FRAMES = 3;
const RELEASE_FRAMES = 2;

let pending = [];

/**
 * Do something once Compose has zoomed the editor back in, such as select a
 * block to edit. Selecting while zoomed out would leave core's zoom-out mode
 * to decide what to do with it.
 *
 * @param {Function} callback Called with the registry.
 */
export function afterZoomIn( callback ) {
	pending.push( callback );
}

/**
 * @param {boolean} isComposing Whether the canvas is in Compose.
 * @param {Object}  editorRef   Ref to the editor's container.
 */
export function useComposeZoom( isComposing, editorRef ) {
	const registry = useRegistry();

	useEffect( () => {
		const actions = unlock( registry.dispatch( blockEditorStore ) );
		const selectors = unlock( registry.select( blockEditorStore ) );

		if ( ! isComposing ) {
			if ( selectors.isZoomOut() ) {
				actions.resetZoomLevel();
			}

			const callbacks = pending;
			pending = [];
			callbacks.forEach( ( callback ) => callback( registry ) );

			return undefined;
		}

		/*
		 * Nothing stays selected or entered: core's zoom-out would pick the
		 * section around a selected block and draw its own toolbar over it.
		 * The layer takes the selection over instead.
		 */
		actions.stopEditingContentOnlySection();
		actions.clearSelectedBlock();

		let isCancelled = false;
		let isZoomed = false;
		let request;
		let widened = null;

		const zoomOut = () => {
			if ( selectors.getZoomLevel() !== ZOOMED_OUT ) {
				actions.setZoomLevel( ZOOMED_OUT );
			}
		};
		const whenReady = ( isReady, then ) => {
			const tick = () => {
				if ( isCancelled ) {
					return;
				}

				if ( isReady() ) {
					then();
				} else {
					request = window.requestAnimationFrame( tick );
				}
			};

			tick();
		};
		const afterFrames = ( count, then ) => {
			let left = count;

			whenReady( () => left-- <= 0, then );
		};

		// Zoomed out already, by a canvas before this one, core has no
		// unzoomed width to start from.
		if ( selectors.isZoomOut() ) {
			actions.resetZoomLevel();
		}

		whenReady(
			() => getCanvasFrame( editorRef.current )?.contentDocument?.body,
			() => {
				widened = editorRef.current;
				widened.classList.add( WIDENING_CLASS );
				afterFrames( MEASURE_FRAMES, () => {
					isZoomed = true;
					zoomOut();
					afterFrames( RELEASE_FRAMES, () =>
						widened.classList.remove( WIDENING_CLASS )
					);
				} );
			}
		);

		const unsubscribe = registry.subscribe( () => {
			if ( isZoomed ) {
				zoomOut();
			}
		}, blockEditorStore );

		return () => {
			isCancelled = true;
			window.cancelAnimationFrame( request );
			widened?.classList.remove( WIDENING_CLASS );
			unsubscribe();
		};
	}, [ editorRef, isComposing, registry ] );

	// The zoom is the block editor's, shared by every editor. Leaving the
	// canvas mid-Compose mustn't leave the full-screen editor zoomed out.
	useEffect(
		() => () => {
			if ( unlock( registry.select( blockEditorStore ) ).isZoomOut() ) {
				unlock(
					registry.dispatch( blockEditorStore )
				).resetZoomLevel();
			}

			pending = [];
		},
		[ registry ]
	);
}
