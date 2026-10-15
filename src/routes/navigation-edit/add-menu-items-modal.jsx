/**
 * Internal dependencies
 */
import {
	archiveIcon,
	blockDefaultIcon,
	blocksStore,
	Button,
	categoryIcon,
	chevronDownIcon,
	coreDataStore,
	customLinkIcon,
	DataViewsPicker,
	decodeEntities,
	Icon,
	fileIcon,
	filterSortAndPaginate,
	imageIcon,
	InputControl,
	LegacyIcon,
	Modal,
	Notice,
	pageIcon,
	postListIcon,
	Tabs,
	useMemo,
	useSelect,
	useState,
	__,
} from '../../wordpress-packages';
import {
	createNavigationLinkBlock,
	getParsedBlocks,
} from './navigation-blocks';
import { EMPTY_ARRAY, getPageTitle } from './shared';

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

export default function AddMenuItemsModal( {
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

	return (
		<Modal
			className="navigation-add-items-modal"
			onRequestClose={ onClose }
			title={ __( 'Add menu items' ) }
		>
			<div className="navigation-add-items-modal__inner">
				<Tabs.Root
					className="navigation-add-items-modal__tabs"
					onValueChange={ selectGroup }
					orientation="vertical"
					value={ activeGroup }
				>
					<Tabs.List className="navigation-add-items-modal__tablist">
						{ MENU_ITEM_GROUPS.filter(
							( itemGroup ) =>
								PRIMARY_MENU_ITEM_GROUPS.has( itemGroup.id ) ||
								areMoreGroupsVisible
						).map( ( itemGroup ) => (
							<Tabs.Tab
								className="navigation-add-items-modal__tab"
								key={ itemGroup.id }
								value={ itemGroup.id }
							>
								<span className="navigation-add-items-modal__tab-icon">
									<Icon icon={ itemGroup.icon } />
								</span>
								<span className="navigation-add-items-modal__tab-label">
									{ itemGroup.title }
								</span>
							</Tabs.Tab>
						) ) }
						{ ! areMoreGroupsVisible && (
							<Button
								className="navigation-add-items-modal__more-tab"
								onClick={ () =>
									setAreMoreGroupsVisible( true )
								}
								variant="tertiary"
							>
								<span className="navigation-add-items-modal__more-tab-icon">
									<Icon icon={ chevronDownIcon } />
								</span>
								<span className="navigation-add-items-modal__tab-label">
									{ __( 'More' ) }
								</span>
							</Button>
						) }
					</Tabs.List>
					<Tabs.Panel
						className="navigation-add-items-modal__panel"
						value={ activeGroup }
					>
						<div className="navigation-add-items-modal__header">
							<div>
								<h2>{ group.title }</h2>
								<p>{ group.description }</p>
							</div>
						</div>
						{ activeGroup === 'custom' ? (
							<div className="navigation-add-items-custom-link">
								{ !! error && (
									<Notice status="error">{ error }</Notice>
								) }
								<InputControl
									label={ __( 'URL' ) }
									onValueChange={ ( nextUrl ) => {
										setError( '' );
										setCustomUrl( nextUrl );
									} }
									value={ customUrl }
								/>
								<InputControl
									label={ __( 'Link text' ) }
									onValueChange={ ( nextLabel ) => {
										setError( '' );
										setCustomLabel( nextLabel );
									} }
									value={ customLabel }
								/>
								<div className="navigation-add-items-custom-link__actions">
									<Button
										disabled={ isSaving }
										onClick={ onClose }
										variant="tertiary"
									>
										{ __( 'Cancel' ) }
									</Button>
									<Button
										disabled={ isSaving }
										isBusy={ isSaving }
										onClick={ addCustomLink }
										variant="primary"
									>
										{ __( 'Add to menu' ) }
									</Button>
								</div>
							</div>
						) : (
							<DataViewsPicker
								actions={ [
									{
										callback: addSelectedItems,
										id: 'add-to-menu',
										isPrimary: true,
										label: __( 'Add to menu' ),
										supportsBulk: true,
									},
								] }
								data={ shownData }
								defaultLayouts={ {
									pickerGrid: true,
									pickerTable: true,
								} }
								fields={ pickerFields }
								getItemId={ ( item ) => item.id }
								isLoading={ isResolving }
								itemListLabel={ group.title }
								onChangeSelection={ setSelection }
								onChangeView={ setView }
								paginationInfo={ paginationInfo }
								selection={ selection }
								view={ view }
							>
								<div className="navigation-add-items-modal__toolbar">
									<DataViewsPicker.Search
										label={ __( 'Search menu items' ) }
									/>
									<div className="navigation-add-items-modal__toolbar-actions">
										<DataViewsPicker.FiltersToggle />
										<DataViewsPicker.ViewConfig />
										<DataViewsPicker.LayoutSwitcher />
									</div>
								</div>
								<DataViewsPicker.FiltersToggled className="navigation-add-items-modal__filters" />
								<div className="navigation-add-items-modal__picker-scroll">
									<DataViewsPicker.BulkActionToolbar />
									<DataViewsPicker.Layout />
								</div>
								<div className="navigation-add-items-modal__picker-footer">
									<DataViewsPicker.Footer />
								</div>
							</DataViewsPicker>
						) }
					</Tabs.Panel>
				</Tabs.Root>
			</div>
		</Modal>
	);
}

function PickerPreview( { item } ) {
	if ( item.group === 'media' && item.mediaUrl ) {
		return (
			<div className="navigation-add-items-picker__preview is-image">
				<img alt="" src={ item.mediaUrl } />
			</div>
		);
	}

	return (
		<div className="navigation-add-items-picker__preview">
			<div className="navigation-add-items-picker__preview-header" />
			<div className="navigation-add-items-picker__preview-line" />
			<div className="navigation-add-items-picker__preview-line is-short" />
		</div>
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

	return (
		<span className="navigation-add-items-picker__source-icon">
			{ /* Block icons are not always SVG elements, so this stays on `LegacyIcon`. */ }
			<LegacyIcon icon={ icon } />
		</span>
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
		render: ( { item } ) => (
			<span className="navigation-add-items-picker__title-cell">
				<PickerSourceIcon item={ item } />
				<span className="navigation-add-items-picker__title">
					{ item.title }
				</span>
			</span>
		),
		type: 'text',
	},
	{
		enableGlobalSearch: true,
		enableSorting: false,
		filterBy: false,
		id: 'description',
		label: __( 'Description' ),
		render: ( { item } ) => (
			<span className="navigation-add-items-picker__description">
				{ item.description || item.typeLabel }
			</span>
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
		render: ( { item } ) => (
			<span className="navigation-add-items-picker__type">
				{ item.typeLabel }
			</span>
		),
		type: 'text',
	},
	{
		enableGlobalSearch: true,
		enableSorting: false,
		filterBy: false,
		id: 'linkLabel',
		label: __( 'Link' ),
		render: ( { item } ) => (
			<span className="navigation-add-items-picker__link">
				{ item.linkLabel }
			</span>
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
		render: ( { item } ) => (
			<span
				className={
					item.status === 'publish'
						? 'navigation-add-items-picker__badge is-published'
						: 'navigation-add-items-picker__badge is-draft'
				}
			>
				{ getRecordStatusLabel( item.status ) }
			</span>
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
			item.inThisMenu ? (
				<span className="navigation-add-items-picker__badge is-linked">
					{ __( 'In this menu' ) }
				</span>
			) : (
				<span className="navigation-add-items-picker__empty">-</span>
			),
		type: 'text',
	},
];
