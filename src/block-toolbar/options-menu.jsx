/**
 * The block's options menu: one labelled menu for the block tools that were
 * spread along the toolbar, with flyouts to keep it short.
 *
 * Style choices that usually come from the site's styles, like text
 * alignment and size, move here from the toolbar, each showing the value in
 * use. Then the formatting fallback, styles, inserting, the clipboard, and
 * "More" for what is used least, where core's and plugins' own items go.
 *
 * It stands in for core's "⋮" menu, which the stylesheet hides when this is
 * there. See `core-menu-items.jsx` for how core's items get here.
 */

/**
 * WordPress dependencies
 */
import {
	store as blockEditorStore,
	useBlockEditingMode,
	useSettings,
} from '@wordpress/block-editor';
import {
	getBlockType,
	hasBlockSupport,
	store as blocksStore,
} from '@wordpress/blocks';
import { useDispatch, useRegistry, useSelect } from '@wordpress/data';
import { Fragment, useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
	formatBold,
	formatItalic,
	group,
	lock,
	pencil,
	seen,
	settings as optionsIcon,
	symbol,
	typography,
	ungroup,
	unlock,
	unseen,
} from '@wordpress/icons';
import { Menu } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import {
	getActiveFontSizeSlug,
	getFontSizeAttributes,
	getFontSizeHint,
	TEXT_BLOCKS,
} from '../editor-extensions/font-size-details';
import {
	fromRadio,
	getChoiceLabel,
	getTextAlignment,
	NONE,
	useBlockWidths,
} from './alignment';
import {
	copyBlocks,
	copyStyles,
	cutBlocks,
	pasteStyles,
} from './block-actions';
import { ColorPickerPopover, ColorSubmenu, useBlockColors } from './colors';
import { readToolbarTools } from './core-menu-items';
import { toShortcut, useBlockShortcuts } from './shortcuts';
import { ToolbarMenu, useLeaveFocus } from './toolbar-menu';

/**
 * Core's items that sit with Group rather than in More, as the design has
 * them, matched by core's words for them.
 */
const TOP_LEVEL_CORE_ITEMS = new Set( [
	__( 'Group' ),
	__( 'Ungroup' ),
	__( 'Create pattern' ),
] );

/**
 * Icons for core's items, by their words, as the design draws them.
 */
const CORE_ITEM_ICONS = {
	[ __( 'Group' ) ]: group,
	[ __( 'Ungroup' ) ]: ungroup,
	[ __( 'Create pattern' ) ]: symbol,
	[ __( 'Lock' ) ]: lock,
	[ __( 'Unlock' ) ]: unlock,
	[ __( 'Rename' ) ]: pencil,
	[ __( 'Hide' ) ]: unseen,
	[ __( 'Show' ) ]: seen,
};

/**
 * A flyout of choices, showing the one in use beside its name.
 *
 * @param {Object}   props
 * @param {string}   props.label    The flyout's name.
 * @param {Object}   [props.icon]   Its icon.
 * @param {Object[]} props.options  Choices, `{ value, label, icon, hint }`.
 * @param {string}   props.value    The choice in use.
 * @param {Function} props.onChange Called with the choice picked.
 * @return {Element} The flyout.
 */
function ChoiceSubmenu( { label, icon, options, value, onChange } ) {
	return (
		<Menu.SubmenuRoot>
			<Menu.SubmenuTrigger
				prefix={ icon && <Menu.PrefixIcon icon={ icon } /> }
				suffix={ getChoiceLabel( options, value ) }
			>
				<Menu.ItemLabel>{ label }</Menu.ItemLabel>
			</Menu.SubmenuTrigger>
			<Menu.Popup>
				<Menu.RadioGroup value={ value } onValueChange={ onChange }>
					{ options.map( ( option ) => (
						<Menu.RadioItem
							key={ option.value }
							value={ option.value }
							closeOnClick
							prefix={
								option.icon && (
									<Menu.PrefixIcon icon={ option.icon } />
								)
							}
							suffix={ option.hint }
						>
							<Menu.ItemLabel>{ option.label }</Menu.ItemLabel>
						</Menu.RadioItem>
					) ) }
				</Menu.RadioGroup>
			</Menu.Popup>
		</Menu.SubmenuRoot>
	);
}

