/**
 * WordPress dependencies
 */
import { useNavigate, useParams } from '@wordpress/route';
import { _n } from '@wordpress/i18n';
import { Preview as LazyEditorPreview } from '@wordpress/lazy-editor';

/**
 * Internal dependencies
 */
import { cnlEditorStore, getErrorMessage, getTitleText } from '../../records';
import {
	addSubmenuIcon,
	archiveIcon,
	blockDefaultIcon,
	blocksStore,
	Breadcrumbs,
	Button,
	categoryIcon,
	CheckboxControl,
	chevronDownIcon,
	chevronLeftIcon,
	compassIcon,
	coreDataStore,
	customLinkIcon,
	DataViewsPicker,
	decodeEntities,
	DropdownMenu,
	el,
	EmptyState,
	Icon,
	fileIcon,
	filterSortAndPaginate,
	imageIcon,
	layoutIcon,
	linkIcon,
	MenuGroup,
	MenuItem,
	Modal,
	moreVerticalIcon,
	noticesStore,
	Notice,
	pageIcon,
	pencilIcon,
	plusIcon,
	postCategoriesIcon,
	postListIcon,
	Page,
	SelectControl,
	Spinner,
	sprintf,
	TextControl,
	trashIcon,
	Tabs,
	updateIcon,
	useDispatch,
	useEffect,
	useMemo,
	useSelect,
	useState,
	__,
	registerCoreBlocks,
} from '../../wordpress-packages';
import {
	appendNavigationBlocksToContent,
	createManualNavigationContentFromPages,
	createNavigationLinkBlock,
	createNavigationLinkBlockFromPage,
	createNavigationSubmenuBlock,
	createNavigationSubmenuBlockFromPage,
	getManualNavigationItems,
	getNavigationPageTitle,
	getParsedBlocks,
	isAutoMenuContent,
} from './navigation-blocks';
import {
	assignNavigationMenuToFirstBlock,
	buildNavigationLocationsMap,
	compareTemplatePartsByArea,
	getLocationAreaLabel,
	getLocationLabel,
	getTemplatePartRawContent,
	mergeTemplatePartWithEditedRecord,
	removeNavigationMenuFromFirstBlock,
	templatePartHasNavigationBlock,
} from '../navigation/navigation-locations';

const NAVIGATION_POST_TYPE = 'wp_navigation';
const PAGE_QUERY = {
	context: 'edit',
	order: 'asc',
	orderby: 'menu_order',
	per_page: 100,
	status: 'publish',
	_fields: 'id,link,menu_order,parent,title,type',
};
const NAVIGATION_MENUS_QUERY = {
	context: 'edit',
	order: 'desc',
	orderby: 'date',
	per_page: 100,
	status: 'publish,draft',
	_fields: 'id,title,content,status',
};
const TEMPLATE_PARTS_QUERY = {
	context: 'edit',
	per_page: 100,
	_fields: 'id,slug,title,area,status,content',
};
const EMPTY_ARRAY = [];
let didRegisterCoreBlocks = false;

function ensureCoreBlocksRegistered() {
	if ( didRegisterCoreBlocks || typeof window === 'undefined' ) {
		return;
	}

	registerCoreBlocks();
	didRegisterCoreBlocks = true;
}

ensureCoreBlocksRegistered();

function getMenuContent( menu ) {
	if ( typeof menu?.content === 'string' ) {
		return menu.content;
	}

	return menu?.content?.raw || '';
}

function getMenuTitle( menu ) {
	return getTitleText( menu?.title ) || __( 'Navigation' );
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
		el( EmptyState.Title, null, __( 'No menu selected' ) )
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

function getPageTitle( page ) {
	return getNavigationPageTitle( page ) || __( '(no title)' );
}

function NavigationItemsList( { items } ) {
	if ( ! items.length ) {
		return el(
			'p',
			{ className: 'routes-navigation-edit__empty-list' },
			__( 'No menu items yet.' )
		);
	}

	return el(
		'ul',
		{ className: 'routes-navigation-edit__items' },
		items.map( ( item ) =>
			el(
				'li',
				{
					className: 'routes-navigation-edit__item',
					key: item.id,
					style: { '--navigation-edit-depth': item.depth },
				},
				el( Icon, {
					className: 'routes-navigation-edit__item-icon',
					icon: item.isSubmenu ? postListIcon : pageIcon,
				} ),
				el( 'span', null, item.label )
			)
		)
	);
}

function closeDropdownThen( onClose, callback ) {
	onClose?.();
	callback();
}

function AddMenuItemDropdown( { onChooseMode } ) {
	const [ isChoosingSubmenuType, setIsChoosingSubmenuType ] =
		useState( false );

	return el(
		DropdownMenu,
		{
			icon: plusIcon,
			label: __( 'Add menu item' ),
			popoverProps: { placement: 'bottom-start' },
			onToggle: ( isOpen ) => {
				if ( ! isOpen ) {
					setIsChoosingSubmenuType( false );
				}
			},
			toggleProps: {
				className: 'routes-navigation-edit__add-button',
				variant: 'primary',
			},
		},
		( { onClose } ) => {
			return el(
				'div',
				{ className: 'routes-navigation-edit__add-menu' },
				isChoosingSubmenuType &&
					el(
						MenuGroup,
						null,
						el(
							MenuItem,
							{
								icon: chevronLeftIcon,
								onClick: () =>
									setIsChoosingSubmenuType( false ),
							},
							__( 'Back' )
						)
					),
				isChoosingSubmenuType &&
					el(
						MenuGroup,
						null,
						el(
							MenuItem,
							{
								icon: pageIcon,
								onClick: () =>
									closeDropdownThen( onClose, () =>
										onChooseMode( 'submenu-page' )
									),
							},
							__( 'Existing page' )
						),
						el(
							MenuItem,
							{
								icon: linkIcon,
								onClick: () =>
									closeDropdownThen( onClose, () =>
										onChooseMode( 'submenu-custom' )
									),
							},
							__( 'Custom link' )
						),
						el(
							MenuItem,
							{
								icon: addSubmenuIcon,
								onClick: () =>
									closeDropdownThen( onClose, () =>
										onChooseMode( 'submenu-label' )
									),
							},
							__( 'Label only' )
						)
					),
				! isChoosingSubmenuType &&
					el(
						MenuGroup,
						null,
						el(
							MenuItem,
							{
								icon: pageIcon,
								onClick: () =>
									closeDropdownThen( onClose, () =>
										onChooseMode( 'existing-page' )
									),
							},
							__( 'Add existing page' )
						),
						el(
							MenuItem,
							{
								icon: linkIcon,
								onClick: () =>
									closeDropdownThen( onClose, () =>
										onChooseMode( 'custom-link' )
									),
							},
							__( 'Custom link' )
						),
						el(
							MenuItem,
							{
								icon: addSubmenuIcon,
								onClick: () => setIsChoosingSubmenuType( true ),
							},
							__( 'Submenu' )
						)
					),
				! isChoosingSubmenuType &&
					el(
						MenuGroup,
						null,
						el(
							MenuItem,
							{
								icon: postCategoriesIcon,
								onClick: () =>
									closeDropdownThen( onClose, () =>
										onChooseMode( 'more' )
									),
							},
							__( 'More…' )
						)
					)
			);
		}
	);
}

function PageSelectModal( {
	isSaving,
	mode,
	onAddPage,
	onClose,
	pages,
	title,
} ) {
	const [ selectedPageId, setSelectedPageId ] = useState(
		pages[ 0 ]?.id ? String( pages[ 0 ].id ) : ''
	);
	const selectedPage = useMemo(
		() =>
			pages.find(
				( page ) => String( page.id ) === String( selectedPageId )
			),
		[ pages, selectedPageId ]
	);

	useEffect( () => {
		if ( ! selectedPageId && pages[ 0 ]?.id ) {
			setSelectedPageId( String( pages[ 0 ].id ) );
		}
	}, [ pages, selectedPageId ] );

	return el(
		Modal,
		{
			className: 'routes-navigation-edit__item-modal',
			onRequestClose: onClose,
			title,
		},
		pages.length === 0 &&
			el(
				'p',
				null,
				__( 'There are no published pages available to add.' )
			),
		pages.length > 0 &&
			el( SelectControl, {
				__next40pxDefaultSize: true,
				__nextHasNoMarginBottom: true,
				label: __( 'Page' ),
				onChange: setSelectedPageId,
				options: pages.map( ( page ) => ( {
					label: getPageTitle( page ),
					value: String( page.id ),
				} ) ),
				value: selectedPageId,
			} ),
		el(
			'div',
			{
				className: 'routes-navigation-edit__modal-actions',
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
					disabled: ! selectedPage || isSaving,
					isBusy: isSaving,
					onClick: () => onAddPage( selectedPage, mode ),
					variant: 'primary',
				},
				mode === 'submenu-page' ? __( 'Add submenu' ) : __( 'Add page' )
			)
		)
	);
}

