/**
 * WordPress dependencies
 */
import { useNavigate, useSearch } from '@wordpress/route';
import { Preview as LazyEditorPreview } from '@wordpress/lazy-editor';

/**
 * Internal dependencies
 */
import { withUiTheme } from '../../theme';
import { getFromNavigationSearch } from '../../site-trail';
import {
	cnlEditorStore,
	getErrorMessage,
	getNavigationMenuItemCount,
	getTitleText,
} from '../../records';
import {
	Button,
	CheckboxControl,
	chevronRightIcon,
	coreDataStore,
	DropdownMenu,
	EmptyState,
	Fragment,
	Icon,
	InputControl,
	layoutIcon,
	MenuItem,
	Modal,
	moreVerticalIcon,
	compassIcon,
	noticesStore,
	Notice,
	Page,
	Spinner,
	Stack,
	__,
	_n,
	el,
	sprintf,
	useDispatch,
	useEffect,
	useMemo,
	useSelect,
	useState,
} from '../../wordpress-packages';
import {
	assignNavigationMenuToFirstBlock,
	buildNavigationLocationsMap,
	compareTemplatePartsByArea,
	createEditedTemplatePartsCache,
	getLocationAreaLabel,
	getLocationLabel,
	getLocationsSummary,
	getMainMenu,
	getTemplatePartRawContent,
	removeNavigationMenuFromFirstBlock,
	templatePartHasNavigationBlock,
} from './navigation-locations';
import SitePreviewCanvas from '../static/site-preview';
import {
	NavigationSitePreview,
	NavigationSitePreviewNotice,
} from './site-preview';

const NAVIGATION_MENUS_CHANGED_EVENT = 'cnl-editor-navigation-menus-changed';
const NAVIGATION_POST_TYPE = 'wp_navigation';
const EMPTY_ARRAY = [];
const PAGE_LIST_BLOCK_CONTENT = '<!-- wp:page-list /-->';
const TEMPLATE_PARTS_QUERY = {
	context: 'edit',
	per_page: 100,
	_fields: 'id,slug,title,area,status,content',
};

function getMenuTitle( menu ) {
	return getTitleText( menu?.title ) || __( 'Untitled menu' );
}

function getMenuContent( menu ) {
	if ( typeof menu?.content === 'string' ) {
		return menu.content;
	}

	return menu?.content?.raw || '';
}

function getNavigationMenuId( menuOrId ) {
	const rawId =
		typeof menuOrId === 'object' && menuOrId !== null
			? menuOrId.id
			: menuOrId;

	if ( rawId === undefined || rawId === null || rawId === '' ) {
		return undefined;
	}

	if ( typeof rawId === 'string' ) {
		try {
			const parsedId = JSON.parse( rawId );

			if (
				typeof parsedId === 'string' ||
				typeof parsedId === 'number'
			) {
				return String( parsedId );
			}
		} catch {
			return rawId;
		}
	}

	return String( rawId );
}

function getMenuLocationsDescription( count ) {
	return count
		? sprintf(
				/* translators: %d: Number of locations where this navigation menu is shown. */
				_n(
					'This menu is shown in %d location on your site.',
					'This menu is shown in %d locations on your site.',
					count
				),
				count
			)
		: __(
				'Choose where this menu should appear, such as your header or footer.'
			);
}

function navigateToNavigationEditRoute( navigate, menuOrId ) {
	const menuId = getNavigationMenuId( menuOrId );

	if ( ! menuId ) {
		return;
	}

	const route = `/navigation/edit/${ encodeURIComponent( menuId ) }`;
	// So the edit screen's breadcrumb can lead back to the Menus list.
	const search = getFromNavigationSearch();

	navigate( { search, to: route } );
	window.setTimeout( () => {
		const currentUrl = new URL( window.location.href );
		const currentRoute = currentUrl.searchParams.get( 'p' ) || '';

		if ( currentRoute.startsWith( route ) ) {
			return;
		}

		const routeSearch = new URLSearchParams( search ).toString();
		currentUrl.searchParams.set(
			'p',
			routeSearch ? `${ route }?${ routeSearch }` : route
		);
		window.location.assign( currentUrl.toString() );
	}, 100 );
}

