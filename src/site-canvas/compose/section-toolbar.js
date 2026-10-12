/**
 * The toolbars Compose shows over what is picked: a section's, to move it,
 * change its layout or colours, edit or delete it, and the header's or
 * footer's, to change its design or edit it.
 *
 * Built as core's block toolbar is, from the same components and class names,
 * so they look and behave like the toolbar over any block: the block's icon
 * and mover first, a group for each set of controls, and the less common
 * actions under Options.
 */

/**
 * WordPress dependencies
 */
import {
	Toolbar,
	ToolbarButton,
	ToolbarGroup,
	ToolbarItem,
} from '@wordpress/components';

/**
 * Internal dependencies
 */
import { getSectionArrangements } from '../../layouts/variants';
import {
	__,
	BlockIcon,
	blockEditorStore,
	blocksStore,
	chevronDownIcon,
	chevronUpIcon,
	cloneBlock,
	colorIcon,
	coreDataStore,
	dragHandleIcon,
	DropdownMenu,
	el,
	footerIcon,
	getBlockType,
	headerIcon,
	layoutIcon,
	MenuGroup,
	MenuItem,
	moreVerticalIcon,
	parseBlocks,
	pencilIcon,
	serialize,
	stylesIcon,
	useDispatch,
	useMemo,
	useSelect,
} from '../../wordpress-packages';
import {
	getActiveSectionStyle,
	getSectionStyles,
	withSectionStyle,
} from './section-styles';
import { VariationMenu } from './variation-menu';

const EMPTY_ARRAY = [];

/**
 * A toolbar dressed as core's block toolbar.
 *
 * @param {Object}  props
 * @param {string}  props.label    What it is for, like the section's name.
 * @param {boolean} props.isSynced Whether it is for something shared by every
 *                                 page, which core marks in purple.
 * @param {Element} props.children Its groups.
 * @return {Element} The toolbar.
 */
function ComposeToolbar( { children, isSynced = false, label } ) {
	return el(
		Toolbar,
		{
			className:
				'block-editor-block-contextual-toolbar cnl-compose-toolbar',
			label,
		},
		el(
			'div',
			{
				className: `block-editor-block-toolbar${
					isSynced ? ' is-synced' : ''
				}`,
			},
			children
		)
	);
}

/**
 * The block's icon at the start of the toolbar. As in core when a block
 * can't be switched to another, it isn't a control.
 *
 * @param {Object}  props
 * @param {Object}  props.icon  The icon.
 * @param {string}  props.label The block's name, for its title.
 * @param {?string} props.text  Text beside the icon, if any.
 * @return {Element} The button.
 */
function BlockIconButton( { icon, label, text } ) {
	return el( ToolbarButton, {
		className: 'block-editor-block-toolbar__block-icon-button',
		disabled: true,
		icon: el( BlockIcon, {
			className: 'block-editor-block-toolbar__block-icon',
			icon,
			showColors: true,
		} ),
		text,
		title: label,
	} );
}

/**
 * A section's layouts and colours, each as it would look.
 *
 * @param {string} clientId The section's client ID.
 * @return {Object} `{ block, colors, layouts }`. `colors` and `layouts` are
 *                  `{ current, options }`, or null when there are none.
 */
