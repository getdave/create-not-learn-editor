import { useNavigate, useParams, useSearch } from '@wordpress/route';
import { Preview as LazyEditorPreview } from '@wordpress/lazy-editor';

/**
 * Internal dependencies
 */
import { getPostType, settings } from '../../settings';
import {
	getErrorMessage,
	getTemplateAuthorText,
	getTitleText,
} from '../../records';
import {
	EMPTY_ARRAY,
	OTHER_PAGE_LAYOUT_TYPE,
	PAGE_LAYOUTS_PER_PAGE,
	getPageLayoutGroups,
	getPatternContent,
	getPatternDescription,
	getPatternPreviewContent,
	getPatternPreviewContentWithTitle,
	getPatternTitle,
	getPreviewContent,
	getPreviewTemplateForPost,
	getSelectedTemplateContent,
	isPageLayoutPattern,
} from './page-layouts';
import {
	Button,
	CheckboxControl,
	chevronLeftIcon,
	chevronRightIcon,
	coreDataStore,
	DataViews,
	DropdownMenu,
	EmptyState,
	Icon,
	infoIcon,
	InputControl,
	MenuItem,
	Modal,
	Notice,
	plusIcon,
	Popover,
	SelectControl,
	Spinner,
	Tabs,
	__,
	el,
	layoutIcon,
	moreVerticalIcon,
	pageIcon,
	postListIcon,
	Page,
	parseBlocks,
	sprintf,
	serialize,
	useEffect,
	useDispatch,
	useMemo,
	useSelect,
	useState,
} from '../../wordpress-packages';

const DEFAULT_CONTENT_VIEW = {
	fields: [ 'author', 'status', 'date' ],
	filters: [],
	layout: {
		previewSize: 160,
	},
	mediaField: 'content-preview',
	page: 1,
	perPage: 20,
	search: '',
	sort: {
		direction: 'desc',
		field: 'date',
	},
	titleField: 'title',
	type: 'grid',
};

const DEFAULT_CONTENT_LAYOUTS = {
	grid: {
		showMedia: true,
	},
	list: true,
	table: {
		layout: {
			styles: {
				author: {
					align: 'start',
				},
			},
		},
	},
};

const STATUS_OPTIONS = [
	{ label: __( 'Published' ), value: 'publish' },
	{ label: __( 'Draft' ), value: 'draft' },
	{ label: __( 'Scheduled' ), value: 'future' },
	{ label: __( 'Pending review' ), value: 'pending' },
	{ label: __( 'Private' ), value: 'private' },
];

const POST_QUERY_FIELDS =
	'id,author,link,title,status,type,date,modified,date_gmt,modified_gmt,content,template,slug';

const TEMPLATE_QUERY = {
	context: 'edit',
	per_page: 100,
	_fields:
		'id,slug,title,description,source,author,theme,type,status,content',
};

const PAGE_TITLE_PREVIEW_DEBOUNCE_MS = 700;

function getActiveTab( searchParams ) {
	return searchParams.content === 'templates' ? 'templates' : 'content';
}

function getPostQuery( search ) {
	return {
		context: 'edit',
		per_page: 20,
		search: search || undefined,
		_fields: POST_QUERY_FIELDS,
		status: 'publish,draft,pending,private,future',
	};
}

function getSearchValue( value ) {
	if ( Array.isArray( value ) ) {
		return value[ 0 ];
	}

	return value;
}

function getStatusLabel( status ) {
	switch ( status ) {
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
		default:
			return status || __( 'Unknown' );
	}
}

function getDateLabel( post ) {
	const date = post?.date || post?.modified;

	if ( ! date ) {
		return __( 'No date' );
	}

	const prefix =
		post.status === 'publish' ? __( 'Published' ) : __( 'Modified' );
	const formatted = new Date( date ).toLocaleString( undefined, {
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		month: 'short',
		year: 'numeric',
	} );

	return sprintf(
		/* translators: 1: date prefix, 2: formatted date. */
		__( '%1$s: %2$s' ),
		prefix,
		formatted
	);
}

function getTemplateTitle( template ) {
	if ( template?.slug === 'home' ) {
		return __( 'Posts Listing' );
	}

	if ( template?.slug === 'single' ) {
		return __( 'Single Post' );
	}

	return getTitleText( template?.title ) || __( 'Untitled template' );
}

function getCanvasLabel( {
	selectedPost,
	selectedTemplate,
	showTemplates,
	type,
} ) {
	if ( showTemplates ) {
		return selectedTemplate
			? getTemplateTitle( selectedTemplate )
			: __( 'Template' );
	}

	return selectedPost
		? getTitleText( selectedPost.title )
		: type.singular || type.label;
}

function getCanvasDescription( {
	selectedPost,
	selectedTemplate,
	showTemplates,
	type,
} ) {
	if ( showTemplates ) {
		if ( selectedTemplate ) {
			return (
				selectedTemplate.description ||
				__( 'Template preview placeholder.' )
			);
		}

		return sprintf(
			/* translators: %s: post type label. */
			__( 'Select a template used by %s.' ),
			( type.label || type.name ).toLowerCase()
		);
	}

	if ( selectedPost ) {
		return sprintf(
			/* translators: 1: post type label, 2: post status. */
			__( '%1$s preview placeholder. Status: %2$s.' ),
			type.singular || type.label,
			selectedPost.status
		);
	}

	return sprintf(
		/* translators: %s: post type label. */
		__( 'Select %s from the list to populate this canvas.' ),
		( type.label || type.name ).toLowerCase()
	);
}

function getCanvasIconClass( { showTemplates, type } ) {
	if ( showTemplates ) {
		return 'dashicons-layout';
	}

	return type.name === 'page'
		? 'dashicons-admin-page'
		: 'dashicons-admin-post';
}

function getInitialContentView( searchParams ) {
	return {
		...DEFAULT_CONTENT_VIEW,
		page: searchParams.page ? Number( searchParams.page ) || 1 : 1,
		search: searchParams.search || '',
	};
}