function NavigationLocationsUnavailableEmptyState() {
	return el(
		EmptyState.Root,
		{ className: 'routes-navigation-choose-location-modal__empty-state' },
		el( EmptyState.Icon, { icon: layoutIcon } ),
		el( EmptyState.Title, null, __( 'No menu locations found' ) ),
		el(
			EmptyState.Description,
			null,
			__(
				'Add a menu space to a header, footer, or other site area before choosing a location here.'
			)
		)
	);
}

function getMenuRowDescription( menu, locations, isResolvingLocations ) {
	const itemCount = getNavigationMenuItemCount( menu );
	const itemsText = sprintf(
		/* translators: %d: Number of navigation blocks in the menu. */
		_n( '%d item', '%d items', itemCount ),
		itemCount
	);
	const usageText = isResolvingLocations
		? __( 'Checking usage…' )
		: getLocationsSummary( locations );

	return sprintf(
		/* translators: 1: Item count, e.g. "3 items". 2: Where the menu is shown, e.g. "2 locations". */
		__( '%1$s · %2$s' ),
		itemsText,
		usageText
	);
}

function NavigationMenuRow( {
	description,
	isBusy,
	menu,
	onDelete,
	onDuplicate,
	onEdit,
	onRename,
} ) {
	const title = getMenuTitle( menu );

	return el(
		'div',
		{ className: 'routes-navigation-list__row' },
		el(
			Button,
			{
				className:
					'routes-navigation-list__row-link cnl-screen-links__link',
				onClick: () => onEdit( menu ),
			},
			el( Icon, {
				className: 'cnl-screen-links__icon',
				icon: compassIcon,
			} ),
			el(
				'span',
				{ className: 'cnl-screen-links__text' },
				el( 'span', { className: 'cnl-screen-links__title' }, title ),
				el(
					'span',
					{ className: 'cnl-screen-links__description' },
					description
				)
			),
			el( Icon, {
				className: 'cnl-screen-links__chevron',
				icon: chevronRightIcon,
			} )
		),
		el(
			DropdownMenu,
			{
				className: 'routes-navigation-list__row-menu',
				disabled: isBusy,
				icon: moreVerticalIcon,
				label: sprintf(
					/* translators: %s: navigation menu title. */
					__( '%s options' ),
					title
				),
				popoverProps: { placement: 'bottom-end' },
				toggleProps: {
					__next40pxDefaultSize: true,
					variant: 'tertiary',
				},
			},
			( { onClose } ) =>
				el(
					Fragment,
					null,
					el(
						MenuItem,
						{
							onClick: () => {
								onRename( menu );
								onClose();
							},
						},
						__( 'Rename' )
					),
					el(
						MenuItem,
						{
							onClick: () => {
								onDuplicate( menu );
								onClose();
							},
						},
						__( 'Duplicate' )
					),
					el(
						MenuItem,
						{
							isDestructive: true,
							onClick: () => {
								onDelete( menu );
								onClose();
							},
						},
						__( 'Delete' )
					)
				)
		)
	);
}

function RenameNavigationMenuModal( {
	isSaving,
	menuTitle,
	onChangeTitle,
	onClose,
	onSave,
	title,
} ) {
	return el(
		Modal,
		{
			className: 'routes-navigation-edit__item-modal',
			onRequestClose: onClose,
			title: __( 'Rename navigation menu' ),
		},
		el( InputControl, {
			disabled: isSaving,
			label: __( 'Name' ),
			onValueChange: onChangeTitle,
			value: title,
		} ),
		el(
			'div',
			{ className: 'routes-navigation-edit__modal-actions' },
			el(
				Button,
				{
					disabled: isSaving,
					onClick: onClose,
					variant: 'tertiary',
				},
				__( 'Cancel' )
			),
			el(
				Button,
				{
					disabled:
						isSaving ||
						! title.trim() ||
						title.trim() === menuTitle,
					isBusy: isSaving,
					onClick: onSave,
					variant: 'primary',
				},
				__( 'Save' )
			)
		)
	);
}

