import { useNavigate, useParams, useSearch } from '@wordpress/route';
import { Preview as LazyEditorPreview } from '@wordpress/lazy-editor';

/**
 * Internal dependencies
 */
import { withUiTheme } from '../../theme';
import { getPostType } from '../../settings';
import {
	getErrorMessage,
	getTemplateAuthorText,
	getTemplateDisplayTitle,
	getTitleText,
} from '../../records';
import {
	DEFAULT_PAGE_LAYOUT_COLUMNS,
	EMPTY_ARRAY,
	OTHER_PAGE_LAYOUT_TYPE,
	getPageLayoutGroups,
	getPatternContent,
	getPatternDescription,
	getPatternPreviewContent,
	getPatternPreviewContentWithTitle,
	getPatternTitle,
	getSelectedTemplateContent,
	isPageLayoutPattern,
} from './page-layouts';
import { isPageInMenu } from './menu-status';
import useMainMenu, { useAddPageToMenu } from './use-main-menu';
import { PageDetailStage, PagesTree } from './pages/stage';
import {
	DesignPicker,
	DesignPickerNav,
	GridShapeIcon,
	GroupHeading,
	StartFromScratch,
} from '../../design-picker';
import PagesCanvas from './pages/canvas';
import {
	Badge,
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
	Notice,
	Popover,
	SelectControl,
	Skeleton,
	Spinner,
	Stack,
	Tabs,
	Text,
	ToggleGroupControl,
	ToggleGroupControlOptionIcon,
	__,
	el,
	layoutIcon,
	LegacyIcon,
	moreVerticalIcon,
	pageIcon,
	postFeaturedImageIcon,
	postListIcon,
	Page,
	parseBlocks,
	sprintf,
	serialize,
	useEffect,
	useDispatch,
	useId,
	useMemo,
	useRef,
	useSelect,
	useState,
} from '../../wordpress-packages';

const DEFAULT_CONTENT_VIEW = {
	fields: [ 'author', 'status', 'date' ],
	filters: [],
	layout: {},
	page: 1,
	perPage: 20,
	search: '',
	sort: {
		direction: 'desc',
		field: 'date',
	},
	titleField: 'title',
	type: 'table',
};

const DEFAULT_CONTENT_LAYOUTS = {
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
	'id,author,link,title,status,type,date,modified,date_gmt,modified_gmt,content,template,slug,parent';

const TEMPLATE_QUERY = {
	context: 'edit',
	per_page: 100,
	_fields:
		'id,slug,title,description,source,author,theme,type,status,content',
};

const PAGE_TITLE_PREVIEW_DEBOUNCE_MS = 700;

const BLANK_PAGE_PATTERN = { content: '' };

/*
 * Each density is a grid shape, and that shape doubles as the page size: the
 * design grid never scrolls, so `columns * rows` designs is exactly what fits
 * before paginating. The densest option is a genuine grid rather than three
 * full-height columns, which read as awkwardly narrow slivers.
 */
const PAGE_LAYOUT_DENSITIES = [
	{ columns: 3, label: __( 'Small previews' ), rows: 2 },
	{ columns: 2, label: __( 'Medium previews' ), rows: 1 },
	{ columns: 1, label: __( 'Large previews' ), rows: 1 },
];

function getPageLayoutDensity( columns ) {
	return (
		PAGE_LAYOUT_DENSITIES.find(
			( density ) => density.columns === columns
		) || PAGE_LAYOUT_DENSITIES[ 1 ]
	);
}

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
	return getTemplateDisplayTitle( template ) || __( 'Untitled template' );
}