function normalizeTemplateText( value ) {
	const rendered = value?.rendered || value?.raw || value || '';
	const element = document.createElement( 'textarea' );
	element.innerHTML = String( rendered )
		.replace( /<[^>]+>/g, '' )
		.trim();
	return element.value;
}

function templateMatchesPostType( template, typeName ) {
	if ( ! template || ! typeName ) {
		return false;
	}

	const slug = template.slug || '';

	if ( typeName === 'page' ) {
		return (
			slug === 'front-page' ||
			slug === 'page' ||
			slug.startsWith( 'page-' )
		);
	}

	if ( typeName === 'post' ) {
		return [ 'home', 'single', 'single-post' ].includes( slug );
	}

	const text = [
		slug,
		normalizeTemplateText( template.title ),
		template.description,
	]
		.join( ' ' )
		.toLowerCase();

	return (
		slug === `single-${ typeName }` ||
		slug === `archive-${ typeName }` ||
		text.includes( typeName.toLowerCase() )
	);
}

function getTemplateDescription( template ) {
	return template?.description || '';
}

function TemplateDescriptionInfo( { description } ) {
	const [ isOpen, setIsOpen ] = useState( false );

	if ( ! description ) {
		return null;
	}

	return el(
		'span',
		{ className: 'routes-post-list__template-card-info' },
		el( Button, {
			'aria-expanded': isOpen,
			icon: infoIcon,
			label: __( 'Template description' ),
			onClick: ( event ) => {
				event.stopPropagation();
				setIsOpen( ( open ) => ! open );
			},
			size: 'small',
		} ),
		isOpen &&
			el(
				Popover,
				{
					className: 'routes-post-list__template-card-info-popover',
					focusOnMount: 'container',
					onClose: () => setIsOpen( false ),
					placement: 'right-start',
					resize: false,
					shift: true,
				},
				el(
					'span',
					{
						className:
							'routes-post-list__template-card-info-content',
					},
					description
				)
			)
	);
}

function getTemplateStatusLabel( template ) {
	if ( template?.slug === 'page' || template?.slug === 'front-page' ) {
		return __( 'Default' );
	}

	if ( template?.status === 'publish' ) {
		return __( 'Active' );
	}

	return getStatusLabel( template?.status );
}

function renderContentPreview( { item }, templates ) {
	const template = getPreviewTemplateForPost( item, templates, settings );
	const content = getPreviewContent( item, template );
	const description = getTitleText( item.title );

	return el(
		'div',
		{
			className: 'cnl-editor-dataviews-preview',
		},
		el( LazyEditorPreview, {
			content,
			description,
		} )
	);
}

function getContentFields( templates ) {
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
			enableSorting: false,
			filterBy: false,
			getValue: ( { item } ) => item.author || '',
			id: 'author',
			label: __( 'Author' ),
			render: ( { item } ) =>
				sprintf(
					/* translators: %s: author ID. */
					__( 'Author ID %s' ),
					item.author || __( 'Unknown' )
				),
			type: 'integer',
		},
		{
			elements: STATUS_OPTIONS,
			enableSorting: false,
			filterBy: {
				operators: [ 'isAny' ],
			},
			getValue: ( { item } ) => getStatusLabel( item.status ),
			id: 'status',
			label: __( 'Status' ),
			type: 'text',
		},
		{
			getValue: ( { item } ) => item.date || item.modified || '',
			id: 'date',
			label: __( 'Date' ),
			render: ( { item } ) => getDateLabel( item ),
			type: 'datetime',
		},
		{
			enableHiding: false,
			enableSorting: false,
			filterBy: false,
			id: 'content-preview',
			label: __( 'Content preview' ),
			render: ( props ) => renderContentPreview( props, templates ),
			type: 'media',
		},
	];
}

function getContentActions( navigate, type ) {
	return [
		{
			callback: ( items ) => {
				const item = items[ 0 ];
				if ( item?.id ) {
					navigate( {
						to: `/types/${ type.name }/edit/${ item.id }`,
					} );
				}
			},
			id: 'edit',
			isPrimary: true,
			label: __( 'Edit' ),
			supportsBulk: false,
		},
		{
			callback: ( items ) => {
				const item = items[ 0 ];
				if ( item?.link ) {
					window.open( item.link, '_blank', 'noopener,noreferrer' );
				}
			},
			id: 'open-preview',
			isEligible: ( item ) => !! item.link,
			label: __( 'Open preview' ),
			supportsBulk: false,
		},
	];
}

function getPageTemplateOptions( templates ) {
	return [
		{
			label: __( 'Default template' ),
			value: '',
		},
		...templates
			.filter( ( template ) => !! template.content?.raw )
			.filter( ( template ) => template.slug !== 'page' )
			.map( ( template ) => ( {
				label: getTemplateTitle( template ),
				value: template.slug || String( template.id ),
			} ) ),
	];
}

function usePageLayoutPatterns() {
	return useSelect( ( select ) => {
		const store = select( coreDataStore );
		const patterns = store.getBlockPatterns?.() || EMPTY_ARRAY;

		return {
			isResolving: store.isResolving?.( 'getBlockPatterns' ) || false,
			patterns: patterns.filter( isPageLayoutPattern ),
		};
	}, [] );
}

function PageLayoutPreviewPlaceholder() {
	return el(
		'div',
		{ className: 'cnl-add-page-layout-placeholder' },
		el( 'div', { className: 'cnl-add-page-layout-placeholder__brand' } ),
		el( 'div', { className: 'cnl-add-page-layout-placeholder__title' } ),
		el( 'div', { className: 'cnl-add-page-layout-placeholder__line' } ),
		el( 'div', { className: 'cnl-add-page-layout-placeholder__line' } ),
		el( 'div', { className: 'cnl-add-page-layout-placeholder__media' } )
	);
}

