/**
 * Pan and zoom maths for the Site Overview canvas.
 *
 * A view is `{ x, y, k }`: the canvas is scaled by `k`, then moved by `x` and
 * `y`, so a point on the canvas shows on screen at `point * k + offset`.
 *
 * The furthest out the canvas zooms is the level that just fits the whole
 * site on screen. That level is 100%, and every other level is counted from
 * it, so 200% shows the site twice as big as it is when it all fits.
 */

// The most the canvas is ever scaled up, so thumbnails stay sharp. However
// big or small the site, zooming in stops when cards are twice their size.
export const MAX_SCALE = 2;

// Space to keep around the site when it fits on screen, in screen pixels.
export const FIT_PADDING = 48;

// The zoom levels the zoom buttons step through, counted from the fit. The
// canvas's scale limit cuts them short.
const ZOOM_STEPS = [ 1, 1.5, 2, 3, 4, 6, 8, 12, 16 ];

/**
 * The view that shows the whole of a rectangle, centred.
 *
 * @param {Object} bounds  Rectangle on the canvas, `{ x, y, width, height }`.
 * @param {Object} size    Screen size, `{ width, height }`.
 * @param {number} padding Space to leave around it, in screen pixels.
 * @return {Object} View.
 */
export function fitView( bounds, size, padding = FIT_PADDING ) {
	const availableWidth = Math.max( 1, size.width - padding * 2 );
	const availableHeight = Math.max( 1, size.height - padding * 2 );
	const k = Math.min(
		availableWidth / Math.max( 1, bounds.width ),
		availableHeight / Math.max( 1, bounds.height ),
		MAX_SCALE
	);

	return {
		k,
		x: ( size.width - bounds.width * k ) / 2 - bounds.x * k,
		y: ( size.height - bounds.height * k ) / 2 - bounds.y * k,
	};
}

/**
 * The scales the canvas can be at: from the one that fits the whole site, to
 * `MAX_SCALE`.
 *
 * @param {Object} bounds The site, on the canvas.
 * @param {Object} size   Screen size.
 * @return {Object} `{ min, max }`.
 */
export function getScaleLimits( bounds, size ) {
	return { max: MAX_SCALE, min: fitView( bounds, size ).k };
}

/**
 * How far in a view is zoomed, where 1 is the level that fits the site.
 *
 * @param {Object} view   View.
 * @param {Object} bounds The site, on the canvas.
 * @param {Object} size   Screen size.
 * @return {number} Zoom level.
 */
export function getZoomLevel( view, bounds, size ) {
	return view.k / getScaleLimits( bounds, size ).min;
}

/**
 * Keep a view within the site: no further out than the level that fits it,
 * no further in than the limit, and not moved so far that it shows more
 * empty canvas than the fit does. When the site is narrower or shorter than
 * the screen, it stays centred that way.
 *
 * @param {Object} view   View.
 * @param {Object} bounds The site, on the canvas.
 * @param {Object} size   Screen size.
 * @return {Object} View.
 */
export function constrainView( view, bounds, size ) {
	const { max, min } = getScaleLimits( bounds, size );
	const k = Math.min( max, Math.max( min, view.k ) );
	const constrain = ( offset, start, length, screen ) => {
		const contentStart = start * k;
		const contentLength = length * k;

		if ( contentLength + FIT_PADDING * 2 <= screen ) {
			return ( screen - contentLength ) / 2 - contentStart;
		}

		return Math.min(
			FIT_PADDING - contentStart,
			Math.max(
				screen - FIT_PADDING - contentLength - contentStart,
				offset
			)
		);
	};

	return {
		k,
		x: constrain( view.x, bounds.x, bounds.width, size.width ),
		y: constrain( view.y, bounds.y, bounds.height, size.height ),
	};
}

/**
 * Zoom to a new scale, keeping a point on screen where it is.
 *
 * @param {Object} view  Current view.
 * @param {number} k     New scale.
 * @param {Object} point Screen point to zoom around, `{ x, y }`.
 * @return {Object} New view.
 */
export function zoomAt( view, k, point ) {
	const ratio = k / view.k;

	return {
		k,
		x: point.x - ( point.x - view.x ) * ratio,
		y: point.y - ( point.y - view.y ) * ratio,
	};
}

/**
 * The next zoom level up or down from the current one.
 *
 * @param {number} level     Current zoom level, where 1 fits the site.
 * @param {number} direction 1 to zoom in, -1 to zoom out.
 * @return {number} Next zoom level, for `constrainView` to keep in limits.
 */
export function getNextZoomStep( level, direction ) {
	if ( direction > 0 ) {
		// Past the last step, as far in as the canvas goes.
		return ZOOM_STEPS.find( ( step ) => step > level + 0.001 ) ?? Infinity;
	}

	return (
		[ ...ZOOM_STEPS ].reverse().find( ( step ) => step < level - 0.001 ) ??
		1
	);
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
 * Where a rectangle on the canvas shows on screen.
 *
 * @param {Object} view Current view.
 * @param {Object} rect Rectangle on the canvas.
 * @return {Object} `{ left, top, right, bottom }`, in screen pixels.
 */
export function getScreenRect( view, rect ) {
	const left = rect.x * view.k + view.x;
	const top = rect.y * view.k + view.y;

	return {
		bottom: top + rect.height * view.k,
		left,
		right: left + rect.width * view.k,
		top,
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
	const { bottom, left, right, top } = getScreenRect( view, rect );

	return (
		left >= margin &&
		top >= margin &&
		right <= size.width - margin &&
		bottom <= size.height - margin
	);
}

/**
 * Where to put a card's popover: beside the card, on whichever side has
 * room, kept on screen.
 *
 * @param {Object} card    The card, on screen, from `getScreenRect`.
 * @param {Object} popover The popover's size, `{ width, height }`.
 * @param {Object} size    Screen size.
 * @param {number} gap     Space between the card and the popover, and the
 *                         popover and the screen's edges.
 * @return {Object} `{ left, top }`, in screen pixels.
 */
export function getPopoverPosition( card, popover, size, gap = 12 ) {
	const fitsAfter = card.right + gap + popover.width <= size.width - gap;
	const fitsBefore = card.left - gap - popover.width >= gap;
	let left = card.right + gap;

	if ( ! fitsAfter && fitsBefore ) {
		left = card.left - gap - popover.width;
	} else if ( ! fitsAfter ) {
		left = size.width - gap - popover.width;
	}

	return {
		left: Math.max( gap, left ),
		top: Math.max(
			gap,
			Math.min( card.top, size.height - gap - popover.height )
		),
	};
}
