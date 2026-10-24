/**
 * The block toolbar, reworked along the lines of Gutenberg's proposal for it
 * (https://github.com/WordPress/gutenberg/issues/85204), from outside core's
 * toolbar rather than as a toolbar of our own.
 *
 * Core's toolbar stays, with its slots, keyboard handling and focus. Its own
 * pieces are restyled or hidden by the stylesheet, and what replaces them is
 * filled into its slots:
 *
 * - The block's name beside its icon, as the way to transform it.
 * - Full-size movers.
 * - A Layout menu and "+" for containers, in the block group.
 * - An options menu standing in for core's "⋮", with the style controls the
 *   toolbar used to show, and a trash button, at the end.
 * - Every block it sits in, beside core's select-parent button.
 * - Formatting with a text selection, next to it.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * for the same reason as `src/editor-extensions/template-part-editing.js`.
 */

/**
 * WordPress dependencies
 */
import {
	BlockControls,
	store as blockEditorStore,
	useBlockEditingMode,
} from '@wordpress/block-editor';
import { ToolbarButton, ToolbarGroup } from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { addFilter } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';
import { trash } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { CoreMenuItemsHost, useCoreMenuItems } from './core-menu-items';
import { ContainerControls, isContainerBlock } from './layout-menu';
import { OptionsMenu } from './options-menu';
import { ParentSelector } from './parent-selector';
import { useBlockShortcuts } from './shortcuts';
import { registerToolbarKeyboard } from './toolbar-keyboard';
import { useFloatingFormatToolbar } from './use-floating-format-toolbar';
import { useParentSelectorFit } from './use-parent-selector-fit';

/**
 * Delete, at the end of the toolbar, now there is room for it. Where Edit
 * content adds its own Remove (`src/site-canvas/section-modes/`), which also
 * keeps the section's layout and offers Restore, the stylesheet hides this.
 *
 * @param {Object} props
 * @param {string} props.clientId Block client ID.
 * @return {?Element} The button.
 */
function TrashButton( { clientId } ) {
	const canRemove = useSelect(
		( select ) => select( blockEditorStore ).canRemoveBlock( clientId ),
		[ clientId ]
	);
	const { removeBlocks } = useDispatch( blockEditorStore );
	const { remove } = useBlockShortcuts();

	if ( ! canRemove ) {
		return null;
	}

	return (
		<ToolbarButton
			className="cnl-block-toolbar__trash"
			icon={ trash }
			label={ __( 'Delete' ) }
			shortcut={ remove?.displayShortcut }
			onClick={ () => removeBlocks( [ clientId ], true ) }
		/>
	);
}

/**
 * What the selected block adds to core's toolbar.
 *
 * @param {Object}   props
 * @param {string}   props.clientId      Block client ID.
 * @param {string}   props.name          Block name.
 * @param {Object}   props.attributes    Block attributes.
 * @param {Function} props.setAttributes Block attribute setter.
 * @return {Element} The fills.
 */
function BlockToolbarFills( { clientId, name, attributes, setAttributes } ) {
	const { hostRef, read, observe } = useCoreMenuItems();
	const isDefaultEditingMode = useBlockEditingMode() === 'default';
	const isContainer = isDefaultEditingMode && isContainerBlock( name );

	useFloatingFormatToolbar( clientId );
	useParentSelectorFit( clientId );

	return (
		<>
			<BlockControls group="parent">
				<ParentSelector clientId={ clientId } />
			</BlockControls>
			{ isContainer && (
				<BlockControls group="block">
					<ContainerControls
						clientId={ clientId }
						name={ name }
						attributes={ attributes }
						setAttributes={ setAttributes }
					/>
				</BlockControls>
			) }
			<BlockControls group="other">
				<ToolbarGroup className="cnl-block-toolbar__end">
					<OptionsMenu
						clientId={ clientId }
						name={ name }
						attributes={ attributes }
						setAttributes={ setAttributes }
						isContainer={ isContainer }
						readCoreItems={ read }
						observeCoreItems={ observe }
					/>
					<TrashButton clientId={ clientId } />
				</ToolbarGroup>
			</BlockControls>
			<CoreMenuItemsHost clientId={ clientId } hostRef={ hostRef } />
		</>
	);
}

function withBlockToolbar( BlockEdit ) {
	return function BlockToolbarBlockEdit( props ) {
		return (
			<>
				<BlockEdit { ...props } />
				{ props.isSelected && (
					<BlockToolbarFills
						clientId={ props.clientId }
						name={ props.name }
						attributes={ props.attributes }
						setAttributes={ props.setAttributes }
					/>
				) }
			</>
		);
	};
}

/**
 * Register the reworked block toolbar with the editor.
 */
export function registerBlockToolbar() {
	document.documentElement.classList.add( 'cnl-has-block-toolbar' );
	registerToolbarKeyboard();

	addFilter(
		'editor.BlockEdit',
		'create-not-learn-editor/block-toolbar',
		withBlockToolbar
	);
}
