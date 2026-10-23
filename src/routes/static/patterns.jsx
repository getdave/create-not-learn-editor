/**
 * WordPress dependencies
 */
import { Preview as LazyEditorPreview } from '@wordpress/lazy-editor';
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getStaticScreen } from './screens';
import { useDataViews } from '../../use-dataviews';
import {
	DEFAULT_TEMPLATE_LAYOUTS,
	EMPTY_ARRAY,
	NO_LIST_DATA,
	getSearchParams,
} from './list-shared';
import {
	PATTERN_SYNC_STATUS,
	PATTERN_TYPES,
	getPatternCategoryChips,
	getPatternCategoryLabels,
	getPatternDescription,
	getPatternSyncStatusLabel,
	getPatternTitle,
	getPatternTypeLabel,
	getPatternsForTab,
	normalizeThemePattern,
	normalizeUserPattern,
} from './pattern-data';
import { getErrorMessage } from '../../records';
import {
	Button,
	coreDataStore,
	EmptyState,
	InputControl,
	layoutIcon,
	Modal,
	Notice,
	Page,
	plusIcon,
	SelectControl,
	Spinner,
	Tabs,
	__,
	useDispatch,
	useMemo,
	useSelect,
	useState,
} from '../../wordpress-packages';

const USER_PATTERN_QUERY = {
	context: 'edit',
	per_page: 100,
	status: 'publish,draft,pending,private,future',
};
const DEFAULT_PATTERN_CONTENT = '';
const DEFAULT_PATTERN_VIEW = {
	fields: [ 'category' ],
	filters: [],
	layout: {
		badgeFields: [ 'category' ],
		previewSize: 160,
	},
	mediaField: 'preview',
	page: 1,
	perPage: 20,
	search: '',
	sort: {
		direction: 'asc',
		field: 'title',
	},
	titleField: 'title',
	type: 'grid',
};
const PATTERN_TABS = [
	{
		label: __( 'All sections' ),
		value: 'all',
	},
	{
		label: __( 'Saved by you' ),
		value: 'my-patterns',
	},
	{
		label: __( 'From your theme' ),
		value: 'registered',
	},
];

function PatternCategoryChips( { chips, onChange, value } ) {
	if ( chips.length < 2 ) {
		return null;
	}

	return (
		<div
			aria-label={ __( 'Kinds of section' ) }
			className="routes-pattern-list__categories"
			role="group"
		>
			{ [ { label: __( 'Everything' ), value: 'all' }, ...chips ].map(
				( chip ) => (
					<Button
						aria-pressed={ value === chip.value }
						className="routes-pattern-list__category"
						key={ chip.value }
						onClick={ () => onChange( chip.value ) }
						size="compact"
						variant="secondary"
					>
						{ chip.label }
					</Button>
				)
			) }
		</div>
	);
}

function renderPatternPreview( { item } ) {
	return (
		<div className="cnl-editor-dataviews-preview">
			<LazyEditorPreview
				content={ item.content }
				description={ getPatternTitle( item ) }
				viewportWidth={ item.viewportWidth }
			/>
		</div>
	);
}

function getPatternFields( categoryMap ) {
	return [
		{
			enableGlobalSearch: true,
			enableHiding: false,
			getValue: ( { item } ) => getPatternTitle( item ),
			id: 'title',
			label: __( 'Title' ),
			render: ( { item } ) => (
				<span className="cnl-editor-dataviews-title">
					{ getPatternTitle( item ) }
				</span>
			),
			type: 'text',
		},
		{
			enableGlobalSearch: true,
			enableSorting: false,
			getValue: ( { item } ) => getPatternDescription( item ),
			id: 'description',
			label: __( 'Description' ),
			render: ( { item } ) =>
				getPatternDescription( item ) ||
				__( 'Reusable block pattern.' ),
			type: 'text',
		},
		{
			enableGlobalSearch: true,
			enableSorting: false,
			getValue: ( { item } ) =>
				getPatternCategoryLabels( item, categoryMap ),
			id: 'category',
			label: __( 'Category' ),
			type: 'text',
		},
		{
			getValue: ( { item } ) =>
				getPatternSyncStatusLabel( item.syncStatus ),
			id: 'sync-status',
			label: __( 'Sync status' ),
			type: 'text',
		},
		{
			getValue: ( { item } ) => getPatternTypeLabel( item.type ),
			id: 'type',
			label: __( 'Type' ),
			type: 'text',
		},
		{
			enableHiding: false,
			enableSorting: false,
			filterBy: false,
			id: 'preview',
			label: __( 'Preview' ),
			render: renderPatternPreview,
			type: 'media',
		},
	];
}

