/**
 * Internal dependencies
 */
import {
	addSubmenuIcon,
	blockEditorStore,
	chevronLeftIcon,
	DropdownMenu,
	el,
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
	setInsertedBlock,
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
			setInsertedBlock( block );
		}
	};

	const dropdown = el(
		DropdownMenu,
		{
			icon: plusIcon,
			label: appenderLabel,
			onToggle: ( isOpen ) => {
				if ( ! isOpen ) {
					setIsChoosingSubmenuType( false );
				}
			},
			popoverProps: { placement: 'bottom-start' },
			toggleProps: {
				...props,
				'aria-describedby': descriptionId,
				__next40pxDefaultSize: true,
				className: toggleClassName,
				ref: forwardedRef,
			},
		},
		( { onClose } ) =>
			isChoosingSubmenuType
				? el(
						'div',
						null,
						el(
							MenuGroup,
							null,
							el(
								MenuItem,
								{
									icon: chevronLeftIcon,
									onClick: () =>
										setIsChoosingSubmenuType( false ),
								},
								__( 'Back' )
							)
						),
						el(
							MenuGroup,
							null,
							el(
								MenuItem,
								{
									icon: pageIcon,
									onClick: () => {
										onClose();
										setIsChoosingSubmenuType( false );
										deferUntilDropdownCloses( () =>
											appendBlock(
												createPageNavigationSubmenuBlock()
											)
										);
									},
								},
								__( 'Existing page' )
							),
							el(
								MenuItem,
								{
									icon: linkIcon,
									onClick: () => {
										onClose();
										setIsChoosingSubmenuType( false );
										deferUntilDropdownCloses( () =>
											appendBlock(
												createCustomNavigationSubmenuBlock()
											)
										);
									},
								},
								__( 'Custom link' )
							),
							el(
								MenuItem,
								{
									icon: addSubmenuIcon,
									onClick: () => {
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
									},
								},
								__( 'Label only' )
							)
						)
				  )
				: el(
						'div',
						null,
						el(
							MenuGroup,
							null,
							el(
								MenuItem,
								{
									icon: pageIcon,
									onClick: () => {
										onClose();
										deferUntilDropdownCloses( () =>
											appendBlock(
												createExistingPageNavigationLinkBlock()
											)
										);
									},
								},
								__( 'Add existing page' )
							),
							el(
								MenuItem,
								{
									icon: linkIcon,
									onClick: () => {
										onClose();
										deferUntilDropdownCloses( () =>
											appendBlock(
												createCustomNavigationLinkBlock()
											)
										);
									},
								},
								__( 'Custom link' )
							),
							el(
								MenuItem,
								{
									icon: addSubmenuIcon,
									onClick: () =>
										setIsChoosingSubmenuType( true ),
								},
								__( 'Submenu' )
							)
						),
						el(
							MenuGroup,
							null,
							el(
								MenuItem,
								{
									icon: postCategoriesIcon,
									onClick: () => {
										onAddMenuItems?.( clientId || null );
										onClose();
									},
								},
								__( 'More…' )
							)
						)
				  )
	);

	if ( ! shouldShowEmptySubmenu ) {
		return dropdown;
	}

	return el(
		'div',
		{ className: 'routes-navigation-edit-list-view__empty-submenu' },
		el( 'span', null, __( 'This submenu is empty.' ) ),
		dropdown
	);
}
