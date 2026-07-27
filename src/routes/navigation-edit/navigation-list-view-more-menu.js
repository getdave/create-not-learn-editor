/**
 * Internal dependencies
 */
import {
	addSubmenuIcon,
	blockEditorStore,
	blocksStore,
	BlockTitle,
	chevronDownIcon,
	chevronUpIcon,
	createBlock,
	DropdownMenu,
	el,
	hasBlockSupport,
	MenuGroup,
	MenuItem,
	moreVerticalIcon,
	sprintf,
	useDispatch,
	useSelect,
	__,
} from '../../wordpress-packages';

const DEFAULT_NAVIGATION_LINK = {
	attributes: {
		label: '',
		url: '',
	},
	name: 'core/navigation-link',
};
const BLOCKS_THAT_CAN_BE_CONVERTED_TO_SUBMENU = [
	'core/navigation-link',
	'core/navigation-submenu',
];
const POPOVER_PROPS = {
	className: 'block-editor-block-settings-menu__popover',
	placement: 'bottom-start',
};

function createDefaultNavigationLink() {
	return createBlock(
		DEFAULT_NAVIGATION_LINK.name,
		DEFAULT_NAVIGATION_LINK.attributes
	);
}

function AddSubmenuItem( {
	block,
	expandedState,
	expand,
	onClose,
	setInsertedBlock,
} ) {
	const { insertBlock, replaceBlock, replaceInnerBlocks } =
		useDispatch( blockEditorStore );
	const clientId = block.clientId;
	const isDisabled = ! BLOCKS_THAT_CAN_BE_CONVERTED_TO_SUBMENU.includes(
		block.name
	);

	return el(
		MenuItem,
		{
			disabled: isDisabled,
			icon: addSubmenuIcon,
			onClick: () => {
				const updateSelectionOnInsert = false;
				const newLink = createDefaultNavigationLink();

				if ( block.name === 'core/navigation-submenu' ) {
					insertBlock(
						newLink,
						block.innerBlocks.length,
						clientId,
						updateSelectionOnInsert
					);
					if ( ! expandedState[ clientId ] ) {
						expand( clientId );
					}
				} else {
					const newSubmenu = createBlock(
						'core/navigation-submenu',
						block.attributes,
						block.innerBlocks
					);

					replaceBlock( clientId, newSubmenu );
					replaceInnerBlocks(
						newSubmenu.clientId,
						[ newLink ],
						updateSelectionOnInsert
					);
					expand( newSubmenu.clientId );
				}

				setInsertedBlock( newLink );
				onClose();
			},
		},
		__( 'Add submenu link' )
	);
}

export default function NavigationListViewMoreMenu( props ) {
	const { block } = props;
	const { clientId } = block;
	const {
		duplicateBlocks,
		insertBlock,
		moveBlocksDown,
		moveBlocksUp,
		removeBlocks,
	} = useDispatch( blockEditorStore );
	const removeLabel = sprintf(
		/* translators: %s: block name. */
		__( 'Remove %s' ),
		BlockTitle( { clientId, maximumLength: 25 } )
	);
	const {
		canDuplicate,
		canInsertBlock,
		index,
		isFirst,
		isLast,
		rootClientId,
	} = useSelect(
		( select ) => {
			const {
				canInsertBlockType,
				getBlockCount,
				getBlockIndex,
				getBlockRootClientId,
			} = select( blockEditorStore );
			const { getDefaultBlockName } = select( blocksStore );
			const blockRootClientId = getBlockRootClientId( clientId );
			const defaultBlockName = getDefaultBlockName();
			const currentIndex = getBlockIndex( clientId );
			const canInsertDefaultBlock =
				defaultBlockName &&
				canInsertBlockType( defaultBlockName, blockRootClientId );
			const canInsertNavigationLink = canInsertBlockType(
				DEFAULT_NAVIGATION_LINK.name,
				blockRootClientId
			);

			return {
				canDuplicate:
					!! block &&
					hasBlockSupport( block.name, 'multiple', true ) &&
					canInsertBlockType( block.name, blockRootClientId ),
				canInsertBlock:
					!! block &&
					( canInsertDefaultBlock || canInsertNavigationLink ),
				index: currentIndex,
				isFirst: currentIndex === 0,
				isLast: currentIndex === getBlockCount( blockRootClientId ) - 1,
				rootClientId: blockRootClientId,
			};
		},
		[ block, clientId ]
	);
	const insertNavigationLink = ( nextIndex ) => {
		const newLink = createDefaultNavigationLink();

		insertBlock( newLink, nextIndex, rootClientId, false );
		props.setInsertedBlock( newLink );
	};

	return el(
		DropdownMenu,
		{
			className: 'block-editor-block-settings-menu',
			disableOpenOnArrowDown: props.disableOpenOnArrowDown,
			icon: moreVerticalIcon,
			label: __( 'Options' ),
			noIcons: true,
			popoverProps: {
				...POPOVER_PROPS,
				...props.popoverProps,
			},
			toggleProps: props.toggleProps,
		},
		( { onClose } ) =>
			el(
				'div',
				null,
				el(
					MenuGroup,
					null,
					el(
						MenuItem,
						{
							accessibleWhenDisabled: true,
							disabled: isFirst,
							icon: chevronUpIcon,
							onClick: () => {
								moveBlocksUp( [ clientId ], rootClientId );
								onClose();
							},
						},
						__( 'Move up' )
					),
					el(
						MenuItem,
						{
							accessibleWhenDisabled: true,
							disabled: isLast,
							icon: chevronDownIcon,
							onClick: () => {
								moveBlocksDown( [ clientId ], rootClientId );
								onClose();
							},
						},
						__( 'Move down' )
					),
					el( AddSubmenuItem, {
						block,
						expandedState: props.expandedState,
						expand: props.expand,
						onClose,
						setInsertedBlock: props.setInsertedBlock,
					} ),
					canDuplicate &&
						el(
							MenuItem,
							{
								onClick: () => {
									duplicateBlocks( [ clientId ] );
									onClose();
								},
							},
							__( 'Duplicate' )
						),
					canInsertBlock &&
						el(
							MenuItem,
							{
								onClick: () => {
									insertNavigationLink( index );
									onClose();
								},
							},
							__( 'Add before' )
						),
					canInsertBlock &&
						el(
							MenuItem,
							{
								onClick: () => {
									insertNavigationLink( index + 1 );
									onClose();
								},
							},
							__( 'Add after' )
						)
				),
				el(
					MenuGroup,
					null,
					el(
						MenuItem,
						{
							onClick: () => {
								removeBlocks( [ clientId ], false );
								onClose();
							},
						},
						removeLabel
					)
				)
			)
	);
}
