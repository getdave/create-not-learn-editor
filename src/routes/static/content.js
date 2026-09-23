/**
 * WordPress dependencies
 */
import { Preview as LazyEditorPreview } from '@wordpress/lazy-editor';
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getCurrentEditorPath, getStaticScreen } from './screens';
import {
	cnlEditorStore,
	getErrorMessage,
	getTemplateAuthorText,
	getTitleText,
} from '../../records';
import { addPreviewArgs, settings as appSettings } from '../../settings';
import {
	Button,
	coreDataStore,
	DataViews,
	EmptyState,
	InputControl,
	layoutIcon,
	MediaUpload,
	Modal,
	Notice,
	Page,
	plusIcon,
	seenIcon,
	SelectControl,
	Spinner,
	sprintf,
	Tabs,
	__,
	el,
	useDispatch,
	useEffect,
	useMemo,
	useRef,
	useSelect,
	useState,
} from '../../wordpress-packages';

const SITE_IDENTITY_CHANGED_EVENT = 'cnl-editor-site-identity-changed';
const STYLES_PREVIEW_CHANGED_EVENT = 'cnl-editor-styles-preview-changed';
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
	fields: [ 'description', 'author', 'status', 'slug' ],
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
	fields: [ 'area', 'author', 'slug' ],
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
const DEFAULT_PATTERN_VIEW = {
	fields: [ 'category', 'sync-status', 'type' ],
	filters: [],
	layout: {
		badgeFields: [ 'sync-status' ],
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
		label: __( 'All patterns' ),
		value: 'all',
	},
	{
		label: __( 'My patterns' ),
		value: 'my-patterns',
	},
	{
		label: __( 'Registered' ),
		value: 'registered',
	},
];
const TEMPLATE_PART_AREAS = [
	{
		label: __( 'All Template Parts' ),
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

function updateSearchParams( updates ) {
	const params = getSearchParams();

	Object.entries( updates ).forEach( ( [ key, value ] ) => {
		if ( value === undefined || value === null || value === '' ) {
			params.delete( key );
			return;
		}

		params.set( key, value );
	} );

	window.history.replaceState(
		null,
		'',
		`${ window.location.pathname }?${ params }`
	);
}

function getSearchValue( value ) {
	if ( Array.isArray( value ) ) {
		return value[ 0 ];
	}

	return value;
}

function useSiteIdentity() {
	const { invalidateSiteSettings, saveSiteSettings } =
		useDispatch( cnlEditorStore );
	const { error, isLoading, isSaving, settings } = useSelect( ( select ) => {
		const store = select( cnlEditorStore );

		return {
			error: store.getSiteSettingsError(),
			isLoading:
				store.isFetchingSiteSettings() ||
				! store.hasFinishedResolution( 'getSiteSettings', [] ),
			isSaving: store.isSavingSiteSettings(),
			settings: store.getSiteSettings(),
		};
	}, [] );
	const [ draft, setDraft ] = useState( {
		description: '',
		siteIcon: null,
		siteLogo: 0,
		title: '',
	} );
	const [ selectedMedia, setSelectedMedia ] = useState( {
		siteIcon: null,
		siteLogo: null,
	} );
	const [ saveNotice, setSaveNotice ] = useState( null );
	const hasLocalEdits = useRef( false );
	const dirtyMediaFields = useRef( new Set() );

	useEffect( () => {
		const refreshSettings = () => invalidateSiteSettings();

		window.addEventListener( SITE_IDENTITY_CHANGED_EVENT, refreshSettings );

		return () => {
			window.removeEventListener(
				SITE_IDENTITY_CHANGED_EVENT,
				refreshSettings
			);
		};
	}, [ invalidateSiteSettings ] );

	useEffect( () => {
		if ( ! settings || hasLocalEdits.current ) {
			return;
		}

		setDraft( {
			description: settings.description || '',
			siteIcon: settings.site_icon || null,
			siteLogo: settings.site_logo || 0,
			title: settings.title || '',
		} );
	}, [ settings ] );

	const updateDraft = ( key, value ) => {
		hasLocalEdits.current = true;
		setDraft( ( currentDraft ) => ( {
			...currentDraft,
			[ key ]: value,
		} ) );
		setSaveNotice( null );
	};

	const updateMediaDraft = ( key, media ) => {
		updateDraft( key, media?.id || ( 'siteLogo' === key ? 0 : null ) );
		dirtyMediaFields.current.add( key );
		setSelectedMedia( ( currentMedia ) => ( {
			...currentMedia,
			[ key ]: media || null,
		} ) );
	};

	const save = () => {
		setSaveNotice( null );

		const payload = {
			description: draft.description,
			title: draft.title,
		};

		if ( dirtyMediaFields.current.has( 'siteIcon' ) ) {
			payload.site_icon = draft.siteIcon || 0;
		}

		if ( dirtyMediaFields.current.has( 'siteLogo' ) ) {
			payload.site_logo = draft.siteLogo || 0;
		}

		saveSiteSettings( payload )
			.then( ( result ) => {
				const nextSettings = result || draft;
				hasLocalEdits.current = false;
				dirtyMediaFields.current.clear();
				setDraft( {
					description: nextSettings.description || '',
					siteIcon: nextSettings.site_icon || null,
					siteLogo: nextSettings.site_logo || 0,
					title: nextSettings.title || '',
				} );
				setSelectedMedia( {
					siteIcon: null,
					siteLogo: null,
				} );
				setSaveNotice( __( 'Site identity saved.' ) );
				window.dispatchEvent(
					new CustomEvent( SITE_IDENTITY_CHANGED_EVENT )
				);
			} )
			.catch( () => {} );
	};

	return {
		draft,
		error: error ? getErrorMessage( error ) : null,
		isLoading,
		isSaving,
		save,
		saveNotice,
		selectedMedia,
		settings,
		updateDraft,
		updateMediaDraft,
	};
}

function getMediaUrl( media ) {
	return (
		media?.media_details?.sizes?.medium?.source_url ||
		media?.media_details?.sizes?.thumbnail?.source_url ||
		media?.source_url ||
		media?.url ||
		''
	);
}

function useMediaRecord( mediaId ) {
	return useSelect(
		( select ) => {
			if ( ! mediaId ) {
				return {
					isLoading: false,
					media: null,
				};
			}

			const args = [ 'root', 'media', mediaId ];
			const store = select( coreDataStore );

			return {
				isLoading:
					store.isResolving( 'getEntityRecord', args ) ||
					! store.hasFinishedResolution( 'getEntityRecord', args ),
				media: store.getEntityRecord( ...args ),
			};
		},
		[ mediaId ]
	);
}

function SiteMediaSetting( {
	description,
	imageClassName = '',
	label,
	onChange,
	selectedMedia = null,
	value,
} ) {
	const { isLoading, media } = useMediaRecord( value );
	const imageUrl = getMediaUrl( selectedMedia ) || getMediaUrl( media );

	return el(
		'div',
		{ className: 'cnl-editor-identity-media' },
		el(
			'div',
			{ className: 'cnl-editor-identity-media__preview' },
			imageUrl
				? el( 'img', {
						alt: '',
						className: imageClassName,
						src: imageUrl,
					} )
				: el(
						'div',
						{
							'aria-hidden': true,
							className: 'cnl-editor-identity-media__placeholder',
						},
						isLoading ? el( Spinner ) : label.charAt( 0 )
					)
		),
		el(
			'div',
			{ className: 'cnl-editor-identity-media__details' },
			el( 'h3', null, label ),
			el( 'p', null, description ),
			el(
				'div',
				{ className: 'cnl-editor-identity-media__actions' },
				el( MediaUpload, {
					allowedTypes: [ 'image' ],
					multiple: false,
					onSelect: onChange,
					render: ( { open } ) =>
						el(
							Button,
							{
								onClick: open,
								variant: value ? 'secondary' : 'primary',
							},
							value ? __( 'Replace' ) : __( 'Choose image' )
						),
					value: value || undefined,
				} ),
				Boolean( value ) &&
					el(
						Button,
						{
							onClick: () => onChange( null ),
							variant: 'tertiary',
						},
						__( 'Remove' )
					)
			)
		)
	);
}

function SiteIdentityStage() {
	const {
		draft,
		error,
		isLoading,
		isSaving,
		save,
		saveNotice,
		selectedMedia,
		updateDraft,
		updateMediaDraft,
	} = useSiteIdentity();

	return el(
		'div',
		{ className: 'cnl-editor-stage' },
		el(
			'div',
			{ className: 'cnl-editor-stage__header' },
			el( 'span', {
				'aria-hidden': true,
				className: 'dashicons dashicons-id',
			} ),
			el(
				'div',
				null,
				el( 'h1', null, __( 'Site Identity' ) ),
				el(
					'p',
					null,
					__(
						'Manage the name and tagline visitors see across the site.'
					)
				)
			)
		),
		el(
			'div',
			{ className: 'cnl-editor-panel cnl-editor-identity-form' },
			isLoading &&
				el( 'div', { className: 'cnl-editor-spinner' }, el( Spinner ) ),
			! isLoading &&
				el(
					'div',
					{ className: 'cnl-editor-identity-form__fields' },
					el( InputControl, {
						label: __( 'Site Title' ),
						onValueChange: ( value ) =>
							updateDraft( 'title', value ),
						value: draft.title,
					} ),
					el( InputControl, {
						label: __( 'Site Tagline' ),
						onValueChange: ( value ) =>
							updateDraft( 'description', value ),
						value: draft.description,
					} ),
					el( SiteMediaSetting, {
						description: __(
							'Appears in templates and places where the site brand is shown.'
						),
						label: __( 'Site Logo' ),
						onChange: ( media ) =>
							updateMediaDraft( 'siteLogo', media ),
						selectedMedia: selectedMedia.siteLogo,
						value: draft.siteLogo,
					} ),
					el( SiteMediaSetting, {
						description: __(
							'Appears in browser tabs, bookmarks, and app surfaces.'
						),
						imageClassName:
							'cnl-editor-identity-media__image--icon',
						label: __( 'Site Icon' ),
						onChange: ( media ) =>
							updateMediaDraft( 'siteIcon', media ),
						selectedMedia: selectedMedia.siteIcon,
						value: draft.siteIcon,
					} ),
					el(
						Button,
						{
							isBusy: isSaving,
							onClick: save,
							variant: 'primary',
						},
						__( 'Save identity' )
					)
				),
			error &&
				el(
					Notice,
					{
						className: 'cnl-editor-panel__notice',
						isDismissible: false,
						status: 'error',
					},
					error
				),
			saveNotice &&
				el(
					Notice,
					{
						className: 'cnl-editor-panel__notice',
						isDismissible: false,
						status: 'success',
					},
					saveNotice
				)
		)
	);
}

function SiteIdentityCanvas() {
	const { isLoading, settings } = useSiteIdentity();
	const title = settings?.title || __( 'Site title' );
	const tagline = settings?.description || __( 'Site tagline' );
	const { isLoading: isLogoLoading, media: logoMedia } = useMediaRecord(
		settings?.site_logo
	);
	const { isLoading: isIconLoading, media: iconMedia } = useMediaRecord(
		settings?.site_icon
	);
	const logoUrl = getMediaUrl( logoMedia );
	const iconUrl = getMediaUrl( iconMedia );

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
					__( 'Site Identity' )
				),
				el(
					'div',
					{ className: 'cnl-editor-canvas__status' },
					__( 'Design' )
				)
			)
		),
		el(
			'div',
			{ className: 'cnl-editor-canvas__frame-wrap' },
			isLoading || isLogoLoading || isIconLoading
				? el(
						'div',
						{ className: 'cnl-editor-spinner' },
						el( Spinner )
					)
				: el(
						'div',
						{ className: 'cnl-editor-identity-preview' },
						el(
							'div',
							{
								'aria-hidden': true,
								className: 'cnl-editor-identity-preview__mark',
							},
							iconUrl
								? el( 'img', {
										alt: '',
										className:
											'cnl-editor-identity-preview__icon',
										src: iconUrl,
									} )
								: title.charAt( 0 ).toUpperCase()
						),
						logoUrl &&
							el( 'img', {
								alt: '',
								className: 'cnl-editor-identity-preview__logo',
								src: logoUrl,
							} ),
						el(
							'h2',
							{
								className: 'cnl-editor-identity-preview__title',
							},
							title
						),
						el(
							'p',
							{
								className:
									'cnl-editor-identity-preview__tagline',
							},
							tagline
						)
					)
		)
	);
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