function useSectionVariations( clientId ) {
	const { block, blockStyles, themeVariations } = useSelect(
		( select ) => {
			const section = select( blockEditorStore ).getBlock( clientId );

			return {
				block: section,
				blockStyles: section
					? select( blocksStore ).getBlockStyles( section.name )
					: EMPTY_ARRAY,
				themeVariations: section
					? select(
							coreDataStore
						).__experimentalGetCurrentThemeBaseGlobalStyles()
							?.styles?.blocks?.[ section.name ]?.variations
					: undefined,
			};
		},
		[ clientId ]
	);

	const layouts = useMemo( () => {
		const arrangements = block && getSectionArrangements( block );

		return arrangements
			? {
					current: arrangements.current,
					options: arrangements.options.map( ( option ) => ( {
						blocks: [ option.block ],
						block: option.block,
						label: option.label,
						name: option.name,
					} ) ),
				}
			: null;
	}, [ block ] );

	const colors = useMemo( () => {
		const styles = getSectionStyles( blockStyles, themeVariations );

		if ( ! block || ! styles.length ) {
			return null;
		}

		const className = block.attributes.className;
		const withStyle = ( name ) =>
			cloneBlock( block, {
				className: withSectionStyle( className, name ),
			} );

		return {
			current: getActiveSectionStyle( className, styles ),
			options: [
				{
					blocks: [ withStyle( null ) ],
					label: __( 'None' ),
					name: null,
				},
				...styles.map( ( style ) => ( {
					blocks: [ withStyle( style.name ) ],
					label: style.label,
					name: style.name,
				} ) ),
			],
		};
	}, [ block, blockStyles, themeVariations ] );

	return { block, colors, layouts };
}

/**
 * @param {Object}   props
 * @param {string}   props.clientId     The section's client ID.
 * @param {number}   props.index        Its position among the sections.
 * @param {number}   props.count        How many sections there are.
 * @param {string}   props.rootClientId The sections' parent.
 * @param {string}   props.title        The section's name.
 * @param {Function} props.onDragStart  Starts dragging the section, called
 *                                      with the pointer event.
 * @param {Function} props.onEdit       Edits the section in Edit.
 * @param {Function} props.onRemove     Removes the section.
 * @param {Function} props.onReplace    Called with the block that takes the
 *                                      section's place.
 * @return {Element} The toolbar.
 */
export function SectionToolbar( {
	clientId,
	count,
	index,
	onDragStart,
	onEdit,
	onRemove,
	onReplace,
	rootClientId,
	title,
} ) {
	const {
		moveBlocksDown,
		moveBlocksUp,
		replaceBlock,
		updateBlockAttributes,
	} = useDispatch( blockEditorStore );
	const { block, colors, layouts } = useSectionVariations( clientId );

	return el(
		ComposeToolbar,
		{ label: title },
		el(
			'div',
			null,
			el(
				ToolbarGroup,
				{ className: 'block-editor-block-toolbar__block-controls' },
				el(
					ToolbarGroup,
					null,
					el( BlockIconButton, {
						icon: block && getBlockType( block.name )?.icon,
						label: title,
					} )
				),
				el(
					ToolbarGroup,
					{ className: 'block-editor-block-mover' },
					el( ToolbarButton, {
						__next40pxDefaultSize: true,
						className: 'block-editor-block-mover__drag-handle',
						icon: dragHandleIcon,
						label: __( 'Drag' ),
						onPointerDown: onDragStart,
					} ),
					el(
						'div',
						{
							className:
								'block-editor-block-mover__move-button-container',
						},
						el( ToolbarButton, {
							__next40pxDefaultSize: true,
							accessibleWhenDisabled: true,
							className:
								'block-editor-block-mover-button is-up-button',
							disabled: index === 0,
							icon: chevronUpIcon,
							label: __( 'Move up' ),
							onClick: () =>
								moveBlocksUp( [ clientId ], rootClientId ),
						} ),
						el( ToolbarButton, {
							__next40pxDefaultSize: true,
							accessibleWhenDisabled: true,
							className:
								'block-editor-block-mover-button is-down-button',
							disabled: index === count - 1,
							icon: chevronDownIcon,
							label: __( 'Move down' ),
							onClick: () =>
								moveBlocksDown( [ clientId ], rootClientId ),
						} )
					)
				)
			)
		),
		( layouts || colors ) &&
			el(
				ToolbarGroup,
				null,
				layouts &&
					el( VariationMenu, {
						current: layouts.current,
						icon: layoutIcon,
						label: __( 'Layout' ),
						onSelect: ( option ) => {
							const next = cloneBlock( option.block );

							replaceBlock( clientId, next );
							onReplace( next );
						},
						options: layouts.options,
					} ),
				colors &&
					el( VariationMenu, {
						current: colors.current,
						icon: colorIcon,
						label: __( 'Color' ),
						onSelect: ( option ) =>
							updateBlockAttributes( clientId, {
								className: withSectionStyle(
									block.attributes.className,
									option.name
								),
							} ),
						options: colors.options,
					} )
			),
		el(
			ToolbarGroup,
			null,
			el( ToolbarButton, {
				icon: pencilIcon,
				label: __( 'Edit' ),
				onClick: onEdit,
			} )
		),
		el(
			ToolbarGroup,
			null,
			el( ToolbarItem, null, ( toggleProps ) =>
				el(
					DropdownMenu,
					{
						icon: moreVerticalIcon,
						label: __( 'Options' ),
						popoverProps: { placement: 'bottom-start' },
						toggleProps,
					},
					( { onClose } ) =>
						el(
							MenuGroup,
							null,
							el(
								MenuItem,
								{
									onClick: () => {
										onClose();
										onRemove();
									},
								},
								__( 'Delete' )
							)
						)
				)
			)
		)
	);
}