function getTemplateIcon( template ) {
	if ( template?.slug === 'home' ) {
		return postListIcon;
	}

	if ( template?.slug === 'single' ) {
		return postFeaturedImageIcon;
	}

	return layoutIcon;
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

function getDefaultContentViewType( type ) {
	return type?.name === 'page' ? 'grid' : 'table';
}

function getDefaultContentViewFields( type ) {
	return type?.name === 'page' ? [ 'on-site' ] : DEFAULT_CONTENT_VIEW.fields;
}

function getInitialContentView( searchParams, type ) {
	return {
		...DEFAULT_CONTENT_VIEW,
		fields: getDefaultContentViewFields( type ),
		page: searchParams.page ? Number( searchParams.page ) || 1 : 1,
		search: searchParams.search || '',
		type: getDefaultContentViewType( type ),
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

function TemplateDescriptionInfo( { authorText, description } ) {
	const [ isOpen, setIsOpen ] = useState( false );

	if ( ! description && ! authorText ) {
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
					description &&
						el(
							'span',
							{
								className:
									'routes-post-list__template-card-info-description',
							},
							description
						),
					authorText &&
						el(
							'span',
							{
								className:
									'routes-post-list__template-card-info-author',
							},
							sprintf(
								/* translators: %s: template author name. */
								__( 'Author: %s' ),
								authorText
							)
						)
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

function getStatusIntent( status ) {
	switch ( status ) {
		case 'draft':
		case 'auto-draft':
		case 'pending':
			return 'draft';
		case 'future':
		case 'private':
			return 'informational';
		default:
			return 'none';
	}
}

function renderSiteRoleBadges( item, siteRoles ) {
	const badges = [];

	if ( item.status !== 'publish' ) {
		badges.push( {
			intent: getStatusIntent( item.status ),
			label: getStatusLabel( item.status ),
		} );
	}

	if ( Number( item.id ) === siteRoles.frontPageId ) {
		badges.push( { intent: 'informational', label: __( 'Homepage' ) } );
	}

	if ( Number( item.id ) === siteRoles.postsPageId ) {
		badges.push( { intent: 'informational', label: __( 'Blog' ) } );
	}

	if ( siteRoles.menuPages ) {
		badges.push(
			isPageInMenu( item, siteRoles.menuPages )
				? { intent: 'stable', label: __( 'In menu' ) }
				: { intent: 'none', label: __( 'Not in menu' ) }
		);
	}

	return el(
		Stack,
		{ className: 'routes-post-list__badges', gap: 'xs', wrap: 'wrap' },
		badges.map( ( badge ) =>
			el( Badge, { intent: badge.intent, key: badge.label }, badge.label )
		)
	);
}

function getContentFields( siteRoles = {} ) {
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
			render: ( { item } ) =>
				item.status === 'publish'
					? getStatusLabel( item.status )
					: el(
							Badge,
							{ intent: getStatusIntent( item.status ) },
							getStatusLabel( item.status )
						),
			type: 'text',
		},
		siteRoles.isPages && {
			enableSorting: false,
			filterBy: false,
			getValue: ( { item } ) =>
				isPageInMenu( item, siteRoles.menuPages )
					? __( 'In menu' )
					: __( 'Not in menu' ),
			id: 'on-site',
			label: __( 'Details' ),
			render: ( { item } ) => renderSiteRoleBadges( item, siteRoles ),
			type: 'text',
		},
		{
			getValue: ( { item } ) => item.date || item.modified || '',
			id: 'date',
			label: __( 'Date' ),
			render: ( { item } ) => getDateLabel( item ),
			type: 'datetime',
		},
	].filter( Boolean );
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
			label: __( 'Standard layout' ),
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
		Stack,
		{
			'aria-hidden': true,
			className: 'cnl-add-page-layout-categories-placeholder',
			direction: 'column',
			gap: 'lg',
		},
		[ 70, 54, 62, 48, 66, 52 ].map( ( width, index ) =>
			el( Skeleton, {
				key: index,
				style: { height: 14, width: `${ width }%` },
			} )
		)
	);
}

function PageLayoutResultsPlaceholder( { columns, rows } ) {
	return el(
		'div',
		{
			'aria-hidden': true,
			className: 'cnl-add-page-layout-grid',
			style: {
				'--cnl-add-page-layout-columns': columns,
				'--cnl-add-page-layout-rows': rows,
			},
		},
		Array.from( { length: columns * rows } ).map( ( _, index ) =>
			el( Skeleton, {
				className: 'cnl-add-page-layout-skeleton',
				key: index,
			} )
		)
	);
}

/*
 * The preview scrolls independently, so the choose action is a button in the
 * card footer rather than the whole card. That keeps the scroll region and the
 * click target from competing.
 */
function PageLayoutCard( { onSelect, pageTemplateContent, pattern } ) {
	const previewContent = getPatternPreviewContent(
		pattern,
		pageTemplateContent
	);
	const title = getPatternTitle( pattern );
	const description = getPatternDescription( pattern );

	return el(
		'div',
		{
			className: 'cnl-design-picker__card cnl-add-page-layout-card',
			title: description || undefined,
		},
		el(
			'div',
			{
				className:
					'cnl-design-picker__preview cnl-add-page-layout-card__preview',
			},
			el(
				'div',
				{ className: 'cnl-add-page-layout-preview-page' },
				previewContent
					? el( LazyEditorPreview, {
							content: previewContent,
							description: title,
							placeholder: el( PageLayoutPreviewPlaceholder ),
						} )
					: el( PageLayoutPreviewPlaceholder )
			)
		),
		el(
			'div',
			{ className: 'cnl-design-picker__card-footer' },
			el( 'span', { className: 'cnl-design-picker__name' }, title ),
			el(
				'button',
				{
					className: 'cnl-design-picker__action',
					onClick: () => onSelect( pattern ),
					type: 'button',
				},
				__( 'Use design' ),
				el( Icon, {
					icon:
						document.documentElement.dir === 'rtl'
							? chevronLeftIcon
							: chevronRightIcon,
					size: 16,
				} )
			)
		)
	);
}

function getAddToMenuHelp( {
	menuListsAllPages,
	menuTitle,
	publishImmediately,
} ) {
	if ( menuListsAllPages ) {
		return __( 'Your menu already lists every published page.' );
	}

	if ( ! publishImmediately ) {
		return __( 'Publish the page to add it to your menu.' );
	}

	return menuTitle
		? sprintf(
				/* translators: %s: navigation menu name. */
				__( 'Adds a link to your “%s” menu so visitors can find it.' ),
				menuTitle
			)
		: __( 'Adds a link to your menu so visitors can find it.' );
}

function AddPageFlow( { mainMenu = {}, onClose, templates } ) {
	const navigate = useNavigate();
	const { saveEntityRecord } = useDispatch( coreDataStore );
	const addPageToMenu = useAddPageToMenu();
	const [ addToMenu, setAddToMenu ] = useState( true );
	const menuListsAllPages = Boolean( mainMenu.menuPages?.listsAllPages );
	const [ startedBlank, setStartedBlank ] = useState( false );
	const [ selectedLayout, setSelectedLayout ] = useState();
	const [ selectedPageType, setSelectedPageType ] = useState();
	const [ selectedTemplateSlug, setSelectedTemplateSlug ] = useState( '' );
	const [ pageLayoutColumns, setPageLayoutColumns ] = useState(
		DEFAULT_PAGE_LAYOUT_COLUMNS
	);
	const [ pageLayoutPage, setPageLayoutPage ] = useState( 1 );
	const [ pageTitle, setPageTitle ] = useState( '' );
	const [ previewPageTitle, setPreviewPageTitle ] = useState( '' );
	const [ publishImmediately, setPublishImmediately ] = useState( true );
	const [ validationError, setValidationError ] = useState();
	const [ isBusy, setIsBusy ] = useState( false );
	const idPrefix = `cnl-add-page-${ useId().replace( /:/g, '' ) }`;
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
	const activePageLayoutDensity = getPageLayoutDensity( pageLayoutColumns );
	const pageLayoutPerPage =
		activePageLayoutDensity.columns * activePageLayoutDensity.rows;
	const pageLayoutPageCount = Math.max(
		1,
		Math.ceil( activePageLayouts.length / pageLayoutPerPage )
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
	const isShowingForm = startedBlank || !! selectedLayout;
	// A blank page still previews, as its layout with nothing in it.
	const previewPattern =
		selectedLayout || ( startedBlank ? BLANK_PAGE_PATTERN : undefined );
	useEffect( () => {
		if ( ! previewPattern ) {
			setPreviewPageTitle( pageTitle );
			return undefined;
		}

		const timeoutId = window.setTimeout(
			() => setPreviewPageTitle( pageTitle ),
			PAGE_TITLE_PREVIEW_DEBOUNCE_MS
		);

		return () => window.clearTimeout( timeoutId );
	}, [ pageTitle, previewPattern ] );
	const formPreviewContent = useMemo(
		() =>
			previewPattern
				? getPatternPreviewContentWithTitle(
						previewPattern,
						pageTemplateContent,
						previewPageTitle,
						{ parseBlocks, serialize }
					)
				: '',
		[ pageTemplateContent, previewPageTitle, previewPattern ]
	);
	const canCreate = pageTitle.trim().length > 0;

	useEffect( () => {
		setPageLayoutPage( 1 );
	}, [ activePageType, pageLayoutColumns ] );

	useEffect( () => {
		if ( ! pageLayoutGroups.length ) {
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
	}, [ pageLayoutGroups, selectedPageType ] );

	const handleStartBlank = () => {
		setStartedBlank( true );
		setSelectedLayout( undefined );
		setSelectedTemplateSlug( '' );
		setPageTitle( '' );
		setValidationError( undefined );
	};
	const handleBack = () => {
		setStartedBlank( false );
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

			if (
				addToMenu &&
				publishImmediately &&
				mainMenu.menuId &&
				! menuListsAllPages
			) {
				await addPageToMenu( mainMenu.menuId, newPage );
			}

			onClose();
			// Open the new page in the Pages screen, where its sections are.
			navigate( {
				search: { postId: newPage.id },
				to: '/types/page/list/all',
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

	if ( isShowingForm ) {
		return el(
			DesignPicker,
			{
				className: 'cnl-add-page-modal',
				mainClassName: `cnl-add-page-form${
					formPreviewContent ? ' has-preview' : ''
				}`,
				onClose,
				subtitle: selectedLayout
					? sprintf(
							/* translators: %s: page design name. */
							__(
								'Your page starts from the “%s” design. You can change its name later.'
							),
							getPatternTitle( selectedLayout )
						)
					: __(
							'Your page starts blank. You can change its name later.'
						),
				title: __( 'Name your page' ),
			},
			el(
				'div',
				{ className: 'cnl-add-page-form__fields' },
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
							{ className: 'cnl-add-page-form__checkbox-help' },
							__(
								'Your page will be visible to visitors immediately.'
							)
						)
					),
					mainMenu.menuId &&
						el(
							'div',
							{ className: 'cnl-add-page-form__checkbox-item' },
							el( CheckboxControl, {
								checked:
									menuListsAllPages ||
									( addToMenu && publishImmediately ),
								disabled:
									isBusy ||
									menuListsAllPages ||
									! publishImmediately,
								label: __( 'Add to my menu' ),
								onChange: setAddToMenu,
							} ),
							el(
								'p',
								{
									className:
										'cnl-add-page-form__checkbox-help',
								},
								getAddToMenuHelp( {
									menuListsAllPages,
									menuTitle: mainMenu.menuTitle,
									publishImmediately,
								} )
							)
						),
					pageTemplateOptions.length > 1 &&
						el( SelectControl, {
							__next40pxDefaultSize: true,
							__nextHasNoMarginBottom: true,
							disabled: isBusy,
							label: __( 'Layout' ),
							onChange: ( value ) =>
								setSelectedTemplateSlug( String( value ) ),
							options: pageTemplateOptions,
							value: selectedTemplateSlug,
						} )
				),
				el(
					'div',
					{ className: 'cnl-add-page-form__actions' },
					el(
						Button,
						{
							__next40pxDefaultSize: true,
							disabled: isBusy,
							icon: chevronLeftIcon,
							onClick: handleBack,
							variant: 'tertiary',
						},
						__( 'Back to designs' )
					),
					el(
						Button,
						{
							__next40pxDefaultSize: true,
							accessibleWhenDisabled: true,
							disabled: isBusy || ! canCreate,
							isBusy,
							onClick: createPage,
							variant: 'primary',
						},
						__( 'Create page' )
					)
				)
			),
			formPreviewContent &&
				el(
					'div',
					{ className: 'cnl-add-page-form__preview' },
					el(
						'div',
						{
							className:
								'cnl-design-picker__preview cnl-add-page-form__preview-page',
						},
						el( LazyEditorPreview, {
							content: formPreviewContent,
							description: selectedLayout
								? getPatternTitle( selectedLayout )
								: __( 'Blank page' ),
						} )
					)
				)
		);
	}

	const currentPageLayoutPage = Math.min(
		pageLayoutPage,
		pageLayoutPageCount
	);
	const visiblePageLayouts = activePageLayouts.slice(
		( currentPageLayoutPage - 1 ) * pageLayoutPerPage,
		currentPageLayoutPage * pageLayoutPerPage
	);
	/*
	 * Only lay out the rows that actually have designs in them, so a partly
	 * filled last page stretches to fill the panel instead of leaving a void.
	 */
	const visiblePageLayoutRows = Math.max(
		1,
		Math.min(
			activePageLayoutDensity.rows,
			Math.ceil(
				visiblePageLayouts.length / activePageLayoutDensity.columns
			)
		)
	);
	const firstVisiblePageLayoutIndex =
		( currentPageLayoutPage - 1 ) * pageLayoutPerPage + 1;
	const lastVisiblePageLayoutIndex = Math.min(
		currentPageLayoutPage * pageLayoutPerPage,
		activePageLayouts.length
	);
	let designs;

	if ( isLoadingPageLayouts ) {
		designs = el( PageLayoutResultsPlaceholder, {
			columns: activePageLayoutDensity.columns,
			rows: activePageLayoutDensity.rows,
		} );
	} else if ( ! activePageLayouts.length ) {
		designs = el(
			Text,
			{ className: 'cnl-design-picker__empty', variant: 'body-md' },
			__(
				'Your theme has no page designs to offer, so start from scratch.'
			)
		);
	} else {
		designs = el(
			'section',
			{
				'aria-labelledby': `${ idPrefix }-heading`,
				className: 'cnl-add-page-layout-results',
			},
			el(
				GroupHeading,
				{
					id: `${ idPrefix }-heading`,
					label: activePageLayoutGroup?.label,
				},
				activePageLayouts.length > pageLayoutPerPage &&
					el(
						Stack,
						{
							'aria-label': __( 'Page design pagination' ),
							align: 'center',
							className: 'cnl-add-page-layout-pagination',
							direction: 'row',
							gap: 'xs',
							render: el( 'nav' ),
						},
						el( Button, {
							accessibleWhenDisabled: true,
							disabled: currentPageLayoutPage === 1,
							icon: chevronLeftIcon,
							label: __( 'Previous designs' ),
							onClick: goToPreviousPageLayouts,
							size: 'compact',
							variant: 'tertiary',
						} ),
						el(
							Text,
							{
								className:
									'cnl-add-page-layout-pagination__label',
								variant: 'body-sm',
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
							accessibleWhenDisabled: true,
							disabled:
								currentPageLayoutPage === pageLayoutPageCount,
							icon: chevronRightIcon,
							label: __( 'Next designs' ),
							onClick: goToNextPageLayouts,
							size: 'compact',
							variant: 'tertiary',
						} )
					)
			),
			el(
				'div',
				{
					className: 'cnl-add-page-layout-grid',
					style: {
						'--cnl-add-page-layout-columns':
							activePageLayoutDensity.columns,
						'--cnl-add-page-layout-rows': visiblePageLayoutRows,
					},
				},
				visiblePageLayouts.map( ( pattern ) =>
					el( PageLayoutCard, {
						key: pattern.name,
						onSelect: handleSelectLayout,
						pageTemplateContent,
						pattern,
					} )
				)
			)
		);
	}

	return el(
		DesignPicker,
		{
			actions: [
				pageTemplateOptions.length > 1 &&
					el( SelectControl, {
						__next40pxDefaultSize: true,
						__nextHasNoMarginBottom: true,
						className: 'cnl-add-page-layout-template-select',
						key: 'template',
						label: __( 'Preview with' ),
						labelPosition: 'side',
						onChange: ( value ) =>
							setSelectedTemplateSlug( String( value ) ),
						options: pageTemplateOptions,
						value: selectedTemplateSlug,
					} ),
				el(
					ToggleGroupControl,
					{
						__next40pxDefaultSize: true,
						hideLabelFromVision: true,
						isBlock: false,
						key: 'density',
						label: __( 'Preview size' ),
						onChange: ( value ) =>
							setPageLayoutColumns( Number( value ) ),
						value: pageLayoutColumns,
					},
					PAGE_LAYOUT_DENSITIES.map( ( density ) =>
						el( ToggleGroupControlOptionIcon, {
							icon: el( GridShapeIcon, {
								columns: density.columns,
								rows: density.rows,
							} ),
							key: density.columns,
							label: density.label,
							value: density.columns,
						} )
					)
				),
			],
			className: 'cnl-add-page-modal',
			mainClassName: 'cnl-add-page-layout-main',
			nav: el(
				DesignPickerNav,
				{
					current: activePageType,
					items: visiblePageLayoutGroups.map( ( group ) => ( {
						label: group.label,
						value: group.slug,
					} ) ),
					label: __( 'Page types' ),
					onSelect: setSelectedPageType,
				},
				isLoadingPageLayouts && el( PageLayoutSidebarPlaceholder )
			),
			onClose,
			subtitle: __(
				'Choose a design to get started. You can change anything on it later.'
			),
			title: __( 'Add a page' ),
		},
		el( StartFromScratch, {
			description: __( 'Build your page on a blank canvas' ),
			onClick: handleStartBlank,
		} ),
		designs
	);
}

function TabLabel( { icon, label } ) {
	return el(
		'span',
		{ className: 'routes-post-list__tab-label' },
		icon &&
			el( LegacyIcon, {
				className: 'routes-post-list__tab-icon',
				icon: icon.replace( /^dashicons-/, '' ),
				size: 20,
			} ),
		label
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
			el( DataViews.Layout ),
			el( DataViews.Pagination )
		)
	);
}

function useContentRecords() {
	const params = useParams( { strict: false } );
	const searchParams = useSearch( { strict: false } );
	const type = getPostType( params.type );
	const [ contentView, setContentView ] = useState( () =>
		getInitialContentView( searchParams, type )
	);
	const previousTypeNameRef = useRef( type?.name );
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

	useEffect( () => {
		if ( previousTypeNameRef.current === type?.name ) {
			return;
		}

		previousTypeNameRef.current = type?.name;
		setContentView( ( currentView ) => ( {
			...currentView,
			fields: getDefaultContentViewFields( type ),
			type: getDefaultContentViewType( type ),
		} ) );
	}, [ type ] );

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
		selectedTemplateId,
		setContentView,
		templates,
		type,
	} = useContentRecords();
	const mainMenu = useMainMenu();
	const { frontPageId, postsPageId } = useSelect( ( select ) => {
		const site = select( coreDataStore ).getEntityRecord( 'root', 'site' );

		return {
			frontPageId:
				site?.show_on_front === 'page'
					? Number( site?.page_on_front ) || 0
					: 0,
			postsPageId:
				site?.show_on_front === 'page'
					? Number( site?.page_for_posts ) || 0
					: 0,
		};
	}, [] );
	const isPages = type?.name === 'page';
	const contentFields = useMemo(
		() =>
			getContentFields( {
				frontPageId,
				isPages,
				menuPages: mainMenu.menuPages,
				postsPageId,
			} ),
		[ frontPageId, isPages, mainMenu.menuPages, postsPageId ]
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
	const drilledPageId =
		isPages && ! showTemplates ? Number( searchParams.postId ) || 0 : 0;

	if ( drilledPageId ) {
		return el( PageDetailStage, {
			key: drilledPageId,
			pageId: drilledPageId,
		} );
	}
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

		if ( ! type.blockEditor ) {
			if ( type.newUrl ) {
				window.open( type.newUrl, '_blank', 'noopener,noreferrer' );
			}
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

	const contentList = isPages
		? el( PagesTree, {
				canCreate: type.canCreate,
				onAddPage: openCreateFlow,
			} )
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
					key: `${ previewTemplatesKey }|${ frontPageId }|${ postsPageId }|${
						mainMenu.menuPages ? 'menu' : 'no-menu'
					}`,
					onChangeSelection: () => {},
					onChangeView: onChangeContentView,
					onClickItem: ( item ) => selectPost( item.id ),
					paginationInfo: {
						totalItems: posts.length,
						totalPages,
					},
					selection: EMPTY_ARRAY,
					view: contentView,
				},
				el( PostListDataViewsLayout )
			);

	return el(
		Page,
		{
			actions: pageActions,
			className: 'cnl-editor-stage cnl-editor-content-page',
			hasPadding: false,
			headingLevel: 2,
			subTitle:
				( type.name === 'page' &&
					__(
						'Every page on your site. Pick one to see it, or edit it to change what is on it.'
					) ) ||
				( type.name === 'post' &&
					__( 'Your blog posts, newest first.' ) ) ||
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
						el( TabLabel, {
							icon: type.menuIcon,
							label: type.menuName || type.label,
						} )
					),
					el(
						Tabs.Tab,
						{ value: 'templates' },
						el( TabLabel, {
							icon: 'dashicons-layout',
							label: __( 'Layouts' ),
						} )
					)
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
						'Layouts decide how your %s are arranged, like where the title and image go. WordPress calls these templates. Changing a layout changes every page that uses it.'
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
									el(
										'span',
										{
											'aria-hidden': true,
											className:
												'routes-post-list__template-card-icon',
										},
										el( Icon, {
											icon: getTemplateIcon( template ),
										} )
									),
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
										)
									)
								),
								el( TemplateDescriptionInfo, {
									authorText:
										getTemplateAuthorText( template ),
									description:
										getTemplateDescription( template ),
								} )
							);
						} ),
					! isLoading && templates.length === 0 && templateEmpty
				)
			: contentList,
		showTemplates &&
			templates.length > 0 &&
			el(
				'div',
				{ className: 'routes-post-list__template-footer' },
				el(
					'span',
					null,
					__( 'Other parts of your site have layouts too.' ),
					' '
				),
				el(
					Button,
					{
						onClick: () => navigate( { to: '/templates' } ),
						variant: 'link',
					},
					__( 'See all layouts.' )
				)
			),
		isAddingPage &&
			type.name === 'page' &&
			el( AddPageFlow, {
				mainMenu,
				onClose: () => setIsAddingPage( false ),
				templates,
			} )
	);
}

function Canvas() {
	const params = useParams( { strict: false } );
	const searchParams = useSearch( { strict: false } );

	if (
		params.type === 'page' &&
		getActiveTab( searchParams ) !== 'templates'
	) {
		return el( PagesCanvas );
	}

	return el( ContentCanvas );
}

function ContentCanvas() {
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
						__( 'See all layouts' )
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

export const stage = withUiTheme( Stage );
export const canvas = withUiTheme( Canvas );