function getTemplateActions( navigate ) {
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
			label: __( 'Edit template' ),
			supportsBulk: false,
		},
	];
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
			title: __( 'Add new template' ),
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
	const { error, isLoading, templates } = useTemplatesData();
	const [ view, setView ] = useState( DEFAULT_TEMPLATE_VIEW );
	const [ selectedTemplateId, setSelectedTemplateId ] = useState(
		getSelectedTemplateIdFromSearch()
	);
	const [ isCreateModalOpen, setIsCreateModalOpen ] = useState( false );
	const [ isCreatingTemplate, setIsCreatingTemplate ] = useState( false );
	const [ createTemplateError, setCreateTemplateError ] = useState( '' );
	const canCreateTemplates = useSelect(
		( select ) =>
			select( coreDataStore ).canUser?.( 'create', {
				kind: 'postType',
				name: 'wp_template',
			} ),
		[]
	);
	const fields = useMemo( () => getTemplateFields(), [] );
	const actions = useMemo(
		() => getTemplateActions( navigate ),
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
				__( 'Add New Template' )
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
			subTitle: __(
				'Templates control the structure used by pages, posts, archives, and other site views.'
			),
			title: __( 'Templates' ),
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
			__( 'No template selected' )
		),
		el(
			'p',
			{
				className: 'cnl-editor-canvas-placeholder__description',
			},
			__( 'Select a template to preview its structure.' )
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
						? getTitleText( selectedTemplate.title )
						: __( 'Templates' )
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
			label: __( 'Area' ),
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
			label: __( 'Edit template part' ),
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
			title: __( 'Add new template part' ),
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
				__( 'Add New Template Part' )
			)
		);
	const empty = el(
		'div',
		{ className: 'cnl-editor-empty-state' },
		el(
			EmptyState.Root,
			null,
			el( EmptyState.Icon, { icon: layoutIcon } ),
			el( EmptyState.Title, null, __( 'No template parts found' ) ),
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
			subTitle: __(
				'Template parts are reusable structural areas like headers, footers, sidebars, and overlays.'
			),
			title: __( 'Template Parts' ),
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
			__( 'No template part selected' )
		),
		el(
			'p',
			{
				className: 'cnl-editor-canvas-placeholder__description',
			},
			__( 'Select a template part to preview its structure.' )
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
						: __( 'Template Parts' )
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
		return __( 'My pattern' );
	}

	return __( 'Registered' );
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
			label: __( 'Edit pattern' ),
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
			title: __( 'Add new pattern' ),
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
				placeholder: __( 'My pattern' ),
				value: title,
			} ),
			el( SelectControl, {
				__next40pxDefaultSize: true,
				__nextHasNoMarginBottom: true,
				disabled: isSaving,
				label: __( 'Syncing' ),
				onChange: setSyncStatus,
				options: [
					{
						label: __( 'Synced' ),
						value: PATTERN_SYNC_STATUS.full,
					},
					{
						label: __( 'Not synced' ),
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
	const visiblePatterns = useMemo(
		() => getPatternsForTab( patterns, activeTab ),
		[ activeTab, patterns ]
	);
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
				__( 'Add New Pattern' )
			)
		);
	const empty = el(
		'div',
		{ className: 'cnl-editor-empty-state' },
		el(
			EmptyState.Root,
			null,
			el( EmptyState.Icon, { icon: layoutIcon } ),
			el( EmptyState.Title, null, __( 'No patterns found' ) ),
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
			subTitle: __(
				'Reusable design elements for your site. Create once, use everywhere.'
			),
			title: __( 'Patterns' ),
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
			__( 'No pattern selected' )
		),
		el(
			'p',
			{
				className: 'cnl-editor-canvas-placeholder__description',
			},
			__( 'Select a pattern to preview its reusable design.' )
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
						: __( 'Patterns' )
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

function getStyleVariationTitle( variation, index = 0 ) {
	const title = variation?.title;

	if ( typeof title === 'string' ) {
		return title;
	}

	return (
		title?.rendered ||
		title?.raw ||
		variation?.name ||
		sprintf(
			/* translators: %d: Style variation number. */
			__( 'Style %d' ),
			index + 1
		)
	);
}

function getStyleVariationPalette( variation ) {
	return (
		variation?.settings?.color?.palette?.theme ||
		variation?.settings?.color?.palette?.default ||
		EMPTY_ARRAY
	);
}

function getStyleVariationFontFamilies( variation ) {
	return (
		variation?.settings?.typography?.fontFamilies?.theme ||
		variation?.settings?.typography?.fontFamilies?.default ||
		EMPTY_ARRAY
	);
}

function getStyleVariationTextColor( variation ) {
	return variation?.styles?.color?.text || '#1d2327';
}

function getStyleVariationBackgroundColor( variation ) {
	return variation?.styles?.color?.background || '#ffffff';
}

function getPreviewStylesConfig( editedGlobalStyles, baseStyles, variations ) {
	const config =
		editedGlobalStyles?.styles || editedGlobalStyles?.settings
			? editedGlobalStyles
			: variations?.[ 0 ] || baseStyles || {};

	return {
		settings: config?.settings || {},
		styles: config?.styles || {},
		title: getStyleVariationTitle( config, 0 ),
	};
}

function useStylesData() {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const {
		baseStyles,
		editedGlobalStyles,
		globalStylesId,
		isLoading,
		theme,
		variations,
	} = useSelect( ( select ) => {
		const store = select( coreDataStore );
		const currentTheme = store.getCurrentTheme?.();
		const currentGlobalStylesId =
			store.__experimentalGetCurrentGlobalStylesId?.();
		const globalStylesRecord = currentGlobalStylesId
			? store.getEditedEntityRecord(
					'root',
					'globalStyles',
					currentGlobalStylesId
				)
			: null;
		const themeBaseStyles =
			store.__experimentalGetCurrentThemeBaseGlobalStyles?.();
		const styleVariations =
			store.__experimentalGetCurrentThemeGlobalStylesVariations?.() ||
			EMPTY_ARRAY;
		const globalStylesArgs = currentGlobalStylesId
			? [ 'root', 'globalStyles', currentGlobalStylesId ]
			: null;

		return {
			baseStyles: themeBaseStyles,
			editedGlobalStyles: globalStylesRecord,
			globalStylesId: currentGlobalStylesId,
			isLoading:
				store.isResolving( 'getCurrentTheme', [] ) ||
				store.isResolving(
					'__experimentalGetCurrentGlobalStylesId',
					[]
				) ||
				store.isResolving(
					'__experimentalGetCurrentThemeBaseGlobalStyles',
					[]
				) ||
				store.isResolving(
					'__experimentalGetCurrentThemeGlobalStylesVariations',
					[]
				) ||
				( Boolean( globalStylesArgs ) &&
					store.isResolving( 'getEntityRecord', globalStylesArgs ) ),
			theme: currentTheme,
			variations: styleVariations,
		};
	}, [] );
	const [ notice, setNotice ] = useState( '' );
	const [ error, setError ] = useState( '' );

	const applyVariation = ( variation, index ) => {
		if ( ! globalStylesId ) {
			setError(
				__( 'The current global styles record is not available.' )
			);
			return;
		}

		setNotice( '' );
		setError( '' );
		editEntityRecord( 'root', 'globalStyles', globalStylesId, {
			settings: variation?.settings || {},
			styles: variation?.styles || {},
		} );
		setNotice(
			sprintf(
				/* translators: %s: Style variation name. */
				__(
					'%s selected. Review and save changes when you are ready.'
				),
				getStyleVariationTitle( variation, index )
			)
		);
	};

	return {
		applyVariation,
		baseStyles,
		editedGlobalStyles,
		error,
		isLoading,
		notice,
		theme,
		variations,
	};
}

function StyleVariationCard( { index, onApply, variation } ) {
	const palette = getStyleVariationPalette( variation );
	const fontFamilies = getStyleVariationFontFamilies( variation );
	const title = getStyleVariationTitle( variation, index );

	return el(
		'section',
		{ className: 'routes-styles__variation-card' },
		el(
			'div',
			{
				className: 'routes-styles__variation-preview',
				style: {
					background: getStyleVariationBackgroundColor( variation ),
					color: getStyleVariationTextColor( variation ),
				},
			},
			el(
				'div',
				{ className: 'routes-styles__swatches' },
				palette.slice( 0, 6 ).map( ( color, colorIndex ) =>
					el( 'span', {
						'aria-hidden': true,
						className: 'routes-styles__swatch',
						key: color.slug || color.color || colorIndex,
						style: { background: color.color || color.slug },
					} )
				)
			),
			el( 'h2', null, title ),
			el(
				'p',
				null,
				fontFamilies[ 0 ]?.name ||
					fontFamilies[ 0 ]?.fontFamily ||
					__( 'Theme typography' )
			)
		),
		el(
			Button,
			{
				onClick: () => onApply( variation, index ),
				variant: 'secondary',
			},
			__( 'Apply styles' )
		)
	);
}

function StylesStage() {
	const { applyVariation, error, isLoading, notice, theme, variations } =
		useStylesData();
	const [ isStyleBookOpened, setIsStyleBookOpened ] = useState(
		getSearchParams().get( 'preview' ) === 'stylebook'
	);
	const themeName = theme?.name?.rendered || theme?.name;
	const toggleStyleBook = () => {
		const nextValue = ! isStyleBookOpened;
		setIsStyleBookOpened( nextValue );
		updateSearchParams( {
			preview: nextValue ? 'stylebook' : undefined,
		} );
		window.dispatchEvent( new CustomEvent( STYLES_PREVIEW_CHANGED_EVENT ) );
	};

	return el(
		'div',
		{ className: 'cnl-editor-stage routes-styles' },
		el(
			'div',
			{ className: 'cnl-editor-stage__header routes-styles__header' },
			el( 'span', {
				'aria-hidden': true,
				className: 'dashicons dashicons-admin-appearance',
			} ),
			el(
				'div',
				null,
				el( 'h1', null, __( 'Styles' ) ),
				el(
					'p',
					null,
					themeName
						? sprintf(
								/* translators: %s: Theme name. */
								__( 'Manage the visual language for %s.' ),
								themeName
							)
						: __( 'Manage the visual language of the site.' )
				)
			),
			el( Button, {
				icon: seenIcon,
				isPressed: isStyleBookOpened,
				label: __( 'Style Book' ),
				onClick: toggleStyleBook,
				variant: 'secondary',
			} )
		),
		notice &&
			el(
				Notice,
				{
					className: 'cnl-editor-panel__notice',
					isDismissible: false,
					status: 'success',
				},
				notice
			),
		error &&
			el(
				Notice,
				{
					className: 'cnl-editor-panel__notice',
					isDismissible: false,
					status: 'error',
				},
				error
			),
		isLoading &&
			el( 'div', { className: 'cnl-editor-spinner' }, el( Spinner ) ),
		! isLoading &&
			el(
				'div',
				{ className: 'routes-styles__section' },
				el( 'h2', null, __( 'Style variations' ) ),
				el(
					'p',
					null,
					__(
						'Choose a visual foundation for colors, typography, and block defaults.'
					)
				),
				variations.length > 0
					? el(
							'div',
							{ className: 'routes-styles__variation-grid' },
							variations.map( ( variation, index ) =>
								el( StyleVariationCard, {
									index,
									key: `${
										variation.slug ||
										getStyleVariationTitle(
											variation,
											index
										)
									}-${ index }`,
									onApply: applyVariation,
									variation,
								} )
							)
						)
					: el(
							'div',
							{ className: 'cnl-editor-empty' },
							__(
								'No style variations are available for this theme.'
							)
						)
			)
	);
}

function StyleBookPreview( { config } ) {
	const palette = getStyleVariationPalette( config );
	const fontFamilies = getStyleVariationFontFamilies( config );

	return el(
		'div',
		{
			className: 'routes-styles-preview routes-styles-preview--stylebook',
			style: {
				background: getStyleVariationBackgroundColor( config ),
				color: getStyleVariationTextColor( config ),
			},
		},
		el( 'span', null, __( 'Style Book' ) ),
		el( 'h2', null, __( 'Typography, colors, and blocks' ) ),
		el(
			'p',
			null,
			__(
				'Preview your website’s visual identity across common elements.'
			)
		),
		el(
			'div',
			{ className: 'routes-styles-preview__samples' },
			el(
				'section',
				null,
				el( 'h3', null, __( 'Heading' ) ),
				el(
					'p',
					null,
					fontFamilies[ 0 ]?.name ||
						fontFamilies[ 0 ]?.fontFamily ||
						__( 'Theme typography' )
				)
			),
			el(
				'section',
				null,
				el( 'h3', null, __( 'Paragraph' ) ),
				el(
					'p',
					null,
					__(
						'This sample shows how body copy, spacing, and color work together.'
					)
				)
			),
			el(
				'section',
				null,
				el( 'h3', null, __( 'Button' ) ),
				el( Button, { variant: 'primary' }, __( 'Sample action' ) )
			)
		),
		el(
			'div',
			{ className: 'routes-styles-preview__palette' },
			palette.slice( 0, 8 ).map( ( color, index ) =>
				el(
					'div',
					{ key: color.slug || color.color || index },
					el( 'span', {
						'aria-hidden': true,
						className: 'routes-styles__swatch',
						style: { background: color.color || color.slug },
					} ),
					el( 'small', null, color.name || color.slug )
				)
			)
		)
	);
}

function StylesCanvas() {
	const { baseStyles, editedGlobalStyles, isLoading, variations } =
		useStylesData();
	const [ isStyleBookOpened, setIsStyleBookOpened ] = useState(
		getSearchParams().get( 'preview' ) === 'stylebook'
	);
	const previewConfig = useMemo(
		() =>
			getPreviewStylesConfig(
				editedGlobalStyles,
				baseStyles,
				variations
			),
		[ baseStyles, editedGlobalStyles, variations ]
	);

	useEffect( () => {
		const updatePreviewMode = () =>
			setIsStyleBookOpened(
				getSearchParams().get( 'preview' ) === 'stylebook'
			);

		window.addEventListener(
			STYLES_PREVIEW_CHANGED_EVENT,
			updatePreviewMode
		);

		return () => {
			window.removeEventListener(
				STYLES_PREVIEW_CHANGED_EVENT,
				updatePreviewMode
			);
		};
	}, [] );

	let canvasContent = el( 'iframe', {
		className: 'cnl-editor-canvas__frame',
		src: addPreviewArgs( appSettings.homeUrl ),
		title: __( 'Site preview' ),
	} );

	if ( isStyleBookOpened ) {
		canvasContent = el( StyleBookPreview, { config: previewConfig } );
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
					__( 'Styles' )
				),
				el(
					'div',
					{ className: 'cnl-editor-canvas__status' },
					isStyleBookOpened ? __( 'Style Book' ) : __( 'Preview' )
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

	if ( getCurrentEditorPath() === '/styles' ) {
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

export { Stage as stage, Canvas as canvas };
