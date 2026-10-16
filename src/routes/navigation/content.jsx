/**
 * WordPress dependencies
 */
import { useNavigate, useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { withCanvasRecovery } from '../../canvas-recovery';
import { withUiTheme } from '../../theme';
import { cnlEditorStore, getErrorMessage } from '../../records';
import {
	Button,
	coreDataStore,
	EmptyState,
	compassIcon,
	noticesStore,
	Notice,
	Page,
	Spinner,
	__,
	sprintf,
	useDispatch,
	useState,
} from '../../wordpress-packages';
import {
	EMPTY_ARRAY,
	NAVIGATION_MENUS_CHANGED_EVENT,
	NAVIGATION_POST_TYPE,
	getMenuContent,
	getMenuRowDescription,
	getMenuTitle,
	getNavigationMenuId,
	navigateToNavigationEditRoute,
} from './menu-helpers';
import { useNavigationMenus } from './use-navigation-menus';
import {
	DeleteNavigationMenuModal,
	NavigationMenuRow,
	RenameNavigationMenuModal,
} from './menu-row';
import { AddNavigationModal } from './add-navigation-modal';
import { Canvas } from './canvas';

function Stage() {
	const navigate = useNavigate();
	const searchParams = useSearch( { strict: false } );
	const { deleteEntityRecord, saveEntityRecord } =
		useDispatch( coreDataStore );
	const { invalidateNavigationMenus } = useDispatch( cnlEditorStore );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );
	const {
		error,
		isLoading,
		isResolvingLocations,
		locationsError,
		locationsMap,
		mainMenuId,
		menus,
	} = useNavigationMenus();
	const [ isAddNavigationModalOpen, setIsAddNavigationModalOpen ] =
		useState( false );
	const [ menuToRename, setMenuToRename ] = useState( null );
	const [ menuToDelete, setMenuToDelete ] = useState( null );
	const [ rowActionMenuTitle, setRowActionMenuTitle ] = useState( '' );
	const [ isRowActionSaving, setIsRowActionSaving ] = useState( false );
	const refreshNavigationMenus = () => {
		invalidateNavigationMenus();
		window.dispatchEvent(
			new CustomEvent( NAVIGATION_MENUS_CHANGED_EVENT )
		);
	};
	const closeRenameModal = () => {
		if ( ! isRowActionSaving ) {
			setMenuToRename( null );
		}
	};
	const closeDeleteModal = () => {
		if ( ! isRowActionSaving ) {
			setMenuToDelete( null );
		}
	};
	const openRenameModal = ( menu ) => {
		setRowActionMenuTitle( getMenuTitle( menu ) );
		setMenuToRename( menu );
	};
	const openDeleteModal = ( menu ) => {
		setMenuToDelete( menu );
	};
	const renameNavigationMenu = async () => {
		const menuId = getNavigationMenuId( menuToRename );
		const title = rowActionMenuTitle.trim();

		if ( ! menuId || ! title ) {
			return;
		}

		setIsRowActionSaving( true );

		try {
			await saveEntityRecord(
				'postType',
				NAVIGATION_POST_TYPE,
				{
					id: menuId,
					title,
				},
				{ throwOnError: true }
			);
			refreshNavigationMenus();
			setMenuToRename( null );
			createSuccessNotice( __( 'Navigation menu renamed.' ), {
				type: 'snackbar',
			} );
		} catch ( renameError ) {
			createErrorNotice(
				sprintf(
					/* translators: %s: error message. */
					__( 'Unable to rename navigation menu (%s).' ),
					getErrorMessage( renameError )
				),
				{ type: 'snackbar' }
			);
		} finally {
			setIsRowActionSaving( false );
		}
	};
	const duplicateNavigationMenu = async ( menu ) => {
		const menuTitle = getMenuTitle( menu );

		setIsRowActionSaving( true );

		try {
			const savedRecord = await saveEntityRecord(
				'postType',
				NAVIGATION_POST_TYPE,
				{
					content: getMenuContent( menu ),
					status: 'publish',
					title: sprintf(
						/* translators: %s: navigation menu title. */
						__( '%s (Copy)' ),
						menuTitle
					),
				},
				{ throwOnError: true }
			);

			refreshNavigationMenus();
			createSuccessNotice( __( 'Navigation menu duplicated.' ), {
				type: 'snackbar',
			} );

			if ( savedRecord?.id ) {
				navigateToNavigationEditRoute( navigate, savedRecord );
			}
		} catch ( duplicateError ) {
			createErrorNotice(
				sprintf(
					/* translators: %s: error message. */
					__( 'Unable to duplicate navigation menu (%s).' ),
					getErrorMessage( duplicateError )
				),
				{ type: 'snackbar' }
			);
		} finally {
			setIsRowActionSaving( false );
		}
	};
	const deleteNavigationMenu = async () => {
		const menuId = getNavigationMenuId( menuToDelete );

		if ( ! menuId ) {
			return;
		}

		setIsRowActionSaving( true );

		try {
			await deleteEntityRecord(
				'postType',
				NAVIGATION_POST_TYPE,
				menuId,
				{ force: true },
				{ throwOnError: true }
			);
			refreshNavigationMenus();
			setMenuToDelete( null );
			createSuccessNotice( __( 'Navigation menu deleted.' ), {
				type: 'snackbar',
			} );

			if ( getNavigationMenuId( searchParams.menuId ) === menuId ) {
				navigate( {
					search: {
						...searchParams,
						menuId: undefined,
					},
					to: '/navigation',
				} );
			}
		} catch ( deleteError ) {
			createErrorNotice(
				sprintf(
					/* translators: %s: error message. */
					__( 'Unable to delete navigation menu (%s).' ),
					getErrorMessage( deleteError )
				),
				{ type: 'snackbar' }
			);
		} finally {
			setIsRowActionSaving( false );
		}
	};
	// The main menu is looked after alongside the pages it links to.
	const editNavigationMenu = ( menu ) =>
		getNavigationMenuId( menu ) === mainMenuId
			? navigate( { to: '/types/page/list/all' } )
			: navigateToNavigationEditRoute( navigate, menu );
	const navigationEmpty = (
		<div className="cnl-editor-empty-state">
			<EmptyState.Root>
				<EmptyState.Icon icon={ compassIcon } />
				<EmptyState.Title>{ __( 'No menus yet' ) }</EmptyState.Title>
				<EmptyState.Description>
					{ __(
						'Create your first menu to start adding links to your site navigation.'
					) }
				</EmptyState.Description>
				<EmptyState.Actions>
					<Button
						__next40pxDefaultSize
						onClick={ () => setIsAddNavigationModalOpen( true ) }
						variant="primary"
					>
						{ __( 'Add your first menu' ) }
					</Button>
				</EmptyState.Actions>
			</EmptyState.Root>
		</div>
	);
	return [
		<Page
			actions={
				<Button
					onClick={ () => setIsAddNavigationModalOpen( true ) }
					size="compact"
					variant="primary"
				>
					{ __( 'Add menu' ) }
				</Button>
			}
			className="cnl-editor-stage routes-navigation-list"
			hasPadding={ false }
			headingLevel={ 2 }
			key="navigation-page"
			subTitle={ __(
				'The links visitors use to get around your site. Your main menu, the one in your header, is looked after on the Pages screen.'
			) }
			title={ __( 'Menus' ) }
		>
			{ ( error || locationsError ) && (
				<Notice
					className="cnl-editor-panel__notice"
					isDismissible={ false }
					status="error"
				>
					{ error || locationsError }
				</Notice>
			) }
			{ isLoading && (
				<div className="cnl-editor-spinner">
					<Spinner />
				</div>
			) }
			{ ! isLoading && ! menus.length && navigationEmpty }
			{ ! isLoading && !! menus.length && (
				<div className="routes-navigation-list__rows">
					{ menus.map( ( menu ) => (
						<NavigationMenuRow
							description={ getMenuRowDescription(
								menu,
								locationsMap[ getNavigationMenuId( menu ) ] ||
									EMPTY_ARRAY,
								isResolvingLocations
							) }
							isBusy={ isRowActionSaving }
							key={ getNavigationMenuId( menu ) }
							menu={ menu }
							onDelete={ openDeleteModal }
							onDuplicate={ duplicateNavigationMenu }
							onEdit={ editNavigationMenu }
							onRename={ openRenameModal }
						/>
					) ) }
				</div>
			) }
		</Page>,
		isAddNavigationModalOpen && (
			<AddNavigationModal
				key="add-navigation-modal"
				onClose={ () => setIsAddNavigationModalOpen( false ) }
			/>
		),
		menuToRename && (
			<RenameNavigationMenuModal
				isSaving={ isRowActionSaving }
				key="rename-navigation-menu-modal"
				menuTitle={ getMenuTitle( menuToRename ) }
				onChangeTitle={ setRowActionMenuTitle }
				onClose={ closeRenameModal }
				onSave={ renameNavigationMenu }
				title={ rowActionMenuTitle }
			/>
		),
		menuToDelete && (
			<DeleteNavigationMenuModal
				isSaving={ isRowActionSaving }
				key="delete-navigation-menu-modal"
				menuTitle={ getMenuTitle( menuToDelete ) }
				onClose={ closeDeleteModal }
				onDelete={ deleteNavigationMenu }
			/>
		),
	];
}

export const stage = withUiTheme( Stage );
export const canvas = withCanvasRecovery( withUiTheme( Canvas ) );