// Only sections saved on the site can be edited; the theme's are read only.
function canEditPattern( pattern ) {
	return pattern?.type === PATTERN_TYPES.user && !! pattern.recordId;
}

function openPattern( navigate, pattern ) {
	if ( canEditPattern( pattern ) ) {
		navigate( {
			to: `/types/wp_block/edit/${ pattern.recordId }`,
		} );
	}
}

function getPatternActions( navigate ) {
	return [
		{
			callback: ( items ) => openPattern( navigate, items[ 0 ] ),
			id: 'edit-pattern',
			isEligible: canEditPattern,
			isPrimary: true,
			label: __( 'Edit' ),
			supportsBulk: false,
		},
	];
}

function CreatePatternModal( { isSaving, onClose, onCreate, saveError } ) {
	const [ title, setTitle ] = useState( '' );
	const [ syncStatus, setSyncStatus ] = useState( PATTERN_SYNC_STATUS.full );
	const [ validationError, setValidationError ] = useState( '' );
	const canCreate = title.trim().length > 0;
	const submit = ( event ) => {
		event.preventDefault();

		if ( ! canCreate ) {
			setValidationError( __( 'Enter a pattern name.' ) );
			return;
		}

		setValidationError( '' );
		onCreate( {
			syncStatus,
			title: title.trim(),
		} );
	};

	return (
		<Modal
			className="routes-pattern-list__create-modal"
			onRequestClose={ () => {
				if ( ! isSaving ) {
					onClose();
				}
			} }
			title={ __( 'Add a section' ) }
		>
			<form
				className="routes-pattern-list__create-form"
				onSubmit={ submit }
			>
				<InputControl
					autoComplete="off"
					disabled={ isSaving }
					label={ __( 'Name' ) }
					onValueChange={ ( value ) => {
						setTitle( value );
						setValidationError( '' );
					} }
					placeholder={ __( 'Customer reviews' ) }
					value={ title }
				/>
				<SelectControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					disabled={ isSaving }
					label={ __( 'When you edit it later' ) }
					onChange={ setSyncStatus }
					options={ [
						{
							label: __( 'Update it everywhere it is used' ),
							value: PATTERN_SYNC_STATUS.full,
						},
						{
							label: __( 'Let each copy be changed on its own' ),
							value: PATTERN_SYNC_STATUS.unsynced,
						},
					] }
					value={ syncStatus }
				/>
				{ ( validationError || saveError ) && (
					<Notice isDismissible={ false } status="error">
						{ validationError || saveError }
					</Notice>
				) }
				<div className="routes-pattern-list__create-actions">
					<Button
						__next40pxDefaultSize
						disabled={ isSaving }
						onClick={ onClose }
						variant="tertiary"
					>
						{ __( 'Cancel' ) }
					</Button>
					<Button
						__next40pxDefaultSize
						disabled={ isSaving || ! canCreate }
						isBusy={ isSaving }
						type="submit"
						variant="primary"
					>
						{ __( 'Add' ) }
					</Button>
				</div>
			</form>
		</Modal>
	);
}

function PatternsDataViewsLayout() {
	// Only rendered inside `DataViews`, so the module has loaded.
	const { DataViews } = useDataViews();

	return (
		<div className="routes-pattern-list__dataviews">
			<div className="routes-pattern-list__dataviews-toolbar">
				<div className="routes-pattern-list__dataviews-toolbar-start">
					<DataViews.Search />
					<DataViews.FiltersToggle />
				</div>
				<div className="routes-pattern-list__dataviews-toolbar-end">
					<DataViews.LayoutSwitcher />
					<DataViews.ViewConfig />
				</div>
			</div>
			<DataViews.Filters className="routes-pattern-list__dataviews-filters" />
			<div className="routes-pattern-list__dataviews-scroll">
				<DataViews.Layout />
				<DataViews.Pagination />
			</div>
		</div>
	);
}

