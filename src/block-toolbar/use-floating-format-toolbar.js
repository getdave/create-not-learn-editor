/**
 * Formatting appears with a text selection, next to it, rather than on the
 * block's toolbar all the time.
 *
 * Core's format buttons (bold, italic, link and the rest under "More") stay
 * where core puts them, in the block toolbar's DOM, so they keep working,
 * keep their place in the toolbar's keyboard order, and keep Alt+F10. The
 * stylesheet hides their group, and while text is selected this lifts the
 * group out of the toolbar's row to just above the selection, or below it
 * when the block's toolbar is in the way.
 */

/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';
import { useEffect } from '@wordpress/element';

/**
 * Core's buttons that mark the format group, by their labels. Core's markup
 * gives the group nothing else to find it by.
 */
const FORMAT_BUTTONS = [ 'Bold', 'Italic', 'More' ]
	.map( ( label ) => `[aria-label="${ label }"]` )
	.join( ', ' );

const GAP = 8;

/**
 * The block toolbar's format group.
 *
 * @return {{ toolbar: ?Element, group: ?Element }} Toolbar and group.
 */
function findFormatGroup() {
	const toolbar = document.querySelector(
		'.block-editor-block-contextual-toolbar .block-editor-block-toolbar'
	);
	const group = [
		...( toolbar?.querySelectorAll(
			':scope > .components-toolbar-group'
		) ?? [] ),
	].find( ( element ) => element.querySelector( FORMAT_BUTTONS ) );

	return { toolbar, group };
}

/**
 * Where the selection is, in the editor's document.
 *
 * @return {?DOMRect} The selection's box, or null without one.
 */
function getSelectionRect() {
	const iframe = document.querySelector( 'iframe[name="editor-canvas"]' );
	const selection = iframe?.contentWindow?.getSelection();

	if ( ! selection?.rangeCount || selection.isCollapsed ) {
		return null;
	}

	const rect = selection.getRangeAt( 0 ).getBoundingClientRect();
	const frame = iframe.getBoundingClientRect();

	return new window.DOMRect(
		frame.left + rect.left,
		frame.top + rect.top,
		rect.width,
		rect.height
	);
}

/**
 * Lift the format group to the selection, or put it back out of sight.
 *
 * @param {boolean} isExpanded Whether text in the block is selected.
 */
function place( isExpanded ) {
	const { toolbar, group } = findFormatGroup();

	if ( ! group ) {
		return;
	}

	const selection = isExpanded && getSelectionRect();

	if ( ! selection ) {
		delete group.dataset.cnlFormat;
		return;
	}

	group.dataset.cnlFormat = 'floating';

	const origin = toolbar.getBoundingClientRect();
	const box = toolbar
		.closest( '.block-editor-block-contextual-toolbar' )
		.getBoundingClientRect();
	const { width, height } = group.getBoundingClientRect();

	let top = selection.top - height - GAP;
	const overlapsToolbar = top < box.bottom && top + height > box.top;
	if ( overlapsToolbar || top < 0 ) {
		top = selection.bottom + GAP;
	}

	const left = Math.max(
		GAP,
		selection.left + selection.width / 2 - width / 2
	);

	group.style.setProperty( '--cnl-format-top', `${ top - origin.top }px` );
	group.style.setProperty( '--cnl-format-left', `${ left - origin.left }px` );
}

/**
 * Keep the block's format group with its text selection.
 *
 * @param {string} clientId The selected block.
 */
export function useFloatingFormatToolbar( clientId ) {
	const { isExpanded, selectionKey } = useSelect(
		( select ) => {
			const { getSelectionStart, getSelectionEnd } =
				select( blockEditorStore );
			const start = getSelectionStart();
			const end = getSelectionEnd();

			return {
				isExpanded:
					start.clientId === clientId &&
					end.clientId === clientId &&
					!! start.attributeKey &&
					( start.attributeKey !== end.attributeKey ||
						start.offset !== end.offset ),
				selectionKey: `${ start.attributeKey }:${ start.offset }:${ end.offset }`,
			};
		},
		[ clientId ]
	);

	useEffect( () => {
		let frame = window.requestAnimationFrame( () => place( isExpanded ) );
		const update = () => {
			window.cancelAnimationFrame( frame );
			frame = window.requestAnimationFrame( () => place( isExpanded ) );
		};

		const canvas = document.querySelector(
			'iframe[name="editor-canvas"]'
		)?.contentWindow;

		canvas?.addEventListener( 'scroll', update, true );
		window.addEventListener( 'resize', update );

		return () => {
			window.cancelAnimationFrame( frame );
			canvas?.removeEventListener( 'scroll', update, true );
			window.removeEventListener( 'resize', update );
		};
	}, [ isExpanded, selectionKey ] );
}