/**
 * A flyout of plain items.
 *
 * @param {Object}  props
 * @param {string}  props.label    The flyout's name.
 * @param {Element} props.children Its items.
 * @return {Element} The flyout.
 */
function Submenu( { label, children } ) {
	return (
		<Menu.SubmenuRoot>
			<Menu.SubmenuTrigger>
				<Menu.ItemLabel>{ label }</Menu.ItemLabel>
			</Menu.SubmenuTrigger>
			<Menu.Popup>{ children }</Menu.Popup>
		</Menu.SubmenuRoot>
	);
}

/**
 * Items that stand for core's own, clicking them when picked.
 *
 * Core's item may open a modal, so the menu leaves focus where the item
 * puts it.
 *
 * @param {Object}   props
 * @param {Object[]} props.items Items read from core's menu.
 * @return {Element[]} Menu items.
 */
function CoreItems( { items } ) {
	const leaveFocus = useLeaveFocus();

	return items.map( ( item ) => (
		<Menu.Item
			key={ item.key }
			disabled={ item.disabled }
			onClick={ () => {
				leaveFocus();
				item.click();
			} }
			prefix={
				CORE_ITEM_ICONS[ item.label ] && (
					<Menu.PrefixIcon icon={ CORE_ITEM_ICONS[ item.label ] } />
				)
			}
			suffix={ item.shortcut }
		>
			<Menu.ItemLabel>{ item.label }</Menu.ItemLabel>
		</Menu.Item>
	) );
}

/**
 * The block's own icon tools, moved from the toolbar for want of a label,
 * each pressing the button it stands for. A button that toggles shows as
 * checked when on.
 *
 * @param {Object}   props
 * @param {Object[]} props.items Tools read from the toolbar.
 * @return {Element[]} Menu items.
 */
function ToolbarTools( { items } ) {
	return items.map( ( item ) => (
		<Menu.CheckboxItem
			key={ item.key }
			checked={ item.pressed }
			disabled={ item.disabled }
			closeOnClick
			onCheckedChange={ item.click }
		>
			<Menu.ItemLabel>{ item.label }</Menu.ItemLabel>
		</Menu.CheckboxItem>
	) );
}

/**
 * Bold and italic, for formatting without selecting text first. They press
 * the format buttons core keeps on the toolbar, out of sight until text is
 * selected, once the menu has closed, so the text has focus back.
 *
 * @param {Object} props
 * @param {Object} props.toolbarRef Ref to an element in the block's toolbar.
 * @return {Element} The flyout.
 */
function FormatSubmenu( { toolbarRef } ) {
	const leaveFocus = useLeaveFocus();
	const press = ( label ) => () => {
		leaveFocus();
		window.setTimeout( () =>
			toolbarRef.current
				?.closest( '.block-editor-block-toolbar' )
				?.querySelector( `button[aria-label="${ label }"]` )
				?.click()
		);
	};

	return (
		<Submenu label={ __( 'Format' ) }>
			<Menu.Item
				prefix={ <Menu.PrefixIcon icon={ formatBold } /> }
				shortcut={ toShortcut( 'primary', 'b' ) }
				onClick={ press( __( 'Bold' ) ) }
			>
				<Menu.ItemLabel>{ __( 'Bold' ) }</Menu.ItemLabel>
			</Menu.Item>
			<Menu.Item
				prefix={ <Menu.PrefixIcon icon={ formatItalic } /> }
				shortcut={ toShortcut( 'primary', 'i' ) }
				onClick={ press( __( 'Italic' ) ) }
			>
				<Menu.ItemLabel>{ __( 'Italic' ) }</Menu.ItemLabel>
			</Menu.Item>
		</Submenu>
	);
}