function CustomLinkModal( {
	isSaving,
	isSubmenu = false,
	onAddLink,
	onClose,
	title,
} ) {
	const [ label, setLabel ] = useState( '' );
	const [ url, setUrl ] = useState( '' );
	const canSave = label.trim() && url.trim();

	const submit = ( event ) => {
		event.preventDefault();

		if ( canSave ) {
			onAddLink( { isSubmenu, label: label.trim(), url: url.trim() } );
		}
	};

	return el(
		Modal,
		{
			className: 'routes-navigation-edit__item-modal',
			onRequestClose: onClose,
			title,
		},
		el(
			'form',
			{
				className: 'routes-navigation-edit__item-form',
				onSubmit: submit,
			},
			el( TextControl, {
				__next40pxDefaultSize: true,
				label: __( 'Label' ),
				onChange: setLabel,
				value: label,
			} ),
			el( TextControl, {
				__next40pxDefaultSize: true,
				label: __( 'URL' ),
				onChange: setUrl,
				type: 'url',
				value: url,
			} ),
			el(
				'div',
				{
					className: 'routes-navigation-edit__modal-actions',
				},
				el(
					Button,
					{
						disabled: isSaving,
						onClick: onClose,
						type: 'button',
						variant: 'tertiary',
					},
					__( 'Cancel' )
				),
				el(
					Button,
					{
						disabled: ! canSave || isSaving,
						isBusy: isSaving,
						type: 'submit',
						variant: 'primary',
					},
					isSubmenu ? __( 'Add submenu' ) : __( 'Add link' )
				)
			)
		)
	);
}

function LabelOnlySubmenuModal( { isSaving, onAddSubmenu, onClose } ) {
	const [ label, setLabel ] = useState( '' );
	const canSave = label.trim();

	const submit = ( event ) => {
		event.preventDefault();

		if ( canSave ) {
			onAddSubmenu( label.trim() );
		}
	};

	return el(
		Modal,
		{
			className: 'routes-navigation-edit__item-modal',
			onRequestClose: onClose,
			title: __( 'Label only submenu' ),
		},
		el(
			'form',
			{
				className: 'routes-navigation-edit__item-form',
				onSubmit: submit,
			},
			el( TextControl, {
				__next40pxDefaultSize: true,
				label: __( 'Submenu label' ),
				onChange: setLabel,
				value: label,
			} ),
			el(
				'div',
				{
					className: 'routes-navigation-edit__modal-actions',
				},
				el(
					Button,
					{
						disabled: isSaving,
						onClick: onClose,
						type: 'button',
						variant: 'tertiary',
					},
					__( 'Cancel' )
				),
				el(
					Button,
					{
						disabled: ! canSave || isSaving,
						isBusy: isSaving,
						type: 'submit',
						variant: 'primary',
					},
					__( 'Add drop-down' )
				)
			)
		)
	);
}

const MENU_ITEM_GROUPS = [
	{
		description: __( 'Site pages and page-like content.' ),
		icon: pageIcon,
		id: 'pages',
		title: __( 'Pages' ),
	},
	{
		description: __( 'Posts and other individual content.' ),
		icon: postListIcon,
		id: 'content',
		title: __( 'Content' ),
	},
	{
		description: __( 'Blocks that can be inserted into navigation menus.' ),
		icon: blockDefaultIcon,
		id: 'blocks',
		title: __( 'Blocks' ),
	},
	{
		description: __( 'Categories, tags, and other term archives.' ),
		icon: categoryIcon,
		id: 'taxonomy',
		title: __( 'Categories & tags' ),
	},
	{
		description: __(
			'Post type archive index pages, such as all Posts, Products, or Events.'
		),
		icon: archiveIcon,
		id: 'archives',
		title: __( 'Archives' ),
	},
	{
		description: __( 'Media files and downloads.' ),
		icon: imageIcon,
		id: 'media',
		title: __( 'Media' ),
	},
	{
		description: __( 'Any URL, email, phone, anchor, or relative link.' ),
		icon: customLinkIcon,
		id: 'custom',
		title: __( 'Custom link' ),
	},
];
const PRIMARY_MENU_ITEM_GROUPS = new Set( [ 'pages', 'content', 'blocks' ] );
const EXCLUDED_BLOCK_INSERTIONS = new Set( [
	'core/navigation-link',
	'core/navigation-submenu',
	'core/home-link',
] );
const MENU_ITEM_GROUPS_BY_ID = Object.fromEntries(
	MENU_ITEM_GROUPS.map( ( group ) => [ group.id, group ] )
);