function DeleteNavigationMenuModal( {
	isSaving,
	menuTitle,
	onClose,
	onDelete,
} ) {
	return el(
		Modal,
		{
			className: 'routes-navigation-edit__item-modal',
			onRequestClose: onClose,
			title: __( 'Delete navigation menu' ),
		},
		el(
			'p',
			null,
			sprintf(
				/* translators: %s: navigation menu title. */
				__(
					'Are you sure you want to delete "%s"? This cannot be undone.'
				),
				menuTitle
			)
		),
		el(
			'div',
			{ className: 'routes-navigation-edit__modal-actions' },
			el(
				Button,
				{
					disabled: isSaving,
					onClick: onClose,
					variant: 'tertiary',
				},
				__( 'Cancel' )
			),
			el(
				Button,
				{
					disabled: isSaving,
					isBusy: isSaving,
					isDestructive: true,
					onClick: onDelete,
					variant: 'primary',
				},
				__( 'Delete' )
			)
		)
	);
}

function useNavigationLocations( menus ) {
	const fallbackMenuId = menus[ 0 ]?.id;
	const mergeEdits = useMemo( () => createEditedTemplatePartsCache(), [] );
	const { error, isResolving, templateParts } = useSelect(
		( select ) => {
			const store = select( coreDataStore );
			const args = [
				'postType',
				'wp_template_part',
				TEMPLATE_PARTS_QUERY,
			];
			const rawTemplateParts =
				store.getEntityRecords( ...args ) || EMPTY_ARRAY;

			return {
				error: store.getResolutionError?.( 'getEntityRecords', args ),
				isResolving:
					store.isResolving( 'getEntityRecords', args ) ||
					! store.hasFinishedResolution( 'getEntityRecords', args ),
				templateParts: mergeEdits( rawTemplateParts, ( id ) =>
					store.getEditedEntityRecord(
						'postType',
						'wp_template_part',
						id
					)
				),
			};
		},
		[ mergeEdits ]
	);
	const locationsMap = useMemo(
		() => buildNavigationLocationsMap( templateParts, fallbackMenuId ),
		[ fallbackMenuId, templateParts ]
	);

	return {
		isResolvingLocations: isResolving,
		locationsError: error ? getErrorMessage( error ) : null,
		locationsMap,
		templateParts,
	};
}

function useNavigationMenus() {
	const searchParams = useSearch( { strict: false } );
	const { invalidateNavigationMenus } = useDispatch( cnlEditorStore );
	const { error, isLoading, menus } = useSelect( ( select ) => {
		const store = select( cnlEditorStore );

		return {
			error: store.getNavigationMenusError(),
			isLoading:
				store.isFetchingNavigationMenus() ||
				! store.hasFinishedResolution( 'getNavigationMenus', [] ),
			menus: store.getNavigationMenus() || [],
		};
	}, [] );
	const {
		isResolvingLocations,
		locationsError,
		locationsMap,
		templateParts,
	} = useNavigationLocations( menus );

	useEffect( () => {
		const refreshMenus = () => invalidateNavigationMenus();

		window.addEventListener( NAVIGATION_MENUS_CHANGED_EVENT, refreshMenus );

		return () => {
			window.removeEventListener(
				NAVIGATION_MENUS_CHANGED_EVENT,
				refreshMenus
			);
		};
	}, [ invalidateNavigationMenus ] );

	const selectedId = getNavigationMenuId(
		searchParams.menuId || searchParams.menuIds?.[ 0 ] || menus[ 0 ]?.id
	);
	const selectedMenu = useMemo(
		() =>
			menus.find(
				( menu ) => getNavigationMenuId( menu ) === selectedId
			),
		[ menus, selectedId ]
	);

	return {
		error: error ? getErrorMessage( error ) : null,
		isLoading,
		isResolvingLocations,
		locationsError,
		mainMenuId: getMainMenu( menus, templateParts )?.id,
		locationsMap,
		menus,
		selectedId,
		selectedMenu,
		templateParts,
	};
}