function PageLayoutSidebarPlaceholder() {
	return el(
		'div',
		{
			'aria-hidden': true,
			className: 'cnl-add-page-layout-categories-placeholder',
		},
		[ 0, 1, 2, 3, 4, 5 ].map( ( index ) =>
			el(
				'div',
				{
					className:
						'cnl-add-page-layout-categories-placeholder__item',
					key: index,
				},
				el( 'span', {
					className:
						'cnl-add-page-layout-categories-placeholder__label',
				} ),
				el( 'span', {
					className:
						'cnl-add-page-layout-categories-placeholder__count',
				} )
			)
		)
	);
}

function PageLayoutResultsPlaceholder() {
	return el(
		'div',
		{
			'aria-hidden': true,
			className:
				'cnl-add-page-layout-grid cnl-add-page-layout-grid--placeholder',
		},
		[ 0, 1 ].map( ( index ) =>
			el(
				'div',
				{
					className: 'cnl-add-page-layout-card-placeholder',
					key: index,
				},
				el(
					'div',
					{ className: 'cnl-add-page-layout-card__preview' },
					el( PageLayoutPreviewPlaceholder )
				),
				el(
					'div',
					{
						className:
							'cnl-add-page-layout-card-placeholder__content',
					},
					el( 'span', {
						className:
							'cnl-add-page-layout-card-placeholder__title',
					} ),
					el( 'span', {
						className: 'cnl-add-page-layout-card-placeholder__line',
					} ),
					el( 'span', {
						className:
							'cnl-add-page-layout-card-placeholder__line is-short',
					} )
				)
			)
		)
	);
}

function PageLayoutCard( { onSelect, pageTemplateContent, pattern } ) {
	const previewContent = getPatternPreviewContent(
		pattern,
		pageTemplateContent
	);

	return el(
		Button,
		{
			__next40pxDefaultSize: true,
			className: 'cnl-add-page-layout-card',
			onClick: () => onSelect( pattern ),
			variant: 'secondary',
		},
		el(
			'div',
			{ className: 'cnl-add-page-layout-card__preview' },
			el(
				'div',
				{ className: 'cnl-add-page-layout-preview-page' },
				previewContent
					? el( LazyEditorPreview, {
							content: previewContent,
							description: getPatternTitle( pattern ),
							placeholder: el( PageLayoutPreviewPlaceholder ),
						} )
					: el( PageLayoutPreviewPlaceholder )
			)
		),
		el(
			'span',
			{ className: 'cnl-add-page-layout-card__content' },
			el(
				'span',
				{ className: 'cnl-add-page-layout-card__title' },
				getPatternTitle( pattern )
			),
			getPatternDescription( pattern ) &&
				el(
					'span',
					{ className: 'cnl-add-page-layout-card__description' },
					getPatternDescription( pattern )
				)
		)
	);
}

function PageLayoutStartBlankCard( { onSelect } ) {
	return el(
		Button,
		{
			__next40pxDefaultSize: true,
			className: 'cnl-add-page-layout-card is-start-blank',
			onClick: onSelect,
			variant: 'secondary',
		},
		el(
			'div',
			{
				className:
					'cnl-add-page-layout-card__preview cnl-add-page-layout-card__preview--empty',
			},
			el(
				EmptyState.Root,
				{ className: 'cnl-add-page-layout-empty-state' },
				el( EmptyState.Icon, { icon: plusIcon } ),
				el( EmptyState.Title, null, __( 'Start blank' ) ),
				el(
					EmptyState.Description,
					null,
					__( 'Create a blank page and add sections as you go.' )
				)
			)
		),
		el(
			'span',
			{ className: 'cnl-add-page-layout-card__content' },
			el(
				'span',
				{ className: 'cnl-add-page-layout-card__title' },
				__( 'Start blank' )
			),
			el(
				'span',
				{ className: 'cnl-add-page-layout-card__description' },
				__( 'Create a blank page' )
			)
		)
	);
}

