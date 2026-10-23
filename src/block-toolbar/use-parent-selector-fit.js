/**
 * The toolbar stays lined up with the block, the parent selector hanging out
 * to its left. Where that would put the parent selector outside the canvas,
 * for a block against its left edge, the toolbar moves right just
 * enough to bring it back in.
 */

/**
 * WordPress dependencies
 */
import { useEffect } from '@wordpress/element';

const MARGIN = 8;

/**
 * Move the toolbar in, if its parent selector is cut off.
 */
function fit() {
	const toolbar = document.querySelector(
		'.block-editor-block-contextual-toolbar.has-parent'
	);

	if ( ! toolbar ) {
		return;
	}

	toolbar.style.removeProperty( '--cnl-toolbar-shift' );

	const hanging = toolbar.querySelector(
		'.components-toolbar-group:has(.cnl-block-parent__button)'
	);

	if ( ! hanging ) {
		return;
	}

	const left = hanging.getBoundingClientRect().left;
	const bound =
		document
			.querySelector( 'iframe[name="editor-canvas"]' )
			?.getBoundingClientRect().left ?? 0;
	const overflow = bound + MARGIN - left;

	if ( overflow > 0 ) {
		toolbar.style.setProperty( '--cnl-toolbar-shift', `${ overflow }px` );
	}
}

/**
 * Keep the selected block's parent selector in view.
 *
 * @param {string} clientId The selected block.
 */
export function useParentSelectorFit( clientId ) {
	useEffect( () => {
		let frame = window.requestAnimationFrame( fit );
		const update = () => {
			window.cancelAnimationFrame( frame );
			frame = window.requestAnimationFrame( fit );
		};

		window.addEventListener( 'resize', update );

		return () => {
			window.cancelAnimationFrame( frame );
			window.removeEventListener( 'resize', update );
		};
	}, [ clientId ] );
}