function usePatternsData() {
	/*
	 * Only the store's own values are selected. Anything built from them is
	 * new on every call, which would re-render the grid, and every preview in
	 * it, whenever anything in core data changed.
	 */
	const {
		blockCategories,
		error,
		isLoading,
		themePatterns,
		userCategories,
		userPatterns,
	} = useSelect( ( select ) => {
		const store = select( coreDataStore );
		const userPatternArgs = [ 'postType', 'wp_block', USER_PATTERN_QUERY ];
		const resolutionError = store.getResolutionError?.(
			'getEntityRecords',
			userPatternArgs
		);

		return {
			blockCategories: store.getBlockPatternCategories?.() || EMPTY_ARRAY,
			error: resolutionError ? getErrorMessage( resolutionError ) : null,
			isLoading:
				Boolean( store.isResolving?.( 'getBlockPatterns', [] ) ) ||
				store.isResolving( 'getEntityRecords', userPatternArgs ) ||
				! store.hasFinishedResolution(
					'getEntityRecords',
					userPatternArgs
				),
			themePatterns: store.getBlockPatterns?.() || EMPTY_ARRAY,
			userCategories: store.getUserPatternCategories?.() || EMPTY_ARRAY,
			userPatterns:
				store.getEntityRecords( ...userPatternArgs ) || EMPTY_ARRAY,
		};
	}, [] );

	const categoryMap = useMemo( () => {
		const map = new Map();

		[ ...blockCategories, ...userCategories ].forEach( ( category ) => {
			if ( category?.name && ! map.has( category.name ) ) {
				map.set( category.name, category.label || category.name );
			}
		} );

		return map;
	}, [ blockCategories, userCategories ] );

	const patterns = useMemo(
		() => [
			...userPatterns.map( ( pattern ) =>
				normalizeUserPattern( pattern, userCategories )
			),
			...themePatterns
				.filter( ( pattern ) => pattern?.inserter !== false )
				.map( normalizeThemePattern ),
		],
		[ themePatterns, userCategories, userPatterns ]
	);

	return { categoryMap, error, isLoading, patterns };
}

function getPatternTabFromSearch() {
	return getSearchParams().get( 'type' ) || 'all';
}