function AddPageFlow( { onClose, templates } ) {
	const navigate = useNavigate();
	const { saveEntityRecord } = useDispatch( coreDataStore );
	const [ selectedPath, setSelectedPath ] = useState();
	const [ selectedLayout, setSelectedLayout ] = useState();
	const [ selectedPageType, setSelectedPageType ] = useState();
	const [ selectedTemplateSlug, setSelectedTemplateSlug ] = useState( '' );
	const [ pageLayoutPage, setPageLayoutPage ] = useState( 1 );
	const [ pageTitle, setPageTitle ] = useState( '' );
	const [ previewPageTitle, setPreviewPageTitle ] = useState( '' );
	const [ publishImmediately, setPublishImmediately ] = useState( true );
	const [ validationError, setValidationError ] = useState();
	const [ isBusy, setIsBusy ] = useState( false );
	const { isResolving, patterns } = usePageLayoutPatterns();
	const pageLayoutGroups = useMemo(
		() => getPageLayoutGroups( patterns ),
		[ patterns ]
	);
	const visiblePageLayoutGroups = useMemo( () => {
		if ( pageLayoutGroups.length !== 1 ) {
			return pageLayoutGroups;
		}

		return [
			{
				...pageLayoutGroups[ 0 ],
				label: __( 'All designs' ),
			},
		];
	}, [ pageLayoutGroups ] );
	const activePageType =
		selectedPageType ||
		pageLayoutGroups[ 0 ]?.slug ||
		OTHER_PAGE_LAYOUT_TYPE;
	const activePageLayoutGroup = pageLayoutGroups.find(
		( group ) => group.slug === activePageType
	);
	const activePageLayouts = activePageLayoutGroup?.patterns || EMPTY_ARRAY;
	const pageLayoutPageCount = Math.max(
		1,
		Math.ceil( activePageLayouts.length / PAGE_LAYOUTS_PER_PAGE )
	);
	const currentPageLayoutPage = Math.min(
		pageLayoutPage,
		pageLayoutPageCount
	);
	const visiblePageLayouts = activePageLayouts.slice(
		( currentPageLayoutPage - 1 ) * PAGE_LAYOUTS_PER_PAGE,
		currentPageLayoutPage * PAGE_LAYOUTS_PER_PAGE
	);
	const shouldShowStartBlankLayoutCard = visiblePageLayouts.length === 1;
	const firstVisiblePageLayoutIndex =
		( currentPageLayoutPage - 1 ) * PAGE_LAYOUTS_PER_PAGE + 1;
	const lastVisiblePageLayoutIndex = Math.min(
		currentPageLayoutPage * PAGE_LAYOUTS_PER_PAGE,
		activePageLayouts.length
	);
	const isLoadingPageLayouts = isResolving && ! pageLayoutGroups.length;
	const pageTemplateOptions = useMemo(
		() => getPageTemplateOptions( templates ),
		[ templates ]
	);
	const pageTemplateContent = useMemo(
		() => getSelectedTemplateContent( templates, selectedTemplateSlug ),
		[ selectedTemplateSlug, templates ]
	);
	useEffect( () => {
		if ( ! selectedLayout ) {
			setPreviewPageTitle( pageTitle );
			return undefined;
		}

		const timeoutId = window.setTimeout(
			() => setPreviewPageTitle( pageTitle ),
			PAGE_TITLE_PREVIEW_DEBOUNCE_MS
		);

		return () => window.clearTimeout( timeoutId );
	}, [ pageTitle, selectedLayout ] );
	const selectedLayoutPreviewContent = useMemo(
		() =>
			selectedLayout
				? getPatternPreviewContentWithTitle(
						selectedLayout,
						pageTemplateContent,
						previewPageTitle,
						{ parseBlocks, serialize }
					)
				: '',
		[ pageTemplateContent, previewPageTitle, selectedLayout ]
	);
	const isChoosingLayout = selectedPath === 'layout' && ! selectedLayout;
	const isShowingForm = selectedPath === 'scratch' || !! selectedLayout;
	const canCreate = pageTitle.trim().length > 0;

	useEffect( () => {
		setPageLayoutPage( 1 );
	}, [ activePageType ] );

	useEffect( () => {
		if ( selectedPath !== 'layout' || ! pageLayoutGroups.length ) {
			return;
		}

		if (
			! selectedPageType ||
			! pageLayoutGroups.some(
				( group ) => group.slug === selectedPageType
			)
		) {
			setSelectedPageType( pageLayoutGroups[ 0 ].slug );
		}
	}, [ pageLayoutGroups, selectedPageType, selectedPath ] );

	const handleSelectPath = ( path ) => {
		setSelectedPath( path );
		setSelectedLayout( undefined );
		setSelectedTemplateSlug( '' );
		setPageLayoutPage( 1 );
		setPageTitle( '' );
		setValidationError( undefined );
	};
	const handleStartBlank = () => handleSelectPath( 'scratch' );
	const handleBack = () => {
		if ( selectedPath === 'layout' && ! selectedLayout ) {
			setSelectedPath( undefined );
			setValidationError( undefined );
			return;
		}

		setSelectedPath( undefined );
		setSelectedLayout( undefined );
		setSelectedTemplateSlug( '' );
		setPageTitle( '' );
		setValidationError( undefined );
	};
	const handleSelectLayout = ( pattern ) => {
		setSelectedLayout( pattern );
		setPageTitle( getPatternTitle( pattern ) );
		setValidationError( undefined );
	};
	const visiblePageLayoutCards = [
		...visiblePageLayouts.map( ( pattern ) =>
			el( PageLayoutCard, {
				key: pattern.name,
				onSelect: handleSelectLayout,
				pageTemplateContent,
				pattern,
			} )
		),
		shouldShowStartBlankLayoutCard &&
			el( PageLayoutStartBlankCard, {
				key: 'start-blank',
				onSelect: handleStartBlank,
			} ),
	].filter( Boolean );
	const createPage = async () => {
		const trimmedTitle = pageTitle.trim();

		if ( ! trimmedTitle ) {
			setValidationError( __( 'Enter a page title.' ) );
			return;
		}

		setIsBusy( true );
		setValidationError( undefined );

		try {
			const newPage = await saveEntityRecord(
				'postType',
				'page',
				{
					content: selectedLayout
						? getPatternContent( selectedLayout )
						: '',
					status: publishImmediately ? 'publish' : 'draft',
					template: selectedTemplateSlug || undefined,
					title: trimmedTitle,
				},
				{ throwOnError: true }
			);

			onClose();
			navigate( {
				to: `/types/page/edit/${ newPage.id }`,
			} );
		} catch ( error ) {
			setValidationError( getErrorMessage( error ) );
		} finally {
			setIsBusy( false );
		}
	};
	const goToPreviousPageLayouts = () =>
		setPageLayoutPage( ( page ) => Math.max( 1, page - 1 ) );
	const goToNextPageLayouts = () =>
		setPageLayoutPage( ( page ) =>
			Math.min( pageLayoutPageCount, page + 1 )
		);

	return el(
		Modal,
		{
			className: `cnl-add-page-modal${
				isChoosingLayout ? ' is-layout-picker' : ''
			}`,
			headerActions: isChoosingLayout
				? el(
						Button,
						{
							__next40pxDefaultSize: true,
							onClick: handleStartBlank,
							variant: 'secondary',
						},
						__( 'Start blank' )
					)
				: null,
			onRequestClose: onClose,
			size: 'large',
			title: isChoosingLayout
				? __( 'Choose a page design' )
				: __( 'Add a new page' ),
		},
		el(
			'div',
			{ className: 'cnl-add-page-modal__body' },
			isChoosingLayout &&
				el(
					'p',
					{ className: 'cnl-add-page-modal__subtitle' },
					__(
						'Choose a page design built with patterns you can customize, or start with a blank page.'
					)
				),
			! selectedPath &&
				el(
					'div',
					{ className: 'cnl-add-page-options' },
					el(
						Button,
						{
							__next40pxDefaultSize: true,
							className: 'cnl-add-page-option-card',
							onClick: () => handleSelectPath( 'layout' ),
							variant: 'secondary',
						},
						el(
							'div',
							{
								className:
									'cnl-add-page-option-card__preview is-layout',
							},
							el(
								'div',
								{
									className:
										'cnl-add-page-wireframe cnl-add-page-wireframe--layout',
								},
								el( 'span', {
									className: 'cnl-add-page-wireframe__bar',
								} ),
								el( 'span', {
									className: 'cnl-add-page-wireframe__bar',
								} ),
								el( 'span', {
									className: 'cnl-add-page-wireframe__bar',
								} )
							)
						),
						el(
							'span',
							{ className: 'cnl-add-page-option-card__title' },
							__( 'Choose a page design' )
						),
						el(
							'span',
							{
								className:
									'cnl-add-page-option-card__description',
							},
							__( 'Start with a page design you can customize' )
						)
					),
					el(
						Button,
						{
							__next40pxDefaultSize: true,
							className: 'cnl-add-page-option-card',
							onClick: handleStartBlank,
							variant: 'secondary',
						},
						el(
							'div',
							{
								className:
									'cnl-add-page-option-card__preview is-scratch',
							},
							el( Icon, { icon: plusIcon } )
						),
						el(
							'span',
							{ className: 'cnl-add-page-option-card__title' },
							__( 'Start from scratch' )
						),
						el(
							'span',
							{
								className:
									'cnl-add-page-option-card__description',
							},
							__(
								'Create a blank page and add sections as you go'
							)
						)
					)
				),
			! selectedPath &&
				el(
					'p',
					{ className: 'cnl-add-page-tutorial' },
					__( 'Unsure where to start?' ),
					' ',
					el(
						'a',
						{
							href: 'https://learn.wordpress.org/lesson/setting-up-your-pages-posts-site-logo-and-navigation-menu/',
							rel: 'noopener noreferrer',
							target: '_blank',
						},
						__( 'Begin with a tutorial' )
					)
				),
			isChoosingLayout &&
				el(
					'div',
					{ className: 'cnl-add-page-layout-picker' },
					el(
						'div',
						{
							'aria-label': __( 'Page types' ),
							className: 'cnl-add-page-layout-categories',
						},
						isLoadingPageLayouts &&
							el( PageLayoutSidebarPlaceholder ),
						! isLoadingPageLayouts &&
							visiblePageLayoutGroups.map( ( group ) =>
								el(
									Button,
									{
										__next40pxDefaultSize: true,
										'aria-current':
											group.slug === activePageType
												? 'true'
												: undefined,
										className: `cnl-add-page-layout-category${
											group.slug === activePageType
												? ' is-selected'
												: ''
										}`,
										key: group.slug,
										onClick: () =>
											setSelectedPageType( group.slug ),
										variant: 'tertiary',
									},
									el( 'span', null, group.label ),
									el(
										'span',
										{
											className:
												'cnl-add-page-layout-category__count',
										},
										group.patterns.length
									)
								)
							)
					),
					el(
						'div',
						{ className: 'cnl-add-page-layout-results' },
						el(
							'div',
							{
								className:
									'cnl-add-page-layout-results__header',
							},
							pageTemplateOptions.length > 1 &&
								el( SelectControl, {
									__next40pxDefaultSize: true,
									className:
										'cnl-add-page-layout-template-select',
									label: __( 'Preview with' ),
									onChange: ( value ) =>
										setSelectedTemplateSlug(
											String( value )
										),
									options: pageTemplateOptions,
									value: selectedTemplateSlug,
								} ),
							activePageLayouts.length > PAGE_LAYOUTS_PER_PAGE &&
								el(
									'div',
									{
										'aria-label': __(
											'Page design pagination'
										),
										className:
											'cnl-add-page-layout-pagination',
										role: 'navigation',
									},
									el( Button, {
										__next40pxDefaultSize: true,
										accessibleWhenDisabled: true,
										disabled: currentPageLayoutPage === 1,
										icon: chevronLeftIcon,
										label: __( 'Previous designs' ),
										onClick: goToPreviousPageLayouts,
										variant: 'tertiary',
									} ),
									el(
										'span',
										{
											className:
												'cnl-add-page-layout-pagination__label',
										},
										sprintf(
											/* translators: 1: first visible design number, 2: last visible design number, 3: total designs. */
											__( '%1$d-%2$d of %3$d designs' ),
											firstVisiblePageLayoutIndex,
											lastVisiblePageLayoutIndex,
											activePageLayouts.length
										)
									),
									el( Button, {
										__next40pxDefaultSize: true,
										accessibleWhenDisabled: true,
										disabled:
											currentPageLayoutPage ===
											pageLayoutPageCount,
										icon: chevronRightIcon,
										label: __( 'Next designs' ),
										onClick: goToNextPageLayouts,
										variant: 'tertiary',
									} )
								)
						),
						isLoadingPageLayouts &&
							el( PageLayoutResultsPlaceholder ),
						! isLoadingPageLayouts &&
							! activePageLayouts.length &&
							el(
								'div',
								{ className: 'cnl-add-page-layout-empty' },
								el(
									'p',
									null,
									__(
										'No page designs are available for this theme yet.'
									)
								),
								el(
									'p',
									null,
									__(
										'Start with a blank page and add patterns from the editor.'
									)
								),
								el(
									Button,
									{
										__next40pxDefaultSize: true,
										onClick: handleStartBlank,
										variant: 'secondary',
									},
									__( 'Start blank' )
								)
							),
						! isLoadingPageLayouts &&
							!! activePageLayouts.length &&
							el(
								'div',
								{ className: 'cnl-add-page-layout-grid' },
								visiblePageLayoutCards
							)
					)
				),
			isShowingForm &&
				el(
					'div',
					{ className: 'cnl-add-page-form' },
					validationError &&
						el(
							Notice,
							{
								isDismissible: true,
								onRemove: () => setValidationError( undefined ),
								status: 'error',
							},
							validationError
						),
					selectedLayout &&
						el(
							'div',
							{ className: 'cnl-add-page-form__preview' },
							el(
								'div',
								{
									className:
										'cnl-add-page-form__preview-page',
								},
								el( LazyEditorPreview, {
									content: selectedLayoutPreviewContent,
									description:
										getPatternTitle( selectedLayout ),
								} )
							)
						),
					el( InputControl, {
						autoComplete: 'off',
						className: 'cnl-add-page-form__title',
						disabled: isBusy,
						label: __( 'Page title' ),
						onValueChange: setPageTitle,
						placeholder: __( 'Enter page title' ),
						required: true,
						value: pageTitle,
					} ),
					el(
						'div',
						{ className: 'cnl-add-page-form__settings' },
						el(
							'div',
							{ className: 'cnl-add-page-form__checkbox-item' },
							el( CheckboxControl, {
								checked: publishImmediately,
								disabled: isBusy,
								label: __( 'Publish immediately' ),
								onChange: setPublishImmediately,
							} ),
							el(
								'p',
								{
									className:
										'cnl-add-page-form__checkbox-help',
								},
								__(
									'Your page will be visible to visitors immediately.'
								)
							)
						),
						pageTemplateOptions.length > 1 &&
							el( SelectControl, {
								__next40pxDefaultSize: true,
								disabled: isBusy,
								label: __( 'Page Template' ),
								onChange: ( value ) =>
									setSelectedTemplateSlug( String( value ) ),
								options: pageTemplateOptions,
								value: selectedTemplateSlug,
							} )
					)
				)
		),
		el(
			'div',
			{ className: 'cnl-add-page-modal__footer' },
			selectedPath &&
				el(
					Button,
					{
						__next40pxDefaultSize: true,
						disabled: isBusy,
						icon: chevronLeftIcon,
						onClick: handleBack,
						variant: 'tertiary',
					},
					__( 'Back to options' )
				),
			el(
				'div',
				{ className: 'cnl-add-page-modal__footer-actions' },
				isShowingForm &&
					el(
						Button,
						{
							__next40pxDefaultSize: true,
							disabled: isBusy || ! canCreate,
							isBusy,
							onClick: createPage,
							variant: 'primary',
						},
						__( 'Create and edit' )
					)
			)
		)
	);
}