function createPickerView( group ) {
	let fields = [ 'typeLabel', 'linkLabel', 'inThisMenu' ];

	if ( group === 'pages' ) {
		fields = [ 'status', 'inThisMenu' ];
	} else if ( group === 'blocks' ) {
		fields = [ 'description' ];
	}

	return {
		descriptionField: 'linkLabel',
		fields,
		filters: [],
		layout: {
			badgeFields: [ 'typeLabel', 'status', 'inThisMenu' ],
			previewSize: group === 'media' ? 140 : 160,
		},
		mediaField: 'preview',
		page: 1,
		perPage: 25,
		search: '',
		showDescription: false,
		showMedia: group === 'media',
		titleField: 'title',
		type: group === 'media' ? 'pickerGrid' : 'pickerTable',
	};
}

function getLinkedNavigationStateFromContent( content ) {
	const linkedState = {
		entityKeys: new Set(),
		urls: new Set(),
	};

	function visitBlock( block ) {
		const attributes = block.attributes || block.attrs || {};
		if (
			block.name === 'core/navigation-link' ||
			block.blockName === 'core/navigation-link' ||
			block.name === 'core/navigation-submenu' ||
			block.blockName === 'core/navigation-submenu'
		) {
			if ( attributes.url ) {
				linkedState.urls.add( attributes.url );
			}
			if ( attributes.kind && attributes.type && attributes.id ) {
				linkedState.entityKeys.add(
					`${ attributes.kind }:${ attributes.type }:${ attributes.id }`
				);
			}
		}

		( block.innerBlocks || EMPTY_ARRAY ).forEach( visitBlock );
	}

	getParsedBlocks( content ).forEach( visitBlock );
	return linkedState;
}

function isPickerItemInMenu( item, linkedState ) {
	const entityKey =
		item.sourceKind !== 'custom' && item.objectId
			? `${ item.sourceKind }:${ item.sourceType }:${ item.objectId }`
			: null;

	return (
		!! ( entityKey && linkedState.entityKeys.has( entityKey ) ) ||
		!! ( item.url && linkedState.urls.has( item.url ) )
	);
}

function getRecordStatusLabel( status ) {
	return status === 'publish' ? __( 'Published' ) : __( 'Draft' );
}

function normalizeMenuItemUrl( rawUrl ) {
	const trimmed = rawUrl.trim();

	if ( ! trimmed ) {
		return { error: __( 'Enter a URL' ) };
	}

	try {
		if ( trimmed.startsWith( '#' ) ) {
			return { href: trimmed };
		}

		if (
			trimmed.startsWith( '/' ) ||
			trimmed.startsWith( './' ) ||
			trimmed.startsWith( '../' )
		) {
			const url = new URL( trimmed, 'https://example.invalid' );
			return { href: `${ url.pathname }${ url.search }${ url.hash }` };
		}

		if ( /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( trimmed ) ) {
			return { href: `mailto:${ trimmed }` };
		}

		const href = /^[a-z][a-z0-9+.-]*:/i.test( trimmed )
			? trimmed
			: `https://${ trimmed }`;
		new URL( href );
		return { href };
	} catch {
		return { error: __( 'Enter a valid URL' ) };
	}
}

function createBlockFromPickerItem( item ) {
	if ( item.group === 'blocks' ) {
		return {
			attributes: {},
			innerBlocks: [],
			name: item.blockName,
		};
	}

	return createNavigationLinkBlock( {
		id: item.objectId,
		kind: item.sourceKind,
		label: item.title,
		type: item.sourceType,
		url: item.url,
	} );
}

