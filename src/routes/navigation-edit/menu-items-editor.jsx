/**
 * A menu's items, edited in place: the list, and the ways to add to it.
 *
 * Shared by the Menus screen's editor and the Header and Footer screens'
 * Menu view, which each put it under their own heading.
 */

/**
 * Internal dependencies
 */
import { getEditedEntityRecords } from '../../edited-records';
import { getErrorMessage } from '../../records';
import {
	Button,
	compassIcon,
	coreDataStore,
	EmptyState,
	noticesStore,
	sprintf,
	useDispatch,
	useEffect,
	useMemo,
	useSelect,
	useState,
	__,
} from '../../wordpress-packages';
import {
	appendNavigationBlocksToContent,
	createEditorBlocksFromNavigationBlocks,
	createNavigationLinkBlock,
	createNavigationLinkBlockFromPage,
	createNavigationSubmenuBlock,
	createNavigationSubmenuBlockFromPage,
	getManualNavigationItems,
	getNavigationBlocksFromEditedRecord,
	getNavigationContentFromEditedRecord,
	isAutoMenuContent,
	serializeNavigationBlocks,
} from './navigation-blocks';
import NavigationEditListView, { MENU_PAGES_QUERY } from './list-view';
import CustomLinkModal from './custom-link-modal';
import PageSelectModal from './page-select-modal';
import LabelOnlySubmenuModal from './label-only-submenu-modal';
import AddMenuItemsModal from './add-menu-items-modal';
import { EMPTY_ARRAY, getMenuTitle, NAVIGATION_POST_TYPE } from './shared';

/**
 * A menu, and everything needed to change its items.
 *
 * @param {number} navigationId Menu ID.
 * @return {Object} `{ canAddMenuItems, editor, isMenuReady, menuTitle,
 *                  openAddMenuItems }`. `editor` is the list and its dialogs,
 *                  to render once the menu is ready.
 */