function AddNavigationModal( { onClose } ) {
	const navigate = useNavigate();
	const [ autoSyncWithPages, setAutoSyncWithPages ] = useState( false );
	const [ isBusy, setIsBusy ] = useState( false );
	const [ menuTitle, setMenuTitle ] = useState( '' );
	const { saveEntityRecord } = useDispatch( coreDataStore );
	const { invalidateNavigationMenus } = useDispatch( cnlEditorStore );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );

	const closeModal = () => {
		if ( ! isBusy ) {
			onClose();
		}
	};

	const submit = async ( event ) => {
		event.preventDefault();

		const trimmedTitle = menuTitle.trim();
		if ( ! trimmedTitle ) {
			return;
		}

		setIsBusy( true );

		try {
			const savedRecord = await saveEntityRecord(
				'postType',
				NAVIGATION_POST_TYPE,
				{
					...( autoSyncWithPages
						? { content: PAGE_LIST_BLOCK_CONTENT }
						: {} ),
					status: 'publish',
					title: trimmedTitle,
				},
				{ throwOnError: true }
			);

			invalidateNavigationMenus();
			window.dispatchEvent(
				new CustomEvent( NAVIGATION_MENUS_CHANGED_EVENT )
			);
			createSuccessNotice(
				__( 'Navigation menu created successfully.' ),
				{
					type: 'snackbar',
				}
			);

			if ( savedRecord?.id ) {
				navigate( {
					search: getFromNavigationSearch(),
					to: `/navigation/edit/${ encodeURIComponent(
						savedRecord.id
					) }`,
				} );
			}

			onClose();
		} catch ( error ) {
			createErrorNotice(
				sprintf(
					/* translators: %s: error message. */
					__( 'Unable to create navigation menu: %s' ),
					getErrorMessage( error )
				),
				{ type: 'snackbar' }
			);
		} finally {
			setIsBusy( false );
		}
	};

	return el(
		Modal,
		{
			focusOnMount: 'firstContentElement',
			onRequestClose: closeModal,
			size: 'small',
			title: __( 'Add a menu' ),
		},
		el(
			'form',
			{
				onSubmit: submit,
			},
			el(
				Stack,
				{ direction: 'column', gap: 'lg' },
				el( InputControl, {
					autoComplete: 'off',
					disabled: isBusy,
					label: __( 'Name' ),
					onValueChange: setMenuTitle,
					placeholder: __( 'Enter menu name' ),
					value: menuTitle,
				} ),
				el( CheckboxControl, {
					'aria-label': __( 'List every page automatically' ),
					checked: autoSyncWithPages,
					disabled: isBusy,
					help: __(
						'This menu will update automatically when you add, rename, or remove pages, until you choose to customize it manually.'
					),
					label: __( 'List every page automatically' ),
					onChange: setAutoSyncWithPages,
				} ),
				el(
					Stack,
					{ align: 'center', gap: 'sm', justify: 'flex-end' },
					el(
						Button,
						{
							__next40pxDefaultSize: true,
							accessibleWhenDisabled: true,
							disabled: isBusy,
							onClick: closeModal,
							type: 'button',
							variant: 'tertiary',
						},
						__( 'Cancel' )
					),
					el(
						Button,
						{
							__next40pxDefaultSize: true,
							accessibleWhenDisabled: true,
							'aria-busy': isBusy,
							disabled: isBusy || ! menuTitle.trim(),
							type: 'submit',
							variant: 'primary',
						},
						__( 'Create Menu' )
					)
				)
			)
		)
	);
}

function getLocationCandidates( templateParts ) {
	return ( templateParts || EMPTY_ARRAY )
		.filter( ( part ) => templatePartHasNavigationBlock( part ) )
		.sort( compareTemplatePartsByArea )
		.map( ( part ) => ( {
			areaLabel: getLocationAreaLabel( part ),
			id: String( part.id ),
			label: getLocationLabel( part ),
			part,
		} ) );
}

function getLocationSelectionSummary( count, mode ) {
	if ( count > 0 ) {
		return sprintf(
			/* translators: %d: Number of selected locations. */
			_n( '%d location selected', '%d locations selected', count ),
			count
		);
	}

	if ( mode === 'update' ) {
		return __( 'No locations selected.' );
	}

	return __( 'Select one or more locations for this menu.' );
}

function getLocationActionLabel( count, mode ) {
	if ( mode === 'update' ) {
		return __( 'Update locations' );
	}

	if ( count === 1 ) {
		return __( 'Add to location' );
	}

	return sprintf(
		/* translators: %d: Number of selected locations. */
		__( 'Add to %d locations' ),
		count
	);
}