export function PatternsStage() {
	const navigate = useNavigate();
	const dataViews = useDataViews();
	const { invalidateResolution, saveEntityRecord } =
		useDispatch( coreDataStore );
	const { categoryMap, error, isLoading, patterns } = usePatternsData();
	const [ view, setView ] = useState( DEFAULT_PATTERN_VIEW );
	const [ activeTab, setActiveTab ] = useState( getPatternTabFromSearch() );
	const [ isCreateModalOpen, setIsCreateModalOpen ] = useState( false );
	const [ isCreatingPattern, setIsCreatingPattern ] = useState( false );
	const [ createPatternError, setCreatePatternError ] = useState( '' );
	const canCreatePatterns = useSelect(
		( select ) =>
			select( coreDataStore ).canUser?.( 'create', {
				kind: 'postType',
				name: 'wp_block',
			} ),
		[]
	);
	const [ activeCategory, setActiveCategory ] = useState( 'all' );
	const tabPatterns = useMemo(
		() => getPatternsForTab( patterns, activeTab ),
		[ activeTab, patterns ]
	);
	const categoryChips = useMemo(
		() => getPatternCategoryChips( tabPatterns, categoryMap ),
		[ categoryMap, tabPatterns ]
	);
	const visiblePatterns = useMemo(
		() =>
			activeCategory === 'all'
				? tabPatterns
				: tabPatterns.filter( ( pattern ) =>
						pattern.categories?.includes( activeCategory )
					),
		[ activeCategory, tabPatterns ]
	);
	const selectCategory = ( nextCategory ) => {
		setActiveCategory( nextCategory );
		setView( ( currentView ) => ( {
			...currentView,
			page: 1,
		} ) );
	};
	const fields = useMemo(
		() => getPatternFields( categoryMap ),
		[ categoryMap ]
	);
	const actions = useMemo(
		() => getPatternActions( navigate ),
		[ navigate ]
	);
	const { data: shownPatterns, paginationInfo } = useMemo(
		() =>
			dataViews
				? dataViews.filterSortAndPaginate(
						visiblePatterns,
						view,
						fields
					)
				: NO_LIST_DATA,
		[ dataViews, fields, view, visiblePatterns ]
	);
	const selectTab = ( nextTab ) => {
		setActiveTab( nextTab );
		setActiveCategory( 'all' );
		setView( ( currentView ) => ( {
			...currentView,
			page: 1,
		} ) );
		navigate( {
			search: {
				search: undefined,
				type: nextTab === 'all' ? undefined : nextTab,
			},
			to: '/patterns',
		} );
	};
	const onChangeView = ( nextView ) => {
		setView( nextView );
		navigate( {
			search: {
				page:
					nextView.page && nextView.page > 1
						? nextView.page
						: undefined,
				search: nextView.search || undefined,
				type: activeTab === 'all' ? undefined : activeTab,
			},
			to: '/patterns',
		} );
	};
	const openCreateModal = () => {
		setCreatePatternError( '' );
		setIsCreateModalOpen( true );
	};
	const closeCreateModal = () => {
		if ( ! isCreatingPattern ) {
			setCreatePatternError( '' );
			setIsCreateModalOpen( false );
		}
	};
	const createPattern = async ( { syncStatus, title } ) => {
		const record = {
			content: DEFAULT_PATTERN_CONTENT,
			status: 'publish',
			title,
		};

		if ( syncStatus === PATTERN_SYNC_STATUS.unsynced ) {
			record.meta = {
				wp_pattern_sync_status: syncStatus,
			};
		}

		setIsCreatingPattern( true );
		setCreatePatternError( '' );

		try {
			const pattern = await saveEntityRecord(
				'postType',
				'wp_block',
				record,
				{ throwOnError: true }
			);

			invalidateResolution?.( 'getEntityRecords', [
				'postType',
				'wp_block',
				USER_PATTERN_QUERY,
			] );
			setIsCreateModalOpen( false );
			navigate( {
				to: `/types/wp_block/edit/${ pattern.id }`,
			} );
		} catch ( saveError ) {
			setCreatePatternError( getErrorMessage( saveError ) );
		} finally {
			setIsCreatingPattern( false );
		}
	};
	const pageActions = canCreatePatterns !== false && (
		<div className="routes-pattern-list__page-actions">
			<Button
				__next40pxDefaultSize
				icon={ plusIcon }
				onClick={ openCreateModal }
				variant="primary"
			>
				{ __( 'Add section' ) }
			</Button>
		</div>
	);
	const empty = (
		<div className="cnl-editor-empty-state">
			<EmptyState.Root>
				<EmptyState.Icon icon={ layoutIcon } />
				<EmptyState.Title>
					{ __( 'No sections found' ) }
				</EmptyState.Title>
				<EmptyState.Description>
					{ __(
						'Patterns will appear here when the active theme or site defines reusable designs.'
					) }
				</EmptyState.Description>
			</EmptyState.Root>
		</div>
	);

	const DataViews = dataViews?.DataViews;

	return (
		<Page
			actions={ pageActions }
			className="cnl-editor-stage routes-pattern-list"
			hasPadding={ false }
			headingLevel={ 2 }
			subTitle={ getStaticScreen().description }
			title={ getStaticScreen().title }
		>
			<div className="routes-pattern-list__tabs-wrapper">
				<Tabs.Root onValueChange={ selectTab } value={ activeTab }>
					<Tabs.List>
						{ PATTERN_TABS.map( ( tab ) => (
							<Tabs.Tab key={ tab.value } value={ tab.value }>
								{ tab.label }
							</Tabs.Tab>
						) ) }
					</Tabs.List>
				</Tabs.Root>
			</div>
			<PatternCategoryChips
				chips={ categoryChips }
				onChange={ selectCategory }
				value={ activeCategory }
			/>
			{ error && <div className="cnl-editor-empty">{ error }</div> }
			{ DataViews ? (
				<DataViews
					actions={ actions }
					data={ shownPatterns }
					defaultLayouts={ DEFAULT_TEMPLATE_LAYOUTS }
					empty={ empty }
					fields={ fields }
					getItemId={ ( item ) => item.id }
					isLoading={ isLoading }
					isItemClickable={ canEditPattern }
					onChangeSelection={ () => {} }
					onChangeView={ onChangeView }
					onClickItem={ ( item ) => openPattern( navigate, item ) }
					paginationInfo={ paginationInfo }
					selection={ EMPTY_ARRAY }
					view={ view }
				>
					<PatternsDataViewsLayout />
				</DataViews>
			) : (
				<div className="cnl-editor-spinner">
					<Spinner />
				</div>
			) }
			{ isCreateModalOpen && (
				<CreatePatternModal
					isSaving={ isCreatingPattern }
					onClose={ closeCreateModal }
					onCreate={ createPattern }
					saveError={ createPatternError }
				/>
			) }
		</Page>
	);
}
