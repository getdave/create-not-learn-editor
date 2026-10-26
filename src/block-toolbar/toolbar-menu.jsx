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
	useEffect,
	useMemo,
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
 * @param {string}   [props.side]           Which side of the button the menu opens on, `bottom` unless set.
 * @param {boolean}  [props.disabled]       Whether the menu has nothing in it. The button stays, and can be focused, but doesn't open it.
 * @param {Element}  props.children         The menu's items.
 * @param {Object}   ref                    Ref for the button.
 * @return {Element} The button and its menu.
 */
function UnforwardedToolbarMenu(
	{
		buttonProps,
		popupClassName,
		onOpen,
		side = 'bottom',
		disabled = false,
		children,
	},
	ref
) {
	const [ isOpen, setIsOpen ] = useState( false );
	const buttonRef = useRef();
	const leavesFocusRef = useRef( false );
	/*
	 * Made once for each ref given. A new callback each render would be
	 * called again each render, and a ref that sets state, as the options
	 * menu's does, would render again for ever.
	 */
	const mergedRef = useMemo( () => mergeRefs( buttonRef, ref ), [ ref ] );

	// A menu left with nothing in it closes.
	useEffect( () => {
		if ( disabled ) {
			setIsOpen( false );
		}
	}, [ disabled ] );

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
				ref={ mergedRef }
				disabled={ disabled }
				accessibleWhenDisabled
				aria-haspopup={ disabled ? undefined : 'menu' }
				aria-expanded={ disabled ? undefined : isOpen }
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
					open={ isOpen && ! disabled }
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
								side={ side }
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
