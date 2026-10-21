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
	getSearchValue,
} from './list-shared';
import {
	getErrorMessage,
	getTemplateAuthorText,
	getTitleText,
} from '../../records';
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
	sprintf,
	Tabs,
	__,
	useDispatch,
	useMemo,
	useSelect,
	useState,
} from '../../wordpress-packages';

const TEMPLATE_PART_QUERY = {
	context: 'edit',
	per_page: 100,
	_fields:
		'id,slug,title,description,source,author,theme,type,status,content,date,modified,area',
};
const DEFAULT_TEMPLATE_PART_VIEW = {
	fields: [ 'area' ],
	filters: [],
	layout: {
		badgeFields: [ 'area' ],
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
const TEMPLATE_PART_AREAS = [
	{
		label: __( 'All' ),
		value: 'all',
	},
	{
		label: __( 'Headers' ),
		value: 'header',
	},
	{
		label: __( 'Footers' ),
		value: 'footer',
	},
	{
		label: __( 'Sidebars' ),
		value: 'sidebar',
	},
	{
		label: __( 'Overlays' ),
		value: 'navigation-overlay',
	},
	{
		label: __( 'General' ),
		value: 'uncategorized',
	},
];
const TEMPLATE_PART_CREATE_AREAS = TEMPLATE_PART_AREAS.filter(
	( area ) => area.value !== 'all'
);

function getTemplatePartAreaLabel( area ) {
	return (
		TEMPLATE_PART_AREAS.find( ( option ) => option.value === area )
			?.label ||
		area ||
		__( 'General' )
	);
}

function getTemplatePartCreateAreaLabel( area ) {
	switch ( area ) {
		case 'header':
			return __( 'Header' );
		case 'footer':
			return __( 'Footer' );
		case 'sidebar':
			return __( 'Sidebar' );
		case 'navigation-overlay':
			return __( 'Overlay' );
		case 'uncategorized':
			return __( 'General' );
		default:
			return getTemplatePartAreaLabel( area );
	}
}

function getCleanTemplatePartSlug( title ) {
	return (
		title
			.trim()
			.toLowerCase()
			.replace( /[^a-z0-9_\s-]/g, '' )
			.replace( /[\s_]+/g, '-' )
			.replace( /-+/g, '-' )
			.replace( /^-|-$/g, '' ) || 'wp-custom-part'
	);
}

function getUniqueTemplatePartTitle( title, templateParts ) {
	const trimmedTitle = title.trim();
	const existingTitles = new Set(
		( templateParts || EMPTY_ARRAY ).map( ( templatePart ) =>
			getTitleText( templatePart?.title ).toLowerCase()
		)
	);
	const lowerTitle = trimmedTitle.toLowerCase();

	if ( ! existingTitles.has( lowerTitle ) ) {
		return trimmedTitle;
	}

	let suffix = 2;
	while ( existingTitles.has( `${ lowerTitle } ${ suffix }` ) ) {
		suffix += 1;
	}

	return `${ trimmedTitle } ${ suffix }`;
}

function getTemplatePartDescription( templatePart ) {
	return (
		templatePart?.description ||
		getTemplatePartAreaLabel( templatePart?.area )
	);
}

function renderTemplatePartPreview( { item } ) {
	return (
		<div className="cnl-editor-dataviews-preview">
			<LazyEditorPreview
				content={ item?.content?.raw }
				description={ getTitleText( item?.title ) }
			/>
		</div>
	);
}

function getTemplatePartFields( activeArea ) {
	const fields = [
		{
			enableGlobalSearch: true,
			enableHiding: false,
			getValue: ( { item } ) => getTitleText( item.title ),
			id: 'title',
			label: __( 'Title' ),
			render: ( { item } ) => (
				<span className="cnl-editor-dataviews-title">
					{ getTitleText( item.title ) }
				</span>
			),
			type: 'text',
		},
		{
			enableGlobalSearch: true,
			enableSorting: false,
			getValue: ( { item } ) => getTemplatePartDescription( item ),
			id: 'description',
			label: __( 'Description' ),
			render: ( { item } ) => getTemplatePartDescription( item ),
			type: 'text',
		},
		{
			getValue: ( { item } ) => getTemplatePartAreaLabel( item.area ),
			id: 'area',
			label: __( 'Where it goes' ),
			type: 'text',
		},
		{
			enableGlobalSearch: true,
			getValue: ( { item } ) => getTemplateAuthorText( item ),
			id: 'author',
			label: __( 'Author' ),
			type: 'text',
		},
		{
			enableGlobalSearch: true,
			getValue: ( { item } ) => item?.slug || String( item?.id || '' ),
			id: 'slug',
			label: __( 'Slug' ),
			type: 'text',
		},
		{
			enableHiding: false,
			enableSorting: false,
			filterBy: false,
			id: 'preview',
			label: __( 'Preview' ),
			render: renderTemplatePartPreview,
			type: 'media',
		},
	];

	if ( activeArea !== 'all' ) {
		return fields.filter( ( field ) => field.id !== 'area' );
	}

	return fields;
}

function getTemplatePartActions( navigate ) {
	return [
		{
			callback: ( items ) => {
				const item = items[ 0 ];

				if ( item?.id ) {
					navigate( {
						search: {
							postId: item.id,
						},
						to: '/wp_template_part',
					} );
				}
			},
			id: 'edit-template-part',
			isPrimary: true,
			label: __( 'Edit' ),
			supportsBulk: false,
		},
	];
}

function CreateTemplatePartModal( {
	defaultArea,
	isSaving,
	onClose,
	onCreate,
	saveError,
} ) {
	const [ title, setTitle ] = useState( '' );
	const [ area, setArea ] = useState( defaultArea || 'uncategorized' );
	const [ validationError, setValidationError ] = useState( '' );
	const canCreate = title.trim().length > 0;
	const submit = ( event ) => {
		event.preventDefault();

		if ( ! canCreate ) {
			setValidationError( __( 'Enter a template part name.' ) );
			return;
		}

		setValidationError( '' );
		onCreate( {
			area,
			title: title.trim(),
		} );
	};

	return (
		<Modal
			className="routes-template-part-list__create-modal"
			onRequestClose={ () => {
				if ( ! isSaving ) {
					onClose();
				}
			} }
			title={ __( 'Add a site part' ) }
		>
			<form
				className="routes-template-part-list__create-form"
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
					value={ title }
				/>
				<SelectControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					disabled={ isSaving }
					label={ __( 'Area' ) }
					onChange={ setArea }
					options={ TEMPLATE_PART_CREATE_AREAS.map( ( option ) => ( {
						label: getTemplatePartCreateAreaLabel( option.value ),
						value: option.value,
					} ) ) }
					value={ area }
				/>
				{ ( validationError || saveError ) && (
					<Notice isDismissible={ false } status="error">
						{ validationError || saveError }
					</Notice>
				) }
				<div className="routes-template-part-list__create-actions">
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

function TemplatePartsDataViewsLayout() {
	// Only rendered inside `DataViews`, so the module has loaded.
	const { DataViews } = useDataViews();

	return (
		<div className="routes-template-part-list__dataviews">
			<div className="routes-template-part-list__dataviews-toolbar">
				<div className="routes-template-part-list__dataviews-toolbar-start">
					<DataViews.Search />
					<DataViews.FiltersToggle />
				</div>
				<div className="routes-template-part-list__dataviews-toolbar-end">
					<DataViews.LayoutSwitcher />
					<DataViews.ViewConfig />
				</div>
			</div>
			<DataViews.Filters className="routes-template-part-list__dataviews-filters" />
			<div className="routes-template-part-list__dataviews-scroll">
				<DataViews.BulkActionToolbar />
				<DataViews.Layout />
				<DataViews.Pagination />
			</div>
		</div>
	);
}

function useTemplatePartsData() {
	return useSelect( ( select ) => {
		const store = select( coreDataStore );
		const args = [ 'postType', 'wp_template_part', TEMPLATE_PART_QUERY ];
		const templateParts = store.getEntityRecords( ...args ) || EMPTY_ARRAY;
		const error = store.getResolutionError?.( 'getEntityRecords', args );

		return {
			error: error ? getErrorMessage( error ) : null,
			isLoading:
				store.isResolving( 'getEntityRecords', args ) ||
				! store.hasFinishedResolution( 'getEntityRecords', args ),
			templateParts,
		};
	}, [] );
}

function getTemplatePartAreaFromSearch() {
	return getSearchParams().get( 'area' ) || 'all';
}

function getSelectedTemplatePartIdFromSearch() {
	const params = getSearchParams();

	return (
		getSearchValue( params.getAll( 'postIds[]' ) ) || params.get( 'postId' )
	);
}

function getTemplatePartsForArea( templateParts, area ) {
	if ( area === 'all' ) {
		return templateParts;
	}

	return templateParts.filter(
		( templatePart ) => templatePart.area === area
	);
}

export function TemplatePartsStage() {
	const navigate = useNavigate();
	const dataViews = useDataViews();
	const { invalidateResolution, saveEntityRecord } =
		useDispatch( coreDataStore );
	const { error, isLoading, templateParts } = useTemplatePartsData();
	const [ view, setView ] = useState( DEFAULT_TEMPLATE_PART_VIEW );
	const [ activeArea, setActiveArea ] = useState(
		getTemplatePartAreaFromSearch()
	);
	const [ selectedTemplatePartId, setSelectedTemplatePartId ] = useState(
		getSelectedTemplatePartIdFromSearch()
	);
	const [ isCreateModalOpen, setIsCreateModalOpen ] = useState( false );
	const [ isCreatingTemplatePart, setIsCreatingTemplatePart ] =
		useState( false );
	const [ createTemplatePartError, setCreateTemplatePartError ] =
		useState( '' );
	const canCreateTemplateParts = useSelect(
		( select ) =>
			select( coreDataStore ).canUser?.( 'create', {
				kind: 'postType',
				name: 'wp_template_part',
			} ),
		[]
	);
	const visibleTemplateParts = useMemo(
		() => getTemplatePartsForArea( templateParts, activeArea ),
		[ activeArea, templateParts ]
	);
	const fields = useMemo(
		() => getTemplatePartFields( activeArea ),
		[ activeArea ]
	);
	const actions = useMemo(
		() => getTemplatePartActions( navigate ),
		[ navigate ]
	);
	const { data: shownTemplateParts, paginationInfo } = useMemo(
		() =>
			dataViews
				? dataViews.filterSortAndPaginate(
						visibleTemplateParts,
						view,
						fields
					)
				: NO_LIST_DATA,
		[ dataViews, fields, view, visibleTemplateParts ]
	);
	const selectedTemplatePart =
		visibleTemplateParts.find(
			( templatePart ) =>
				String( templatePart.id ) === String( selectedTemplatePartId )
		) || visibleTemplateParts[ 0 ];
	const selection = selectedTemplatePart?.id
		? [ String( selectedTemplatePart.id ) ]
		: [];
	const selectTemplatePart = ( templatePartId ) => {
		setSelectedTemplatePartId( templatePartId );
		navigate( {
			search: {
				area: activeArea === 'all' ? undefined : activeArea,
				postId: templatePartId ? String( templatePartId ) : undefined,
			},
			to: '/template-parts',
		} );
	};
	const selectArea = ( nextArea ) => {
		setActiveArea( nextArea );
		setSelectedTemplatePartId( null );
		setView( ( currentView ) => ( {
			...currentView,
			page: 1,
		} ) );
		navigate( {
			search: {
				area: nextArea === 'all' ? undefined : nextArea,
				postId: undefined,
				search: undefined,
			},
			to: '/template-parts',
		} );
	};
	const onChangeView = ( nextView ) => {
		setView( nextView );
		navigate( {
			search: {
				area: activeArea === 'all' ? undefined : activeArea,
				page:
					nextView.page && nextView.page > 1
						? nextView.page
						: undefined,
				postId: selectedTemplatePart?.id
					? String( selectedTemplatePart.id )
					: undefined,
				search: nextView.search || undefined,
			},
			to: '/template-parts',
		} );
	};
	const openCreateModal = () => {
		setCreateTemplatePartError( '' );
		setIsCreateModalOpen( true );
	};
	const closeCreateModal = () => {
		if ( ! isCreatingTemplatePart ) {
			setCreateTemplatePartError( '' );
			setIsCreateModalOpen( false );
		}
	};
	const createTemplatePart = async ( { area, title } ) => {
		const uniqueTitle = getUniqueTemplatePartTitle( title, templateParts );
		const record = {
			area,
			content: '',
			slug: getCleanTemplatePartSlug( uniqueTitle ),
			title: uniqueTitle,
		};

		setIsCreatingTemplatePart( true );
		setCreateTemplatePartError( '' );

		try {
			const templatePart = await saveEntityRecord(
				'postType',
				'wp_template_part',
				record,
				{ throwOnError: true }
			);

			invalidateResolution?.( 'getEntityRecords', [
				'postType',
				'wp_template_part',
				TEMPLATE_PART_QUERY,
			] );
			setIsCreateModalOpen( false );
			navigate( {
				search: {
					postId: templatePart.id,
				},
				to: '/wp_template_part',
			} );
		} catch ( saveError ) {
			setCreateTemplatePartError( getErrorMessage( saveError ) );
		} finally {
			setIsCreatingTemplatePart( false );
		}
	};
	const pageActions = canCreateTemplateParts !== false && (
		<div className="routes-template-part-list__page-actions">
			<Button
				__next40pxDefaultSize
				icon={ plusIcon }
				onClick={ openCreateModal }
				variant="primary"
			>
				{ __( 'Add site part' ) }
			</Button>
		</div>
	);
	const empty = (
		<div className="cnl-editor-empty-state">
			<EmptyState.Root>
				<EmptyState.Icon icon={ layoutIcon } />
				<EmptyState.Title>
					{ __( 'No site parts found' ) }
				</EmptyState.Title>
				<EmptyState.Description>
					{ activeArea === 'all'
						? __(
								'Template parts will appear here when the active theme or site defines reusable structural areas.'
							)
						: sprintf(
								/* translators: %s: template part area label. */
								__( 'No template parts are available for %s.' ),
								getTemplatePartAreaLabel(
									activeArea
								).toLowerCase()
							) }
				</EmptyState.Description>
			</EmptyState.Root>
		</div>
	);

	const DataViews = dataViews?.DataViews;

	return (
		<Page
			actions={ pageActions }
			className="cnl-editor-stage routes-template-part-list"
			hasPadding={ false }
			headingLevel={ 2 }
			subTitle={ getStaticScreen().description }
			title={ getStaticScreen().title }
		>
			<div className="routes-template-part-list__tabs-wrapper">
				<Tabs.Root onValueChange={ selectArea } value={ activeArea }>
					<Tabs.List>
						{ TEMPLATE_PART_AREAS.map( ( area ) => (
							<Tabs.Tab key={ area.value } value={ area.value }>
								{ area.label }
							</Tabs.Tab>
						) ) }
					</Tabs.List>
				</Tabs.Root>
			</div>
			{ error && <div className="cnl-editor-empty">{ error }</div> }
			{ DataViews ? (
				<DataViews
					actions={ actions }
					data={ shownTemplateParts }
					defaultLayouts={ DEFAULT_TEMPLATE_LAYOUTS }
					empty={ empty }
					fields={ fields }
					getItemId={ ( item ) => String( item.id ) }
					isLoading={ isLoading }
					onChangeSelection={ ( items ) =>
						selectTemplatePart( items[ 0 ] )
					}
					onChangeView={ onChangeView }
					onClickItem={ ( item ) => selectTemplatePart( item.id ) }
					paginationInfo={ paginationInfo }
					selection={ selection }
					view={ view }
				>
					<TemplatePartsDataViewsLayout />
				</DataViews>
			) : (
				<div className="cnl-editor-spinner">
					<Spinner />
				</div>
			) }
			{ isCreateModalOpen && (
				<CreateTemplatePartModal
					defaultArea={
						activeArea === 'all' ? 'uncategorized' : activeArea
					}
					isSaving={ isCreatingTemplatePart }
					onClose={ closeCreateModal }
					onCreate={ createTemplatePart }
					saveError={ createTemplatePartError }
				/>
			) }
		</Page>
	);
}

export function TemplatePartsCanvas() {
	const navigate = useNavigate();
	const { isLoading, templateParts } = useTemplatePartsData();
	const activeArea = getTemplatePartAreaFromSearch();
	const visibleTemplateParts = getTemplatePartsForArea(
		templateParts,
		activeArea
	);
	const selectedTemplatePartId = getSelectedTemplatePartIdFromSearch();
	const selectedTemplatePart =
		visibleTemplateParts.find(
			( templatePart ) =>
				String( templatePart.id ) === String( selectedTemplatePartId )
		) || visibleTemplateParts[ 0 ];
	let canvasContent = (
		<div className="cnl-editor-canvas-placeholder">
			<span
				aria-hidden
				className="cnl-editor-canvas-placeholder__icon dashicons dashicons-schedule"
			/>
			<h2 className="cnl-editor-canvas-placeholder__title">
				{ __( 'No site part selected' ) }
			</h2>
			<p className="cnl-editor-canvas-placeholder__description">
				{ __( 'Pick a site part, like your header, to preview it.' ) }
			</p>
		</div>
	);

	if ( selectedTemplatePart ) {
		canvasContent = (
			<div className="routes-template-part-list__canvas-preview">
				<LazyEditorPreview
					content={ selectedTemplatePart?.content?.raw }
					description={ getTitleText( selectedTemplatePart.title ) }
				/>
			</div>
		);
	}

	if ( isLoading ) {
		canvasContent = (
			<div className="cnl-editor-spinner">
				<Spinner />
			</div>
		);
	}

	return (
		<section className="cnl-editor-canvas">
			<header className="cnl-editor-canvas__toolbar">
				<div>
					<div className="cnl-editor-canvas__label">
						{ selectedTemplatePart
							? getTitleText( selectedTemplatePart.title )
							: __( 'Site parts' ) }
					</div>
					<div className="cnl-editor-canvas__status">
						{ selectedTemplatePart
							? getTemplatePartAreaLabel(
									selectedTemplatePart.area
								)
							: __( 'Advanced' ) }
					</div>
				</div>
				<div className="cnl-editor-canvas__actions">
					{ selectedTemplatePart?.id && (
						<Button
							onClick={ () =>
								navigate( {
									search: {
										postId: selectedTemplatePart.id,
									},
									to: '/wp_template_part',
								} )
							}
							variant="primary"
						>
							{ __( 'Edit template part' ) }
						</Button>
					) }
				</div>
			</header>
			<div className="cnl-editor-canvas__frame-wrap">
				{ canvasContent }
			</div>
		</section>
	);
}
