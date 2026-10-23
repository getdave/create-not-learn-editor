/**
 * The parent selector, outside the toolbar to its left, standing in for
 * core's icon-only one.
 *
 * It names the block it selects, "↖ Grid", so it can't be taken for one of
 * the selected block's own tools, and lights that block up while pointed at
 * or focused, as core's does. From two levels deep, a chevron beside it
 * lists every block the selected one sits in, from the outermost down, each
 * with its name, a custom one where set, and its type, so a block further up
 * is one pick away rather than a click per level.
 *
 * Core decides whether a block gets a parent selector at all; the stylesheet
 * shows this one only where core would show its own.
 */

/**
 * WordPress dependencies
 */
import { BlockIcon, store as blockEditorStore } from '@wordpress/block-editor';
import {
	/* eslint-disable @wordpress/no-unsafe-wp-apis -- The label List View and core's parent selector give a block, its custom name or what it shows. */
	__experimentalGetBlockLabel as getBlockLabel,
	/* eslint-enable @wordpress/no-unsafe-wp-apis */
	getBlockType,
	store as blocksStore,
} from '@wordpress/blocks';
import { ToolbarButton } from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { __, sprintf } from '@wordpress/i18n';
import { arrowUpLeft, chevronDown } from '@wordpress/icons';
import { Menu } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { ToolbarMenu } from './toolbar-menu';

/**
 * The selected block's ancestors, outermost first, skipping any the editor
 * keeps out of reach, as core's parent selector does.
 *
 * @param {string} clientId Block client ID.
 * @return {string[]} Their client IDs.
 */
function useAncestorIds( clientId ) {
	const parents = useSelect(
		( select ) => select( blockEditorStore ).getBlockParents( clientId ),
		[ clientId ]
	);
	const editingModes = useSelect(
		( select ) =>
			parents
				.map( ( id ) =>
					select( blockEditorStore ).getBlockEditingMode( id )
				)
				.join(),
		[ parents ]
	).split( ',' );

	return parents.filter(
		( id, index ) => editingModes[ index ] !== 'disabled'
	);
}

const NO_DETAILS = {};

/**
 * A block's icon, name and type, as List View gives them.
 *
 * @param {string} clientId Block client ID.
 * @return {{ icon: Object, label: string, type: string }} The block's details.
 */
function useBlockDetails( clientId ) {
	return useSelect(
		( select ) => {
			const { getBlockAttributes, getBlockName } =
				select( blockEditorStore );
			const name = getBlockName( clientId );
			const blockType = getBlockType( name );

			// A block at the top of the page has no parent to describe.
			if ( ! blockType ) {
				return NO_DETAILS;
			}

			const attributes = getBlockAttributes( clientId );

			const variation = select( blocksStore ).getActiveBlockVariation(
				name,
				attributes
			);

			return {
				icon: variation?.icon ?? blockType?.icon,
				label:
					attributes?.metadata?.name ||
					getBlockLabel( blockType, attributes, 'list-view' ),
				type: variation?.title ?? blockType?.title,
			};
		},
		[ clientId ]
	);
}

/**
 * Light a block up while something standing for it is pointed at or
 * focused.
 *
 * @param {string} clientId Block client ID.
 * @return {Object} Props for the element standing for it.
 */
function useHighlight( clientId ) {
	const { toggleBlockHighlight } = useDispatch( blockEditorStore );
	const on = () => toggleBlockHighlight( clientId, true );
	const off = () => toggleBlockHighlight( clientId, false );

	return {
		onMouseEnter: on,
		onMouseLeave: off,
		onFocus: on,
		onBlur: off,
	};
}

/**
 * One ancestor in the list: its icon and name, indented together by its
 * depth, then its type. The icon is part of the label rather than the
 * menu's icon column, which lines every item's icon up and so can't show
 * nesting.
 *
 * @param {Object} props
 * @param {string} props.clientId Ancestor's client ID.
 * @param {number} props.depth    How deep it is, from 0.
 * @return {Element} The item.
 */
function LineageItem( { clientId, depth } ) {
	const { selectBlock } = useDispatch( blockEditorStore );
	const { icon, label, type } = useBlockDetails( clientId );
	const highlight = useHighlight( clientId );

	return (
		<Menu.Item
			onClick={ () => selectBlock( clientId ) }
			{ ...highlight }
			suffix={ label !== type ? type : undefined }
		>
			<Menu.ItemLabel>
				<span
					className="cnl-block-lineage__label"
					style={ { '--cnl-lineage-depth': depth } }
				>
					<BlockIcon icon={ icon } />
					{ label }
				</span>
			</Menu.ItemLabel>
		</Menu.Item>
	);
}

/**
 * The parent selector, and the list of blocks further up.
 *
 * @param {Object} props
 * @param {string} props.clientId Block client ID.
 * @return {?Element} The controls.
 */
export function ParentSelector( { clientId } ) {
	const ancestorIds = useAncestorIds( clientId );
	const parentId = ancestorIds[ ancestorIds.length - 1 ];
	const { label } = useBlockDetails( parentId );
	const { selectBlock } = useDispatch( blockEditorStore );
	const highlight = useHighlight( parentId );

	if ( ! parentId ) {
		return null;
	}

	return (
		<>
			<ToolbarButton
				className="cnl-block-parent__button"
				icon={ arrowUpLeft }
				label={ sprintf(
					/* translators: %s: the parent block's name, like Group. */
					__( 'Select parent block: %s' ),
					label
				) }
				showTooltip
				onClick={ () => selectBlock( parentId ) }
				{ ...highlight }
			>
				<span className="cnl-block-parent__label">{ label }</span>
			</ToolbarButton>
			{ ancestorIds.length > 1 && (
				<ToolbarMenu
					buttonProps={ {
						className: 'cnl-block-parent__lineage',
						icon: chevronDown,
						label: __( 'Select a block further up' ),
					} }
					popupClassName="cnl-block-lineage"
				>
					{ ancestorIds.map( ( id, depth ) => (
						<LineageItem
							key={ id }
							clientId={ id }
							depth={ depth }
						/>
					) ) }
				</ToolbarMenu>
			) }
		</>
	);
}
