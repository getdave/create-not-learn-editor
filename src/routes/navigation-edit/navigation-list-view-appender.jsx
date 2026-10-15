/**
 * Internal dependencies
 */
import {
	addSubmenuIcon,
	blockEditorStore,
	chevronLeftIcon,
	DropdownMenu,
	linkIcon,
	MenuGroup,
	MenuItem,
	pageIcon,
	plusIcon,
	postCategoriesIcon,
	useDispatch,
	useSelect,
	useState,
	__,
} from '../../wordpress-packages';
import {
	createCustomNavigationLinkBlock,
	createCustomNavigationSubmenuBlock,
	createExistingPageNavigationLinkBlock,
	createLabelOnlyNavigationSubmenuBlock,
	createPageNavigationSubmenuBlock,
	getBlockListRootClientId,
	insertBlockAtListAppenderPosition,
} from './navigation-list-view-insertions';

function deferUntilDropdownCloses( callback ) {
	if ( typeof window === 'undefined' || ! window.requestAnimationFrame ) {
		callback();
		return;
	}

	window.requestAnimationFrame( callback );
}

export default function NavigationListViewAppender( {
	blockCount,
	clientId,
	descriptionId,
	forwardedRef,
	isEmptyBranch,
	onAddLabelOnlySubmenu,
	onAddMenuItems,
	setInsertedBlockClientId,
	...props
} ) {
	const [ isChoosingSubmenuType, setIsChoosingSubmenuType ] =
		useState( false );
	const rootClientId = getBlockListRootClientId( clientId );
	const { replaceInnerBlocks } = useDispatch( blockEditorStore );
	const { blocks, isSubmenuAppender } = useSelect(
		( select ) => {
			const store = select( blockEditorStore );

			return {
				blocks: store.getBlocks( rootClientId ),
				isSubmenuAppender:
					!! clientId &&
					store.getBlockName( clientId ) ===
						'core/navigation-submenu',
			};
		},
		[ clientId, rootClientId ]
	);
	const shouldShowEmptySubmenu =
		isEmptyBranch || ( isSubmenuAppender && blockCount === 0 );
	const appenderLabel = isSubmenuAppender
		? __( 'Add to submenu' )
		: __( 'Add menu item' );
	const toggleClassName = [
		typeof props.className === 'string' ? props.className : '',
		'block-editor-inserter__toggle',
		'routes-navigation-edit-list-view__appender',
	]
		.filter( Boolean )
		.join( ' ' );

	const appendBlock = ( block, { openLinkUI = true } = {} ) => {
		replaceInnerBlocks(
			rootClientId,
			insertBlockAtListAppenderPosition( blocks, block, blockCount ),
			false
		);

		if ( openLinkUI ) {
			setInsertedBlockClientId?.( block.clientId );
		}
	};

	const dropdown = (
		<DropdownMenu
			icon={ plusIcon }
			label={ appenderLabel }
			onToggle={ ( isOpen ) => {
				if ( ! isOpen ) {
					setIsChoosingSubmenuType( false );
				}
			} }
			popoverProps={ { placement: 'bottom-start' } }
			toggleProps={ {
				...props,
				'aria-describedby': descriptionId,
				__next40pxDefaultSize: true,
				className: toggleClassName,
				ref: forwardedRef,
			} }
		>
			{ ( { onClose } ) =>
				isChoosingSubmenuType ? (
					<div>
						<MenuGroup>
							<MenuItem
								icon={ chevronLeftIcon }
								onClick={ () =>
									setIsChoosingSubmenuType( false )
								}
							>
								{ __( 'Back' ) }
							</MenuItem>
						</MenuGroup>
						<MenuGroup>
							<MenuItem
								icon={ pageIcon }
								onClick={ () => {
									onClose();
									setIsChoosingSubmenuType( false );
									deferUntilDropdownCloses( () =>
										appendBlock(
											createPageNavigationSubmenuBlock()
										)
									);
								} }
							>
								{ __( 'Existing page' ) }
							</MenuItem>
							<MenuItem
								icon={ linkIcon }
								onClick={ () => {
									onClose();
									setIsChoosingSubmenuType( false );
									deferUntilDropdownCloses( () =>
										appendBlock(
											createCustomNavigationSubmenuBlock()
										)
									);
								} }
							>
								{ __( 'Custom link' ) }
							</MenuItem>
							<MenuItem
								icon={ addSubmenuIcon }
								onClick={ () => {
									onClose();
									setIsChoosingSubmenuType( false );
									deferUntilDropdownCloses( () => {
										const block =
											createLabelOnlyNavigationSubmenuBlock();

										appendBlock( block, {
											openLinkUI: false,
										} );
										onAddLabelOnlySubmenu?.( block );
									} );
								} }
							>
								{ __( 'Label only' ) }
							</MenuItem>
						</MenuGroup>
					</div>
				) : (
					<div>
						<MenuGroup>
							<MenuItem
								icon={ pageIcon }
								onClick={ () => {
									onClose();
									deferUntilDropdownCloses( () =>
										appendBlock(
											createExistingPageNavigationLinkBlock()
										)
									);
								} }
							>
								{ __( 'Add existing page' ) }
							</MenuItem>
							<MenuItem
								icon={ linkIcon }
								onClick={ () => {
									onClose();
									deferUntilDropdownCloses( () =>
										appendBlock(
											createCustomNavigationLinkBlock()
										)
									);
								} }
							>
								{ __( 'Custom link' ) }
							</MenuItem>
							<MenuItem
								icon={ addSubmenuIcon }
								onClick={ () =>
									setIsChoosingSubmenuType( true )
								}
							>
								{ __( 'Submenu' ) }
							</MenuItem>
						</MenuGroup>
						<MenuGroup>
							<MenuItem
								icon={ postCategoriesIcon }
								onClick={ () => {
									onAddMenuItems?.( clientId || null );
									onClose();
								} }
							>
								{ __( 'More…' ) }
							</MenuItem>
						</MenuGroup>
					</div>
				)
			}
		</DropdownMenu>
	);

	if ( ! shouldShowEmptySubmenu ) {
		return dropdown;
	}

	return (
		<div className="routes-navigation-edit-list-view__empty-submenu">
			<span>{ __( 'This submenu is empty.' ) }</span>
			{ dropdown }
		</div>
	);
}