function ChooseLocationModal( {
	initialSelectedLocationIds = EMPTY_ARRAY,
	isSaving,
	mode,
	onApply,
	onClose,
	templateParts,
} ) {
	const candidates = useMemo(
		() => getLocationCandidates( templateParts ),
		[ templateParts ]
	);
	const [ selectedIds, setSelectedIds ] = useState(
		initialSelectedLocationIds
	);
	const [ error, setError ] = useState( '' );

	const toggleLocation = ( id, isChecked ) => {
		setError( '' );
		setSelectedIds( ( currentIds ) =>
			isChecked
				? [ ...new Set( [ ...currentIds, id ] ) ]
				: currentIds.filter( ( currentId ) => currentId !== id )
		);
	};

	const selectedCandidates = candidates.filter( ( candidate ) =>
		selectedIds.includes( candidate.id )
	);
	const applyLocations = () => {
		if ( mode === 'choose' && selectedCandidates.length === 0 ) {
			setError(
				__( 'Select at least one location before applying this menu.' )
			);
			return;
		}

		onApply( selectedCandidates, candidates );
	};

	return el(
		Modal,
		{
			className: 'routes-navigation-choose-location-modal',
			onRequestClose: onClose,
			title:
				mode === 'update'
					? __( 'Update locations' )
					: __( 'Choose location' ),
		},
		el(
			'p',
			{ className: 'routes-navigation-choose-location-modal__intro' },
			__(
				'Choose where this navigation menu should be shown on your site.'
			)
		),
		!! error &&
			el(
				'div',
				{ className: 'routes-navigation-edit__notice is-error' },
				error
			),
		candidates.length === 0 &&
			el( NavigationLocationsUnavailableEmptyState ),
		candidates.length > 0 &&
			el(
				'div',
				{ className: 'routes-navigation-choose-location-modal__grid' },
				candidates.map( ( candidate ) =>
					el(
						'section',
						{
							className:
								'routes-navigation-choose-location-modal__card',
							key: candidate.id,
						},
						el(
							'div',
							{
								className:
									'routes-navigation-choose-location-modal__card-header',
							},
							el( CheckboxControl, {
								__nextHasNoMarginBottom: true,
								checked: selectedIds.includes( candidate.id ),
								label: candidate.label,
								onChange: ( isChecked ) =>
									toggleLocation( candidate.id, isChecked ),
							} ),
							el(
								'span',
								{
									className:
										'routes-navigation-choose-location-modal__area',
								},
								candidate.areaLabel
							)
						),
						el(
							'div',
							{
								className:
									'routes-navigation-choose-location-modal__preview',
							},
							el( LazyEditorPreview, {
								content: getTemplatePartRawContent(
									candidate.part
								),
								description: candidate.label,
							} )
						)
					)
				)
			),
		candidates.length > 0 &&
			el(
				'div',
				{
					className:
						'routes-navigation-choose-location-modal__footer',
				},
				el(
					'p',
					{
						className:
							'routes-navigation-choose-location-modal__selection-summary',
					},
					getLocationSelectionSummary(
						selectedCandidates.length,
						mode
					)
				),
				el(
					'div',
					{
						className:
							'routes-navigation-choose-location-modal__actions',
					},
					el(
						Button,
						{
							disabled: isSaving,
							onClick: onClose,
							variant: 'tertiary',
						},
						__( 'Cancel' )
					),
					el(
						Button,
						{
							disabled:
								isSaving ||
								( mode === 'choose' &&
									selectedCandidates.length === 0 ),
							isBusy: isSaving,
							onClick: applyLocations,
							variant: 'primary',
						},
						getLocationActionLabel(
							selectedCandidates.length,
							mode
						)
					)
				)
			)
	);
}

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
	const navigationEmpty = el(
		'div',
		{ className: 'cnl-editor-empty-state' },
		el(
			EmptyState.Root,
			null,
			el( EmptyState.Icon, { icon: compassIcon } ),
			el( EmptyState.Title, null, __( 'No menus yet' ) ),
			el(
				EmptyState.Description,
				null,
				__(
					'Create your first menu to start adding links to your site navigation.'
				)
			),
			el(
				EmptyState.Actions,
				null,
				el(
					Button,
					{
						__next40pxDefaultSize: true,
						onClick: () => setIsAddNavigationModalOpen( true ),
						variant: 'primary',
					},
					__( 'Add your first menu' )
				)
			)
		)
	);
	return [
		el(
			Page,
			{
				actions: el(
					Button,
					{
						onClick: () => setIsAddNavigationModalOpen( true ),
						size: 'compact',
						variant: 'primary',
					},
					__( 'Add menu' )
				),
				className: 'cnl-editor-stage routes-navigation-list',
				hasPadding: false,
				headingLevel: 2,
				key: 'navigation-page',
				subTitle: __(
					'The links visitors use to get around your site. Your main menu, the one in your header, is looked after on the Pages screen.'
				),
				title: __( 'Menus' ),
			},
			( error || locationsError ) &&
				el(
					Notice,
					{
						className: 'cnl-editor-panel__notice',
						isDismissible: false,
						status: 'error',
					},
					error || locationsError
				),
			isLoading &&
				el( 'div', { className: 'cnl-editor-spinner' }, el( Spinner ) ),
			! isLoading && ! menus.length && navigationEmpty,
			! isLoading &&
				!! menus.length &&
				el(
					'div',
					{ className: 'routes-navigation-list__rows' },
					menus.map( ( menu ) =>
						el( NavigationMenuRow, {
							description: getMenuRowDescription(
								menu,
								locationsMap[ getNavigationMenuId( menu ) ] ||
									EMPTY_ARRAY,
								isResolvingLocations
							),
							isBusy: isRowActionSaving,
							key: getNavigationMenuId( menu ),
							menu,
							onDelete: openDeleteModal,
							onDuplicate: duplicateNavigationMenu,
							onEdit: editNavigationMenu,
							onRename: openRenameModal,
						} )
					)
				)
		),
		isAddNavigationModalOpen &&
			el( AddNavigationModal, {
				key: 'add-navigation-modal',
				onClose: () => setIsAddNavigationModalOpen( false ),
			} ),
		menuToRename &&
			el( RenameNavigationMenuModal, {
				isSaving: isRowActionSaving,
				key: 'rename-navigation-menu-modal',
				menuTitle: getMenuTitle( menuToRename ),
				onChangeTitle: setRowActionMenuTitle,
				onClose: closeRenameModal,
				onSave: renameNavigationMenu,
				title: rowActionMenuTitle,
			} ),
		menuToDelete &&
			el( DeleteNavigationMenuModal, {
				isSaving: isRowActionSaving,
				key: 'delete-navigation-menu-modal',
				menuTitle: getMenuTitle( menuToDelete ),
				onClose: closeDeleteModal,
				onDelete: deleteNavigationMenu,
			} ),
	];
}

