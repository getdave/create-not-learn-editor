/**
 * Where blocks in the editor's canvas are on screen, for the Compose layer to
 * draw over them.
 *
 * Measured every frame while Compose is on, so the layer follows the canvas
 * through its zoom, as it scrolls, and as blocks change size. Only a change
 * re-renders.
 */

/**
 * Internal dependencies
 */
import { useEffect, useRef, useState } from '../../wordpress-packages';

const EMPTY_OBJECT = {};

/**
 * The editor's canvas iframe, inside the editor's container.
 *
 * @param {?Element} container The editor's container.
 * @return {?HTMLIFrameElement} The iframe.
 */
export function getCanvasFrame( container ) {
	return container?.querySelector( 'iframe[name="editor-canvas"]' ) || null;
}

function round( value ) {
	return Math.round( value * 10 ) / 10;
}

function isSame( a, b ) {
	const aKeys = Object.keys( a );

	return (
		aKeys.length === Object.keys( b ).length &&
		aKeys.every( ( key ) => {
			const x = a[ key ];
			const y = b[ key ];

			return (
				y &&
				x.top === y.top &&
				x.left === y.left &&
				x.width === y.width &&
				x.height === y.height
			);
		} )
	);
}

/**
 * @param {Object}   options
 * @param {boolean}  options.isActive  Whether to measure.
 * @param {Object}   options.layerRef  Ref to the layer, which rects are
 *                                     relative to.
 * @param {Object}   options.editorRef Ref to the editor's container.
 * @param {string[]} options.clientIds Blocks to measure.
 * @return {Object} `{ frame, rects }`. `rects` maps each client ID found to
 *                  `{ top, left, width, height }`, and `frame` is the
 *                  canvas iframe's own rect, under `'frame'`'s same shape.
 */
export function useBlockRects( { isActive, layerRef, editorRef, clientIds } ) {
	const [ measured, setMeasured ] = useState( EMPTY_OBJECT );
	const latestRef = useRef( measured );
	const idsRef = useRef( clientIds );

	idsRef.current = clientIds;

	useEffect( () => {
		if ( ! isActive ) {
			latestRef.current = EMPTY_OBJECT;
			setMeasured( EMPTY_OBJECT );
			return undefined;
		}

		let request;

		const measure = () => {
			request = window.requestAnimationFrame( measure );

			const layer = layerRef.current;
			const iframe = getCanvasFrame( editorRef.current );
			const doc = iframe?.contentDocument;

			if ( ! layer || ! doc?.body ) {
				return;
			}

			const origin = layer.getBoundingClientRect();
			const frameRect = iframe.getBoundingClientRect();
			const offsetTop = frameRect.top - origin.top;
			const offsetLeft = frameRect.left - origin.left;
			const next = {
				frame: {
					height: round( frameRect.height ),
					left: round( offsetLeft ),
					top: round( offsetTop ),
					width: round( frameRect.width ),
				},
			};

			idsRef.current.forEach( ( clientId ) => {
				const node = doc.getElementById( `block-${ clientId }` );

				if ( ! node ) {
					return;
				}

				const rect = node.getBoundingClientRect();

				next[ clientId ] = {
					height: round( rect.height ),
					left: round( rect.left + offsetLeft ),
					top: round( rect.top + offsetTop ),
					width: round( rect.width ),
				};
			} );

			if ( ! isSame( next, latestRef.current ) ) {
				latestRef.current = next;
				setMeasured( next );
			}
		};

		measure();

		return () => window.cancelAnimationFrame( request );
	}, [ editorRef, isActive, layerRef ] );

	const { frame = null, ...rects } = measured;

	return { frame, rects };
}
