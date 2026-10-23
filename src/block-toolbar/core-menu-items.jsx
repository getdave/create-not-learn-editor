/**
 * The items core and plugins add to a block's options menu, for the options
 * menu that stands in for it.
 *
 * Core's menu is built from slots: Lock, Rename, Hide, Group, Edit as HTML,
 * and anything a plugin fills in, like "Create pattern". Those items keep
 * their own state, like the Rename modal they open, so they can't be drawn
 * again elsewhere. Instead the slots are rendered out of sight while a block
 * is selected, and the options menu lists what is in them, each entry
 * clicking the item it stands for. A plugin's item then turns up in the new
 * menu without the plugin knowing.
 *
 * The slots render into a hidden element at the end of the document, not the
 * toolbar, since core's toolbar drops arrow key navigation when it holds
 * anything focusable that isn't one of its own items.
 */

/**
 * WordPress dependencies
 */
import {
	/* eslint-disable @wordpress/no-unsafe-wp-apis -- The only slot at the top of the block options menu. */
	__unstableBlockSettingsMenuFirstItem as BlockSettingsMenuFirstItem,
	/* eslint-enable @wordpress/no-unsafe-wp-apis */
	BlockSettingsMenuControls,
} from '@wordpress/block-editor';
import { createPortal, useCallback, useRef } from '@wordpress/element';

const noop = () => {};

/**
 * Where the items are, out of sight.
 *
 * @param {Object} props
 * @param {string} props.clientId The selected block.
 * @param {Object} props.hostRef  Ref for the hidden element.
 * @return {Element} The slots, portalled to the document's end.
 */
export function CoreMenuItemsHost( { clientId, hostRef } ) {
	return createPortal(
		<div hidden ref={ hostRef } className="cnl-block-toolbar-core-items">
			<div data-cnl-core-items="first">
				<BlockSettingsMenuFirstItem.Slot
					fillProps={ { onClose: noop } }
				/>
			</div>
			<div data-cnl-core-items="controls">
				<BlockSettingsMenuControls.Slot
					fillProps={ {
						onClose: noop,
						count: 1,
						firstBlockClientId: clientId,
					} }
					clientIds={ [ clientId ] }
				/>
			</div>
		</div>,
		document.body
	);
}

/**
 * Read the items in one of the host's slots.
 *
 * @param {?Element} host  The hidden element.
 * @param {string}   which `first` or `controls`.
 * @return {Object[]} Items, `{ key, label, shortcut, disabled, click }`.
 */
function readItems( host, which ) {
	const slot = host?.querySelector( `[data-cnl-core-items="${ which }"]` );

	if ( ! slot ) {
		return [];
	}

	return [ ...slot.querySelectorAll( '.components-menu-item__button' ) ]
		.map( ( element, index ) => {
			const label = (
				element.querySelector( '.components-menu-item__item' ) ??
				element
			).textContent.trim();

			return {
				key: `${ which }-${ index }-${ label }`,
				label,
				shortcut: element
					.querySelector( '.components-menu-item__shortcut' )
					?.textContent.trim(),
				href: element.getAttribute( 'href' ),
				disabled:
					element.disabled ||
					element.getAttribute( 'aria-disabled' ) === 'true',
				click: () => element.click(),
			};
		} )
		.filter( ( item ) => item.label );
}

/**
 * The toolbar's icon buttons the stylesheet moves out of the toolbar, for
 * not being recognisable from their icon alone. Read as the stylesheet left
 * them, so the two can't disagree. See `$tool-button` in `_style.scss`.
 *
 * @param {?Element} toolbar The block's toolbar.
 * @return {Object[]} Items, `{ key, label, pressed, disabled, click }`.
 */
export function readToolbarTools( toolbar ) {
	if ( ! toolbar ) {
		return [];
	}

	return [
		...toolbar.querySelectorAll(
			'.block-editor-block-toolbar__slot > button.has-icon:not([aria-haspopup])'
		),
	]
		.filter(
			( element ) =>
				element.ownerDocument.defaultView.getComputedStyle( element )
					.display === 'none'
		)
		.map( ( element, index ) => ( {
			key: `tool-${ index }`,
			label: element.getAttribute( 'aria-label' ),
			pressed: element.getAttribute( 'aria-pressed' ) === 'true',
			disabled:
				element.disabled ||
				element.getAttribute( 'aria-disabled' ) === 'true',
			click: () => element.click(),
		} ) )
		.filter( ( item ) => item.label );
}

/**
 * The host's ref, and a way to read what is in it now.
 *
 * @return {{ hostRef: Object, read: Function }} Ref and reader.
 */
export function useCoreMenuItems() {
	const hostRef = useRef();
	const read = useCallback(
		() => ( {
			first: readItems( hostRef.current, 'first' ),
			controls: readItems( hostRef.current, 'controls' ),
		} ),
		[]
	);

	return { hostRef, read };
}
