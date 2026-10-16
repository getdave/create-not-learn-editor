/**
 * Zooming the canvas out to Compose and back in to Edit from the canvas
 * itself: a − and + pair in its corner, as on a map, and a pinch on a
 * trackpad, or Ctrl or ⌘ with the scroll wheel.
 *
 * There are only two steps, the page and the whole page zoomed out, so
 * each control is spent once used, and a gesture moves one step at most.
 */

/**
 * Internal dependencies
 */
import {
	__,
	Button,
	minusIcon,
	plusIcon,
	useEffect,
	useRef,
} from '../wordpress-packages';
import { useCanvasDocument } from './use-canvas-document';

// How far a pinch or scroll has to go before it zooms.
const WHEEL_THRESHOLD = 40;
const SCALE_THRESHOLD = 0.15;

// A pause this long ends a gesture, so the next one can zoom again.
const GESTURE_END_MS = 250;

/**
 * @param {Object}   props
 * @param {boolean}  props.isComposing Whether the canvas is zoomed out.
 * @param {Function} props.onZoomIn    Zooms back in to Edit.
 * @param {Function} props.onZoomOut   Zooms out to Compose.
 * @return {Element} The controls.
 */
export function ZoomControls( { isComposing, onZoomIn, onZoomOut } ) {
	return (
		<div
			aria-label={ __( 'Zoom' ) }
			className="cnl-site-canvas__zoom-controls"
			role="group"
		>
			<Button
				accessibleWhenDisabled
				disabled={ ! isComposing }
				icon={ plusIcon }
				label={ __( 'Zoom in' ) }
				onClick={ onZoomIn }
				showTooltip
				tooltipPosition="middle left"
			/>
			<Button
				accessibleWhenDisabled
				disabled={ isComposing }
				icon={ minusIcon }
				label={ __( 'Zoom out to arrange sections' ) }
				onClick={ onZoomOut }
				showTooltip
				tooltipPosition="middle left"
			/>
		</div>
	);
}

/**
 * Zoom with a pinch, or Ctrl or ⌘ and the scroll wheel, over the canvas.
 * Either way the browser would otherwise zoom the whole screen.
 *
 * @param {Object}   options
 * @param {boolean}  options.enabled   Whether zooming is offered.
 * @param {Object}   options.areaRef   Ref to the canvas's area, around the
 *                                     editor and the layers over it.
 * @param {Object}   options.editorRef Ref to the editor's container.
 * @param {Function} options.onZoomIn  Zooms back in to Edit.
 * @param {Function} options.onZoomOut Zooms out to Compose.
 */
export function useZoomGestures( {
	enabled,
	areaRef,
	editorRef,
	onZoomIn,
	onZoomOut,
} ) {
	// The editor's iframe keeps its events to itself.
	const canvasDocument = useCanvasDocument( editorRef );
	const handlers = useRef();

	handlers.current = { onZoomIn, onZoomOut };

	useEffect( () => {
		const targets = [ areaRef.current, canvasDocument ].filter( Boolean );

		if ( ! enabled || ! targets.length ) {
			return;
		}

		let travel = 0;
		let hasZoomed = false;
		let endTimer;

		const zoom = ( direction ) => {
			hasZoomed = true;

			if ( direction < 0 ) {
				handlers.current.onZoomOut();
			} else {
				handlers.current.onZoomIn();
			}
		};
		const waitForEnd = () => {
			window.clearTimeout( endTimer );
			endTimer = window.setTimeout( () => {
				travel = 0;
				hasZoomed = false;
			}, GESTURE_END_MS );
		};

		// Chrome and Firefox send a pinch as the wheel with Ctrl held.
		const onWheel = ( event ) => {
			if ( ! event.ctrlKey && ! event.metaKey ) {
				return;
			}

			event.preventDefault();
			waitForEnd();
			travel -= event.deltaY;

			if ( ! hasZoomed && Math.abs( travel ) > WHEEL_THRESHOLD ) {
				zoom( travel );
			}
		};

		// Safari sends a pinch as gestures of its own.
		const onGesture = ( event ) => {
			event.preventDefault();
			waitForEnd();

			if (
				! hasZoomed &&
				Math.abs( event.scale - 1 ) > SCALE_THRESHOLD
			) {
				zoom( event.scale - 1 );
			}
		};

		targets.forEach( ( target ) => {
			target.addEventListener( 'wheel', onWheel, { passive: false } );
			target.addEventListener( 'gesturestart', onGesture );
			target.addEventListener( 'gesturechange', onGesture );
		} );

		return () => {
			window.clearTimeout( endTimer );
			targets.forEach( ( target ) => {
				target.removeEventListener( 'wheel', onWheel );
				target.removeEventListener( 'gesturestart', onGesture );
				target.removeEventListener( 'gesturechange', onGesture );
			} );
		};
	}, [ areaRef, canvasDocument, enabled ] );
}