/**
 * The text alignment and width flyouts, and the text size and colour
 * flyouts, as sections of the menu, each null when the block has none of it.
 *
 * Text and colour are offered wherever the block's content can be changed,
 * in a locked section too, as a word processor offers them. The block's
 * width, which changes the section's layout, only where it can be moved.
 *
 * @param {Object}   props
 * @param {string}   props.clientId      Block client ID.
 * @param {string}   props.name          Block name.
 * @param {Object}   props.attributes    Block attributes.
 * @param {Function} props.setAttributes Block attribute setter.
 * @param {boolean}  props.isContainer   Whether the block's width is in its Layout menu instead.
 * @param {string}   props.editingMode   The block's editing mode.
 * @param {?Object}  props.colors        The block's colours, from `useBlockColors()`.
 * @param {Function} props.onCustomColor Opens the colour picker, with the kind of colour.
 * @return {Array<?Element>} The align section and the text section.
 */
function useStyleSections( {
	clientId,
	name,
	attributes,
	setAttributes,
	isContainer,
	editingMode,
	colors,
	onCustomColor,
} ) {
	const [ fontSizes ] = useSettings( 'typography.fontSizes' );
	const widths = useBlockWidths( clientId, name );

	if ( editingMode !== 'default' && editingMode !== 'contentOnly' ) {
		return [ null, null ];
	}

	const textAlign = getTextAlignment( name, attributes, setAttributes );
	const showWidths =
		editingMode === 'default' && ! isContainer && widths.length > 1;
	const width = attributes.align ?? NONE;
	const sizes =
		TEXT_BLOCKS.has( name ) &&
		hasBlockSupport( name, 'typography.fontSize' ) &&
		fontSizes?.length
			? [
					{ value: NONE, label: __( 'Default' ) },
					...fontSizes.map( ( fontSize ) => ( {
						value: fontSize.slug,
						label: fontSize.name || fontSize.slug,
						hint: getFontSizeHint( fontSize ),
					} ) ),
				]
			: [];

	const align = ( textAlign || showWidths ) && (
		<Menu.Group key="align">
			<Menu.GroupLabel>{ __( 'Align' ) }</Menu.GroupLabel>
			{ textAlign && (
				<ChoiceSubmenu
					label={ __( 'Text' ) }
					icon={
						textAlign.options.find(
							( option ) => option.value === textAlign.value
						)?.icon ?? textAlign.options[ 0 ].icon
					}
					options={ [
						{ value: NONE, label: __( 'Default' ) },
						...textAlign.options,
					] }
					value={ textAlign.value ?? NONE }
					onChange={ ( value ) =>
						textAlign.onChange( fromRadio( value ) )
					}
				/>
			) }
			{ showWidths && (
				<ChoiceSubmenu
					label={ __( 'Block' ) }
					icon={
						widths.find( ( option ) => option.value === width )
							?.icon
					}
					options={ widths }
					value={ width }
					onChange={ ( value ) =>
						setAttributes( { align: fromRadio( value ) } )
					}
				/>
			) }
		</Menu.Group>
	);

	const text = ( sizes.length > 0 || colors ) && (
		<Menu.Group key="text">
			{ sizes.length > 0 && (
				<ChoiceSubmenu
					label={ __( 'Text size' ) }
					icon={ typography }
					options={ sizes }
					value={
						getActiveFontSizeSlug( fontSizes, attributes ) ?? NONE
					}
					onChange={ ( value ) =>
						setAttributes(
							getFontSizeAttributes(
								attributes,
								fromRadio( value ) ?? null
							)
						)
					}
				/>
			) }
			{ colors?.kinds.map( ( kind ) => (
				<ColorSubmenu
					key={ kind }
					kind={ kind }
					clientId={ clientId }
					name={ name }
					attributes={ attributes }
					setAttributes={ setAttributes }
					choices={ colors.choices }
					canCustom={ colors.canCustom }
					onCustom={ onCustomColor }
				/>
			) ) }
		</Menu.Group>
	);

	return [ align || null, text || null ];
}

/**
 * What the items read from core's menu and the toolbar are, for telling
 * whether they have changed.
 *
 * @param {Object}   items          Items read.
 * @param {Object[]} items.first    Core's first items.
 * @param {Object[]} items.controls Core's other items.
 * @param {Object[]} items.tools    The toolbar's tools.
 * @return {string} The key.
 */
function getItemsKey( { first, controls, tools } ) {
	return [ ...first, ...controls, ...tools ]
		.map( ( item ) => `${ item.key }:${ item.disabled }:${ item.pressed }` )
		.join();
}