function AddMenuItemsModal( {
	content,
	isSaving,
	onAddBlocks,
	onClose,
	pages,
} ) {
	const [ activeGroup, setActiveGroup ] = useState( 'pages' );
	const [ areMoreGroupsVisible, setAreMoreGroupsVisible ] = useState( false );
	const [ customLabel, setCustomLabel ] = useState( '' );
	const [ customUrl, setCustomUrl ] = useState( '' );
	const [ error, setError ] = useState( '' );
	const [ selection, setSelection ] = useState( [] );
	const [ view, setView ] = useState( () => createPickerView( 'pages' ) );
	const {
		isResolvingContent,
		isResolvingMedia,
		isResolvingTerms,
		media,
		posts,
		terms,
	} = useSelect( ( select ) => {
		const store = select( coreDataStore );
		const postArgs = [
			'postType',
			'post',
			{
				context: 'edit',
				order: 'desc',
				orderby: 'date',
				per_page: 25,
				status: 'publish,draft,pending,private',
				_fields: 'id,link,status,title,type',
			},
		];
		const categoryArgs = [
			'taxonomy',
			'category',
			{
				context: 'view',
				hide_empty: false,
				order: 'asc',
				orderby: 'name',
				per_page: 25,
			},
		];
		const tagArgs = [
			'taxonomy',
			'post_tag',
			{
				context: 'view',
				hide_empty: false,
				order: 'asc',
				orderby: 'name',
				per_page: 25,
			},
		];
		const mediaArgs = [
			'postType',
			'attachment',
			{
				context: 'edit',
				order: 'desc',
				orderby: 'date',
				per_page: 50,
				_fields:
					'id,link,media_type,mime_type,source_url,status,title,type',
			},
		];

		return {
			isResolvingContent: store.isResolving(
				'getEntityRecords',
				postArgs
			),
			isResolvingMedia: store.isResolving(
				'getEntityRecords',
				mediaArgs
			),
			isResolvingTerms:
				store.isResolving( 'getEntityRecords', categoryArgs ) ||
				store.isResolving( 'getEntityRecords', tagArgs ),
			media: store.getEntityRecords( ...mediaArgs ) || EMPTY_ARRAY,
			posts: store.getEntityRecords( ...postArgs ) || EMPTY_ARRAY,
			terms: [
				...(
					store.getEntityRecords( ...categoryArgs ) || EMPTY_ARRAY
				).map( ( term ) => ( {
					...term,
					taxonomy: 'category',
				} ) ),
				...( store.getEntityRecords( ...tagArgs ) || EMPTY_ARRAY ).map(
					( term ) => ( {
						...term,
						taxonomy: 'post_tag',
					} )
				),
			],
		};
	}, [] );
	const blockItems = useSelect( ( select ) => {
		const { getBlockType } = select( blocksStore );
		const navigationBlock = getBlockType( 'core/navigation' );

		return ( navigationBlock?.allowedBlocks || [] )
			.filter( ( name ) => ! EXCLUDED_BLOCK_INSERTIONS.has( name ) )
			.map( ( name ) => getBlockType( name ) )
			.filter( Boolean )
			.map( ( blockType ) => ( {
				blockIcon: blockType.icon?.src,
				blockName: blockType.name,
				description: blockType.description,
				group: 'blocks',
				id: `block:${ blockType.name }`,
				inThisMenu: false,
				linkLabel: blockType.name,
				sourceKind: 'custom',
				sourceType: blockType.name,
				title: blockType.title || blockType.name,
				typeLabel: __( 'Block' ),
			} ) );
	}, [] );
	const linkedState = useMemo(
		() => getLinkedNavigationStateFromContent( content ),
		[ content ]
	);
	const items = useMemo( () => {
		const nextItems = [
			...pages.map( ( page ) => ( {
				group: 'pages',
				id: `post-type:page:${ page.id }`,
				linkLabel: page.link || '',
				objectId: page.id,
				sourceKind: 'post-type',
				sourceType: 'page',
				status: page.status || 'publish',
				title: getPageTitle( page ),
				typeLabel: __( 'Page' ),
				url: page.link || '',
			} ) ),
			...posts.map( ( post ) => ( {
				group: 'content',
				id: `post-type:post:${ post.id }`,
				linkLabel: post.link || '',
				objectId: post.id,
				sourceKind: 'post-type',
				sourceType: post.type || 'post',
				status: post.status || 'publish',
				title: getPageTitle( post ),
				typeLabel: __( 'Post' ),
				url: post.link || '',
			} ) ),
			...blockItems,
			...terms.map( ( term ) => ( {
				group: 'taxonomy',
				id: `taxonomy:${ term.taxonomy }:${ term.id }`,
				linkLabel: term.link || '',
				objectId: term.id,
				sourceKind: 'taxonomy',
				sourceType: term.taxonomy === 'post_tag' ? 'tag' : 'category',
				title: decodeEntities( term.name || __( '(no title)' ) ),
				typeLabel:
					term.taxonomy === 'post_tag'
						? __( 'Tag' )
						: __( 'Category' ),
				url: term.link || '',
			} ) ),
			{
				group: 'archives',
				id: 'post-type-archive:post',
				linkLabel: '/?post_type=post',
				sourceKind: 'post-type-archive',
				sourceType: 'post',
				title: __( 'Posts' ),
				typeLabel: __( 'Archive' ),
				url: '/?post_type=post',
			},
			...media.map( ( item ) => ( {
				group: 'media',
				id: `post-type:attachment:${ item.id }`,
				linkLabel: item.link || item.source_url || '',
				mediaUrl:
					item.media_type === 'image' ? item.source_url : undefined,
				objectId: item.id,
				sourceKind: 'post-type',
				sourceType: 'attachment',
				status: item.status || 'publish',
				title: getPageTitle( item ),
				typeLabel:
					item.media_type === 'image' ? __( 'Image' ) : __( 'Media' ),
				url: item.link || item.source_url || '',
			} ) ),
		];

		return nextItems.map( ( item ) => ( {
			...item,
			inThisMenu: isPickerItemInMenu( item, linkedState ),
		} ) );
	}, [ blockItems, linkedState, media, pages, posts, terms ] );
	const group = MENU_ITEM_GROUPS_BY_ID[ activeGroup ];
	const activeItems = items.filter( ( item ) => item.group === activeGroup );
	const { data: shownData, paginationInfo } = useMemo(
		() => filterSortAndPaginate( activeItems, view, pickerFields ),
		[ activeItems, view ]
	);
	const selectedItems = activeItems.filter( ( item ) =>
		selection.includes( item.id )
	);
	const isResolving =
		( activeGroup === 'content' && isResolvingContent ) ||
		( activeGroup === 'taxonomy' && isResolvingTerms ) ||
		( activeGroup === 'media' && isResolvingMedia );
	const selectGroup = ( nextGroup ) => {
		setActiveGroup( nextGroup );
		setError( '' );
		setSelection( [] );
		setView( createPickerView( nextGroup ) );
	};
	const addSelectedItems = () => {
		if ( selectedItems.length === 0 || isSaving ) {
			return;
		}

		onAddBlocks( selectedItems.map( createBlockFromPickerItem ) );
	};
	const addCustomLink = () => {
		const normalizedUrl = normalizeMenuItemUrl( customUrl );

		if ( normalizedUrl.error ) {
			setError( normalizedUrl.error );
			return;
		}

		const trimmedLabel = customLabel.trim();

		if ( ! trimmedLabel ) {
			setError( __( 'Enter link text' ) );
			return;
		}

		onAddBlocks( [
			createNavigationLinkBlock( {
				kind: 'custom',
				label: trimmedLabel,
				url: normalizedUrl.href,
			} ),
		] );
	};

	return el(
		Modal,
		{
			className: 'navigation-add-items-modal',
			onRequestClose: onClose,
			title: __( 'Add menu items' ),
		},
		el(
			'div',
			{ className: 'navigation-add-items-modal__inner' },
			el(
				Tabs.Root,
				{
					className: 'navigation-add-items-modal__tabs',
					onValueChange: selectGroup,
					orientation: 'vertical',
					value: activeGroup,
				},
				el(
					Tabs.List,
					{ className: 'navigation-add-items-modal__tablist' },
					MENU_ITEM_GROUPS.filter(
						( itemGroup ) =>
							PRIMARY_MENU_ITEM_GROUPS.has( itemGroup.id ) ||
							areMoreGroupsVisible
					).map( ( itemGroup ) =>
						el(
							Tabs.Tab,
							{
								className: 'navigation-add-items-modal__tab',
								key: itemGroup.id,
								value: itemGroup.id,
							},
							el(
								'span',
								{
									className:
										'navigation-add-items-modal__tab-icon',
								},
								el( Icon, { icon: itemGroup.icon } )
							),
							el(
								'span',
								{
									className:
										'navigation-add-items-modal__tab-label',
								},
								itemGroup.title
							)
						)
					),
					! areMoreGroupsVisible &&
						el(
							Button,
							{
								className:
									'navigation-add-items-modal__more-tab',
								onClick: () => setAreMoreGroupsVisible( true ),
								variant: 'tertiary',
							},
							el(
								'span',
								{
									className:
										'navigation-add-items-modal__more-tab-icon',
								},
								el( Icon, { icon: chevronDownIcon } )
							),
							el(
								'span',
								{
									className:
										'navigation-add-items-modal__tab-label',
								},
								__( 'More' )
							)
						)
				),
				el(
					Tabs.Panel,
					{
						className: 'navigation-add-items-modal__panel',
						value: activeGroup,
					},
					el(
						'div',
						{ className: 'navigation-add-items-modal__header' },
						el(
							'div',
							null,
							el( 'h2', null, group.title ),
							el( 'p', null, group.description )
						)
					),
					activeGroup === 'custom'
						? el(
								'div',
								{
									className:
										'navigation-add-items-custom-link',
								},
								!! error &&
									el( Notice, { status: 'error' }, error ),
								el( TextControl, {
									__next40pxDefaultSize: true,
									label: __( 'URL' ),
									onChange: ( nextUrl ) => {
										setError( '' );
										setCustomUrl( nextUrl );
									},
									value: customUrl,
								} ),
								el( TextControl, {
									__next40pxDefaultSize: true,
									label: __( 'Link text' ),
									onChange: ( nextLabel ) => {
										setError( '' );
										setCustomLabel( nextLabel );
									},
									value: customLabel,
								} ),
								el(
									'div',
									{
										className:
											'navigation-add-items-custom-link__actions',
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
											disabled: isSaving,
											isBusy: isSaving,
											onClick: addCustomLink,
											variant: 'primary',
										},
										__( 'Add to menu' )
									)
								)
						  )
						: el(
								DataViewsPicker,
								{
									actions: [
										{
											callback: addSelectedItems,
											id: 'add-to-menu',
											isPrimary: true,
											label: __( 'Add to menu' ),
											supportsBulk: true,
										},
									],
									data: shownData,
									defaultLayouts: {
										pickerGrid: true,
										pickerTable: true,
									},
									fields: pickerFields,
									getItemId: ( item ) => item.id,
									isLoading: isResolving,
									itemListLabel: group.title,
									onChangeSelection: setSelection,
									onChangeView: setView,
									paginationInfo,
									selection,
									view,
								},
								el(
									'div',
									{
										className:
											'navigation-add-items-modal__toolbar',
									},
									el( DataViewsPicker.Search, {
										label: __( 'Search menu items' ),
									} ),
									el(
										'div',
										{
											className:
												'navigation-add-items-modal__toolbar-actions',
										},
										el( DataViewsPicker.FiltersToggle ),
										el( DataViewsPicker.ViewConfig ),
										el( DataViewsPicker.LayoutSwitcher )
									)
								),
								el( DataViewsPicker.FiltersToggled, {
									className:
										'navigation-add-items-modal__filters',
								} ),
								el(
									'div',
									{
										className:
											'navigation-add-items-modal__picker-scroll',
									},
									el( DataViewsPicker.BulkActionToolbar ),
									el( DataViewsPicker.Layout )
								),
								el(
									'div',
									{
										className:
											'navigation-add-items-modal__picker-footer',
									},
									el( DataViewsPicker.Footer )
								)
						  )
				)
			)
		)
	);
}