function PostListDataViewsLayout() {
	return el(
		'div',
		{ className: 'routes-post-list__dataviews' },
		el(
			'div',
			{ className: 'routes-post-list__dataviews-toolbar' },
			el(
				'div',
				{ className: 'routes-post-list__dataviews-toolbar-start' },
				el( DataViews.Search, { label: __( 'Search content' ) } ),
				el( DataViews.FiltersToggle )
			),
			el(
				'div',
				{ className: 'routes-post-list__dataviews-toolbar-end' },
				el( DataViews.ViewConfig ),
				el( DataViews.LayoutSwitcher )
			)
		),
		el( DataViews.FiltersToggled, {
			className: 'routes-post-list__dataviews-filters',
		} ),
		el(
			'div',
			{ className: 'routes-post-list__dataviews-scroll' },
			el( DataViews.BulkActionToolbar ),
			el( DataViews.Layout ),
			el( DataViews.Pagination )
		)
	);
}

function useContentRecords() {
	const params = useParams( { strict: false } );
	const searchParams = useSearch( { strict: false } );
	const [ contentView, setContentView ] = useState( () =>
		getInitialContentView( searchParams )
	);
	const type = getPostType( params.type );
	const activeTab = getActiveTab( searchParams );
	const postQuery = useMemo(
		() => getPostQuery( contentView.search ),
		[ contentView.search ]
	);

	useEffect( () => {
		setContentView( ( currentView ) => ( {
			...currentView,
			page: searchParams.page ? Number( searchParams.page ) || 1 : 1,
			search: searchParams.search || '',
		} ) );
	}, [ searchParams.page, searchParams.search ] );

	const { error, isLoading, posts, rawTemplates } = useSelect(
		( select ) => {
			if ( ! type ) {
				return {
					error: null,
					isLoading: false,
					posts: EMPTY_ARRAY,
					rawTemplates: EMPTY_ARRAY,
				};
			}

			const store = select( coreDataStore );
			const postArgs = [ 'postType', type.name, postQuery ];
			const templateArgs = [ 'postType', 'wp_template', TEMPLATE_QUERY ];
			const resolvedPosts =
				store.getEntityRecords( ...postArgs ) || EMPTY_ARRAY;
			const resolvedTemplates =
				store.getEntityRecords( ...templateArgs ) || EMPTY_ARRAY;
			const postError = store.getResolutionError?.(
				'getEntityRecords',
				postArgs
			);
			const templateError = store.getResolutionError?.(
				'getEntityRecords',
				templateArgs
			);
			const isResolvingPosts = store.isResolving(
				'getEntityRecords',
				postArgs
			);
			const isResolvingTemplates = store.isResolving(
				'getEntityRecords',
				templateArgs
			);
			const hasResolvedPosts = store.hasFinishedResolution(
				'getEntityRecords',
				postArgs
			);
			const hasResolvedTemplates = store.hasFinishedResolution(
				'getEntityRecords',
				templateArgs
			);
			const activeError =
				activeTab === 'templates' ? templateError : postError;

			return {
				error: activeError ? getErrorMessage( activeError ) : null,
				isLoading:
					activeTab === 'templates'
						? ! hasResolvedTemplates || isResolvingTemplates
						: ! hasResolvedPosts ||
							! hasResolvedTemplates ||
							isResolvingPosts ||
							isResolvingTemplates,
				posts: resolvedPosts,
				rawTemplates: resolvedTemplates,
			};
		},
		[ activeTab, postQuery, type ]
	);
	const templates = useMemo(
		() =>
			type
				? rawTemplates.filter( ( template ) =>
						templateMatchesPostType( template, type.name )
					)
				: EMPTY_ARRAY,
		[ rawTemplates, type ]
	);
	const previewTemplates = templates;

	const selectedId =
		getSearchValue( searchParams.postIds ) ||
		searchParams.postId ||
		posts[ 0 ]?.id;
	const selectedTemplateId =
		getSearchValue( searchParams.postIds ) ||
		getSearchValue( searchParams.templateIds ) ||
		searchParams.templateId ||
		templates[ 0 ]?.id;
	const selectedPost = useMemo(
		() =>
			posts.find(
				( post ) => String( post.id ) === String( selectedId )
			),
		[ posts, selectedId ]
	);
	const selectedTemplate = useMemo(
		() =>
			templates.find(
				( template ) =>
					String( template.id ) === String( selectedTemplateId )
			),
		[ selectedTemplateId, templates ]
	);

	return {
		activeTab,
		contentView,
		error,
		isLoading,
		params,
		previewTemplates,
		posts,
		selectedId,
		selectedPost,
		selectedTemplate,
		selectedTemplateId,
		setContentView,
		templates,
		type,
	};
}