/**
 * The options menu, on the block's toolbar.
 *
 * @param {Object}   props
 * @param {string}   props.clientId         Block client ID.
 * @param {string}   props.name             Block name.
 * @param {Object}   props.attributes       Block attributes.
 * @param {Function} props.setAttributes    Block attribute setter.
 * @param {boolean}  props.isContainer      Whether the block has a Layout menu.
 * @param {Function} props.readCoreItems    Reads core's menu items.
 * @param {Function} props.observeCoreItems Calls back when core's menu items may have changed.
 * @return {Element} The menu.
 */
export function OptionsMenu( {
	clientId,
	name,
	attributes,
	setAttributes,
	isContainer,
	readCoreItems,
	observeCoreItems,
} ) {
	const registry = useRegistry();
	const triggerRef = useRef();
	const [ trigger, setTrigger ] = useState();
	const [ pickingColor, setPickingColor ] = useState( null );
	const shortcuts = useBlockShortcuts();
	const editingMode = useBlockEditingMode();
	const isDefaultEditingMode = editingMode === 'default';
	const colors = useBlockColors( name );
	const [ coreItems, setCoreItems ] = useState( {
		first: [],
		controls: [],
		tools: [],
	} );

	const readAllItems = () => ( {
		...readCoreItems(),
		tools: readToolbarTools(
			triggerRef.current?.closest( '.block-editor-block-toolbar' )
		),
	} );

	/*
	 * Core's items and the toolbar's tools are read as they change, not only
	 * as the menu opens, so the button can tell the menu would be empty
	 * before anyone opens it.
	 */
	useEffect( () => {
		if ( ! trigger ) {
			return;
		}

		const refresh = () =>
			setCoreItems( ( current ) => {
				const next = readAllItems();
				return getItemsKey( next ) === getItemsKey( current )
					? current
					: next;
			} );

		refresh();
		return observeCoreItems(
			trigger.closest( '.block-editor-block-toolbar' ),
			refresh
		);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- Reads through refs and stable readers.
	}, [ trigger, observeCoreItems ] );

	const blockTitle = getBlockType( name )?.title;
	const { canDuplicate, canInsert, canRemove, hasTextSelection } = useSelect(
		( select ) => {
			const {
				canInsertBlockType,
				canRemoveBlock,
				getBlockRootClientId,
				getSelectionStart,
			} = select( blockEditorStore );
			const rootClientId = getBlockRootClientId( clientId );

			return {
				canDuplicate:
					hasBlockSupport( name, 'multiple', true ) &&
					canInsertBlockType( name, rootClientId ),
				canInsert: canInsertBlockType(
					select( blocksStore ).getDefaultBlockName(),
					rootClientId
				),
				canRemove: canRemoveBlock( clientId ),
				hasTextSelection:
					getSelectionStart().clientId === clientId &&
					!! getSelectionStart().attributeKey,
			};
		},
		[ clientId, name ]
	);
	const { duplicateBlocks, insertAfterBlock, insertBeforeBlock } =
		useDispatch( blockEditorStore );

	const topLevelCoreItems = coreItems.controls.filter( ( item ) =>
		TOP_LEVEL_CORE_ITEMS.has( item.label )
	);
	const moreCoreItems = coreItems.controls.filter(
		( item ) => ! TOP_LEVEL_CORE_ITEMS.has( item.label )
	);

	const [ alignSection, textSection ] = useStyleSections( {
		clientId,
		name,
		attributes,
		setAttributes,
		isContainer,
		editingMode,
		colors,
		onCustomColor: setPickingColor,
	} );

	/*
	 * The menu's sections, each left out when the block has nothing for it,
	 * then joined with separators, so none is left empty or doubled up.
	 */
	const sections = [
		coreItems.first.length > 0 && (
			<Menu.Group key="first">
				<CoreItems items={ coreItems.first } />
			</Menu.Group>
		),
		coreItems.tools.length > 0 && (
			<Menu.Group key="tools">
				<Menu.GroupLabel>{ blockTitle }</Menu.GroupLabel>
				<ToolbarTools items={ coreItems.tools } />
			</Menu.Group>
		),
		alignSection,
		textSection,
		( hasTextSelection || isDefaultEditingMode || canInsert ) && (
			<Menu.Group key="edit">
				{ hasTextSelection && (
					<FormatSubmenu toolbarRef={ triggerRef } />
				) }
				{ isDefaultEditingMode && (
					<Submenu label={ __( 'Styles' ) }>
						<Menu.Item
							onClick={ () =>
								copyStyles( registry, [ clientId ] )
							}
						>
							<Menu.ItemLabel>
								{ __( 'Copy styles' ) }
							</Menu.ItemLabel>
						</Menu.Item>
						<Menu.Item
							onClick={ () =>
								pasteStyles( registry, [ clientId ] )
							}
						>
							<Menu.ItemLabel>
								{ __( 'Paste styles' ) }
							</Menu.ItemLabel>
						</Menu.Item>
					</Submenu>
				) }
				{ canInsert && (
					<Submenu label={ __( 'Insert' ) }>
						<Menu.Item
							shortcut={ shortcuts[ 'insert-before' ] }
							onClick={ () => insertBeforeBlock( clientId ) }
						>
							<Menu.ItemLabel>
								{ __( 'Block before' ) }
							</Menu.ItemLabel>
						</Menu.Item>
						<Menu.Item
							shortcut={ shortcuts[ 'insert-after' ] }
							onClick={ () => insertAfterBlock( clientId ) }
						>
							<Menu.ItemLabel>
								{ __( 'Block after' ) }
							</Menu.ItemLabel>
						</Menu.Item>
					</Submenu>
				) }
			</Menu.Group>
		),
		( isDefaultEditingMode || canDuplicate ) && (
			<Menu.Group key="clipboard">
				{ isDefaultEditingMode && (
					<Menu.Item
						shortcut={ toShortcut( 'primary', 'c' ) }
						onClick={ () => copyBlocks( registry, [ clientId ] ) }
					>
						<Menu.ItemLabel>{ __( 'Copy' ) }</Menu.ItemLabel>
					</Menu.Item>
				) }
				{ isDefaultEditingMode && canRemove && (
					<Menu.Item
						shortcut={ toShortcut( 'primary', 'x' ) }
						onClick={ () => cutBlocks( registry, [ clientId ] ) }
					>
						<Menu.ItemLabel>{ __( 'Cut' ) }</Menu.ItemLabel>
					</Menu.Item>
				) }
				{ canDuplicate && (
					<Menu.Item
						shortcut={ shortcuts.duplicate }
						onClick={ () => duplicateBlocks( [ clientId ] ) }
					>
						<Menu.ItemLabel>{ __( 'Duplicate' ) }</Menu.ItemLabel>
					</Menu.Item>
				) }
			</Menu.Group>
		),
		isDefaultEditingMode &&
			( topLevelCoreItems.length > 0 || moreCoreItems.length > 0 ) && (
				<Menu.Group key="core">
					<CoreItems items={ topLevelCoreItems } />
					{ moreCoreItems.length > 0 && (
						<Submenu label={ __( 'More' ) }>
							<CoreItems items={ moreCoreItems } />
						</Submenu>
					) }
				</Menu.Group>
			),
	].filter( Boolean );

	return (
		<>
			<ToolbarMenu
				ref={ ( node ) => {
					triggerRef.current = node;
					setTrigger( node );
				} }
				buttonProps={ {
					className: 'cnl-block-options__toggle',
					icon: optionsIcon,
					label: __( 'Options' ),
				} }
				popupClassName="cnl-block-options"
				disabled={ sections.length === 0 }
				onOpen={ () => setCoreItems( readAllItems() ) }
			>
				{ sections.map( ( section, index ) => (
					<Fragment key={ section.key ?? index }>
						{ index > 0 && <Menu.Separator /> }
						{ section }
					</Fragment>
				) ) }
			</ToolbarMenu>
			{ pickingColor && colors && (
				<ColorPickerPopover
					kind={ pickingColor }
					anchor={ trigger }
					clientId={ clientId }
					name={ name }
					attributes={ attributes }
					setAttributes={ setAttributes }
					choices={ colors.choices }
					onClose={ () => setPickingColor( null ) }
				/>
			) }
		</>
	);
}