function PickerPreview( { item } ) {
	if ( item.group === 'media' && item.mediaUrl ) {
		return el(
			'div',
			{
				className: 'navigation-add-items-picker__preview is-image',
			},
			el( 'img', { alt: '', src: item.mediaUrl } )
		);
	}

	return el(
		'div',
		{ className: 'navigation-add-items-picker__preview' },
		el( 'div', {
			className: 'navigation-add-items-picker__preview-header',
		} ),
		el( 'div', {
			className: 'navigation-add-items-picker__preview-line',
		} ),
		el( 'div', {
			className: 'navigation-add-items-picker__preview-line is-short',
		} )
	);
}

function PickerSourceIcon( { item } ) {
	let icon = pageIcon;

	if ( item.group === 'blocks' ) {
		icon = item.blockIcon || blockDefaultIcon;
	} else if ( item.group === 'media' ) {
		icon = item.mediaUrl ? imageIcon : fileIcon;
	} else if ( item.group === 'taxonomy' ) {
		icon = categoryIcon;
	} else if ( item.group === 'custom' ) {
		icon = customLinkIcon;
	} else if ( item.group === 'archives' ) {
		icon = archiveIcon;
	} else if ( item.group === 'content' ) {
		icon = postListIcon;
	}

	return el(
		'span',
		{ className: 'navigation-add-items-picker__source-icon' },
		el( Icon, { icon } )
	);
}

const pickerFields = [
	{
		enableGlobalSearch: false,
		enableHiding: false,
		enableSorting: false,
		filterBy: false,
		id: 'preview',
		label: __( 'Preview' ),
		render: PickerPreview,
		type: 'media',
	},
	{
		enableGlobalSearch: true,
		enableHiding: false,
		id: 'title',
		label: __( 'Title' ),
		render: ( { item } ) =>
			el(
				'span',
				{ className: 'navigation-add-items-picker__title-cell' },
				el( PickerSourceIcon, { item } ),
				el(
					'span',
					{ className: 'navigation-add-items-picker__title' },
					item.title
				)
			),
		type: 'text',
	},
	{
		enableGlobalSearch: true,
		enableSorting: false,
		filterBy: false,
		id: 'description',
		label: __( 'Description' ),
		render: ( { item } ) =>
			el(
				'span',
				{ className: 'navigation-add-items-picker__description' },
				item.description || item.typeLabel
			),
		type: 'text',
	},
	{
		enableGlobalSearch: true,
		enableHiding: false,
		enableSorting: false,
		filterBy: false,
		id: 'typeLabel',
		label: __( 'Type' ),
		render: ( { item } ) =>
			el(
				'span',
				{ className: 'navigation-add-items-picker__type' },
				item.typeLabel
			),
		type: 'text',
	},
	{
		enableGlobalSearch: true,
		enableSorting: false,
		filterBy: false,
		id: 'linkLabel',
		label: __( 'Link' ),
		render: ( { item } ) =>
			el(
				'span',
				{ className: 'navigation-add-items-picker__link' },
				item.linkLabel
			),
		type: 'text',
	},
	{
		enableGlobalSearch: false,
		enableHiding: false,
		enableSorting: false,
		filterBy: false,
		id: 'status',
		label: __( 'Status' ),
		render: ( { item } ) =>
			el(
				'span',
				{
					className:
						item.status === 'publish'
							? 'navigation-add-items-picker__badge is-published'
							: 'navigation-add-items-picker__badge is-draft',
				},
				getRecordStatusLabel( item.status )
			),
		type: 'text',
	},
	{
		enableGlobalSearch: false,
		enableHiding: false,
		enableSorting: false,
		filterBy: false,
		id: 'inThisMenu',
		label: __( 'Menu' ),
		render: ( { item } ) =>
			item.inThisMenu
				? el(
						'span',
						{
							className:
								'navigation-add-items-picker__badge is-linked',
						},
						__( 'In this menu' )
				  )
				: el(
						'span',
						{ className: 'navigation-add-items-picker__empty' },
						'-'
				  ),
		type: 'text',
	},
];

