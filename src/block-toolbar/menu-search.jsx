/**
 * Searching the options menu, flyouts and all.
 *
 * Base UI's menu filtering does the work: the field, moving through what
 * matches with the arrow keys while typing, hiding groups left empty and
 * saying when nothing matches. `@wordpress/ui` doesn't offer it yet, so it
 * comes from Base UI, which `@wordpress/ui`'s menu is built on.
 *
 * Base UI only filters the items of the menu it's in, not those of its
 * flyouts. So while there is something to search for, each `Flyout` shows
 * its items in place, under its name, and each item is matched by its
 * flyout's name as well as its own: "align" finds every alignment, "center"
 * finds Center under Text alignment.
 */

/**
 * External dependencies
 */
import { Menu as BaseMenu } from '@base-ui/react/menu';

/**
 * WordPress dependencies
 */
import { createContext, useCallback, useContext } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { search } from '@wordpress/icons';
import { Icon, Input, InputLayout, Menu } from '@wordpress/ui';

const MenuSearchContext = createContext( { isSearching: false, path: [] } );

/**
 * Makes a menu searchable. Wraps the `Menu.Root`, here the `ToolbarMenu`.
 *
 * @param {Object}   props
 * @param {string}   props.value         What was typed.
 * @param {Function} props.onValueChange Called with what is typed.
 * @param {Element}  props.children      The menu.
 * @return {Element} The menu, searchable.
 */
export function MenuSearchProvider( { value, onValueChange, children } ) {
	const { startsWith } = BaseMenu.useFilter();
	/*
	 * Each word typed, in any order, starting one of the item's, ignoring
	 * case and accents: "lock" finds Lock, not Block before.
	 */
	const filter = useCallback(
		( text, query ) => {
			const words = text.split( /\s+/ );

			return query
				.split( /\s+/ )
				.filter( Boolean )
				.every( ( typed ) =>
					words.some( ( word ) => startsWith( word, typed ) )
				);
		},
		[ startsWith ]
	);

	return (
		<BaseMenu.FilterProvider
			filter={ filter }
			autoHighlight
			value={ value }
			onValueChange={ onValueChange }
		>
			<MenuSearchContext.Provider
				value={ { isSearching: !! value.trim(), path: [] } }
			>
				{ children }
			</MenuSearchContext.Provider>
		</BaseMenu.FilterProvider>
	);
}

/**
 * The search field, what shows when nothing matches, and the menu's items,
 * which Base UI needs in a list of their own.
 *
 * @param {Object}  props
 * @param {Element} props.children The menu's items.
 * @return {Element} The searchable menu's contents.
 */
export function MenuSearch( { children } ) {
	return (
		<>
			<div className="cnl-menu-search">
				<BaseMenu.Input
					aria-label={ __( 'Search options' ) }
					render={
						<Input
							size="compact"
							prefix={
								<InputLayout.Slot padding="minimal">
									<Icon icon={ search } />
								</InputLayout.Slot>
							}
						/>
					}
				/>
			</div>
			<BaseMenu.Empty className="cnl-menu-search__empty">
				{ __( 'No options found.' ) }
			</BaseMenu.Empty>
			<BaseMenu.List className="cnl-menu-search__list">
				{ children }
			</BaseMenu.List>
		</>
	);
}

/**
 * What an item is matched by: its own words, after those of the flyouts it
 * is shown in place of while searching. For each item's `label`.
 *
 * @return {Function} Takes the item's words, returns what it is matched by.
 */
export function useSearchLabel() {
	const { path } = useContext( MenuSearchContext );

	return ( label ) => [ ...path, label ].join( ' ' );
}

/**
 * A flyout, or, while the menu is being searched, its items in place under
 * its name, so they can be found.
 *
 * @param {Object}  props
 * @param {string}  props.label            The flyout's name, shown above its items while searching.
 * @param {Element} props.trigger          The item that opens it, a `Menu.SubmenuTrigger`.
 * @param {string}  [props.popupClassName] Class for the flyout.
 * @param {Element} props.children         Its items.
 * @return {Element} The flyout, or its items.
 */
export function Flyout( { label, trigger, popupClassName, children } ) {
	const { isSearching, path } = useContext( MenuSearchContext );

	if ( isSearching ) {
		return (
			<Menu.Group className="cnl-menu-search__results">
				<Menu.GroupLabel>{ label }</Menu.GroupLabel>
				<MenuSearchContext.Provider
					value={ { isSearching, path: [ ...path, label ] } }
				>
					{ children }
				</MenuSearchContext.Provider>
			</Menu.Group>
		);
	}

	return (
		<Menu.SubmenuRoot>
			{ trigger }
			<Menu.Popup className={ popupClassName }>{ children }</Menu.Popup>
		</Menu.SubmenuRoot>
	);
}