export function useMenuItemsEditor( navigationId ) {
	const [ isSaving, setIsSaving ] = useState( false );
	const [ addMode, setAddMode ] = useState( null );
	const [ insertionParentClientId, setInsertionParentClientId ] =
		useState( null );
	const [ isNavigationListViewReady, setIsNavigationListViewReady ] =
		useState( false );
	const [ listViewBlocks, setListViewBlocks ] = useState( null );
	const [ pendingInsertion, setPendingInsertion ] = useState( null );
	const { editEntityRecord } = useDispatch( coreDataStore );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );
	const { isLoadingMenu, menu, pages } = useSelect(
		( select ) => {
			const store = select( coreDataStore );
			const menuArgs = [ 'postType', NAVIGATION_POST_TYPE, navigationId ];
			const pageArgs = [ 'postType', 'page', MENU_PAGES_QUERY ];
			const rawMenu = store.getEntityRecord( ...menuArgs );

			return {
				isLoadingMenu:
					store.isResolving( 'getEntityRecord', menuArgs ) ||
					! store.hasFinishedResolution(
						'getEntityRecord',
						menuArgs
					),
				menu: rawMenu
					? store.getEditedEntityRecord( ...menuArgs )
					: rawMenu,
				pages:
					getEditedEntityRecords( store, ...pageArgs ) || EMPTY_ARRAY,
			};
		},
		[ navigationId ]
	);
	const menuBlocks = useMemo(
		() => listViewBlocks || getNavigationBlocksFromEditedRecord( menu ),
		[ listViewBlocks, menu ]
	);
	const content = useMemo(
		() =>
			listViewBlocks
				? serializeNavigationBlocks( listViewBlocks )
				: getNavigationContentFromEditedRecord( menu ),
		[ listViewBlocks, menu ]
	);
	const isAutoMenu = isAutoMenuContent( content );
	const manualItems = useMemo(
		() => getManualNavigationItems( menuBlocks ),
		[ menuBlocks ]
	);
	const isMenuReady = ! isLoadingMenu && !! menu;
	const menuTitle = isMenuReady ? getMenuTitle( menu ) : __( 'Navigation' );
	const isEmptyManualMenu = ! isAutoMenu && manualItems.length === 0;

	useEffect( () => {
		setListViewBlocks( null );
	}, [ navigationId ] );

	const completePendingInsertion = ( insertion, error ) => {
		setPendingInsertion( ( currentInsertion ) =>
			currentInsertion?.id === insertion.id ? null : currentInsertion
		);
		setIsSaving( false );

		if ( error ) {
			createErrorNotice(
				sprintf(
					/* translators: %s: error message. */
					__( 'Unable to update navigation menu (%s).' ),
					getErrorMessage( error )
				),
				{ type: 'snackbar' }
			);
			return;
		}

		setAddMode( null );
		createSuccessNotice( insertion.successMessage, {
			type: 'snackbar',
		} );
	};

	const addNavigationBlocks = async ( blocks, successMessage ) => {
		const editorBlocks = createEditorBlocksFromNavigationBlocks( blocks );
		let waitsForPendingInsertion = false;

		if ( ! editorBlocks.length ) {
			return false;
		}

		setIsSaving( true );

		try {
			if ( isEmptyManualMenu || ! isNavigationListViewReady ) {
				editEntityRecord(
					'postType',
					NAVIGATION_POST_TYPE,
					navigationId,
					{
						content: appendNavigationBlocksToContent(
							content,
							blocks
						),
					}
				);
			} else {
				waitsForPendingInsertion = true;
				setPendingInsertion( {
					blocks: editorBlocks,
					id: window.crypto?.randomUUID?.() || String( Date.now() ),
					parentClientId: insertionParentClientId,
					successMessage,
				} );
				return true;
			}
			setAddMode( null );
			createSuccessNotice( successMessage, { type: 'snackbar' } );
			return true;
		} catch ( error ) {
			createErrorNotice(
				sprintf(
					/* translators: %s: error message. */
					__( 'Unable to update navigation menu (%s).' ),
					getErrorMessage( error )
				),
				{ type: 'snackbar' }
			);
			return false;
		} finally {
			if ( ! waitsForPendingInsertion ) {
				setIsSaving( false );
			}
		}
	};

	const addPageToMenu = ( page, mode ) =>
		addNavigationBlocks(
			[
				mode === 'submenu-page'
					? createNavigationSubmenuBlockFromPage( page )
					: createNavigationLinkBlockFromPage( page ),
			],
			mode === 'submenu-page'
				? __(
						'Submenu added to menu. Review and save changes when you are ready.'
					)
				: __(
						'Page added to menu. Review and save changes when you are ready.'
					)
		);

	const addCustomLinkToMenu = ( { isSubmenu, label, url } ) =>
		addNavigationBlocks(
			[
				isSubmenu
					? createNavigationSubmenuBlock( {
							kind: 'custom',
							label,
							url,
						} )
					: createNavigationLinkBlock( {
							kind: 'custom',
							label,
							url,
						} ),
			],
			isSubmenu
				? __(
						'Submenu added to menu. Review and save changes when you are ready.'
					)
				: __(
						'Link added to menu. Review and save changes when you are ready.'
					)
		);

	const addLabelOnlySubmenuToMenu = ( label ) =>
		addNavigationBlocks(
			[
				createNavigationSubmenuBlock( {
					label,
					url: '#',
				} ),
			],
			__(
				'Submenu added to menu. Review and save changes when you are ready.'
			)
		);

	const addMenuItemsToMenu = ( blocks ) =>
		addNavigationBlocks(
			blocks,
			__(
				'Menu items added. Review and save changes when you are ready.'
			)
		);

	const openAddMenuItemsForTarget = ( parentClientId ) => {
		setInsertionParentClientId( parentClientId || null );
		setAddMode( 'more' );
	};

	const closeAddMenuItemModal = () => {
		if ( ! isSaving ) {
			setAddMode( null );
		}
	};

	const editor = (
		<>
			<div
				className={ `routes-navigation-edit__body${
					isEmptyManualMenu ? ' is-empty-manual' : ''
				}` }
			>
				{ isEmptyManualMenu && (
					<EmptyState.Root className="routes-navigation-edit__empty-summary">
						<EmptyState.Icon icon={ compassIcon } />
						<EmptyState.Title>
							{ __( 'No menu items yet' ) }
						</EmptyState.Title>
						<EmptyState.Description>
							{ __(
								'Add pages, links, or other content to start building this navigation menu.'
							) }
						</EmptyState.Description>
						<EmptyState.Actions>
							<Button
								__next40pxDefaultSize
								disabled={
									isSaving || ! isNavigationListViewReady
								}
								onClick={ () => setAddMode( 'more' ) }
								variant="primary"
							>
								{ __( 'Add menu items' ) }
							</Button>
						</EmptyState.Actions>
					</EmptyState.Root>
				) }
				<NavigationEditListView
					menuTitle={ menuTitle }
					navigationId={ navigationId }
					onAddMenuItems={ openAddMenuItemsForTarget }
					onBlocksChange={ setListViewBlocks }
					onInsertionTargetChange={ setInsertionParentClientId }
					onPendingInsertionComplete={ completePendingInsertion }
					onReadyChange={ setIsNavigationListViewReady }
					pendingInsertion={ pendingInsertion }
				/>
			</div>
			{ ( addMode === 'existing-page' || addMode === 'submenu-page' ) && (
				<PageSelectModal
					isSaving={ isSaving }
					mode={ addMode }
					onAddPage={ addPageToMenu }
					onClose={ closeAddMenuItemModal }
					pages={ pages }
					title={
						addMode === 'submenu-page'
							? __( 'Add submenu from page' )
							: __( 'Add existing page' )
					}
				/>
			) }
			{ addMode === 'custom-link' && (
				<CustomLinkModal
					isSaving={ isSaving }
					onAddLink={ addCustomLinkToMenu }
					onClose={ closeAddMenuItemModal }
					title={ __( 'Custom link' ) }
				/>
			) }
			{ addMode === 'submenu-custom' && (
				<CustomLinkModal
					isSaving={ isSaving }
					isSubmenu
					onAddLink={ addCustomLinkToMenu }
					onClose={ closeAddMenuItemModal }
					title={ __( 'Custom link submenu' ) }
				/>
			) }
			{ addMode === 'submenu-label' && (
				<LabelOnlySubmenuModal
					isSaving={ isSaving }
					onAddSubmenu={ addLabelOnlySubmenuToMenu }
					onClose={ closeAddMenuItemModal }
				/>
			) }
			{ addMode === 'more' && (
				<AddMenuItemsModal
					content={ content }
					isSaving={ isSaving }
					onAddBlocks={ addMenuItemsToMenu }
					onClose={ closeAddMenuItemModal }
					pages={ pages }
				/>
			) }
		</>
	);

	return {
		canAddMenuItems: isNavigationListViewReady && ! isSaving,
		editor,
		isMenuReady,
		menuTitle,
		openAddMenuItems: () => setAddMode( 'more' ),
	};
}
