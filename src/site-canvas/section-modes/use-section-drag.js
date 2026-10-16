/**
 * Dragging a section to reorder the page, in Compose. A section is grabbed
 * anywhere on it: a press that moves past a few pixels starts a drag, and one
 * that doesn't is a click, which picks it. The header and footer stay where
 * they are.
 *
 * Watched from inside the canvas, as the section is pressed there, with the
 * pointer captured so the drag carries on outside it. The canvas scrolls when
 * dragged near its top or bottom, and Escape puts the section back.
 */

/**
 * Internal dependencies
 */
import { getDropIndex } from '../../routes/content/pages/page-sections';
import { useEffect, useRef, useState } from '../../wordpress-packages';

// How far a press moves before it is a drag, in pixels.
const DRAG_THRESHOLD = 5;

// How close to the canvas's top and bottom a drag scrolls it, and by how
// much a frame, in pixels.
const SCROLL_EDGE = 48;
const SCROLL_STEP = 16;

/**
 * @param {Object}    options
 * @param {?Document} options.canvasDocument The editor's canvas.
 * @param {boolean}   options.isActive       Whether sections can be dragged.
 * @param {Function}  options.getLatest      Returns `{ findTarget, frame,
 *                                           rects, sectionIds }`, as they
 *                                           are now.
 * @param {Function}  options.onDrop         Called with the section's client
 *                                           ID and its new index.
 * @return {?Object} While dragging, `{ clientId, from, slot, ghost }`: the
 *                   section, where it was, the gap it would drop into,
 *                   counted from 0, before the first section, and where its
 *                   ghost goes under the pointer, `{ left, top, width,
 *                   viewportWidth }`, on the canvas.
 */
export function useSectionDrag( {
	canvasDocument,
	getLatest,
	isActive,
	onDrop,
} ) {
	const [ drag, setDrag ] = useState( null );
	const latestRef = useRef();

	latestRef.current = { getLatest, onDrop };

	useEffect( () => {
		if ( ! isActive || ! canvasDocument ) {
			setDrag( null );
			return undefined;
		}

		const view = canvasDocument.defaultView;
		let press = null;

		// The section under a height on the canvas, and which side of its
		// middle the pointer is on.
		const getSpot = ( clientY ) => {
			const { frame, rects, sectionIds } = latestRef.current.getLatest();
			const y = frame.top + clientY;
			let over = sectionIds.length - 1;
			let position = 'after';

			for ( let index = 0; index < sectionIds.length; index++ ) {
				const rect = rects[ sectionIds[ index ] ];

				if ( rect && y < rect.top + rect.height / 2 ) {
					over = index;
					position = 'before';
					break;
				}
			}

			return {
				over,
				position,
				slot: over + ( position === 'after' ? 1 : 0 ),
			};
		};

		const cancel = () => {
			press = null;
			setDrag( null );
		};

		const onPointerDown = ( event ) => {
			if ( event.button !== 0 ) {
				return;
			}

			const { findTarget, sectionIds } = latestRef.current.getLatest();
			const block = event.target.closest?.( '[data-block]' );
			const clientId = block ? findTarget( block.dataset.block ) : null;
			const from = sectionIds.indexOf( clientId );

			if ( from === -1 ) {
				return;
			}

			// Where on the section it was grabbed, so its ghost keeps hold
			// of the same spot, and how wide it is laid out and drawn.
			const node = canvasDocument.getElementById( `block-${ clientId }` );
			const rect = node.getBoundingClientRect();

			press = {
				clientId,
				from,
				grabX: event.clientX - rect.left,
				grabY: event.clientY - rect.top,
				isDragging: false,
				viewportWidth: node.offsetWidth,
				width: rect.width,
				x: event.clientX,
				y: event.clientY,
			};

			try {
				event.target.setPointerCapture( event.pointerId );
			} catch {
				// Not every target can hold the pointer; the drag still works
				// while it stays over the canvas.
			}
		};

		const onPointerMove = ( event ) => {
			if ( ! press ) {
				return;
			}

			if (
				! press.isDragging &&
				Math.hypot( event.clientX - press.x, event.clientY - press.y ) <
					DRAG_THRESHOLD
			) {
				return;
			}

			press.isDragging = true;

			if ( event.clientY < SCROLL_EDGE ) {
				view.scrollBy( 0, -SCROLL_STEP );
			} else if ( event.clientY > view.innerHeight - SCROLL_EDGE ) {
				view.scrollBy( 0, SCROLL_STEP );
			}

			setDrag( {
				clientId: press.clientId,
				from: press.from,
				ghost: {
					left: event.clientX - press.grabX,
					top: event.clientY - press.grabY,
					viewportWidth: press.viewportWidth,
					width: press.width,
				},
				slot: getSpot( event.clientY ).slot,
			} );
		};

		const onPointerUp = ( event ) => {
			if ( ! press ) {
				return;
			}

			const { clientId, from, isDragging } = press;

			cancel();

			if ( ! isDragging ) {
				return;
			}

			const { over, position } = getSpot( event.clientY );
			const to = getDropIndex( from, over, position );

			if ( to !== from ) {
				latestRef.current.onDrop( clientId, to );
			}
		};

		const onKeyDown = ( event ) => {
			if ( event.key === 'Escape' && press?.isDragging ) {
				event.preventDefault();
				event.stopPropagation();
				cancel();
			}
		};

		canvasDocument.addEventListener( 'pointerdown', onPointerDown, true );
		canvasDocument.addEventListener( 'pointermove', onPointerMove );
		canvasDocument.addEventListener( 'pointerup', onPointerUp );
		canvasDocument.addEventListener( 'pointercancel', cancel );
		canvasDocument.addEventListener( 'keydown', onKeyDown, true );
		window.addEventListener( 'keydown', onKeyDown, true );

		return () => {
			canvasDocument.removeEventListener(
				'pointerdown',
				onPointerDown,
				true
			);
			canvasDocument.removeEventListener( 'pointermove', onPointerMove );
			canvasDocument.removeEventListener( 'pointerup', onPointerUp );
			canvasDocument.removeEventListener( 'pointercancel', cancel );
			canvasDocument.removeEventListener( 'keydown', onKeyDown, true );
			window.removeEventListener( 'keydown', onKeyDown, true );
		};
	}, [ canvasDocument, isActive ] );

	return drag;
}