function NavigationEditStage() {
	const navigate = useNavigate();
	const params = useParams( { strict: false } );
	const navigationId = Number( params.id );
	const [ isConfirmingCustomize, setIsConfirmingCustomize ] =
		useState( false );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ addMode, setAddMode ] = useState( null );
	const [ isRenaming, setIsRenaming ] = useState( false );
	const [ isDeleting, setIsDeleting ] = useState( false );
	const [ renameTitle, setRenameTitle ] = useState( '' );
	const { deleteEntityRecord, editEntityRecord } =
		useDispatch( coreDataStore );
	const { invalidateNavigationMenus } = useDispatch( cnlEditorStore );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );
	const { isLoadingMenu, isResolvingPages, menu, pages } = useSelect(
		( select ) => {
			const store = select( coreDataStore );
			const menuArgs = [ 'postType', NAVIGATION_POST_TYPE, navigationId ];
			const pageArgs = [ 'postType', 'page', PAGE_QUERY ];
			const rawMenu = store.getEntityRecord( ...menuArgs );

			return {
				isLoadingMenu:
					store.isResolving( 'getEntityRecord', menuArgs ) ||
					! store.hasFinishedResolution(
						'getEntityRecord',
						menuArgs
					),
				isResolvingPages:
					store.isResolving( 'getEntityRecords', pageArgs ) ||
					! store.hasFinishedResolution(
						'getEntityRecords',
						pageArgs
					),
				menu: rawMenu
					? store.getEditedEntityRecord( ...menuArgs )
					: rawMenu,
				pages: store.getEntityRecords( ...pageArgs ) || EMPTY_ARRAY,
			};
		},
		[ navigationId ]
	);
	const content = getMenuContent( menu );
	const isAutoMenu = isAutoMenuContent( content );
	const manualItems = useMemo(
		() => getManualNavigationItems( getParsedBlocks( content ) ),
		[ content ]
	);
	const autoMenuItems = useMemo(
		() =>
			pages.map( ( page ) => ( {
				depth: 0,
				id: page.id,
				isSubmenu: false,
				label: getPageTitle( page ),
			} ) ),
		[ pages ]
	);

	const editNavigationMenu = ( edits ) =>
		editEntityRecord(
			'postType',
			NAVIGATION_POST_TYPE,
			navigationId,
			edits
		);

	const addNavigationBlocks = async ( blocks, successMessage ) => {
		if ( ! blocks.length ) {
			return false;
		}

		setIsSaving( true );

		try {
			editNavigationMenu( {
				content: appendNavigationBlocksToContent( content, blocks ),
			} );
			setAddMode( null );
			createSuccessNotice( successMessage, { type: 'snackbar' } );
			return true;
		} catch ( error ) {
			createErrorNotice(
				sprintf(
					/* translators: %s: error message. */
					__( 'Unable to update navigation menu (%s).' ),
					getErrorMessage( error )
				),
				{ type: 'snackbar' }
			);
			return false;
		} finally {
			setIsSaving( false );
		}
	};

	const addPageToMenu = ( page, mode ) =>
		addNavigationBlocks(
			[
				mode === 'submenu-page'
					? createNavigationSubmenuBlockFromPage( page )
					: createNavigationLinkBlockFromPage( page ),
			],
			mode === 'submenu-page'
				? __(
						'Submenu added to menu. Review and save changes when you are ready.'
				  )
				: __(
						'Page added to menu. Review and save changes when you are ready.'
				  )
		);

	const addCustomLinkToMenu = ( { isSubmenu, label, url } ) =>
		addNavigationBlocks(
			[
				isSubmenu
					? createNavigationSubmenuBlock( {
							kind: 'custom',
							label,
							url,
					  } )
					: createNavigationLinkBlock( {
							kind: 'custom',
							label,
							url,
					  } ),
			],
			isSubmenu
				? __(
						'Submenu added to menu. Review and save changes when you are ready.'
				  )
				: __(
						'Link added to menu. Review and save changes when you are ready.'
				  )
		);

	const addLabelOnlySubmenuToMenu = ( label ) =>
		addNavigationBlocks(
			[
				createNavigationSubmenuBlock( {
					label,
					url: '#',
				} ),
			],
			__(
				'Submenu added to menu. Review and save changes when you are ready.'
			)
		);

	const addMenuItemsToMenu = ( blocks ) =>
		addNavigationBlocks(
			blocks,
			__(
				'Menu items added. Review and save changes when you are ready.'
			)
		);

	const closeAddMenuItemModal = () => {
		if ( ! isSaving ) {
			setAddMode( null );
		}
	};

	const customizeMenu = async () => {
		setIsSaving( true );

		try {
			editNavigationMenu( {
				content: createManualNavigationContentFromPages( pages ),
			} );
			createSuccessNotice(
				__(
					'Navigation menu customized. Review and save changes when you are ready.'
				),
				{ type: 'snackbar' }
			);
			setIsConfirmingCustomize( false );
		} catch ( error ) {
			createErrorNotice(
				sprintf(
					/* translators: %s: error message. */
					__( 'Unable to customize navigation menu (%s).' ),
					getErrorMessage( error )
				),
				{ type: 'snackbar' }
			);
		} finally {
			setIsSaving( false );
		}
	};

	const isMenuReady = ! isLoadingMenu && !! menu;
	const menuTitle = isMenuReady ? getMenuTitle( menu ) : __( 'Navigation' );
	const listItems = isAutoMenu ? autoMenuItems : manualItems;
	const isEmptyManualMenu = ! isAutoMenu && listItems.length === 0;

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

	const menuOptions =
		isMenuReady &&
		el(
			DropdownMenu,
			{
				icon: moreVerticalIcon,
				label: __( 'Navigation menu options' ),
				popoverProps: { placement: 'bottom-end' },
				toggleProps: { variant: 'tertiary' },
			},
			( { onClose } ) =>
				el(
					'div',
					null,
					el(
						MenuGroup,
						null,
						! isAutoMenu &&
							el(
								MenuItem,
								{
									icon: postCategoriesIcon,
									onClick: () => {
										setAddMode( 'more' );
										onClose();
									},
								},
								__( 'Add menu items' )
							),
						el(
							MenuItem,
							{
								icon: pencilIcon,
								onClick: () => {
									openRenameModal();
									onClose();
								},
							},
							__( 'Rename' )
						),
						el(
							MenuItem,
							{
								onClick: () =>
									navigate( {
										to: `/types/${ NAVIGATION_POST_TYPE }/edit/${ navigationId }`,
									} ),
							},
							__( 'Open block editor' )
						)
					),
					el(
						MenuGroup,
						null,
						el(
							MenuItem,
							{
								icon: trashIcon,
								isDestructive: true,
								onClick: () => {
									setIsDeleting( true );
									onClose();
								},
							},
							__( 'Delete' )
						)
					)
				)
		);

	return el(
		Page,
		{
			actions: menuOptions,
			ariaLabel: menuTitle,
			breadcrumbs: el( Breadcrumbs, {
				items: [
					{
						label: __( 'Navigation' ),
						to: '/navigation',
					},
					{ label: menuTitle },
				],
			} ),
			className: `cnl-editor-stage routes-navigation-edit${
				isAutoMenu ? ' is-auto-menu' : ''
			}`,
			hasPadding: false,
			headingLevel: 2,
			subTitle: __( 'Manage this navigation menu.' ),
		},
		! isMenuReady &&
			el( 'div', { className: 'cnl-editor-spinner' }, el( Spinner ) ),
		isMenuReady &&
			el(
				'div',
				{ className: 'routes-navigation-edit__content' },
				el(
					'div',
					{
						className: `routes-navigation-edit__body${
							isEmptyManualMenu ? ' is-empty-manual' : ''
						}`,
					},
					isAutoMenu &&
						el(
							EmptyState.Root,
							{
								className:
									'routes-navigation-edit__auto-summary',
							},
							el( EmptyState.Icon, { icon: updateIcon } ),
							el( EmptyState.Title, null, __( 'Auto-menu' ) ),
							el(
								EmptyState.Description,
								null,
								__(
									'This menu is kept in sync with your current'
								),
								' ',
								el(
									Button,
									{
										onClick: () =>
											navigate( {
												to: '/types/page/list/all',
											} ),
										variant: 'link',
									},
									__( 'Pages' )
								),
								' ',
								__(
									'When you add, rename, or remove pages, this menu updates automatically.'
								)
							),
							el(
								EmptyState.Actions,
								null,
								el(
									Button,
									{
										__next40pxDefaultSize: true,
										disabled: isResolvingPages,
										onClick: () =>
											setIsConfirmingCustomize( true ),
										variant: 'primary',
									},
									__( 'Customize' )
								)
							)
						),
					isEmptyManualMenu &&
						el(
							EmptyState.Root,
							{
								className:
									'routes-navigation-edit__empty-summary',
							},
							el( EmptyState.Icon, { icon: compassIcon } ),
							el(
								EmptyState.Title,
								null,
								__( 'No menu items yet' )
							),
							el(
								EmptyState.Description,
								null,
								__(
									'Add pages, links, or other content to start building this navigation menu.'
								)
							),
							el(
								EmptyState.Actions,
								null,
								el(
									Button,
									{
										__next40pxDefaultSize: true,
										disabled: isSaving,
										onClick: () => setAddMode( 'more' ),
										variant: 'primary',
									},
									__( 'Add menu items' )
								)
							)
						),
					( isAutoMenu || ! isEmptyManualMenu ) &&
						el( NavigationItemsList, { items: listItems } ),
					! isAutoMenu &&
						! isEmptyManualMenu &&
						el( AddMenuItemDropdown, {
							onChooseMode: setAddMode,
						} )
				),
				isConfirmingCustomize &&
					el(
						Modal,
						{
							className:
								'routes-navigation-edit__customize-auto-menu-modal',
							onRequestClose: () => {
								if ( ! isSaving ) {
									setIsConfirmingCustomize( false );
								}
							},
							title: __( 'Customize this menu?' ),
						},
						el(
							'p',
							null,
							__(
								"Your menu won't be automatically kept in sync with your pages anymore, but you will be able to customize it manually."
							)
						),
						el(
							'div',
							{
								className:
									'routes-navigation-edit__modal-actions',
							},
							el(
								Button,
								{
									disabled: isSaving,
									onClick: () =>
										setIsConfirmingCustomize( false ),
									variant: 'tertiary',
								},
								__( 'Cancel' )
							),
							el(
								Button,
								{
									disabled: isSaving || isResolvingPages,
									isBusy: isSaving,
									onClick: customizeMenu,
									variant: 'primary',
								},
								__( 'Customize menu' )
							)
						)
					),
				( addMode === 'existing-page' || addMode === 'submenu-page' ) &&
					el( PageSelectModal, {
						isSaving,
						mode: addMode,
						onAddPage: addPageToMenu,
						onClose: closeAddMenuItemModal,
						pages,
						title:
							addMode === 'submenu-page'
								? __( 'Add submenu from page' )
								: __( 'Add existing page' ),
					} ),
				addMode === 'custom-link' &&
					el( CustomLinkModal, {
						isSaving,
						onAddLink: addCustomLinkToMenu,
						onClose: closeAddMenuItemModal,
						title: __( 'Custom link' ),
					} ),
				addMode === 'submenu-custom' &&
					el( CustomLinkModal, {
						isSaving,
						isSubmenu: true,
						onAddLink: addCustomLinkToMenu,
						onClose: closeAddMenuItemModal,
						title: __( 'Custom link submenu' ),
					} ),
				addMode === 'submenu-label' &&
					el( LabelOnlySubmenuModal, {
						isSaving,
						onAddSubmenu: addLabelOnlySubmenuToMenu,
						onClose: closeAddMenuItemModal,
					} ),
				addMode === 'more' &&
					el( AddMenuItemsModal, {
						content,
						isSaving,
						onAddBlocks: addMenuItemsToMenu,
						onClose: closeAddMenuItemModal,
						pages,
					} ),
				isRenaming &&
					el(
						Modal,
						{
							className: 'routes-navigation-edit__item-modal',
							onRequestClose: closeRenameModal,
							title: __( 'Rename navigation menu' ),
						},
						el( TextControl, {
							__next40pxDefaultSize: true,
							disabled: isSaving,
							label: __( 'Name' ),
							onChange: setRenameTitle,
							value: renameTitle,
						} ),
						el(
							'div',
							{
								className:
									'routes-navigation-edit__modal-actions',
							},
							el(
								Button,
								{
									disabled: isSaving,
									onClick: closeRenameModal,
									variant: 'tertiary',
								},
								__( 'Cancel' )
							),
							el(
								Button,
								{
									disabled: isSaving || ! renameTitle.trim(),
									isBusy: isSaving,
									onClick: renameNavigationMenu,
									variant: 'primary',
								},
								__( 'Save' )
							)
						)
					),
				isDeleting &&
					el(
						Modal,
						{
							className: 'routes-navigation-edit__item-modal',
							onRequestClose: closeDeleteModal,
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
							{
								className:
									'routes-navigation-edit__modal-actions',
							},
							el(
								Button,
								{
									disabled: isSaving,
									onClick: closeDeleteModal,
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
									onClick: deleteNavigationMenu,
									variant: 'primary',
								},
								__( 'Delete' )
							)
						)
					)
			)
	);
}

