/**
 * Arrow keys through the block toolbar's visible items.
 *
 * Core's toolbar moves focus through every item it holds, including the
 * ones the stylesheet hides, and focusing a hidden item does nothing, so the
 * arrow keys would stop at the first one. This moves focus between the items
 * on show instead, in the order they are seen, before core's own handling
 * sees the key.
 */

const KEYS = [ 'ArrowLeft', 'ArrowRight', 'Home', 'End' ];

/**
 * @param {KeyboardEvent} event Key press anywhere in the document.
 */
function onKeyDown( event ) {
	if (
		! KEYS.includes( event.key ) ||
		event.altKey ||
		event.ctrlKey ||
		event.metaKey ||
		! event.target.matches?.( '[data-toolbar-item]' )
	) {
		return;
	}

	const toolbar = event.target.closest(
		'.block-editor-block-contextual-toolbar'
	);

	if ( ! toolbar ) {
		return;
	}

	// In the order they are seen, as the parent selector is drawn to the
	// left of tools that come before it in the markup.
	const items = [ ...toolbar.querySelectorAll( '[data-toolbar-item]' ) ]
		.filter( ( item ) => item.getClientRects().length > 0 )
		.sort(
			( a, b ) =>
				a.getBoundingClientRect().left - b.getBoundingClientRect().left
		);
	const index = items.indexOf( event.target );

	if ( index === -1 ) {
		return;
	}

	const isRTL = toolbar.ownerDocument.documentElement.dir === 'rtl';
	const step = ( event.key === 'ArrowRight' ) !== isRTL ? 1 : -1;
	const next =
		{
			Home: 0,
			End: items.length - 1,
		}[ event.key ] ?? ( index + step + items.length ) % items.length;

	event.preventDefault();
	event.stopPropagation();
	items[ next ].focus();
}

/**
 * Listen for arrow keys in block toolbars.
 */
export function registerToolbarKeyboard() {
	document.addEventListener( 'keydown', onKeyDown, true );
}
