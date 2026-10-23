/**
 * A `@wordpress/ui` menu opened from a button on core's block toolbar.
 *
 * Base UI puts focus guards, tabbable `<span>`s, either side of a menu's
 * trigger and where its popup is rendered from. Core's toolbar treats
 * anything tabbable that isn't one of its own items as a custom control,
 * drops back to a plain toolbar and renders again, which unmounts the menu
 * as soon as it opens. So the button is core's `ToolbarButton`, and the
 * menu, without a trigger of its own, is rendered from the end of the
 * document, opened from the button and placed against it.
 */

/**
 * WordPress dependencies
 */
import { ToolbarButton } from '@wordpress/components';
import {
	createContext,
	createPortal,
	forwardRef,
	useContext,
	useRef,
	useState,
} from '@wordpress/element';
import { Menu } from '@wordpress/ui';

const ToolbarMenuContext = createContext( { leaveFocus: () => {} } );

/**
 * For an item that sends focus somewhere else, like a modal or the text,
 * keeping the menu from taking it back to its button as it closes.
 *
 * @return {Function} Call before the item does its work.
 */
export function useLeaveFocus() {
	return useContext( ToolbarMenuContext ).leaveFocus;
}

/**
 * Join refs into one callback ref.
 *
 * @param {...(Function|Object)} refs Refs.
 * @return {Function} The ref.
 */
function mergeRefs( ...refs ) {
	return ( node ) =>
		refs.forEach( ( ref ) => {
			if ( typeof ref === 'function' ) {
				ref( node );
			} else if ( ref ) {
				ref.current = node;
			}
		} );
}

/**
 * @param {Object}   props
 * @param {Object}   props.buttonProps      Props for the toolbar button: `icon`, `label`, `className`, `children`.
 * @param {string}   [props.popupClassName] Class for the menu.
 * @param {Function} [props.onOpen]         Called as the menu opens.
 * @param {Element}  props.children         The menu's items.
 * @param {Object}   ref                    Ref for the button.
 * @return {Element} The button and its menu.
 */
function UnforwardedToolbarMenu(
	{ buttonProps, popupClassName, onOpen, children },
	ref
) {
	const [ isOpen, setIsOpen ] = useState( false );
	const buttonRef = useRef();
	const leavesFocusRef = useRef( false );

	const setOpen = ( open ) => {
		if ( open ) {
			leavesFocusRef.current = false;
			onOpen?.();
		}
		setIsOpen( open );
	};

	return (
		<>
			<ToolbarButton
				{ ...buttonProps }
				ref={ mergeRefs( buttonRef, ref ) }
				aria-haspopup="menu"
				aria-expanded={ isOpen }
				isPressed={ isOpen }
				onClick={ () => setOpen( ! isOpen ) }
				onKeyDown={ ( event ) => {
					if ( event.key === 'ArrowDown' && ! isOpen ) {
						event.preventDefault();
						setOpen( true );
					}
				} }
			/>
			{ createPortal(
				<Menu.Root
					open={ isOpen }
					onOpenChange={ ( open, details ) => {
						// A press on the button toggles the menu itself.
						if (
							! open &&
							buttonRef.current?.contains(
								details?.event?.target
							)
						) {
							return;
						}
						setOpen( open );
					} }
				>
					<Menu.Popup
						className={ popupClassName }
						finalFocus={ () =>
							leavesFocusRef.current ? false : buttonRef.current
						}
						positioner={
							<Menu.Positioner
								anchor={ buttonRef }
								side="bottom"
								align="start"
								sideOffset={ 8 }
							/>
						}
					>
						{ children }
					</Menu.Popup>
				</Menu.Root>,
				document.body
			) }
		</>
	);
}

export const ToolbarMenu = forwardRef( UnforwardedToolbarMenu );
