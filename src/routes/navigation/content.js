/**
 * WordPress dependencies
 */
import { useNavigate, useSearch } from '@wordpress/route';
import { Preview as LazyEditorPreview } from '@wordpress/lazy-editor';

/**
 * Internal dependencies
 */
import {
	cnlEditorStore,
	getErrorMessage,
	getNavigationMenuItemCount,
	getTitleText,
} from '../../records';
import {
	Button,
	CheckboxControl,
	coreDataStore,
	DataViews,
	DropdownMenu,
	EmptyState,
	HStack,
	Icon,
	layoutIcon,
	MenuItem,
	Modal,
	moreVerticalIcon,
	compassIcon,
	noticesStore,
	Notice,
	Page,
	Spinner,
	TextControl,
	__,
	_n,
	el,
	sprintf,
	useDispatch,
	useEffect,
	useMemo,
	useSelect,
	useState,
	VStack,
} from '../../wordpress-packages';
import {
	assignNavigationMenuToFirstBlock,
	buildNavigationLocationsMap,
	compareTemplatePartsByArea,
	getLocationAreaLabel,
	getLocationLabel,
	getLocationsSummary,
	getTemplatePartRawContent,
	mergeTemplatePartWithEditedRecord,
	removeNavigationMenuFromFirstBlock,
	templatePartHasNavigationBlock,
} from './navigation-locations';

const NAVIGATION_MENUS_CHANGED_EVENT = 'cnl-editor-navigation-menus-changed';
const EMPTY_ARRAY = [];
const PAGE_LIST_BLOCK_CONTENT = '<!-- wp:page-list /-->';
const TEMPLATE_PARTS_QUERY = {
	context: 'edit',
	per_page: 100,
	_fields: 'id,slug,title,area,status,content',
};
const DEFAULT_NAVIGATION_VIEW = {
	fields: [ 'usage', 'items', 'status' ],
	page: 1,
	perPage: 10,
	search: '',
	sort: {
		direction: 'desc',
		field: 'date',
	},
	titleField: 'title',
	type: 'list',
};

function getMenuTitle( menu ) {
	return getTitleText( menu?.title ) || __( 'Untitled menu' );
}