/**
 * The designs a header or footer can take, each as it would look.
 *
 * Core's template part block offers the same in its Design panel: the
 * patterns made for the part's area. They are read from the site's patterns
 * rather than the block editor's, which leaves out any that can't be inserted
 * where the part is, and nothing can be inserted in the template around a
 * page.
 *
 * @param {Object} part `{ area, clientId, id }`.
 * @return {Object} `{ current, options }`.
 */
function usePartDesigns( part ) {
	const { patterns, partBlocks } = useSelect(
		( select ) => ( {
			partBlocks: select( coreDataStore ).getEditedEntityRecord(
				'postType',
				'wp_template_part',
				part.id
			)?.blocks,
			patterns: select( coreDataStore ).getBlockPatterns(),
		} ),
		[ part.id ]
	);

	return useMemo( () => {
		const blockType = `core/template-part/${ part.area }`;
		const markup = partBlocks ? serialize( partBlocks ) : '';
		const options = ( patterns || EMPTY_ARRAY )
			.filter( ( pattern ) =>
				( pattern.blockTypes || EMPTY_ARRAY ).includes( blockType )
			)
			.map( ( pattern ) => ( {
				blocks: parseBlocks( pattern.content ),
				label: pattern.title,
				name: pattern.name,
			} ) );

		return {
			current:
				options.find(
					( option ) =>
						markup && serialize( option.blocks ) === markup
				)?.name ?? null,
			options,
		};
	}, [ part.area, partBlocks, patterns ] );
}

/**
 * @param {Object}   props
 * @param {Object}   props.part   `{ area, clientId, id }`.
 * @param {string}   props.title  The part's name, like Header.
 * @param {Function} props.onEdit Edits the part in Edit.
 * @return {Element} The toolbar.
 */
export function PartToolbar( { part, title, onEdit } ) {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const designs = usePartDesigns( part );

	return el(
		ComposeToolbar,
		{ isSynced: true, label: title },
		el(
			ToolbarGroup,
			{ className: 'block-editor-block-toolbar__block-controls' },
			el( BlockIconButton, {
				icon: part.area === 'footer' ? footerIcon : headerIcon,
				label: title,
				text: title,
			} )
		),
		designs.options.length > 0 &&
			el(
				ToolbarGroup,
				null,
				el( VariationMenu, {
					current: designs.current,
					icon: stylesIcon,
					label: __( 'Design' ),
					onSelect: ( option ) => {
						const blocks = option.blocks.map( ( item ) =>
							cloneBlock( item )
						);

						editEntityRecord(
							'postType',
							'wp_template_part',
							part.id,
							{ blocks, content: serialize( blocks ) }
						);
					},
					options: designs.options,
				} )
			),
		el(
			ToolbarGroup,
			null,
			el( ToolbarButton, {
				icon: pencilIcon,
				label: __( 'Edit' ),
				onClick: onEdit,
			} )
		)
	);
}
