/**
 * Internal dependencies
 */
import { useListViewTreeState } from '../../list-view';
import { createNavigationLinkVariationBlock } from './navigation-list-view-insertions';
import {
	addSubmenuIcon,
	blockEditorStore,
	blocksStore,
	BlockTitle,
	chevronDownIcon,
	chevronUpIcon,
	createBlock,
	DropdownMenu,
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
	return createNavigationLinkVariationBlock(
		'custom-link',
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

	return (
		<MenuItem
			disabled={ isDisabled }
			icon={ addSubmenuIcon }
			onClick={ () => {
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
			} }
		>
			{ __( 'Add submenu link' ) }
		</MenuItem>
	);
}

export default function NavigationListViewMoreMenu( props ) {
	const { clientId, setInsertedBlockClientId, updateExpansion } = props;
	const block = useSelect(
		( select ) => select( blockEditorStore ).getBlock( clientId ),
		[ clientId ]
	);
	const { expansionState = {} } = useListViewTreeState();
	const {
		duplicateBlocks,
		insertBlock,
		moveBlocksDown,
		moveBlocksUp,
		removeBlocks,
	} = useDispatch( blockEditorStore );
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
		setInsertedBlockClientId?.( newLink.clientId );
	};

	if ( ! block ) {
		return null;
	}

	const removeLabel = sprintf(
		/* translators: %s: block name. */
		__( 'Remove %s' ),
		BlockTitle( { clientId, maximumLength: 25 } )
	);

	return (
		<DropdownMenu
			className="block-editor-block-settings-menu"
			disableOpenOnArrowDown={ props.disableOpenOnArrowDown }
			icon={ moreVerticalIcon }
			label={ __( 'Options' ) }
			noIcons
			popoverProps={ {
				...POPOVER_PROPS,
				...props.popoverProps,
			} }
			toggleProps={ props.toggleProps }
		>
			{ ( { onClose } ) => (
				<div>
					<MenuGroup>
						<MenuItem
							accessibleWhenDisabled
							disabled={ isFirst }
							icon={ chevronUpIcon }
							onClick={ () => {
								moveBlocksUp( [ clientId ], rootClientId );
								onClose();
							} }
						>
							{ __( 'Move up' ) }
						</MenuItem>
						<MenuItem
							accessibleWhenDisabled
							disabled={ isLast }
							icon={ chevronDownIcon }
							onClick={ () => {
								moveBlocksDown( [ clientId ], rootClientId );
								onClose();
							} }
						>
							{ __( 'Move down' ) }
						</MenuItem>
						<AddSubmenuItem
							block={ block }
							expandedState={ expansionState }
							expand={ ( expandClientId ) =>
								updateExpansion?.( {
									clientIds: [ expandClientId ],
									type: 'expand',
								} )
							}
							onClose={ onClose }
							setInsertedBlock={ ( insertedBlock ) =>
								setInsertedBlockClientId?.(
									insertedBlock.clientId
								)
							}
						/>
						{ canDuplicate && (
							<MenuItem
								onClick={ () => {
									duplicateBlocks( [ clientId ] );
									onClose();
								} }
							>
								{ __( 'Duplicate' ) }
							</MenuItem>
						) }
						{ canInsertBlock && (
							<MenuItem
								onClick={ () => {
									insertNavigationLink( index );
									onClose();
								} }
							>
								{ __( 'Add before' ) }
							</MenuItem>
						) }
						{ canInsertBlock && (
							<MenuItem
								onClick={ () => {
									insertNavigationLink( index + 1 );
									onClose();
								} }
							>
								{ __( 'Add after' ) }
							</MenuItem>
						) }
					</MenuGroup>
					<MenuGroup>
						<MenuItem
							onClick={ () => {
								removeBlocks( [ clientId ], false );
								onClose();
							} }
						>
							{ removeLabel }
						</MenuItem>
					</MenuGroup>
				</div>
			) }
		</DropdownMenu>
	);
}