function getMenuStatusLabel( menu ) {
	if ( menu?.status === 'publish' ) {
		return __( 'Published' );
	}

	if ( menu?.status === 'draft' ) {
		return __( 'Draft' );
	}

	return menu?.status || __( 'Unknown' );
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

function getNavigationMenuSearchId( menuOrId ) {
	const menuId = getNavigationMenuId( menuOrId );
	const numericMenuId = Number( menuId );

	return Number.isFinite( numericMenuId ) ? numericMenuId : menuId;
}

function getMenuLocationsTitle( menuTitle ) {
	return sprintf(
		/* translators: %s: Navigation menu title. */
		__( '%s menu locations' ),
		menuTitle
	);
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

	navigate( { to: route } );
	window.setTimeout( () => {
		const currentUrl = new URL( window.location.href );
		const currentRoute = currentUrl.searchParams.get( 'p' ) || '';

		if ( currentRoute.startsWith( route ) ) {
			return;
		}

		currentUrl.searchParams.set( 'p', route );
		window.location.assign( currentUrl.toString() );
	}, 100 );
}

function NavigationLocationsEmptyState( { disabled, onChooseLocation } ) {
	return el(
		EmptyState.Root,
		{ className: 'routes-navigation-locations-canvas__empty-state' },
		el( EmptyState.Icon, { icon: compassIcon } ),
		el(
			EmptyState.Title,
			null,
			__( 'This menu is not shown on your site yet' )
		),
		el(
			EmptyState.Description,
			null,
			__(
				'Choose where this menu should appear, such as your header or footer.'
			)
		),
		el(
			EmptyState.Actions,
			null,
			el(
				Button,
				{
					__next40pxDefaultSize: true,
					disabled,
					onClick: onChooseLocation,
					variant: 'primary',
				},
				__( 'Choose location' )
			)
		)
	);
}

function NavigationNoMenuSelectedEmptyState() {
	return el(
		EmptyState.Root,
		{ className: 'routes-navigation-locations-canvas__empty-state' },
		el( EmptyState.Icon, { icon: compassIcon } ),
		el( EmptyState.Title, null, __( 'No menu selected' ) ),
		el(
			EmptyState.Description,
			null,
			__( 'Create or select a navigation menu to edit its structure.' )
		)
	);
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

function getInitialNavigationView( searchParams ) {
	return {
		...DEFAULT_NAVIGATION_VIEW,
		page: searchParams.page ? Number( searchParams.page ) || 1 : 1,
		search: searchParams.search || '',
	};
}

function getNavigationFields( {
	isResolvingLocations,
	locationsMap,
	onSelectMenu,
} ) {
	return [
		{
			enableGlobalSearch: true,
			enableHiding: false,
			getValue: ( { item } ) => getMenuTitle( item ),
			id: 'title',
			label: __( 'Title' ),
			render: ( { item } ) =>
				el(
					Button,
					{
						className: 'routes-navigation-list__title',
						onClick: ( event ) => {
							event.stopPropagation();
							onSelectMenu( getNavigationMenuId( item ) );
						},
						variant: 'link',
					},
					getMenuTitle( item )
				),
			type: 'text',
		},
		{
			enableSorting: false,
			filterBy: false,
			getValue: ( { item } ) =>
				isResolvingLocations
					? __( 'Checking usage…' )
					: getLocationsSummary(
							locationsMap[ getNavigationMenuId( item ) ] ||
								EMPTY_ARRAY
					  ),
			id: 'usage',
			label: __( 'Usage' ),
			type: 'text',
		},
		{
			enableSorting: false,
			filterBy: false,
			getValue: ( { item } ) => getNavigationMenuItemCount( item ),
			id: 'items',
			label: __( 'Items' ),
			render: ( { item } ) => {
				const count = getNavigationMenuItemCount( item );

				return sprintf(
					/* translators: %d: Number of navigation blocks in the menu. */
					_n( '%d item', '%d items', count ),
					count
				);
			},
			type: 'integer',
		},
		{
			elements: [
				{ label: __( 'Published' ), value: 'Published' },
				{ label: __( 'Draft' ), value: 'Draft' },
			],
			enableSorting: false,
			filterBy: {
				operators: [ 'isAny' ],
			},
			getValue: ( { item } ) => getMenuStatusLabel( item ),
			id: 'status',
			label: __( 'Status' ),
			type: 'text',
		},
	];
}

function getNavigationActions( navigate ) {
	return [
		{
			callback: ( items ) => {
				const item = items[ 0 ];
				window.setTimeout(
					() => navigateToNavigationEditRoute( navigate, item ),
					0
				);
			},
			id: 'edit',
			label: __( 'Edit' ),
			supportsBulk: false,
		},
	];
}

function NavigationListDataViewsLayout() {
	return el(
		'div',
		{ className: 'routes-navigation-list__dataviews' },
		el(
			'div',
			{ className: 'routes-navigation-list__dataviews-toolbar' },
			el(
				'div',
				{
					className:
						'routes-navigation-list__dataviews-toolbar-start',
				},
				el( DataViews.Search, { label: __( 'Search menus' ) } ),
				el( DataViews.FiltersToggle )
			),
			el(
				'div',
				{ className: 'routes-navigation-list__dataviews-toolbar-end' },
				el( DataViews.ViewConfig ),
				el( DataViews.LayoutSwitcher )
			)
		),
		el( DataViews.FiltersToggled, {
			className: 'routes-navigation-list__dataviews-filters',
		} ),
		el(
			'div',
			{ className: 'routes-navigation-list__dataviews-scroll' },
			el( DataViews.Layout ),
			el( DataViews.Pagination )
		)
	);
}

function useNavigationLocations( menus ) {
	const fallbackMenuId = menus[ 0 ]?.id;
	const { error, isResolving, templateParts } = useSelect( ( select ) => {
		const store = select( coreDataStore );
		const args = [ 'postType', 'wp_template_part', TEMPLATE_PARTS_QUERY ];
		const rawTemplateParts =
			store.getEntityRecords( ...args ) || EMPTY_ARRAY;

		return {
			error: store.getResolutionError?.( 'getEntityRecords', args ),
			isResolving:
				store.isResolving( 'getEntityRecords', args ) ||
				! store.hasFinishedResolution( 'getEntityRecords', args ),
			templateParts: rawTemplateParts.map( ( part ) =>
				mergeTemplatePartWithEditedRecord(
					part,
					store.getEditedEntityRecord(
						'postType',
						'wp_template_part',
						part.id
					)
				)
			),
		};
	}, [] );
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
				'wp_navigation',
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
			title: __( 'Add New Navigation Menu' ),
		},
		el(
			'form',
			{
				onSubmit: submit,
			},
			el(
				VStack,
				{ spacing: 4 },
				el( TextControl, {
					__next40pxDefaultSize: true,
					autoComplete: 'off',
					disabled: isBusy,
					label: __( 'Name' ),
					onChange: setMenuTitle,
					placeholder: __( 'Enter menu name' ),
					value: menuTitle,
				} ),
				el( CheckboxControl, {
					'aria-label': __( 'Auto sync with site pages' ),
					checked: autoSyncWithPages,
					disabled: isBusy,
					help: __(
						'This menu will update automatically when you add, rename, or remove pages, until you choose to customize it manually.'
					),
					label: __( 'Auto sync with site pages' ),
					onChange: setAutoSyncWithPages,
				} ),
				el(
					HStack,
					{ justify: 'right', spacing: 2 },
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

	useEffect( () => {
		setSelectedIds( initialSelectedLocationIds );
	}, [ initialSelectedLocationIds ] );

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
	const {
		error,
		isLoading,
		isResolvingLocations,
		locationsError,
		locationsMap,
		menus,
	} = useNavigationMenus();
	const [ view, setView ] = useState( () =>
		getInitialNavigationView( searchParams )
	);
	const [ isAddNavigationModalOpen, setIsAddNavigationModalOpen ] =
		useState( false );
	const onSelectMenu = ( nextSelectedId ) => {
		navigate( {
			search: {
				...searchParams,
				menuId: nextSelectedId
					? getNavigationMenuSearchId( nextSelectedId )
					: undefined,
			},
			to: '/navigation',
		} );
	};
	const navigationFields = getNavigationFields( {
		isResolvingLocations,
		locationsMap,
		onSelectMenu,
	} );
	const navigationActions = getNavigationActions( navigate );
	const navigationEmpty = el(
		'div',
		{ className: 'cnl-editor-empty-state' },
		el(
			EmptyState.Root,
			null,
			el( EmptyState.Icon, { icon: compassIcon } ),
			el( EmptyState.Title, null, __( 'No navigation menus yet' ) ),
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
	const onChangeView = ( nextView ) => {
		setView( nextView );
		navigate( {
			search: {
				...searchParams,
				page:
					nextView.page && nextView.page > 1
						? nextView.page
						: undefined,
				search: nextView.search || undefined,
			},
			to: '/navigation',
		} );
	};
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
					__( 'Add New' )
				),
				className: 'cnl-editor-stage routes-navigation-list',
				hasPadding: false,
				headingLevel: 2,
				key: 'navigation-page',
				subTitle: __( 'Manage menus for the site.' ),
				title: __( 'Navigation' ),
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
			el(
				DataViews,
				{
					actions: navigationActions,
					data: menus,
					defaultLayouts: {
						list: true,
						table: {},
					},
					empty: navigationEmpty,
					fields: navigationFields,
					getItemId: ( item ) => getNavigationMenuId( item ),
					isLoading,
					onChangeView,
					onChangeSelection: () => {},
					onClickItem: ( item ) =>
						onSelectMenu( getNavigationMenuId( item ) ),
					paginationInfo: {
						totalItems: menus.length,
						totalPages: Math.max(
							1,
							Math.ceil(
								menus.length /
									( view.perPage || menus.length || 1 )
							)
						),
					},
					selection: EMPTY_ARRAY,
					view,
				},
				el( NavigationListDataViewsLayout )
			)
		),
		isAddNavigationModalOpen &&
			el( AddNavigationModal, {
				key: 'add-navigation-modal',
				onClose: () => setIsAddNavigationModalOpen( false ),
			} ),
	];
}

function Canvas() {
	const navigate = useNavigate();
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
			className:
				'cnl-editor-canvas routes-navigation-locations-canvas-shell',
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
		isResolvingLocations &&
			! selectedMenu &&
			el( 'div', { className: 'cnl-editor-spinner' }, el( Spinner ) ),
		selectedMenu &&
			el(
				Page,
				{
					actions: selectedMenuActions,
					className: 'routes-navigation-locations-canvas',
					hasPadding: false,
					headingLevel: 2,
					showSidebarToggle: false,
					subTitle: getMenuLocationsDescription(
						selectedLocations.length
					),
					title: getMenuLocationsTitle( selectedMenuTitle ),
				},
				el(
					'div',
					{
						className:
							'routes-navigation-locations-canvas__content',
					},
					isResolvingLocations &&
						el(
							'div',
							{ className: 'cnl-editor-spinner' },
							el( Spinner )
						),
					! isResolvingLocations &&
						selectedLocations.length === 0 &&
						el( NavigationLocationsEmptyState, {
							disabled: isResolvingLocations,
							onChooseLocation: () =>
								setLocationModalMode( 'choose' ),
						} ),
					! isResolvingLocations &&
						selectedLocations.length > 0 &&
						el(
							'div',
							{
								className:
									'routes-navigation-locations-canvas__previews',
							},
							selectedLocations.map( ( location ) =>
								el(
									'section',
									{
										className:
											'routes-navigation-locations-canvas__card',
										key: location.id,
									},
									el(
										'div',
										{
											className:
												'routes-navigation-locations-canvas__card-header',
										},
										el(
											'div',
											{
												className:
													'routes-navigation-locations-canvas__card-title',
											},
											el( Icon, {
												className:
													'routes-navigation-locations-canvas__card-icon',
												icon: layoutIcon,
											} ),
											el( 'span', null, location.label )
										),
										el(
											Button,
											{
												onClick: () =>
													navigate( {
														to: `/wp_template_part?postId=${ encodeURIComponent(
															location.part.id
														) }`,
													} ),
												variant: 'link',
											},
											__( 'Edit' )
										)
									),
									el(
										'div',
										{
											className:
												'routes-navigation-locations-canvas__preview',
										},
										el( LazyEditorPreview, {
											content: getTemplatePartRawContent(
												location.part
											),
											description: location.label,
										} )
									)
								)
							)
						)
				)
			),
		! isResolvingLocations &&
			! selectedMenu &&
			el(
				'div',
				{
					className:
						'routes-navigation-locations-canvas is-top-centered',
				},
				el( NavigationNoMenuSelectedEmptyState )
			),
		locationModalMode &&
			selectedMenu?.id &&
			el( ChooseLocationModal, {
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

export { Stage as stage, Canvas as canvas };