function Stage() {
	const navigate = useNavigate();
	const searchParams = useSearch( { strict: false } );
	const [ isAddingPage, setIsAddingPage ] = useState( false );
	const {
		activeTab,
		contentView,
		error,
		isLoading,
		posts,
		previewTemplates,
		selectedId,
		selectedTemplateId,
		setContentView,
		templates,
		type,
	} = useContentRecords();
	const contentFields = useMemo(
		() => getContentFields( previewTemplates ),
		[ previewTemplates ]
	);
	const contentActions = useMemo(
		() => ( type ? getContentActions( navigate, type ) : [] ),
		[ navigate, type ]
	);
	const previewTemplatesKey = useMemo(
		() =>
			previewTemplates
				.map( ( template ) => `${ template.id }:${ template.slug }` )
				.join( '|' ),
		[ previewTemplates ]
	);

	if ( ! type ) {
		return null;
	}

	const listPath = `/types/${ type.name }/list/all`;
	const showTemplates = activeTab === 'templates';
	const onChangeContentView = ( nextView ) => {
		setContentView( nextView );
		navigate( {
			search: {
				...searchParams,
				content: undefined,
				page:
					nextView.page && nextView.page > 1
						? nextView.page
						: undefined,
				search: nextView.search || undefined,
			},
			to: listPath,
		} );
	};
	const selectPost = ( postId ) =>
		navigate( {
			search: {
				...searchParams,
				postIds: postId ? [ String( postId ) ] : undefined,
			},
			to: listPath,
		} );
	const selectTemplate = ( templateId ) =>
		navigate( {
			search: {
				...searchParams,
				content: 'templates',
				postIds: templateId ? [ String( templateId ) ] : undefined,
				templateId: undefined,
				templateIds: undefined,
			},
			to: listPath,
		} );
	const handleContentTabChange = ( nextTab ) => {
		navigate( {
			search: {
				...searchParams,
				content: nextTab === 'templates' ? 'templates' : undefined,
				page: undefined,
				postId: undefined,
				postIds: undefined,
				search: undefined,
				templateId: undefined,
				templateIds: undefined,
			},
			to: listPath,
		} );
	};
	const configureHomepage = () => {};
	const totalPages = Math.max(
		1,
		Math.ceil( posts.length / ( contentView.perPage || 20 ) )
	);
	const addLabel = sprintf(
		/* translators: %s: post type singular label. */
		__( 'Add %s' ),
		type.singular || type.name
	);
	const openCreateFlow = () => {
		if ( type.name === 'page' ) {
			setIsAddingPage( true );
			return;
		}

		navigate( {
			to: `/types/${ type.name }/new`,
		} );
	};
	const pageActions = el(
		'div',
		{ className: 'routes-post-list__page-actions' },
		type.canCreate &&
			el(
				Button,
				{
					__next40pxDefaultSize: true,
					onClick: openCreateFlow,
					variant: 'primary',
				},
				addLabel
			),
		type.name === 'page' &&
			el(
				DropdownMenu,
				{
					className: 'routes-post-list__more-options',
					icon: moreVerticalIcon,
					label: __( 'Page Options' ),
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
								configureHomepage();
								onClose();
							},
						},
						__( 'Configure Homepage' )
					)
			)
	);
	const contentEmpty = el(
		'div',
		{ className: 'cnl-editor-empty-state' },
		el(
			EmptyState.Root,
			null,
			el( EmptyState.Icon, {
				icon: type.name === 'page' ? pageIcon : postListIcon,
			} ),
			el(
				EmptyState.Title,
				null,
				sprintf(
					/* translators: %s: post type plural label. */
					__( 'No %s yet' ),
					type.label || type.name
				)
			),
			el(
				EmptyState.Description,
				null,
				sprintf(
					/* translators: %s: post type singular label. */
					__( 'Create your first %s to start adding content here.' ),
					type.singular || type.name
				)
			),
			type.canCreate &&
				el(
					EmptyState.Actions,
					null,
					el(
						Button,
						{
							__next40pxDefaultSize: true,
							onClick: openCreateFlow,
							variant: 'primary',
						},
						addLabel
					)
				)
		)
	);
	const templateEmpty = el(
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
				sprintf(
					/* translators: %s: post type label. */
					__( 'No templates are currently available for %s.' ),
					( type.label || type.name ).toLowerCase()
				)
			)
		)
	);

	return el(
		Page,
		{
			actions: pageActions,
			className: 'cnl-editor-stage cnl-editor-content-page',
			hasPadding: false,
			headingLevel: 2,
			subTitle:
				type.description ||
				sprintf(
					/* translators: %s: post type label. */
					__( 'Browse, preview, and edit %s.' ),
					( type.label || type.name ).toLowerCase()
				),
			title: type.menuName || type.label,
		},
		el(
			'div',
			{ className: 'routes-post-list__tabs-wrapper' },
			el(
				Tabs.Root,
				{
					onValueChange: handleContentTabChange,
					value: showTemplates ? 'templates' : 'content',
				},
				el(
					Tabs.List,
					null,
					el(
						Tabs.Tab,
						{ value: 'content' },
						type.menuName || type.label
					),
					el( Tabs.Tab, { value: 'templates' }, __( 'Templates' ) )
				)
			)
		),
		showTemplates &&
			el(
				'p',
				{ className: 'cnl-editor-stage__description' },
				sprintf(
					/* translators: %s: post type label. */
					__(
						'Templates control the layout used by %s on your site. The default template is used unless content has a different template selected.'
					),
					( type.label || type.name ).toLowerCase()
				)
			),
		error && el( 'div', { className: 'cnl-editor-empty' }, error ),
		showTemplates
			? el(
					'div',
					{
						className:
							'cnl-editor-list routes-post-list__templates',
					},
					isLoading &&
						el(
							'div',
							{ className: 'cnl-editor-spinner' },
							el( Spinner )
						),
					! isLoading &&
						templates.map( ( template ) => {
							const isSelected =
								String( selectedTemplateId ) ===
								String( template.id );

							return el(
								'div',
								{
									key: template.id,
									className:
										'routes-post-list__template-card-wrapper',
								},
								el(
									'button',
									{
										'aria-pressed': isSelected,
										className: `routes-post-list__template-card${
											isSelected ? ' is-selected' : ''
										}`,
										onClick: () =>
											selectTemplate( template.id ),
										type: 'button',
									},
									el( 'span', {
										'aria-hidden': true,
										className:
											'routes-post-list__template-card-icon dashicons dashicons-layout',
									} ),
									el(
										'span',
										{
											className:
												'routes-post-list__template-card-content',
										},
										el(
											'span',
											{
												className:
													'routes-post-list__template-card-title',
											},
											getTemplateTitle( template )
										),
										el(
											'span',
											{
												className:
													'routes-post-list__template-badge',
											},
											getTemplateStatusLabel( template )
										),
										el(
											'span',
											{
												className:
													'routes-post-list__template-card-author',
											},
											sprintf(
												/* translators: %s: template author name. */
												__( 'Author: %s' ),
												getTemplateAuthorText(
													template
												)
											)
										)
									)
								),
								el( TemplateDescriptionInfo, {
									description:
										getTemplateDescription( template ),
								} )
							);
						} ),
					! isLoading && templates.length === 0 && templateEmpty
				)
			: el(
					DataViews,
					{
						actions: contentActions,
						data: posts,
						defaultLayouts: DEFAULT_CONTENT_LAYOUTS,
						empty: contentEmpty,
						fields: contentFields,
						getItemId: ( item ) => String( item.id ),
						isLoading,
						key: previewTemplatesKey,
						onChangeSelection: ( items ) =>
							selectPost( items[ 0 ] ),
						onChangeView: onChangeContentView,
						onClickItem: ( item ) => selectPost( item.id ),
						paginationInfo: {
							totalItems: posts.length,
							totalPages,
						},
						selection: selectedId ? [ String( selectedId ) ] : [],
						view: contentView,
					},
					el( PostListDataViewsLayout )
				),
		showTemplates &&
			templates.length > 0 &&
			el(
				'div',
				{ className: 'routes-post-list__template-footer' },
				el(
					'span',
					null,
					sprintf(
						/* translators: %s: post type singular label. */
						__( 'For more advanced control over %s templates,' ),
						type.singular || type.name
					),
					' '
				),
				el(
					Button,
					{
						onClick: () => navigate( { to: '/templates' } ),
						variant: 'link',
					},
					__( 'view all templates.' )
				)
			),
		isAddingPage &&
			type.name === 'page' &&
			el( AddPageFlow, {
				onClose: () => setIsAddingPage( false ),
				templates,
			} )
	);
}

