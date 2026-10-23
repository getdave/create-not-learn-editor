/**
 * Whether boot is showing the full-screen edit canvas.
 *
 * Boot has two ways of showing a canvas: a preview beside a route's stage, and
 * the full-screen editor a route opens for editing. The editor layer only
 * belongs on the second. Boot keeps that fact in its router's loader data,
 * which nothing outside boot can read, and reflects it on its layout element
 * as the `has-full-canvas` class. So this reads it from the DOM, where it is
 * live and also where the layer's stylesheet reads it, so the JavaScript half
 * and the CSS half cannot disagree about which mode is on screen.
 *
 * DRIFT CANARY. Boot builds its classes from CSS modules, so the rendered name
 * is a hash followed by `__has-full-canvas`. Only the suffix is matched. The
 * same selector is repeated as `$edit-canvas` in `style.scss`, and the two must
 * change together.
 */

/**
 * WordPress dependencies
 */
import { useSyncExternalStore } from '@wordpress/element';

export const EDIT_CANVAS_CLASS = '__has-full-canvas';

export const EDIT_CANVAS_SELECTOR = `[class*="${ EDIT_CANVAS_CLASS }"]`;

/**
 * @param {Element|Document} root Tree to read. Injectable for tests.
 * @return {boolean} Whether the edit canvas is on screen right now.
 */
export function isEditCanvas( root = document ) {
	return !! root.querySelector( EDIT_CANVAS_SELECTOR );
}

/**
 * Whether a class attribute value carries boot's full-canvas marker.
 *
 * @param {?string} value Class attribute value.
 * @return {boolean} Whether the marker is present.
 */
function hasMarker( value ) {
	return !! value && value.includes( EDIT_CANVAS_CLASS );
}

/**
 * Whether a class change could have changed the answer.
 *
 * Class changes are frequent in the admin document, on every selection and
 * toolbar render, and almost none of them are boot's layout gaining or losing
 * the marker. Comparing the old and new values skips the rest.
 *
 * @param {MutationRecord} record Attribute mutation record.
 * @return {boolean} Whether the marker came or went.
 */
function changesMarker( record ) {
	return (
		hasMarker( record.oldValue ) !==
		hasMarker( record.target.getAttribute( 'class' ) )
	);
}

/**
 * Whether a tree change brought in an element with the marker.
 *
 * @param {MutationRecord} record Child list mutation record.
 * @return {boolean} Whether any node added has the marker, or holds one.
 */
function addsMarker( record ) {
	return Array.from( record.addedNodes ).some(
		( node ) =>
			node.nodeType === node.ELEMENT_NODE &&
			( hasMarker( node.getAttribute( 'class' ) ) ||
				!! node.querySelector( EDIT_CANVAS_SELECTOR ) )
	);
}

/**
 * Report changes to whether the edit canvas is on screen.
 *
 * Only actual changes are reported. The layer is booted before boot renders
 * its layout, and boot moves between modes client-side through its router, so
 * the tree is watched for the life of the subscription rather than read once.
 *
 * React changes the admin document all the time, so the whole of it is only
 * searched when it has to be. While the edit canvas is on screen the element
 * with the marker is kept, and checked; while it isn't, only what was added
 * is searched. Boot is free to replace its layout element, and both cases
 * follow that.
 *
 * @param {Function} onChange Called with the new value when it changes.
 * @param {Node}     root     Tree to watch. Injectable for tests.
 * @return {Function} Unsubscribe function.
 */
export function subscribeToEditCanvas( onChange, root = document ) {
	let marked = root.querySelector( EDIT_CANVAS_SELECTOR );
	let last = !! marked;

	const read = () => {
		if (
			marked &&
			root.contains( marked ) &&
			hasMarker( marked.getAttribute( 'class' ) )
		) {
			return true;
		}

		marked = root.querySelector( EDIT_CANVAS_SELECTOR );

		return !! marked;
	};

	const observer = new window.MutationObserver( ( records ) => {
		const mayChange = records.some( ( record ) => {
			if ( record.type === 'childList' ) {
				// The marked element may have gone, which `read` checks
				// cheaply, or one may have been added.
				return last || addsMarker( record );
			}

			return changesMarker( record );
		} );

		if ( ! mayChange ) {
			return;
		}

		const next = read();

		if ( next === last ) {
			return;
		}

		last = next;
		onChange( next );
	} );

	observer.observe( root, {
		attributes: true,
		attributeFilter: [ 'class' ],
		attributeOldValue: true,
		childList: true,
		subtree: true,
	} );

	return () => observer.disconnect();
}

/**
 * @return {boolean} Whether the edit canvas is on screen, kept current.
 */
export function useIsEditCanvas() {
	return useSyncExternalStore( subscribeToEditCanvas, isEditCanvas );
}
