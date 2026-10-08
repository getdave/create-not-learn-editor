/**
 * WordPress dependencies
 */
import { Preview as LazyEditorPreview } from '@wordpress/lazy-editor';
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { withUiTheme } from '../../theme';
import { getCurrentEditorPath, getStaticScreen } from './screens';
import { SiteIdentityCanvas, SiteIdentityStage } from './identity';
import { ColorsStage, FontsStage, StylesCanvas, StylesStage } from './styles';
import {
	getErrorMessage,
	getTemplateAuthorText,
	getTemplateDisplayTitle,
	getTitleText,
} from '../../records';
import {
	Button,
	coreDataStore,
	DataViews,
	EmptyState,
	InputControl,
	layoutIcon,
	Modal,
	noticesStore,
	Notice,
	Page,
	plusIcon,
	SelectControl,
	Spinner,
	sprintf,
	Tabs,
	__,
	el,
	useDispatch,
	useMemo,
	useSelect,
	useState,
} from '../../wordpress-packages';

const EMPTY_ARRAY = [];
const TEMPLATE_QUERY = {
	context: 'edit',
	per_page: 100,
	_fields:
		'id,slug,title,description,source,author,theme,type,status,content,date,modified',
};
const TEMPLATE_PART_QUERY = {
	context: 'edit',
	per_page: 100,
	_fields:
		'id,slug,title,description,source,author,theme,type,status,content,date,modified,area',
};
const USER_PATTERN_QUERY = {
	context: 'edit',
	per_page: 100,
	status: 'publish,draft,pending,private,future',
};
const PATTERN_TYPES = {
	theme: 'theme',
	user: 'user',
};
const PATTERN_SYNC_STATUS = {
	full: 'fully',
	unsynced: 'unsynced',
};
const DEFAULT_PATTERN_CONTENT = '';
const DEFAULT_TEMPLATE_VIEW = {
	descriptionField: 'description',
	fields: [],
	filters: [],
	layout: {
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
const DEFAULT_TEMPLATE_LAYOUTS = {
	grid: {
		showMedia: true,
	},
	list: {
		showMedia: false,
	},
	table: {
		showMedia: false,
	},
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

function getSearchParams() {
	const params = new URLSearchParams( window.location.search );
	const routePath = params.get( 'p' ) || '';
	const routeQueryIndex = routePath.indexOf( '?' );

	if ( routeQueryIndex !== -1 ) {
		const routeParams = new URLSearchParams(
			routePath.slice( routeQueryIndex + 1 )
		);

		routeParams.forEach( ( value, key ) => {
			if ( ! params.has( key ) ) {
				params.set( key, value );
			}
		} );
	}

	return params;
}

function getSearchValue( value ) {
	if ( Array.isArray( value ) ) {
		return value[ 0 ];
	}

	return value;
}

function getTemplateDescription( template ) {
	return template?.description || '';
}

function getTemplateStatusLabel( template ) {
	switch ( template?.status ) {
		case 'publish':
			return __( 'Published' );
		case 'draft':
		case 'auto-draft':
			return __( 'Draft' );
		case 'future':
			return __( 'Scheduled' );
		case 'pending':
			return __( 'Pending review' );
		case 'private':
			return __( 'Private' );
		case 'trash':
			return __( 'Trash' );
		default:
			return __( 'Template' );
	}
}

function getTemplateSlug( template ) {
	return template?.slug || String( template?.id || '' );
}

function getCleanTemplateSlug( title ) {
	return (
		title
			.trim()
			.toLowerCase()
			.replace( /[^a-z0-9_\s-]/g, '' )
			.replace( /[\s_]+/g, '-' )
			.replace( /-+/g, '-' )
			.replace( /^-|-$/g, '' ) || 'wp-custom-template'
	);
}

function getUniqueTemplateTitle( title, templates ) {
	const trimmedTitle = title.trim();
	const existingTitles = new Set(
		( templates || EMPTY_ARRAY ).map( ( template ) =>
			getTitleText( template?.title ).toLowerCase()
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

function getTemplateRecordId( template ) {
	if ( template?.id ) {
		return template.id;
	}

	if ( template?.theme && template?.slug ) {
		return `${ template.theme }//${ template.slug }`;
	}

	return template?.slug;
}

function renderTemplatePreview( { item } ) {
	return el(
		'div',
		{
			className: 'cnl-editor-dataviews-preview',
		},
		el( LazyEditorPreview, {
			content: item?.content?.raw,
			description: getTitleText( item?.title ),
		} )
	);
}

function getTemplateFields() {
	return [
		{
			enableGlobalSearch: true,
			enableHiding: false,
			getValue: ( { item } ) => getTemplateDisplayTitle( item ),
			id: 'title',
			label: __( 'Title' ),
			render: ( { item } ) =>
				el(
					'span',
					{ className: 'cnl-editor-dataviews-title' },
					getTemplateDisplayTitle( item )
				),
			type: 'text',
		},
		{
			enableGlobalSearch: true,
			enableSorting: false,
			getValue: ( { item } ) => getTemplateDescription( item ),
			id: 'description',
			label: __( 'Description' ),
			render: ( { item } ) =>
				getTemplateDescription( item ) ||
				__( 'Controls part of the site layout.' ),
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
			getValue: ( { item } ) => getTemplateStatusLabel( item ),
			id: 'status',
			label: __( 'Status' ),
			type: 'text',
		},
		{
			enableGlobalSearch: true,
			getValue: ( { item } ) => getTemplateSlug( item ),
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
			render: renderTemplatePreview,
			type: 'media',
		},
	];
}

function getTemplateActions( navigate, onRename ) {
	return [
		{
			callback: ( items ) => {
				const item = items[ 0 ];

				if ( item?.id ) {
					navigate( {
						search: {
							postId: item.id,
						},
						to: '/wp_template',
					} );
				}
			},
			id: 'edit-template',
			isPrimary: true,
			label: __( 'Edit' ),
			supportsBulk: false,
		},
		{
			callback: ( items ) => onRename( items[ 0 ] ),
			id: 'rename-template',
			isEligible: ( item ) => item?.source === 'custom',
			label: __( 'Rename' ),
			supportsBulk: false,
		},
	];
}

function RenameTemplateModal( {
	isSaving,
	onChangeTitle,
	onClose,
	onSave,
	saveError,
	templateTitle,
	title,
} ) {
	const canSave =
		! isSaving && title.trim().length > 0 && title.trim() !== templateTitle;
	const submit = ( event ) => {
		event.preventDefault();

		if ( canSave ) {
			onSave();
		}
	};

	return el(
		Modal,
		{
			className: 'routes-template-list__rename-modal',
			onRequestClose: () => {
				if ( ! isSaving ) {
					onClose();
				}
			},
			title: __( 'Rename layout' ),
		},
		el(
			'form',
			{
				className: 'routes-template-list__rename-form',
				onSubmit: submit,
			},
			el( InputControl, {
				autoComplete: 'off',
				disabled: isSaving,
				label: __( 'Name' ),
				onValueChange: onChangeTitle,
				value: title,
			} ),
			saveError &&
				el(
					Notice,
					{
						isDismissible: false,
						status: 'error',
					},
					saveError
				),
			el(
				'div',
				{ className: 'routes-template-list__rename-actions' },
				el(
					Button,
					{
						__next40pxDefaultSize: true,
						disabled: isSaving,
						onClick: onClose,
						variant: 'tertiary',
					},
					__( 'Cancel' )
				),
				el(
					Button,
					{
						__next40pxDefaultSize: true,
						disabled: ! canSave,
						isBusy: isSaving,
						type: 'submit',
						variant: 'primary',
					},
					__( 'Save' )
				)
			)
		)
	);
}

function CreateTemplateModal( { isSaving, onClose, onCreate, saveError } ) {
	const [ title, setTitle ] = useState( '' );
	const [ validationError, setValidationError ] = useState( '' );
	const canCreate = title.trim().length > 0;
	const submit = ( event ) => {
		event.preventDefault();

		if ( ! canCreate ) {
			setValidationError( __( 'Enter a template name.' ) );
			return;
		}

		setValidationError( '' );
		onCreate( {
			title: title.trim(),
		} );
	};

	return el(
		Modal,
		{
			className: 'routes-template-list__create-modal',
			onRequestClose: () => {
				if ( ! isSaving ) {
					onClose();
				}
			},
			title: __( 'Add a layout' ),
		},
		el(
			'form',
			{
				className: 'routes-template-list__create-form',
				onSubmit: submit,
			},
			el( InputControl, {
				autoComplete: 'off',
				disabled: isSaving,
				label: __( 'Name' ),
				onValueChange: ( value ) => {
					setTitle( value );
					setValidationError( '' );
				},
				value: title,
			} ),
			( validationError || saveError ) &&
				el(
					Notice,
					{
						isDismissible: false,
						status: 'error',
					},
					validationError || saveError
				),
			el(
				'div',
				{ className: 'routes-template-list__create-actions' },
				el(
					Button,
					{
						__next40pxDefaultSize: true,
						disabled: isSaving,
						onClick: onClose,
						variant: 'tertiary',
					},
					__( 'Cancel' )
				),
				el(
					Button,
					{
						__next40pxDefaultSize: true,
						disabled: isSaving || ! canCreate,
						isBusy: isSaving,
						type: 'submit',
						variant: 'primary',
					},
					__( 'Add' )
				)
			)
		)
	);
}

function TemplatesDataViewsLayout() {
	return el(
		'div',
		{ className: 'routes-template-list__dataviews' },
		el(
			'div',
			{ className: 'routes-template-list__dataviews-toolbar' },
			el(
				'div',
				{
					className: 'routes-template-list__dataviews-toolbar-start',
				},
				el( DataViews.Search ),
				el( DataViews.FiltersToggle )
			),
			el(
				'div',
				{ className: 'routes-template-list__dataviews-toolbar-end' },
				el( DataViews.LayoutSwitcher ),
				el( DataViews.ViewConfig )
			)
		),
		el( DataViews.Filters, {
			className: 'routes-template-list__dataviews-filters',
		} ),
		el(
			'div',
			{ className: 'routes-template-list__dataviews-scroll' },
			el( DataViews.BulkActionToolbar ),
			el( DataViews.Layout ),
			el( DataViews.Pagination )
		)
	);
}

function useTemplatesData() {
	return useSelect( ( select ) => {
		const store = select( coreDataStore );
		const args = [ 'postType', 'wp_template', TEMPLATE_QUERY ];
		const templates = store.getEntityRecords( ...args ) || EMPTY_ARRAY;
		const error = store.getResolutionError?.( 'getEntityRecords', args );

		return {
			error: error ? getErrorMessage( error ) : null,
			isLoading:
				store.isResolving( 'getEntityRecords', args ) ||
				! store.hasFinishedResolution( 'getEntityRecords', args ),
			templates,
		};
	}, [] );
}

function getSelectedTemplateIdFromSearch() {
	const params = getSearchParams();

	return (
		getSearchValue( params.getAll( 'postIds[]' ) ) ||
		params.get( 'postId' ) ||
		getSearchValue( params.getAll( 'templateIds[]' ) ) ||
		params.get( 'templateId' )
	);
}

function TemplatesStage() {
	const navigate = useNavigate();
	const { invalidateResolution, saveEntityRecord } =
		useDispatch( coreDataStore );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );
	const { error, isLoading, templates } = useTemplatesData();
	const [ view, setView ] = useState( DEFAULT_TEMPLATE_VIEW );
	const [ selectedTemplateId, setSelectedTemplateId ] = useState(
		getSelectedTemplateIdFromSearch()
	);
	const [ isCreateModalOpen, setIsCreateModalOpen ] = useState( false );
	const [ isCreatingTemplate, setIsCreatingTemplate ] = useState( false );
	const [ createTemplateError, setCreateTemplateError ] = useState( '' );
	const [ templateToRename, setTemplateToRename ] = useState( null );
	const [ renameTitle, setRenameTitle ] = useState( '' );
	const [ isRenamingTemplate, setIsRenamingTemplate ] = useState( false );
	const [ renameTemplateError, setRenameTemplateError ] = useState( '' );
	const canCreateTemplates = useSelect(
		( select ) =>
			select( coreDataStore ).canUser?.( 'create', {
				kind: 'postType',
				name: 'wp_template',
			} ),
		[]
	);
	const fields = useMemo( () => getTemplateFields(), [] );
	const openRenameModal = ( template ) => {
		setRenameTemplateError( '' );
		setRenameTitle( getTitleText( template?.title ) );
		setTemplateToRename( template );
	};
	const closeRenameModal = () => {
		if ( ! isRenamingTemplate ) {
			setRenameTemplateError( '' );
			setTemplateToRename( null );
		}
	};
	const renameTemplate = async () => {
		const title = renameTitle.trim();

		if ( ! templateToRename?.id || ! title ) {
			return;
		}

		setIsRenamingTemplate( true );
		setRenameTemplateError( '' );

		try {
			await saveEntityRecord(
				'postType',
				'wp_template',
				{
					id: templateToRename.id,
					title,
				},
				{ throwOnError: true }
			);
			invalidateResolution?.( 'getEntityRecords', [
				'postType',
				'wp_template',
				TEMPLATE_QUERY,
			] );
			setTemplateToRename( null );
			createSuccessNotice( __( 'Layout renamed.' ), {
				type: 'snackbar',
			} );
		} catch ( saveError ) {
			const message = getErrorMessage( saveError );
			setRenameTemplateError( message );
			createErrorNotice(
				sprintf(
					/* translators: %s: error message. */
					__( 'Unable to rename layout (%s).' ),
					message
				),
				{ type: 'snackbar' }
			);
		} finally {
			setIsRenamingTemplate( false );
		}
	};
	const actions = useMemo(
		() => getTemplateActions( navigate, openRenameModal ),
		[ navigate ]
	);
	const totalPages = Math.max(
		1,
		Math.ceil( templates.length / ( view.perPage || 20 ) )
	);
	const selectedTemplate =
		templates.find(
			( template ) =>
				String( template.id ) === String( selectedTemplateId )
		) || templates[ 0 ];
	const selection = selectedTemplate?.id
		? [ String( selectedTemplate.id ) ]
		: [];
	const selectTemplate = ( templateId ) => {
		setSelectedTemplateId( templateId );
		navigate( {
			search: {
				postId: templateId ? String( templateId ) : undefined,
			},
			to: '/templates',
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
			},
			to: '/templates',
		} );
	};
	const openCreateModal = () => {
		setCreateTemplateError( '' );
		setIsCreateModalOpen( true );
	};
	const closeCreateModal = () => {
		if ( ! isCreatingTemplate ) {
			setCreateTemplateError( '' );
			setIsCreateModalOpen( false );
		}
	};
	const createTemplate = async ( { title } ) => {
		const uniqueTitle = getUniqueTemplateTitle( title, templates );
		const record = {
			content: '',
			slug: getCleanTemplateSlug( uniqueTitle ),
			title: uniqueTitle,
		};

		setIsCreatingTemplate( true );
		setCreateTemplateError( '' );

		try {
			const template = await saveEntityRecord(
				'postType',
				'wp_template',
				record,
				{ throwOnError: true }
			);
			const templateId = getTemplateRecordId( template );

			invalidateResolution?.( 'getEntityRecords', [
				'postType',
				'wp_template',
				TEMPLATE_QUERY,
			] );
			setIsCreateModalOpen( false );
			navigate( {
				search: {
					postId: templateId,
				},
				to: '/wp_template',
			} );
		} catch ( saveError ) {
			setCreateTemplateError( getErrorMessage( saveError ) );
		} finally {
			setIsCreatingTemplate( false );
		}
	};
	const pageActions =
		canCreateTemplates !== false &&
		el(
			'div',
			{ className: 'routes-template-list__page-actions' },
			el(
				Button,
				{
					__next40pxDefaultSize: true,
					icon: plusIcon,
					onClick: openCreateModal,
					variant: 'primary',
				},
				__( 'Add layout' )
			)
		);
	const empty = el(
		'div',
		{ className: 'cnl-editor-empty-state' },
		el(
			EmptyState.Root,
			null,
			el( EmptyState.Icon, { icon: layoutIcon } ),
			el( EmptyState.Title, null, __( 'No templates found' ) ),
			el(
				EmptyState.Description,
				null,
				__(
					'Templates will appear here when the active theme or site defines them.'
				)
			)
		)
	);

	return el(
		Page,
		{
			actions: pageActions,
			className: 'cnl-editor-stage routes-template-list',
			hasPadding: false,
			headingLevel: 2,
			subTitle: getStaticScreen().description,
			title: getStaticScreen().title,
		},
		error && el( 'div', { className: 'cnl-editor-empty' }, error ),
		el(
			DataViews,
			{
				actions,
				data: templates,
				defaultLayouts: DEFAULT_TEMPLATE_LAYOUTS,
				empty,
				fields,
				getItemId: ( item ) => String( item.id ),
				isLoading,
				onChangeSelection: ( items ) => selectTemplate( items[ 0 ] ),
				onChangeView,
				onClickItem: ( item ) => selectTemplate( item.id ),
				paginationInfo: {
					totalItems: templates.length,
					totalPages,
				},
				selection,
				view,
			},
			el( TemplatesDataViewsLayout )
		),
		isCreateModalOpen &&
			el( CreateTemplateModal, {
				isSaving: isCreatingTemplate,
				onClose: closeCreateModal,
				onCreate: createTemplate,
				saveError: createTemplateError,
			} ),
		templateToRename &&
			el( RenameTemplateModal, {
				isSaving: isRenamingTemplate,
				key: 'rename-template-modal',
				onChangeTitle: setRenameTitle,
				onClose: closeRenameModal,
				onSave: renameTemplate,
				saveError: renameTemplateError,
				templateTitle: getTitleText( templateToRename.title ),
				title: renameTitle,
			} )
	);
}

function TemplatesCanvas() {
	const navigate = useNavigate();
	const { isLoading, templates } = useTemplatesData();
	const selectedTemplateId = getSelectedTemplateIdFromSearch();
	const selectedTemplate =
		templates.find(
			( template ) =>
				String( template.id ) === String( selectedTemplateId )
		) || templates[ 0 ];
	let canvasContent = el(
		'div',
		{ className: 'cnl-editor-canvas-placeholder' },
		el( 'span', {
			'aria-hidden': true,
			className:
				'cnl-editor-canvas-placeholder__icon dashicons dashicons-media-document',
		} ),
		el(
			'h2',
			{
				className: 'cnl-editor-canvas-placeholder__title',
			},
			__( 'No layout selected' )
		),
		el(
			'p',
			{
				className: 'cnl-editor-canvas-placeholder__description',
			},
			__( 'Pick a layout to see how it arranges a page.' )
		)
	);

	if ( selectedTemplate ) {
		canvasContent = el(
			'div',
			{ className: 'routes-template-list__canvas-preview' },
			el( LazyEditorPreview, {
				content: selectedTemplate?.content?.raw,
				description: getTitleText( selectedTemplate.title ),
			} )
		);
	}

	if ( isLoading ) {
		canvasContent = el(
			'div',
			{ className: 'cnl-editor-spinner' },
			el( Spinner )
		);
	}

	return el(
		'section',
		{ className: 'cnl-editor-canvas' },
		el(
			'header',
			{ className: 'cnl-editor-canvas__toolbar' },
			el(
				'div',
				null,
				el(
					'div',
					{ className: 'cnl-editor-canvas__label' },
					selectedTemplate
						? getTemplateDisplayTitle( selectedTemplate )
						: __( 'Layouts' )
				),
				el(
					'div',
					{ className: 'cnl-editor-canvas__status' },
					selectedTemplate
						? getTemplateStatusLabel( selectedTemplate )
						: __( 'Advanced' )
				)
			),
			el(
				'div',
				{ className: 'cnl-editor-canvas__actions' },
				selectedTemplate?.id &&
					el(
						Button,
						{
							onClick: () =>
								navigate( {
									search: {
										postId: selectedTemplate.id,
									},
									to: '/wp_template',
								} ),
							variant: 'primary',
						},
						__( 'Edit' )
					)
			)
		),
		el(
			'div',
			{ className: 'cnl-editor-canvas__frame-wrap' },
			canvasContent
		)
	);
}

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
	return el(
		'div',
		{
			className: 'cnl-editor-dataviews-preview',
		},
		el( LazyEditorPreview, {
			content: item?.content?.raw,
			description: getTitleText( item?.title ),
		} )
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
			render: ( { item } ) =>
				el(
					'span',
					{ className: 'cnl-editor-dataviews-title' },
					getTitleText( item.title )
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

	return el(
		Modal,
		{
			className: 'routes-template-part-list__create-modal',
			onRequestClose: () => {
				if ( ! isSaving ) {
					onClose();
				}
			},
			title: __( 'Add a site part' ),
		},
		el(
			'form',
			{
				className: 'routes-template-part-list__create-form',
				onSubmit: submit,
			},
			el( InputControl, {
				autoComplete: 'off',
				disabled: isSaving,
				label: __( 'Name' ),
				onValueChange: ( value ) => {
					setTitle( value );
					setValidationError( '' );
				},
				value: title,
			} ),
			el( SelectControl, {
				__next40pxDefaultSize: true,
				__nextHasNoMarginBottom: true,
				disabled: isSaving,
				label: __( 'Area' ),
				onChange: setArea,
				options: TEMPLATE_PART_CREATE_AREAS.map( ( option ) => ( {
					label: getTemplatePartCreateAreaLabel( option.value ),
					value: option.value,
				} ) ),
				value: area,
			} ),
			( validationError || saveError ) &&
				el(
					Notice,
					{
						isDismissible: false,
						status: 'error',
					},
					validationError || saveError
				),
			el(
				'div',
				{ className: 'routes-template-part-list__create-actions' },
				el(
					Button,
					{
						__next40pxDefaultSize: true,
						disabled: isSaving,
						onClick: onClose,
						variant: 'tertiary',
					},
					__( 'Cancel' )
				),
				el(
					Button,
					{
						__next40pxDefaultSize: true,
						disabled: isSaving || ! canCreate,
						isBusy: isSaving,
						type: 'submit',
						variant: 'primary',
					},
					__( 'Add' )
				)
			)
		)
	);
}

function TemplatePartsDataViewsLayout() {
	return el(
		'div',
		{ className: 'routes-template-part-list__dataviews' },
		el(
			'div',
			{ className: 'routes-template-part-list__dataviews-toolbar' },
			el(
				'div',
				{
					className:
						'routes-template-part-list__dataviews-toolbar-start',
				},
				el( DataViews.Search ),
				el( DataViews.FiltersToggle )
			),
			el(
				'div',
				{
					className:
						'routes-template-part-list__dataviews-toolbar-end',
				},
				el( DataViews.LayoutSwitcher ),
				el( DataViews.ViewConfig )
			)
		),
		el( DataViews.Filters, {
			className: 'routes-template-part-list__dataviews-filters',
		} ),
		el(
			'div',
			{ className: 'routes-template-part-list__dataviews-scroll' },
			el( DataViews.BulkActionToolbar ),
			el( DataViews.Layout ),
			el( DataViews.Pagination )
		)
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

function TemplatePartsStage() {
	const navigate = useNavigate();
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
	const totalPages = Math.max(
		1,
		Math.ceil( visibleTemplateParts.length / ( view.perPage || 20 ) )
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
	const pageActions =
		canCreateTemplateParts !== false &&
		el(
			'div',
			{ className: 'routes-template-part-list__page-actions' },
			el(
				Button,
				{
					__next40pxDefaultSize: true,
					icon: plusIcon,
					onClick: openCreateModal,
					variant: 'primary',
				},
				__( 'Add site part' )
			)
		);
	const empty = el(
		'div',
		{ className: 'cnl-editor-empty-state' },
		el(
			EmptyState.Root,
			null,
			el( EmptyState.Icon, { icon: layoutIcon } ),
			el( EmptyState.Title, null, __( 'No site parts found' ) ),
			el(
				EmptyState.Description,
				null,
				activeArea === 'all'
					? __(
							'Template parts will appear here when the active theme or site defines reusable structural areas.'
						)
					: sprintf(
							/* translators: %s: template part area label. */
							__( 'No template parts are available for %s.' ),
							getTemplatePartAreaLabel( activeArea ).toLowerCase()
						)
			)
		)
	);

	return el(
		Page,
		{
			actions: pageActions,
			className: 'cnl-editor-stage routes-template-part-list',
			hasPadding: false,
			headingLevel: 2,
			subTitle: getStaticScreen().description,
			title: getStaticScreen().title,
		},
		el(
			'div',
			{ className: 'routes-template-part-list__tabs-wrapper' },
			el(
				Tabs.Root,
				{
					onValueChange: selectArea,
					value: activeArea,
				},
				el(
					Tabs.List,
					null,
					TEMPLATE_PART_AREAS.map( ( area ) =>
						el(
							Tabs.Tab,
							{
								key: area.value,
								value: area.value,
							},
							area.label
						)
					)
				)
			)
		),
		error && el( 'div', { className: 'cnl-editor-empty' }, error ),
		el(
			DataViews,
			{
				actions,
				data: visibleTemplateParts,
				defaultLayouts: DEFAULT_TEMPLATE_LAYOUTS,
				empty,
				fields,
				getItemId: ( item ) => String( item.id ),
				isLoading,
				onChangeSelection: ( items ) =>
					selectTemplatePart( items[ 0 ] ),
				onChangeView,
				onClickItem: ( item ) => selectTemplatePart( item.id ),
				paginationInfo: {
					totalItems: visibleTemplateParts.length,
					totalPages,
				},
				selection,
				view,
			},
			el( TemplatePartsDataViewsLayout )
		),
		isCreateModalOpen &&
			el( CreateTemplatePartModal, {
				defaultArea:
					activeArea === 'all' ? 'uncategorized' : activeArea,
				isSaving: isCreatingTemplatePart,
				onClose: closeCreateModal,
				onCreate: createTemplatePart,
				saveError: createTemplatePartError,
			} )
	);
}

function TemplatePartsCanvas() {
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
	let canvasContent = el(
		'div',
		{ className: 'cnl-editor-canvas-placeholder' },
		el( 'span', {
			'aria-hidden': true,
			className:
				'cnl-editor-canvas-placeholder__icon dashicons dashicons-schedule',
		} ),
		el(
			'h2',
			{
				className: 'cnl-editor-canvas-placeholder__title',
			},
			__( 'No site part selected' )
		),
		el(
			'p',
			{
				className: 'cnl-editor-canvas-placeholder__description',
			},
			__( 'Pick a site part, like your header, to preview it.' )
		)
	);

	if ( selectedTemplatePart ) {
		canvasContent = el(
			'div',
			{ className: 'routes-template-part-list__canvas-preview' },
			el( LazyEditorPreview, {
				content: selectedTemplatePart?.content?.raw,
				description: getTitleText( selectedTemplatePart.title ),
			} )
		);
	}

	if ( isLoading ) {
		canvasContent = el(
			'div',
			{ className: 'cnl-editor-spinner' },
			el( Spinner )
		);
	}

	return el(
		'section',
		{ className: 'cnl-editor-canvas' },
		el(
			'header',
			{ className: 'cnl-editor-canvas__toolbar' },
			el(
				'div',
				null,
				el(
					'div',
					{ className: 'cnl-editor-canvas__label' },
					selectedTemplatePart
						? getTitleText( selectedTemplatePart.title )
						: __( 'Site parts' )
				),
				el(
					'div',
					{ className: 'cnl-editor-canvas__status' },
					selectedTemplatePart
						? getTemplatePartAreaLabel( selectedTemplatePart.area )
						: __( 'Advanced' )
				)
			),
			el(
				'div',
				{ className: 'cnl-editor-canvas__actions' },
				selectedTemplatePart?.id &&
					el(
						Button,
						{
							onClick: () =>
								navigate( {
									search: {
										postId: selectedTemplatePart.id,
									},
									to: '/wp_template_part',
								} ),
							variant: 'primary',
						},
						__( 'Edit template part' )
					)
			)
		),
		el(
			'div',
			{ className: 'cnl-editor-canvas__frame-wrap' },
			canvasContent
		)
	);
}

function decodeText( value, fallback = '' ) {
	const element = document.createElement( 'textarea' );
	element.innerHTML = String( value || '' )
		.replace( /<[^>]+>/g, '' )
		.trim();
	return element.value || fallback;
}

function getPatternTitle( pattern ) {
	return decodeText( pattern?.title, __( 'Untitled pattern' ) );
}

function getPatternDescription( pattern ) {
	return decodeText( pattern?.description || '' );
}

function getPatternSyncStatusLabel( syncStatus ) {
	if ( syncStatus === PATTERN_SYNC_STATUS.unsynced ) {
		return __( 'Not synced' );
	}

	return __( 'Synced' );
}

function getPatternTypeLabel( type ) {
	if ( type === PATTERN_TYPES.user ) {
		return __( 'Saved by you' );
	}

	return __( 'From your theme' );
}

function getUserPatternCategorySlugs( pattern, userCategories ) {
	if ( ! Array.isArray( pattern?.wp_pattern_category ) ) {
		return EMPTY_ARRAY;
	}

	return pattern.wp_pattern_category
		.map(
			( categoryId ) =>
				userCategories.find(
					( category ) =>
						Number( category.id ) === Number( categoryId )
				)?.name
		)
		.filter( Boolean );
}

function getPatternCategoryLabels( pattern, categoryMap ) {
	const categories = pattern?.categories || EMPTY_ARRAY;

	if ( ! categories.length ) {
		return __( 'Uncategorized' );
	}

	return categories
		.map( ( category ) => categoryMap.get( category ) || category )
		.join( ', ' );
}

function normalizeThemePattern( pattern ) {
	return {
		categories: pattern?.categories || EMPTY_ARRAY,
		content: pattern?.content || '',
		description: pattern?.description || '',
		id: `theme:${ pattern?.name || pattern?.title }`,
		keywords: pattern?.keywords || EMPTY_ARRAY,
		name: pattern?.name,
		syncStatus: PATTERN_SYNC_STATUS.unsynced,
		title: pattern?.title || pattern?.name || __( 'Untitled pattern' ),
		type: PATTERN_TYPES.theme,
		viewportWidth: pattern?.viewportWidth,
	};
}

function normalizeUserPattern( pattern, userCategories ) {
	return {
		categories: getUserPatternCategorySlugs( pattern, userCategories ),
		content:
			typeof pattern?.content === 'string'
				? pattern.content
				: pattern?.content?.raw || '',
		description:
			typeof pattern?.excerpt === 'string'
				? pattern.excerpt
				: pattern?.excerpt?.raw || pattern?.description || '',
		id: `user:${ pattern?.id }`,
		keywords: EMPTY_ARRAY,
		name: pattern?.name || String( pattern?.id || '' ),
		recordId: pattern?.id,
		syncStatus: pattern?.wp_pattern_sync_status || PATTERN_SYNC_STATUS.full,
		title:
			typeof pattern?.title === 'string'
				? pattern.title
				: pattern?.title?.raw ||
					pattern?.title?.rendered ||
					__( 'Untitled pattern' ),
		type: PATTERN_TYPES.user,
	};
}

function getPatternsForTab( patterns, activeTab ) {
	if ( activeTab === 'my-patterns' ) {
		return patterns.filter(
			( pattern ) => pattern.type === PATTERN_TYPES.user
		);
	}

	if ( activeTab === 'registered' ) {
		return patterns.filter(
			( pattern ) => pattern.type === PATTERN_TYPES.theme
		);
	}

	return patterns;
}

const MAX_CATEGORY_CHIPS = 10;

/**
 * The most common kinds of section, for quick filtering.
 *
 * @param {Object[]} patterns    Patterns in the current tab.
 * @param {Map}      categoryMap Category labels keyed by slug.
 * @return {Object[]} Chips with a value and a label.
 */
function getPatternCategoryChips( patterns, categoryMap ) {
	const counts = new Map();

	patterns.forEach( ( pattern ) =>
		( pattern.categories || EMPTY_ARRAY ).forEach( ( category ) =>
			counts.set( category, ( counts.get( category ) || 0 ) + 1 )
		)
	);

	return [ ...counts.entries() ]
		.sort( ( [ , first ], [ , second ] ) => second - first )
		.slice( 0, MAX_CATEGORY_CHIPS )
		.map( ( [ value ] ) => ( {
			label: categoryMap.get( value ) || value,
			value,
		} ) )
		.sort( ( first, second ) => first.label.localeCompare( second.label ) );
}

function PatternCategoryChips( { chips, onChange, value } ) {
	if ( chips.length < 2 ) {
		return null;
	}

	return el(
		'div',
		{
			'aria-label': __( 'Kinds of section' ),
			className: 'routes-pattern-list__categories',
			role: 'group',
		},
		[ { label: __( 'Everything' ), value: 'all' }, ...chips ].map(
			( chip ) =>
				el(
					Button,
					{
						'aria-pressed': value === chip.value,
						className: 'routes-pattern-list__category',
						key: chip.value,
						onClick: () => onChange( chip.value ),
						size: 'compact',
						variant: 'secondary',
					},
					chip.label
				)
		)
	);
}

function renderPatternPreview( { item } ) {
	return el(
		'div',
		{
			className: 'cnl-editor-dataviews-preview',
		},
		el( LazyEditorPreview, {
			content: item.content,
			description: getPatternTitle( item ),
			viewportWidth: item.viewportWidth,
		} )
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
			render: ( { item } ) =>
				el(
					'span',
					{ className: 'cnl-editor-dataviews-title' },
					getPatternTitle( item )
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

function getPatternActions( navigate ) {
	return [
		{
			callback: ( items ) => {
				const item = items[ 0 ];

				if ( item?.recordId ) {
					navigate( {
						to: `/types/wp_block/edit/${ item.recordId }`,
					} );
				}
			},
			id: 'edit-pattern',
			isEligible: ( item ) => item?.type === PATTERN_TYPES.user,
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

	return el(
		Modal,
		{
			className: 'routes-pattern-list__create-modal',
			onRequestClose: () => {
				if ( ! isSaving ) {
					onClose();
				}
			},
			title: __( 'Add a section' ),
		},
		el(
			'form',
			{
				className: 'routes-pattern-list__create-form',
				onSubmit: submit,
			},
			el( InputControl, {
				autoComplete: 'off',
				disabled: isSaving,
				label: __( 'Name' ),
				onValueChange: ( value ) => {
					setTitle( value );
					setValidationError( '' );
				},
				placeholder: __( 'Customer reviews' ),
				value: title,
			} ),
			el( SelectControl, {
				__next40pxDefaultSize: true,
				__nextHasNoMarginBottom: true,
				disabled: isSaving,
				label: __( 'When you edit it later' ),
				onChange: setSyncStatus,
				options: [
					{
						label: __( 'Update it everywhere it is used' ),
						value: PATTERN_SYNC_STATUS.full,
					},
					{
						label: __( 'Let each copy be changed on its own' ),
						value: PATTERN_SYNC_STATUS.unsynced,
					},
				],
				value: syncStatus,
			} ),
			( validationError || saveError ) &&
				el(
					Notice,
					{
						isDismissible: false,
						status: 'error',
					},
					validationError || saveError
				),
			el(
				'div',
				{ className: 'routes-pattern-list__create-actions' },
				el(
					Button,
					{
						__next40pxDefaultSize: true,
						disabled: isSaving,
						onClick: onClose,
						variant: 'tertiary',
					},
					__( 'Cancel' )
				),
				el(
					Button,
					{
						__next40pxDefaultSize: true,
						disabled: isSaving || ! canCreate,
						isBusy: isSaving,
						type: 'submit',
						variant: 'primary',
					},
					__( 'Add' )
				)
			)
		)
	);
}

function PatternsDataViewsLayout() {
	return el(
		'div',
		{ className: 'routes-pattern-list__dataviews' },
		el(
			'div',
			{ className: 'routes-pattern-list__dataviews-toolbar' },
			el(
				'div',
				{
					className: 'routes-pattern-list__dataviews-toolbar-start',
				},
				el( DataViews.Search ),
				el( DataViews.FiltersToggle )
			),
			el(
				'div',
				{ className: 'routes-pattern-list__dataviews-toolbar-end' },
				el( DataViews.LayoutSwitcher ),
				el( DataViews.ViewConfig )
			)
		),
		el( DataViews.Filters, {
			className: 'routes-pattern-list__dataviews-filters',
		} ),
		el(
			'div',
			{ className: 'routes-pattern-list__dataviews-scroll' },
			el( DataViews.BulkActionToolbar ),
			el( DataViews.Layout ),
			el( DataViews.Pagination )
		)
	);
}

function usePatternsData() {
	return useSelect( ( select ) => {
		const store = select( coreDataStore );
		const userPatternArgs = [ 'postType', 'wp_block', USER_PATTERN_QUERY ];
		const themePatterns = store.getBlockPatterns?.() || EMPTY_ARRAY;
		const userPatterns =
			store.getEntityRecords( ...userPatternArgs ) || EMPTY_ARRAY;
		const blockCategories =
			store.getBlockPatternCategories?.() || EMPTY_ARRAY;
		const userCategories =
			store.getUserPatternCategories?.() || EMPTY_ARRAY;
		const categoryMap = new Map();

		[ ...blockCategories, ...userCategories ].forEach( ( category ) => {
			if ( category?.name && ! categoryMap.has( category.name ) ) {
				categoryMap.set(
					category.name,
					category.label || category.name
				);
			}
		} );

		return {
			categoryMap,
			error: store.getResolutionError?.(
				'getEntityRecords',
				userPatternArgs
			)
				? getErrorMessage(
						store.getResolutionError?.(
							'getEntityRecords',
							userPatternArgs
						)
					)
				: null,
			isLoading:
				Boolean( store.isResolving?.( 'getBlockPatterns', [] ) ) ||
				store.isResolving( 'getEntityRecords', userPatternArgs ) ||
				! store.hasFinishedResolution(
					'getEntityRecords',
					userPatternArgs
				),
			patterns: [
				...userPatterns.map( ( pattern ) =>
					normalizeUserPattern( pattern, userCategories )
				),
				...themePatterns
					.filter( ( pattern ) => pattern?.inserter !== false )
					.map( normalizeThemePattern ),
			],
		};
	}, [] );
}

function getPatternTabFromSearch() {
	return getSearchParams().get( 'type' ) || 'all';
}

function getSelectedPatternIdFromSearch() {
	return getSearchParams().get( 'patternId' );
}

function PatternsStage() {
	const navigate = useNavigate();
	const { invalidateResolution, saveEntityRecord } =
		useDispatch( coreDataStore );
	const { categoryMap, error, isLoading, patterns } = usePatternsData();
	const [ view, setView ] = useState( DEFAULT_PATTERN_VIEW );
	const [ activeTab, setActiveTab ] = useState( getPatternTabFromSearch() );
	const [ selectedPatternId, setSelectedPatternId ] = useState(
		getSelectedPatternIdFromSearch()
	);
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
		setSelectedPatternId( null );
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
	const totalPages = Math.max(
		1,
		Math.ceil( visiblePatterns.length / ( view.perPage || 20 ) )
	);
	const selectedPattern =
		visiblePatterns.find(
			( pattern ) => pattern.id === selectedPatternId
		) || visiblePatterns[ 0 ];
	const selection = selectedPattern?.id ? [ selectedPattern.id ] : [];
	const selectPattern = ( patternId ) => {
		setSelectedPatternId( patternId );
		navigate( {
			search: {
				patternId: patternId || undefined,
				type: activeTab === 'all' ? undefined : activeTab,
			},
			to: '/patterns',
		} );
	};
	const selectTab = ( nextTab ) => {
		setActiveTab( nextTab );
		setActiveCategory( 'all' );
		setSelectedPatternId( null );
		setView( ( currentView ) => ( {
			...currentView,
			page: 1,
		} ) );
		navigate( {
			search: {
				patternId: undefined,
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
				patternId: selectedPattern?.id,
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
	const pageActions =
		canCreatePatterns !== false &&
		el(
			'div',
			{ className: 'routes-pattern-list__page-actions' },
			el(
				Button,
				{
					__next40pxDefaultSize: true,
					icon: plusIcon,
					onClick: openCreateModal,
					variant: 'primary',
				},
				__( 'Add section' )
			)
		);
	const empty = el(
		'div',
		{ className: 'cnl-editor-empty-state' },
		el(
			EmptyState.Root,
			null,
			el( EmptyState.Icon, { icon: layoutIcon } ),
			el( EmptyState.Title, null, __( 'No sections found' ) ),
			el(
				EmptyState.Description,
				null,
				__(
					'Patterns will appear here when the active theme or site defines reusable designs.'
				)
			)
		)
	);

	return el(
		Page,
		{
			actions: pageActions,
			className: 'cnl-editor-stage routes-pattern-list',
			hasPadding: false,
			headingLevel: 2,
			subTitle: getStaticScreen().description,
			title: getStaticScreen().title,
		},
		el(
			'div',
			{ className: 'routes-pattern-list__tabs-wrapper' },
			el(
				Tabs.Root,
				{
					onValueChange: selectTab,
					value: activeTab,
				},
				el(
					Tabs.List,
					null,
					PATTERN_TABS.map( ( tab ) =>
						el(
							Tabs.Tab,
							{
								key: tab.value,
								value: tab.value,
							},
							tab.label
						)
					)
				)
			)
		),
		el( PatternCategoryChips, {
			chips: categoryChips,
			onChange: selectCategory,
			value: activeCategory,
		} ),
		error && el( 'div', { className: 'cnl-editor-empty' }, error ),
		el(
			DataViews,
			{
				actions,
				data: visiblePatterns,
				defaultLayouts: DEFAULT_TEMPLATE_LAYOUTS,
				empty,
				fields,
				getItemId: ( item ) => item.id,
				isLoading,
				onChangeSelection: ( items ) => selectPattern( items[ 0 ] ),
				onChangeView,
				onClickItem: ( item ) => selectPattern( item.id ),
				paginationInfo: {
					totalItems: visiblePatterns.length,
					totalPages,
				},
				selection,
				view,
			},
			el( PatternsDataViewsLayout )
		),
		isCreateModalOpen &&
			el( CreatePatternModal, {
				isSaving: isCreatingPattern,
				onClose: closeCreateModal,
				onCreate: createPattern,
				saveError: createPatternError,
			} )
	);
}

function PatternsCanvas() {
	const navigate = useNavigate();
	const { isLoading, patterns } = usePatternsData();
	const activeTab = getPatternTabFromSearch();
	const visiblePatterns = getPatternsForTab( patterns, activeTab );
	const selectedPatternId = getSelectedPatternIdFromSearch();
	const selectedPattern =
		visiblePatterns.find(
			( pattern ) => pattern.id === selectedPatternId
		) || visiblePatterns[ 0 ];
	let canvasContent = el(
		'div',
		{ className: 'cnl-editor-canvas-placeholder' },
		el( 'span', {
			'aria-hidden': true,
			className:
				'cnl-editor-canvas-placeholder__icon dashicons dashicons-layout',
		} ),
		el(
			'h2',
			{
				className: 'cnl-editor-canvas-placeholder__title',
			},
			__( 'No section selected' )
		),
		el(
			'p',
			{
				className: 'cnl-editor-canvas-placeholder__description',
			},
			__( 'Pick a section to preview it.' )
		)
	);

	if ( selectedPattern ) {
		canvasContent = el(
			'div',
			{ className: 'routes-pattern-list__canvas-preview' },
			el( LazyEditorPreview, {
				content: selectedPattern.content,
				description: getPatternTitle( selectedPattern ),
				viewportWidth: selectedPattern.viewportWidth,
			} )
		);
	}

	if ( isLoading ) {
		canvasContent = el(
			'div',
			{ className: 'cnl-editor-spinner' },
			el( Spinner )
		);
	}

	return el(
		'section',
		{ className: 'cnl-editor-canvas' },
		el(
			'header',
			{ className: 'cnl-editor-canvas__toolbar' },
			el(
				'div',
				null,
				el(
					'div',
					{ className: 'cnl-editor-canvas__label' },
					selectedPattern
						? getPatternTitle( selectedPattern )
						: __( 'Sections' )
				),
				el(
					'div',
					{ className: 'cnl-editor-canvas__status' },
					selectedPattern
						? getPatternTypeLabel( selectedPattern.type )
						: __( 'Advanced' )
				)
			),
			el(
				'div',
				{ className: 'cnl-editor-canvas__actions' },
				selectedPattern?.recordId &&
					el(
						Button,
						{
							onClick: () =>
								navigate( {
									to: `/types/wp_block/edit/${ selectedPattern.recordId }`,
								} ),
							variant: 'primary',
						},
						__( 'Edit pattern' )
					)
			)
		),
		el(
			'div',
			{ className: 'cnl-editor-canvas__frame-wrap' },
			canvasContent
		)
	);
}

function Stage() {
	if ( getCurrentEditorPath() === '/patterns' ) {
		return el( PatternsStage );
	}

	if ( getCurrentEditorPath() === '/template-parts' ) {
		return el( TemplatePartsStage );
	}

	if ( getCurrentEditorPath() === '/templates' ) {
		return el( TemplatesStage );
	}

	if ( getCurrentEditorPath() === '/styles' ) {
		return el( StylesStage );
	}

	if ( getCurrentEditorPath() === '/colors' ) {
		return el( ColorsStage );
	}

	if ( getCurrentEditorPath() === '/fonts' ) {
		return el( FontsStage );
	}

	if ( getCurrentEditorPath() === '/identity' ) {
		return el( SiteIdentityStage );
	}

	const screen = getStaticScreen();

	return el(
		'div',
		{ className: 'cnl-editor-stage' },
		el(
			'div',
			{ className: 'cnl-editor-stage__header' },
			el( 'span', {
				'aria-hidden': true,
				className: `dashicons ${ screen.icon }`,
			} ),
			el(
				'div',
				null,
				el( 'h1', null, screen.title ),
				el( 'p', null, screen.description )
			)
		)
	);
}

function Canvas() {
	if ( getCurrentEditorPath() === '/patterns' ) {
		return el( PatternsCanvas );
	}

	if ( getCurrentEditorPath() === '/template-parts' ) {
		return el( TemplatePartsCanvas );
	}

	if ( getCurrentEditorPath() === '/templates' ) {
		return el( TemplatesCanvas );
	}

	if (
		getCurrentEditorPath() === '/styles' ||
		getCurrentEditorPath() === '/colors' ||
		getCurrentEditorPath() === '/fonts'
	) {
		return el( StylesCanvas );
	}

	if ( getCurrentEditorPath() === '/identity' ) {
		return el( SiteIdentityCanvas );
	}

	const screen = getStaticScreen();

	return el(
		'section',
		{ className: 'cnl-editor-canvas' },
		el(
			'header',
			{ className: 'cnl-editor-canvas__toolbar' },
			el(
				'div',
				null,
				el(
					'div',
					{ className: 'cnl-editor-canvas__label' },
					screen.title
				),
				el(
					'div',
					{ className: 'cnl-editor-canvas__status' },
					screen.section
				)
			)
		),
		el(
			'div',
			{ className: 'cnl-editor-canvas__frame-wrap' },
			el(
				'div',
				{ className: 'cnl-editor-canvas-placeholder' },
				el( 'span', {
					'aria-hidden': true,
					className: `cnl-editor-canvas-placeholder__icon dashicons ${ screen.icon }`,
				} ),
				el(
					'h2',
					{ className: 'cnl-editor-canvas-placeholder__title' },
					screen.title
				),
				el(
					'p',
					{ className: 'cnl-editor-canvas-placeholder__description' },
					screen.description
				),
				el(
					'div',
					{
						className: 'cnl-editor-canvas-placeholder__meta',
					},
					screen.status
				)
			)
		)
	);
}

export const stage = withUiTheme( Stage );
export const canvas = withUiTheme( Canvas );
