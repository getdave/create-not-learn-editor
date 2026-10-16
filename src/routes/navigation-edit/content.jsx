/**
 * WordPress dependencies
 */
import { useNavigate, useParams } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { withCanvasRecovery } from '../../canvas-recovery';
import { withUiTheme } from '../../theme';
import { useSiteTrail } from '../../site-trail';
import { cnlEditorStore, getErrorMessage } from '../../records';
import {
	Breadcrumbs,
	Button,
	coreDataStore,
	DropdownMenu,
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
	useState,
	__,
	registerCoreBlocks,
} from '../../wordpress-packages';
import { useMenuItemsEditor } from './menu-items-editor';
import NavigationEditCanvas from './navigation-edit-canvas';
import { NAVIGATION_POST_TYPE } from './shared';

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
	const [ isRenaming, setIsRenaming ] = useState( false );
	const [ isDeleting, setIsDeleting ] = useState( false );
	const [ renameTitle, setRenameTitle ] = useState( '' );
	const { deleteEntityRecord, editEntityRecord } =
		useDispatch( coreDataStore );
	const { invalidateNavigationMenus } = useDispatch( cnlEditorStore );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );
	const {
		canAddMenuItems,
		editor,
		isMenuReady,
		menuTitle,
		openAddMenuItems,
	} = useMenuItemsEditor( navigationId );

	const editNavigationMenu = ( edits ) =>
		editEntityRecord(
			'postType',
			NAVIGATION_POST_TYPE,
			navigationId,
			edits
		);

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
							disabled={ ! canAddMenuItems }
							icon={ postCategoriesIcon }
							onClick={ () => {
								openAddMenuItems();
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
			// Opened from the Menus screen, the menu leads back.
			breadcrumbs={
				siteTrail.length ? (
					<Breadcrumbs
						items={ [ ...siteTrail, { label: menuTitle } ] }
					/>
				) : undefined
			}
			className="cnl-editor-stage routes-navigation-edit"
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
					{ editor }
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
export const canvas = withCanvasRecovery( withUiTheme( NavigationEditCanvas ) );