function Canvas() {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );
	const {
		error,
		isLoading,
		isResolvingLocations,
		locationsError,
		locationsMap,
		selectedMenu,
		templateParts,
	} = useNavigationMenus();
	const [ locationModalMode, setLocationModalMode ] = useState( null );
	const [ isSavingLocations, setIsSavingLocations ] = useState( false );
	const [ isAddNavigationModalOpen, setIsAddNavigationModalOpen ] =
		useState( false );

	if ( isLoading ) {
		return el(
			'section',
			{ className: 'cnl-editor-canvas' },
			el( 'div', { className: 'cnl-editor-spinner' }, el( Spinner ) )
		);
	}

	// Nothing to edit yet, so show the homepage in the standard site canvas,
	// the same fallback Design and its screens use.
	if ( ! selectedMenu ) {
		return el( SitePreviewCanvas );
	}

	const selectedLocations = selectedMenu
		? locationsMap[ selectedMenu.id ] || EMPTY_ARRAY
		: EMPTY_ARRAY;
	const selectedLocationIds = selectedLocations.map(
		( location ) => location.id
	);
	const editTemplatePartContent = ( part, content ) =>
		editEntityRecord( 'postType', 'wp_template_part', part.id, {
			content,
		} );
	const applyLocationAssignments = async (
		selectedCandidates,
		candidates
	) => {
		if ( ! selectedMenu?.id ) {
			return;
		}

		setIsSavingLocations( true );

		try {
			const selectedIds = new Set(
				selectedCandidates.map( ( candidate ) => candidate.id )
			);
			const currentIds = new Set( selectedLocationIds );

			for ( const candidate of selectedCandidates ) {
				const content = assignNavigationMenuToFirstBlock(
					candidate.part,
					selectedMenu.id
				);

				if ( ! content ) {
					throw new Error(
						sprintf(
							/* translators: %s: location label. */
							__( 'Could not update %s.' ),
							candidate.label
						)
					);
				}

				editTemplatePartContent( candidate.part, content );
			}

			if ( locationModalMode === 'update' ) {
				for ( const candidate of candidates ) {
					if (
						! currentIds.has( candidate.id ) ||
						selectedIds.has( candidate.id )
					) {
						continue;
					}

					const content = removeNavigationMenuFromFirstBlock(
						candidate.part,
						selectedMenu.id
					);

					if ( ! content ) {
						throw new Error(
							sprintf(
								/* translators: %s: location label. */
								__( 'Could not update %s.' ),
								candidate.label
							)
						);
					}

					editTemplatePartContent( candidate.part, content );
				}
			}

			setLocationModalMode( null );
			createSuccessNotice(
				__(
					'Menu locations updated. Review and save changes when you are ready.'
				),
				{ type: 'snackbar' }
			);
		} catch ( saveError ) {
			createErrorNotice(
				sprintf(
					/* translators: %s: error message. */
					__( 'Unable to update menu locations (%s).' ),
					getErrorMessage( saveError )
				),
				{ type: 'snackbar' }
			);
		} finally {
			setIsSavingLocations( false );
		}
	};
	const selectedMenuTitle = selectedMenu ? getMenuTitle( selectedMenu ) : '';
	const selectedMenuActions =
		selectedMenu &&
		el(
			DropdownMenu,
			{
				icon: moreVerticalIcon,
				label: __( 'Menu location options' ),
				popoverProps: { placement: 'bottom-end' },
				toggleProps: {
					__next40pxDefaultSize: true,
					variant: 'tertiary',
				},
			},
			( { onClose } ) =>
				el(
					MenuItem,
					{
						onClick: () => {
							setLocationModalMode(
								selectedLocations.length > 0
									? 'update'
									: 'choose'
							);
							onClose();
						},
					},
					selectedLocations.length > 0
						? __( 'Update locations' )
						: __( 'Choose location' )
				)
		);

	return el(
		'section',
		{
			className: 'cnl-editor-canvas routes-navigation-canvas',
		},
		( error || locationsError ) &&
			el(
				Notice,
				{
					className: 'cnl-editor-preview-canvas__notice',
					isDismissible: false,
					status: 'error',
				},
				error || locationsError
			),
		selectedMenu &&
			el(
				'header',
				{
					className:
						'cnl-editor-canvas__toolbar routes-navigation-canvas-toolbar',
				},
				el(
					'div',
					{
						className: 'routes-navigation-canvas-toolbar__document',
					},
					el(
						'h2',
						{
							className:
								'routes-navigation-canvas-toolbar__title',
						},
						selectedMenuTitle
					),
					el(
						'p',
						{ className: 'routes-navigation-canvas-toolbar__meta' },
						getMenuLocationsDescription( selectedLocations.length )
					)
				),
				el(
					'div',
					{ className: 'routes-navigation-canvas-toolbar__actions' },
					selectedMenuActions
				)
			),
		selectedMenu &&
			! isResolvingLocations &&
			selectedLocations.length === 0 &&
			el( NavigationSitePreviewNotice, {
				onChooseLocation: () => setLocationModalMode( 'choose' ),
			} ),
		el(
			'div',
			{ className: 'routes-navigation-canvas__body' },
			el( NavigationSitePreview )
		),
		locationModalMode &&
			selectedMenu?.id &&
			el( ChooseLocationModal, {
				/*
				 * Seeded once, when it opens. Re-seeding as the locations
				 * change would undo what has been ticked since.
				 */
				key: locationModalMode,
				initialSelectedLocationIds:
					locationModalMode === 'update'
						? selectedLocationIds
						: EMPTY_ARRAY,
				isSaving: isSavingLocations,
				mode: locationModalMode,
				onApply: applyLocationAssignments,
				onClose: () => {
					if ( ! isSavingLocations ) {
						setLocationModalMode( null );
					}
				},
				templateParts,
			} ),
		isAddNavigationModalOpen &&
			el( AddNavigationModal, {
				onClose: () => setIsAddNavigationModalOpen( false ),
			} )
	);
}

export const stage = withUiTheme( Stage );
export const canvas = withUiTheme( Canvas );