function useNavigationLocations( navigationId ) {
	const { isResolvingTemplateParts, menus, templateParts } = useSelect(
		( select ) => {
			const store = select( coreDataStore );
			const menuArgs = [
				'postType',
				NAVIGATION_POST_TYPE,
				NAVIGATION_MENUS_QUERY,
			];
			const templatePartArgs = [
				'postType',
				'wp_template_part',
				TEMPLATE_PARTS_QUERY,
			];
			const rawTemplateParts =
				store.getEntityRecords( ...templatePartArgs ) || EMPTY_ARRAY;

			return {
				isResolvingTemplateParts:
					store.isResolving( 'getEntityRecords', templatePartArgs ) ||
					! store.hasFinishedResolution(
						'getEntityRecords',
						templatePartArgs
					),
				menus: store.getEntityRecords( ...menuArgs ) || EMPTY_ARRAY,
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
		},
		[]
	);
	const fallbackMenuId = menus[ 0 ]?.id;
	const locationsMap = useMemo(
		() => buildNavigationLocationsMap( templateParts, fallbackMenuId ),
		[ fallbackMenuId, templateParts ]
	);

	return {
		isResolvingTemplateParts,
		locations: locationsMap[ navigationId ] || EMPTY_ARRAY,
		menu:
			menus.find( ( menu ) => Number( menu.id ) === navigationId ) ||
			null,
		templateParts,
	};
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
			{ className: 'routes-navigation-edit__modal-description' },
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
					className: 'routes-navigation-edit__modal-actions',
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
					getLocationActionLabel( selectedCandidates.length, mode )
				)
			)
	);
}

