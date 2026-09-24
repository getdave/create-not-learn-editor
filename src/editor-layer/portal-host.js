/**
 * Mount points inside the editor's own regions.
 *
 * The layer renders into the editor's containers rather than positioning
 * against the viewport, so anything portalled in inherits the region's box:
 * its size, its place in the layout and its insets for whatever else is open.
 *
 * The regions belong to the editor and mount asynchronously, so each host waits
 * for its region and appends a child of its own rather than rendering into the
 * region directly, where React would fight the editor over its children.
 */

/**
 * WordPress dependencies
 */
import { useEffect, useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { EDIT_CANVAS_SELECTOR } from './canvas-mode';

/**
 * The edit canvas editor's interface regions.
 *
 * Each is qualified by boot's full-canvas marker so a region belonging to a
 * preview editor elsewhere on the page is never picked. The header is further
 * qualified on `.editor-header` so it matches the editor's own header region.
 *
 * `headerToolbar` is the row holding the inserter, undo and redo, and a host
 * there lands after them. It is deliberately the row, not the toolbar inside
 * it: that toolbar treats any focusable element that is not one of its own
 * toolbar items as a reason to drop its arrow key navigation.
 */
export const EDITOR_REGIONS = {
	header: `${ EDIT_CANVAS_SELECTOR } .interface-interface-skeleton__header:has(.editor-header)`,
	headerToolbar: `${ EDIT_CANVAS_SELECTOR } .editor-header__toolbar`,
	content: `${ EDIT_CANVAS_SELECTOR } .interface-interface-skeleton__content`,
	sidebar: `${ EDIT_CANVAS_SELECTOR } .interface-interface-skeleton__sidebar`,
};

/**
 * Keep a host element appended to a region for as long as the region exists.
 *
 * Watched for the life of the call rather than until the first attach. The
 * regions belong to the editor, which is free to unmount and re-render one, on
 * a rendering-mode change, a document swap or a route change. The host goes
 * with it, so it is appended again when the region comes back, and reported as
 * `null` while there is none.
 *
 * @param {string}           selector  Region to mount into.
 * @param {string}           className Class applied to the host element.
 * @param {Function}         onHost    Called with the host element, or null.
 * @param {Element|Document} root      Tree to search and watch. Injectable for tests.
 * @return {Function} Stop watching and remove the host.
 */
export function observeHost( selector, className, onHost, root = document ) {
	let disposed = false;
	let host = null;

	const attach = () => {
		/*
		 * First and cheapest: this runs on every DOM mutation in the editor.
		 * Containment rather than `isConnected`, so a root that is not in the
		 * document, as in tests, does not append a host on every mutation.
		 */
		if ( disposed || ( host && root.contains( host ) ) ) {
			return;
		}

		const region = root.querySelector( selector );
		let next = null;

		if ( region ) {
			next = document.createElement( 'div' );
			next.className = className;
			region.appendChild( next );
		}

		if ( next !== host ) {
			host = next;
			onHost( host );
		}
	};

	attach();

	/*
	 * Appending the host is itself a mutation. The containment check above is
	 * what keeps that from recurring.
	 */
	const observer = new window.MutationObserver( attach );
	observer.observe( root, { childList: true, subtree: true } );

	return () => {
		disposed = true;
		observer.disconnect();
		host?.remove();
	};
}

/**
 * A host element inside one of the editor's regions, to portal into.
 *
 * @example
 * const host = usePortalHost( EDITOR_REGIONS.header, 'cnl-editor-layer__header' );
 * return host && createPortal( el( MyHeader ), host );
 *
 * @param {string} selector  Region to mount into. See `EDITOR_REGIONS`.
 * @param {string} className Class applied to the host element.
 * @return {?HTMLElement} The host element, or null until the region exists.
 */
export function usePortalHost( selector, className ) {
	const [ host, setHost ] = useState( null );

	useEffect(
		() => observeHost( selector, className, setHost ),
		[ selector, className ]
	);

	return host;
}
