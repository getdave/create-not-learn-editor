/**
 * Pan and zoom maths for the Site Overview canvas.
 *
 * A view is `{ x, y, k }`: the canvas is scaled by `k`, then moved by `x` and
 * `y`, so a point on the canvas shows on screen at `point * k + offset`.
 */

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 2;

// The zoom levels the zoom buttons step through.
const ZOOM_STEPS = [ 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2 ];

export function clampZoom( k ) {
	return Math.min( MAX_ZOOM, Math.max( MIN_ZOOM, k ) );
}

/**
 * Zoom to a new level, keeping a point on screen where it is.
 *
 * @param {Object} view  Current view.
 * @param {number} k     New zoom level.
 * @param {Object} point Screen point to zoom around, `{ x, y }`.
 * @return {Object} New view.
 */
export function zoomAt( view, k, point ) {
	const nextK = clampZoom( k );
	const ratio = nextK / view.k;

	return {
		k: nextK,
		x: point.x - ( point.x - view.x ) * ratio,
		y: point.y - ( point.y - view.y ) * ratio,
	};
}

/**
 * The next zoom level up or down from the current one.
 *
 * @param {number} k         Current zoom level.
 * @param {number} direction 1 to zoom in, -1 to zoom out.
 * @return {number} Next zoom level.
 */
export function getNextZoomStep( k, direction ) {
	if ( direction > 0 ) {
		return ZOOM_STEPS.find( ( step ) => step > k + 0.001 ) ?? MAX_ZOOM;
	}

	return (
		[ ...ZOOM_STEPS ].reverse().find( ( step ) => step < k - 0.001 ) ??
		MIN_ZOOM
	);
}

/**
 * The view that shows the whole of a rectangle, centred.
 *
 * @param {Object} bounds  Rectangle on the canvas, `{ x, y, width, height }`.
 * @param {Object} size    Screen size, `{ width, height }`.
 * @param {number} padding Space to leave around it, in screen pixels.
 * @param {number} maxZoom Zoom level not to go past, so a small site is not
 *                         blown up.
 * @return {Object} View.
 */
export function fitView( bounds, size, padding = 48, maxZoom = 1 ) {
	const availableWidth = Math.max( 1, size.width - padding * 2 );
	const availableHeight = Math.max( 1, size.height - padding * 2 );
	const k = clampZoom(
		Math.min(
			availableWidth / Math.max( 1, bounds.width ),
			availableHeight / Math.max( 1, bounds.height ),
			maxZoom
		)
	);

	return {
		k,
		x: ( size.width - bounds.width * k ) / 2 - bounds.x * k,
		y: ( size.height - bounds.height * k ) / 2 - bounds.y * k,
	};
}

/**
 * The view that centres a rectangle on screen, at the current zoom level.
 *
 * @param {Object} view Current view.
 * @param {Object} rect Rectangle on the canvas.
 * @param {Object} size Screen size.
 * @return {Object} View.
 */
export function centerOn( view, rect, size ) {
	return {
		k: view.k,
		x: size.width / 2 - ( rect.x + rect.width / 2 ) * view.k,
		y: size.height / 2 - ( rect.y + rect.height / 2 ) * view.k,
	};
}

/**
 * Whether a rectangle on the canvas is wholly on screen.
 *
 * @param {Object} view   Current view.
 * @param {Object} rect   Rectangle on the canvas.
 * @param {Object} size   Screen size.
 * @param {number} margin Space it must keep from the screen's edges.
 * @return {boolean} Whether it is on screen.
 */
export function isRectInView( view, rect, size, margin = 0 ) {
	const left = rect.x * view.k + view.x;
	const top = rect.y * view.k + view.y;
	const right = left + rect.width * view.k;
	const bottom = top + rect.height * view.k;

	return (
		left >= margin &&
		top >= margin &&
		right <= size.width - margin &&
		bottom <= size.height - margin
	);
}