function NavigationEditCanvas() {
	const navigate = useNavigate();
	const params = useParams( { strict: false } );
	const navigationId = Number( params.id );
	const { editEntityRecord } = useDispatch( coreDataStore );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );
	const { isResolvingTemplateParts, locations, menu, templateParts } =
		useNavigationLocations( navigationId );
	const [ locationModalMode, setLocationModalMode ] = useState( null );
	const [ isSavingLocations, setIsSavingLocations ] = useState( false );
	const selectedLocationIds = useMemo(
		() => locations.map( ( location ) => location.id ),
		[ locations ]
	);
	const menuTitle = menu ? getMenuTitle( menu ) : __( 'Navigation' );

	const editTemplatePartContent = ( part, content ) =>
		editEntityRecord( 'postType', 'wp_template_part', part.id, {
			content,
		} );

	const applyLocationAssignments = async (
		selectedCandidates,
		candidates
	) => {
		setIsSavingLocations( true );

		try {
			const selectedIds = new Set(
				selectedCandidates.map( ( candidate ) => candidate.id )
			);
			const currentIds = new Set( selectedLocationIds );

			for ( const candidate of selectedCandidates ) {
				const content = assignNavigationMenuToFirstBlock(
					candidate.part,
					navigationId
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
						navigationId
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
		} catch ( error ) {
			createErrorNotice(
				sprintf(
					/* translators: %s: error message. */
					__( 'Unable to update menu locations (%s).' ),
					getErrorMessage( error )
				),
				{ type: 'snackbar' }
			);
		} finally {
			setIsSavingLocations( false );
		}
	};
	if ( ! navigationId ) {
		return el(
			'section',
			{
				className:
					'cnl-editor-canvas routes-navigation-locations-canvas-shell',
			},
			el(
				'div',
				{
					className:
						'routes-navigation-locations-canvas is-top-centered',
				},
				el( NavigationNoMenuSelectedEmptyState )
			)
		);
	}

	const menuLocationActions = el(
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
							locations.length > 0 ? 'update' : 'choose'
						);
						onClose();
					},
				},
				locations.length > 0
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
		el(
			Page,
			{
				actions: menuLocationActions,
				className: 'routes-navigation-locations-canvas',
				hasPadding: false,
				headingLevel: 2,
				showSidebarToggle: false,
				subTitle: getMenuLocationsDescription( locations.length ),
				title: getMenuLocationsTitle( menuTitle ),
			},
			el(
				'div',
				{
					className: 'routes-navigation-locations-canvas__content',
				},
				isResolvingTemplateParts &&
					el(
						'div',
						{ className: 'cnl-editor-spinner' },
						el( Spinner )
					),
				! isResolvingTemplateParts &&
					locations.length === 0 &&
					el( NavigationLocationsEmptyState, {
						disabled: isResolvingTemplateParts,
						onChooseLocation: () =>
							setLocationModalMode( 'choose' ),
					} ),
				! isResolvingTemplateParts &&
					locations.length > 0 &&
					el(
						'div',
						{
							className:
								'routes-navigation-locations-canvas__previews',
						},
						locations.map( ( location ) =>
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
		locationModalMode &&
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
			} )
	);
}

export { NavigationEditStage as stage, NavigationEditCanvas as canvas };
