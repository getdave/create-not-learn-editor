/**
 * WordPress dependencies
 */
import { useNavigate, useParams } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { withUiTheme } from '../../theme';
import { useSiteTrail } from '../../site-trail';
import { cnlEditorStore, getErrorMessage } from '../../records';
import {
	Breadcrumbs,
	Button,
	compassIcon,
	coreDataStore,
	DropdownMenu,
	EmptyState,
	getBlockType as getRegisteredBlockType,
	InputControl,
	MenuGroup,
	MenuItem,
	Modal,
	moreVerticalIcon,
	noticesStore,
	pencilIcon,
	postCategoriesIcon,
	Page,
	Spinner,
	sprintf,
	trashIcon,
	useDispatch,
	useEffect,
	useMemo,
	useSelect,
	useState,
	__,
	registerCoreBlocks,
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
import NavigationEditCanvas from './navigation-edit-canvas';
import { EMPTY_ARRAY, getMenuTitle, NAVIGATION_POST_TYPE } from './shared';

const PAGE_QUERY = MENU_PAGES_QUERY;
let didRegisterCoreBlocks = false;

function ensureCoreBlocksRegistered() {
	if ( didRegisterCoreBlocks || typeof window === 'undefined' ) {
		return;
	}

	if ( ! getRegisteredBlockType( 'core/paragraph' ) ) {
		registerCoreBlocks();
	}

	didRegisterCoreBlocks = true;
}

ensureCoreBlocksRegistered();

function NavigationEditStage() {
	const navigate = useNavigate();
	const siteTrail = useSiteTrail();
	const params = useParams( { strict: false } );
	const navigationId = Number( params.id );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ addMode, setAddMode ] = useState( null );
	const [ isRenaming, setIsRenaming ] = useState( false );
	const [ isDeleting, setIsDeleting ] = useState( false );
	const [ insertionParentClientId, setInsertionParentClientId ] =
		useState( null );
	const [ isNavigationListViewReady, setIsNavigationListViewReady ] =
		useState( false );
	const [ listViewBlocks, setListViewBlocks ] = useState( null );
	const [ pendingInsertion, setPendingInsertion ] = useState( null );
	const [ renameTitle, setRenameTitle ] = useState( '' );
	const { deleteEntityRecord, editEntityRecord } =
		useDispatch( coreDataStore );
	const { invalidateNavigationMenus } = useDispatch( cnlEditorStore );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );
	const { isLoadingMenu, menu, pages } = useSelect(
		( select ) => {
			const store = select( coreDataStore );
			const menuArgs = [ 'postType', NAVIGATION_POST_TYPE, navigationId ];
			const pageArgs = [ 'postType', 'page', PAGE_QUERY ];
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
				pages: store.getEntityRecords( ...pageArgs ) || EMPTY_ARRAY,
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

	const editNavigationMenu = ( edits ) =>
		editEntityRecord(
			'postType',
			NAVIGATION_POST_TYPE,
			navigationId,
			edits
		);

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
				editNavigationMenu( {
					content: appendNavigationBlocksToContent( content, blocks ),
				} );
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

	const isMenuReady = ! isLoadingMenu && !! menu;
	const menuTitle = isMenuReady ? getMenuTitle( menu ) : __( 'Navigation' );
	const isEmptyManualMenu = ! isAutoMenu && manualItems.length === 0;

	const openRenameModal = () => {
		setRenameTitle( menuTitle );
		setIsRenaming( true );
	};

	const closeRenameModal = () => {
		if ( ! isSaving ) {
			setIsRenaming( false );
		}
	};

	const renameNavigationMenu = async () => {
		const trimmedTitle = renameTitle.trim();

		if ( ! trimmedTitle ) {
			return;
		}

		setIsSaving( true );

		try {
			editNavigationMenu( { title: trimmedTitle } );
			setIsRenaming( false );
			createSuccessNotice(
				__(
					'Navigation menu renamed. Review and save changes when you are ready.'
				),
				{ type: 'snackbar' }
			);
		} catch ( error ) {
			createErrorNotice(
				sprintf(
					/* translators: %s: error message. */
					__( 'Unable to rename navigation menu (%s).' ),
					getErrorMessage( error )
				),
				{ type: 'snackbar' }
			);
		} finally {
			setIsSaving( false );
		}
	};

	const closeDeleteModal = () => {
		if ( ! isSaving ) {
			setIsDeleting( false );
		}
	};

	const deleteNavigationMenu = async () => {
		setIsSaving( true );

		try {
			await deleteEntityRecord(
				'postType',
				NAVIGATION_POST_TYPE,
				navigationId,
				{ force: true },
				{ throwOnError: true }
			);
			invalidateNavigationMenus();
			createSuccessNotice( __( 'Navigation menu deleted.' ), {
				type: 'snackbar',
			} );
			navigate( { to: '/navigation' } );
		} catch ( error ) {
			createErrorNotice(
				sprintf(
					/* translators: %s: error message. */
					__( 'Unable to delete navigation menu (%s).' ),
					getErrorMessage( error )
				),
				{ type: 'snackbar' }
			);
		} finally {
			setIsSaving( false );
		}
	};

	const menuOptions = isMenuReady && (
		<DropdownMenu
			icon={ moreVerticalIcon }
			label={ __( 'Navigation menu options' ) }
			popoverProps={ { placement: 'bottom-end' } }
			toggleProps={ { variant: 'tertiary' } }
		>
			{ ( { onClose } ) => (
				<div>
					<MenuGroup>
						<MenuItem
							disabled={ ! isNavigationListViewReady }
							icon={ postCategoriesIcon }
							onClick={ () => {
								setAddMode( 'more' );
								onClose();
							} }
						>
							{ __( 'Add menu items' ) }
						</MenuItem>
						<MenuItem
							icon={ pencilIcon }
							onClick={ () => {
								openRenameModal();
								onClose();
							} }
						>
							{ __( 'Rename' ) }
						</MenuItem>
						<MenuItem
							onClick={ () =>
								navigate( {
									to: `/types/${ NAVIGATION_POST_TYPE }/edit/${ navigationId }`,
								} )
							}
						>
							{ __( 'Open block editor' ) }
						</MenuItem>
					</MenuGroup>
					<MenuGroup>
						<MenuItem
							icon={ trashIcon }
							isDestructive
							onClick={ () => {
								setIsDeleting( true );
								onClose();
							} }
						>
							{ __( 'Delete' ) }
						</MenuItem>
					</MenuGroup>
				</div>
			) }
		</DropdownMenu>
	);

	return (
		<Page
			actions={ menuOptions }
			ariaLabel={ menuTitle }
			// Opened from the Header or Footer screen, the menu leads back.
			breadcrumbs={
				siteTrail.length ? (
					<Breadcrumbs
						items={ [ ...siteTrail, { label: menuTitle } ] }
					/>
				) : undefined
			}
			className="cnl-editor-stage cnl-drilldown-stage routes-navigation-edit"
			hasPadding={ false }
			headingLevel={ 2 }
			subTitle={ __( 'Manage this navigation menu.' ) }
			title={ siteTrail.length ? undefined : menuTitle }
		>
			{ ! isMenuReady && (
				<div className="cnl-editor-spinner">
					<Spinner />
				</div>
			) }
			{ isMenuReady && (
				<div className="routes-navigation-edit__content">
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
											isSaving ||
											! isNavigationListViewReady
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
							onInsertionTargetChange={
								setInsertionParentClientId
							}
							onPendingInsertionComplete={
								completePendingInsertion
							}
							onReadyChange={ setIsNavigationListViewReady }
							pendingInsertion={ pendingInsertion }
						/>
					</div>
					{ ( addMode === 'existing-page' ||
						addMode === 'submenu-page' ) && (
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
					{ isRenaming && (
						<Modal
							className="routes-navigation-edit__item-modal"
							onRequestClose={ closeRenameModal }
							title={ __( 'Rename navigation menu' ) }
						>
							<InputControl
								disabled={ isSaving }
								label={ __( 'Name' ) }
								onValueChange={ setRenameTitle }
								value={ renameTitle }
							/>
							<div className="routes-navigation-edit__modal-actions">
								<Button
									disabled={ isSaving }
									onClick={ closeRenameModal }
									variant="tertiary"
								>
									{ __( 'Cancel' ) }
								</Button>
								<Button
									disabled={
										isSaving || ! renameTitle.trim()
									}
									isBusy={ isSaving }
									onClick={ renameNavigationMenu }
									variant="primary"
								>
									{ __( 'Save' ) }
								</Button>
							</div>
						</Modal>
					) }
					{ isDeleting && (
						<Modal
							className="routes-navigation-edit__item-modal"
							onRequestClose={ closeDeleteModal }
							title={ __( 'Delete navigation menu' ) }
						>
							<p>
								{ sprintf(
									/* translators: %s: navigation menu title. */
									__(
										'Are you sure you want to delete "%s"? This cannot be undone.'
									),
									menuTitle
								) }
							</p>
							<div className="routes-navigation-edit__modal-actions">
								<Button
									disabled={ isSaving }
									onClick={ closeDeleteModal }
									variant="tertiary"
								>
									{ __( 'Cancel' ) }
								</Button>
								<Button
									disabled={ isSaving }
									isBusy={ isSaving }
									isDestructive
									onClick={ deleteNavigationMenu }
									variant="primary"
								>
									{ __( 'Delete' ) }
								</Button>
							</div>
						</Modal>
					) }
				</div>
			) }
		</Page>
	);
}

export const stage = withUiTheme( NavigationEditStage );
export const canvas = withUiTheme( NavigationEditCanvas );