function Canvas() {
	const navigate = useNavigate();
	const { activeTab, isLoading, selectedPost, selectedTemplate, type } =
		useContentRecords();

	if ( ! type ) {
		return null;
	}

	const showTemplates = activeTab === 'templates';

	if ( isLoading ) {
		return el(
			'section',
			{ className: 'cnl-editor-canvas' },
			el( 'div', { className: 'cnl-editor-spinner' }, el( Spinner ) )
		);
	}

	const label = getCanvasLabel( {
		selectedPost,
		selectedTemplate,
		showTemplates,
		type,
	} );
	const description = getCanvasDescription( {
		selectedPost,
		selectedTemplate,
		showTemplates,
		type,
	} );

	return el(
		'section',
		{ className: 'cnl-editor-canvas' },
		el(
			'header',
			{ className: 'cnl-editor-canvas__toolbar' },
			el(
				'div',
				null,
				el( 'div', { className: 'cnl-editor-canvas__label' }, label ),
				el(
					'div',
					{ className: 'cnl-editor-canvas__status' },
					selectedPost?.status || __( 'Preview' )
				)
			),
			el(
				'div',
				{ className: 'cnl-editor-canvas__actions' },
				selectedPost?.link &&
					el(
						Button,
						{
							href: selectedPost.link,
							rel: 'noreferrer',
							target: '_blank',
							variant: 'tertiary',
						},
						__( 'Open preview' )
					),
				showTemplates &&
					el(
						Button,
						{
							onClick: () => navigate( { to: '/templates' } ),
							variant: 'secondary',
						},
						__( 'View all templates' )
					),
				showTemplates &&
					selectedTemplate &&
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
					),
				! showTemplates &&
					selectedPost &&
					el(
						Button,
						{
							onClick: () =>
								navigate( {
									to: `/types/${ type.name }/edit/${ selectedPost.id }`,
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
			el(
				'div',
				{ className: 'cnl-editor-canvas-placeholder' },
				el( 'span', {
					'aria-hidden': true,
					className: `cnl-editor-canvas-placeholder__icon dashicons ${ getCanvasIconClass(
						{ showTemplates, type }
					) }`,
				} ),
				el(
					'h2',
					{ className: 'cnl-editor-canvas-placeholder__title' },
					label
				),
				el(
					'p',
					{ className: 'cnl-editor-canvas-placeholder__description' },
					description
				),
				selectedPost?.id &&
					! showTemplates &&
					el(
						'div',
						{
							className: 'cnl-editor-canvas-placeholder__meta',
						},
						sprintf(
							/* translators: %d: post ID. */
							__( 'ID %d' ),
							selectedPost.id
						)
					),
				selectedTemplate?.id &&
					showTemplates &&
					el(
						'div',
						{
							className: 'cnl-editor-canvas-placeholder__meta',
						},
						selectedTemplate.id
					)
			)
		)
	);
}

export { Stage as stage, Canvas as canvas };
