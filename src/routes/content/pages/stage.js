/**
 * The Pages sidebar: every page as a tree, and a page opened up into its
 * details and sections.
 */

/**
 * WordPress dependencies
 */
import { useNavigate, useSearch } from '@wordpress/route';
import { Preview as LazyEditorPreview } from '@wordpress/lazy-editor';

/**
 * Internal dependencies
 */
import { getErrorMessage, getTemplateDisplayTitle } from '../../../records';
import { getPatternTitle } from '../page-layouts';
import { isPageInMenu } from '../menu-status';
import useMainMenu, { useAddPageToMenu } from '../use-main-menu';
import {
	createBlankSection,
	getPatternSectionBlocks,
	getPlacementText,
	SectionPicker,
} from '../../../section-picker';
import {
	getPageTitle,
	usePageLayouts,
	usePages,
	usePageSections,
	usePreviewStructure,
} from './data';
import {
	buildPageTree,
	countPageTree,
	filterPageTree,
	getPageAncestorTitles,
	getPageDropTarget,
	getPageKeyboardTarget,
	getPageMoveChanges,
} from './page-tree';
import {
	getDropIndex,
	getSectionSummary,
	getSectionTitle,
	getTemplateElementKey,
	getTemplateElementLabel,
	insertItems,
	isSingleBlockSection,
	moveItem,
	removeItem,
} from './page-sections';
import { sectionBridge, useSectionBridge } from './section-bridge';
import SectionSketch from './section-sketch';
import { getLayoutDescription, getLayoutOutline } from './layout-outline';
import LayoutSketch from './layout-sketch';
import {
	__,
	_n,
	arrowDownIcon,
	arrowUpIcon,
	Badge,
	blockEditorStore,
	BlockIcon,
	Breadcrumbs,
	Button,
	checkIcon,
	chevronDownSmallIcon,
	chevronRightSmallIcon,
	cloneBlock,
	copyIcon,
	coreDataStore,
	dispatch,
	dragHandleIcon,
	DropdownMenu,
	el,
	EmptyState,
	externalIcon,
	getBlockType,
	footerIcon,
	headerIcon,
	homeIcon,
	Icon,
	lockSmallIcon,
	MenuGroup,
	MenuItem,
	memo,
	moreVerticalIcon,
	noticesStore,
	Page,
	pageIcon,
	pencilIcon,
	plusIcon,
	postListIcon,
	searchIcon,
	select,
	Skeleton,
	sprintf,
	Stack,
	Text,
	trashIcon,
	UiButton,
	useDispatch,
	useEffect,
	useId,
	useMemo,
	useRef,
	useSelect,
	useState,
} from '../../../wordpress-packages';

const LIST_PATH = '/types/page/list/all';

function getStatusBadge( status ) {
	switch ( status ) {
		case 'draft':
		case 'auto-draft':
			return { intent: 'draft', label: __( 'Draft' ) };
		case 'pending':
			return { intent: 'draft', label: __( 'Pending review' ) };
		case 'future':
			return { intent: 'informational', label: __( 'Scheduled' ) };
		case 'private':
			return { intent: 'informational', label: __( 'Private' ) };
		default:
			return null;
	}
}

function getPageIcon( page, { frontPageId, postsPageId } ) {
	if ( Number( page.id ) === frontPageId ) {
		return homeIcon;
	}

	if ( Number( page.id ) === postsPageId ) {
		return postListIcon;
	}

	return pageIcon;
}

function getPageRole( page, { frontPageId, postsPageId } ) {
	if ( Number( page.id ) === frontPageId ) {
		return __( 'Homepage' );
	}

	if ( Number( page.id ) === postsPageId ) {
		return __( 'Blog' );
	}

	return '';
}

function getPagePath( link ) {
	if ( ! link ) {
		return '';
	}

	try {
		const url = new URL( link );

		return decodeURI( url.pathname + url.search ) || '/';
	} catch {
		return link;
	}
}

function getRelativeTime( date ) {
	if ( ! date ) {
		return '';
	}

	const seconds = ( Date.now() - new Date( date ).getTime() ) / 1000;
	const formatter = new Intl.RelativeTimeFormat( undefined, {
		numeric: 'auto',
	} );
	const steps = [
		[ 60, 'second' ],
		[ 60, 'minute' ],
		[ 24, 'hour' ],
		[ 7, 'day' ],
		[ 4.35, 'week' ],
		[ 12, 'month' ],
		[ Infinity, 'year' ],
	];
	let value = seconds;

	for ( const [ size, unit ] of steps ) {
		if ( Math.abs( value ) < size ) {
			return formatter.format( -Math.round( value ), unit );
		}

		value /= size;
	}

	return '';
}

/**
 * Pick a section in the full editor once it has loaded the page, so opening a
 * section to edit lands on it.
 *
 * The editor gives the page's blocks client IDs of its own, so the section is
 * found by its position inside the Post Content block, or at the top level when
 * the page is edited without its template.
 *
 * @param {number} index Section position.
 */
function selectSectionWhenEditorLoads( index ) {
	const startedAt = Date.now();
	const attempt = () => {
		const store = select( blockEditorStore );
		const [ contentId ] = store.getBlocksByName( 'core/post-content' );
		const clientId = store.getBlockOrder( contentId || '' )[ index ];

		// Until the preview has gone, its blocks are still in the store.
		if ( clientId && ! store.getSettings().isPreviewMode ) {
			dispatch( blockEditorStore ).selectBlock( clientId );
			window.setTimeout( () => {
				document
					.querySelector( 'iframe[name="editor-canvas"]' )
					?.contentDocument?.getElementById( `block-${ clientId }` )
					?.scrollIntoView( { behavior: 'smooth', block: 'center' } );
			}, 300 );
			return;
		}

		if ( Date.now() - startedAt < 8000 ) {
			window.setTimeout( attempt, 150 );
		}
	};

	window.setTimeout( attempt, 300 );
}

/*
 * ---------------------------------------------------------------------------
 * The page tree.
 * ---------------------------------------------------------------------------
 */

const PAGE_DRAG_TYPE = 'application/x-cnl-page';

function PageTreeRow( {
	collapsed,
	depth,
	dnd,
	node,
	onEdit,
	onPreview,
	onToggle,
	previewedId,
	roles,
} ) {
	const { page, children } = node;
	const id = Number( page.id );
	const isCollapsed = collapsed.has( id );
	const status = getStatusBadge( page.status );
	const role = getPageRole( page, roles );
	const title = getPageTitle( page );
	const dropPosition = dnd.drop?.id === id ? dnd.drop.position : null;
	// Dropped just below an open parent, a page goes first among its sub-pages.
	const dropDepth =
		dropPosition === 'after' && children.length && ! isCollapsed
			? depth + 1
			: depth;
	const className = [
		'cnl-pages-tree__row',
		previewedId === id && 'is-previewed',
		dnd.dragId === id && 'is-dragging',
		dropPosition && `is-drop-${ dropPosition }`,
	]
		.filter( Boolean )
		.join( ' ' );

	return el(
		'li',
		{ className: 'cnl-pages-tree__item', 'data-page-id': id },
		el(
			'div',
			{
				className,
				draggable: dnd.isEnabled,
				onDragEnd: dnd.onDragEnd,
				onDragOver: ( event ) => dnd.onDragOver( event, id ),
				onDragStart: ( event ) => dnd.onDragStart( event, id ),
				onDrop: ( event ) => dnd.onDrop( event, id ),
				style: {
					'--cnl-pages-tree-depth': depth,
					'--cnl-pages-tree-drop-depth': dropDepth,
				},
			},
			children.length
				? el( Button, {
						'aria-expanded': ! isCollapsed,
						className: 'cnl-pages-tree__toggle',
						icon: isCollapsed
							? chevronRightSmallIcon
							: chevronDownSmallIcon,
						label: isCollapsed
							? sprintf(
									/* translators: %s: page title. */
									__( 'Show pages under %s' ),
									title
								)
							: sprintf(
									/* translators: %s: page title. */
									__( 'Hide pages under %s' ),
									title
								),
						onClick: () => onToggle( id ),
						size: 'small',
					} )
				: el( 'span', {
						'aria-hidden': true,
						className: 'cnl-pages-tree__toggle-spacer',
					} ),
			el(
				'button',
				{
					'aria-description': dnd.isEnabled
						? __(
								'Press Alt and an arrow key to move this page. Left and right move it out of, or under, another page.'
							)
						: undefined,
					'aria-current': previewedId === id ? 'page' : undefined,
					className: 'cnl-pages-tree__link',
					onClick: () => onPreview( id ),
					onKeyDown: ( event ) => dnd.onKeyDown( event, id ),
					type: 'button',
				},
				el( Icon, {
					className: 'cnl-pages-tree__icon',
					icon: getPageIcon( page, roles ),
				} ),
				el( 'span', { className: 'cnl-pages-tree__title' }, title ),
				role &&
					el( 'span', { className: 'cnl-pages-tree__role' }, role ),
				status &&
					el(
						Badge,
						{
							className: 'cnl-pages-tree__status',
							intent: status.intent,
						},
						status.label
					)
			),
			el( Button, {
				className: 'cnl-pages-tree__edit',
				icon: pencilIcon,
				label: sprintf(
					/* translators: %s: page title. */
					__( 'Edit %s' ),
					title
				),
				onClick: () => onEdit( id ),
				size: 'compact',
			} )
		),
		children.length > 0 &&
			! isCollapsed &&
			el(
				'ul',
				{ className: 'cnl-pages-tree__children', role: 'list' },
				children.map( ( child ) =>
					el( PageTreeRow, {
						collapsed,
						depth: depth + 1,
						dnd,
						key: child.page.id,
						node: child,
						onEdit,
						onPreview,
						onToggle,
						previewedId,
						roles,
					} )
				)
			)
	);
}

function getDropPosition( event ) {
	const rect = event.currentTarget.getBoundingClientRect();
	const ratio = ( event.clientY - rect.top ) / rect.height;

	if ( ratio < 0.25 ) {
		return 'before';
	}

	return ratio > 0.75 ? 'after' : 'inside';
}

/**
 * Every page, nested under its parent, for the Pages screen's list.
 *
 * Pages can be dragged to reorder them, or dropped onto another page to go
 * under it. A move is saved straight away, with a way to undo it, as the tree
 * is the site's structure rather than a draft of one page.
 *
 * @param {Object}   props           Component props.
 * @param {Function} props.onAddPage Opens the add page flow.
 * @param {boolean}  props.canCreate Whether the user can add pages.
 * @return {Element} The page tree.
 */
export function PagesTree( { canCreate, onAddPage } ) {
	const navigate = useNavigate();
	const searchParams = useSearch( { strict: false } );
	const { frontPageId, isLoading, pages, postsPageId } = usePages();
	const { saveEntityRecord } = useDispatch( coreDataStore );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );
	const [ search, setSearch ] = useState( '' );
	const [ collapsed, setCollapsed ] = useState( () => new Set() );
	const [ dragId, setDragId ] = useState( null );
	const [ drop, setDrop ] = useState( null );
	// Moves shown before the saved pages come back, keyed by page ID.
	const [ overrides, setOverrides ] = useState( {} );
	const [ focusId, setFocusId ] = useState( null );
	const listRef = useRef();
	const effectivePages = useMemo(
		() =>
			pages.map( ( page ) =>
				overrides[ page.id ]
					? { ...page, ...overrides[ page.id ] }
					: page
			),
		[ overrides, pages ]
	);
	const roles = useMemo(
		() => ( { frontPageId, postsPageId } ),
		[ frontPageId, postsPageId ]
	);
	const tree = useMemo(
		() => buildPageTree( effectivePages, { frontPageId } ),
		[ effectivePages, frontPageId ]
	);
	const visibleTree = useMemo(
		() => filterPageTree( tree, search, getPageTitle ),
		[ search, tree ]
	);
	const previewedId =
		Number( searchParams.previewId ) ||
		frontPageId ||
		Number( tree[ 0 ]?.page.id ) ||
		0;
	const canMove = ! search.trim();

	// Forget a move once the saved page reflects it.
	useEffect( () => {
		setOverrides( ( current ) => {
			const pending = Object.entries( current ).filter(
				( [ id, override ] ) => {
					const page = pages.find(
						( item ) => Number( item.id ) === Number( id )
					);

					return (
						page &&
						( ( Number( page.parent ) || 0 ) !== override.parent ||
							( Number( page.menu_order ) || 0 ) !==
								override.menu_order )
					);
				}
			);

			return pending.length === Object.keys( current ).length
				? current
				: Object.fromEntries( pending );
		} );
	}, [ pages ] );

	// Keep focus on a page moved with the keyboard, wherever it lands.
	useEffect( () => {
		if ( ! focusId ) {
			return;
		}

		listRef.current
			?.querySelector(
				`[data-page-id="${ focusId }"] > .cnl-pages-tree__row .cnl-pages-tree__link`
			)
			?.focus();
		setFocusId( null );
	}, [ focusId, tree ] );

	const previewPage = ( pageId ) =>
		navigate( {
			search: { ...searchParams, previewId: pageId },
			to: LIST_PATH,
		} );
	const editPage = ( pageId ) =>
		navigate( {
			search: { ...searchParams, postId: pageId, previewId: pageId },
			to: LIST_PATH,
		} );
	const toggle = ( pageId ) =>
		setCollapsed( ( current ) => {
			const next = new Set( current );

			if ( next.has( pageId ) ) {
				next.delete( pageId );
			} else {
				next.add( pageId );
			}

			return next;
		} );

	const saveChanges = async ( changes ) => {
		setOverrides( ( current ) => {
			const next = { ...current };

			changes.forEach( ( change ) => {
				next[ change.id ] = {
					menu_order: change.menu_order,
					parent: change.parent,
				};
			} );

			return next;
		} );

		try {
			await Promise.all(
				changes.map( ( change ) =>
					saveEntityRecord(
						'postType',
						'page',
						{
							id: change.id,
							menu_order: change.menu_order,
							parent: change.parent,
						},
						{ throwOnError: true }
					)
				)
			);

			return true;
		} catch ( error ) {
			setOverrides( ( current ) => {
				const next = { ...current };

				changes.forEach( ( change ) => delete next[ change.id ] );

				return next;
			} );
			createErrorNotice( getErrorMessage( error ), { type: 'snackbar' } );

			return false;
		}
	};

	const movePage = async ( pageId, target ) => {
		const changes = getPageMoveChanges( tree, pageId, target );

		if ( ! changes.length ) {
			return;
		}

		const byId = new Map(
			effectivePages.map( ( page ) => [ Number( page.id ), page ] )
		);
		const previous = changes.map( ( change ) => ( {
			id: change.id,
			menu_order: Number( byId.get( change.id )?.menu_order ) || 0,
			parent: Number( byId.get( change.id )?.parent ) || 0,
		} ) );
		const title = getPageTitle( byId.get( pageId ) );
		const wasParent = Number( byId.get( pageId )?.parent ) || 0;
		let message = sprintf(
			/* translators: %s: page title. */
			__( 'Moved “%s”.' ),
			title
		);

		if ( target.parent && target.parent !== wasParent ) {
			message = sprintf(
				/* translators: 1: page title, 2: parent page title. */
				__( 'Moved “%1$s” under “%2$s”.' ),
				title,
				getPageTitle( byId.get( target.parent ) )
			);
		} else if ( ! target.parent && wasParent ) {
			message = sprintf(
				/* translators: %s: page title. */
				__( 'Moved “%s” out to the top level.' ),
				title
			);
		}

		// Show where the page went.
		if ( target.parent ) {
			setCollapsed( ( current ) => {
				const next = new Set( current );
				next.delete( target.parent );

				return next;
			} );
		}

		if ( await saveChanges( changes ) ) {
			createSuccessNotice( message, {
				actions: [
					{
						label: __( 'Undo' ),
						onClick: () => saveChanges( previous ),
					},
				],
				id: 'cnl-page-moved',
				type: 'snackbar',
			} );
		}
	};

	const dnd = {
		drop,
		dragId,
		isEnabled: canMove,
		onDragEnd: () => {
			setDragId( null );
			setDrop( null );
		},
		onDragOver: ( event, overId ) => {
			if ( ! dragId ) {
				return;
			}

			const position = getDropPosition( event );

			if ( ! getPageDropTarget( tree, dragId, overId, position ) ) {
				if ( drop ) {
					setDrop( null );
				}

				return;
			}

			event.preventDefault();
			event.dataTransfer.dropEffect = 'move';

			if ( drop?.id !== overId || drop?.position !== position ) {
				setDrop( { id: overId, position } );
			}
		},
		onDragStart: ( event, pageId ) => {
			event.stopPropagation();
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData( PAGE_DRAG_TYPE, String( pageId ) );
			setDragId( pageId );
		},
		onDrop: ( event, overId ) => {
			event.preventDefault();

			const target =
				dragId &&
				drop &&
				getPageDropTarget(
					tree,
					dragId,
					overId,
					drop.position,
					! collapsed.has( overId )
				);

			if ( target ) {
				movePage( dragId, target );
			}

			setDragId( null );
			setDrop( null );
		},
		onKeyDown: ( event, pageId ) => {
			if ( ! canMove || ! event.altKey ) {
				return;
			}

			const target = getPageKeyboardTarget( tree, pageId, event.key );

			if ( target ) {
				event.preventDefault();
				setFocusId( pageId );
				movePage( pageId, target );
			}
		},
	};

	if ( isLoading && ! pages.length ) {
		return el(
			Stack,
			{
				'aria-hidden': true,
				className: 'cnl-pages-tree cnl-pages-tree--loading',
				direction: 'column',
				gap: 'md',
			},
			[ 62, 48, 70, 40, 56 ].map( ( width, index ) =>
				el( Skeleton, {
					key: index,
					style: { height: 16, width: `${ width }%` },
				} )
			)
		);
	}

	if ( ! pages.length ) {
		return el(
			EmptyState.Root,
			{ className: 'cnl-pages-tree__empty' },
			el( EmptyState.Icon, { icon: pageIcon } ),
			el( EmptyState.Title, null, __( 'No pages yet' ) ),
			el(
				EmptyState.Description,
				null,
				__( 'Add your first page to start building your site.' )
			),
			canCreate &&
				el(
					EmptyState.Actions,
					null,
					el( UiButton, { onClick: onAddPage }, __( 'Add page' ) )
				)
		);
	}

	return el(
		'div',
		{ className: 'cnl-pages-tree', ref: listRef },
		pages.length > 8 &&
			el(
				'label',
				{ className: 'cnl-pages-tree__search' },
				el( Icon, { icon: searchIcon } ),
				el( 'input', {
					'aria-label': __( 'Find a page' ),
					onChange: ( event ) => setSearch( event.target.value ),
					placeholder: __( 'Find a page' ),
					type: 'search',
					value: search,
				} )
			),
		el(
			'ul',
			{
				'aria-label': __( 'Pages' ),
				className: `cnl-pages-tree__list${
					dragId ? ' is-dragging' : ''
				}`,
				role: 'list',
			},
			visibleTree.map( ( node ) =>
				el( PageTreeRow, {
					collapsed,
					depth: 0,
					dnd,
					key: node.page.id,
					node,
					onEdit: editPage,
					onPreview: previewPage,
					onToggle: toggle,
					previewedId,
					roles,
				} )
			)
		),
		! visibleTree.length &&
			el(
				Text,
				{ className: 'cnl-pages-tree__no-results', variant: 'body-sm' },
				__( 'No pages match your search.' )
			),
		el(
			Text,
			{ className: 'cnl-pages-tree__footer', variant: 'body-sm' },
			sprintf(
				/* translators: %d: number of pages. */
				_n( '%d page', '%d pages', countPageTree( tree ) ),
				countPageTree( tree )
			),
			' · ',
			canMove
				? __(
						'Pick a page to see it, or use the pencil to change what is on it. Drag pages to reorder them, or onto another page to put them under it.'
					)
				: __(
						'Pick a page to see it, or use the pencil to change what is on it.'
					)
		)
	);
}

/*
 * ---------------------------------------------------------------------------
 * A page, opened up.
 * ---------------------------------------------------------------------------
 */

function PageSummary( { page, pageId, roles } ) {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );
	const mainMenu = useMainMenu();
	const addPageToMenu = useAddPageToMenu();
	const [ isAddingToMenu, setIsAddingToMenu ] = useState( false );
	const title = useSelect(
		( selectStore ) =>
			selectStore( coreDataStore ).getEditedEntityRecord(
				'postType',
				'page',
				pageId
			)?.title ?? '',
		[ pageId ]
	);
	const status = page?.status;
	const isPublished = status === 'publish';
	const inMenu = isPageInMenu( page, mainMenu.menuPages );
	const role = page ? getPageRole( page, roles ) : '';
	const path = getPagePath( page?.link );
	const edited = getRelativeTime( page?.modified );
	const statusBadge = getStatusBadge( status );

	const addToMenu = async () => {
		setIsAddingToMenu( true );

		try {
			await addPageToMenu( mainMenu.menuId, page );
			createSuccessNotice(
				sprintf(
					/* translators: %s: page title. */
					__( '“%s” is now in your menu.' ),
					getPageTitle( page )
				),
				{ type: 'snackbar' }
			);
		} catch ( error ) {
			createErrorNotice( getErrorMessage( error ), {
				type: 'snackbar',
			} );
		} finally {
			setIsAddingToMenu( false );
		}
	};

	let menuFact = null;

	if ( mainMenu.menuPages ) {
		if ( inMenu ) {
			menuFact = el(
				Text,
				{ variant: 'body-sm' },
				__( 'Visitors can find it in your menu.' )
			);
		} else if ( ! isPublished ) {
			menuFact = el(
				Text,
				{ variant: 'body-sm' },
				__( 'Not in your menu. Publish it first to add it.' )
			);
		} else {
			menuFact = el(
				Stack,
				{ align: 'center', direction: 'row', gap: 'sm', wrap: 'wrap' },
				el(
					Text,
					{ variant: 'body-sm' },
					__( 'Not in your menu yet.' )
				),
				el(
					Button,
					{
						disabled: isAddingToMenu,
						isBusy: isAddingToMenu,
						onClick: addToMenu,
						variant: 'link',
					},
					__( 'Add it' )
				)
			);
		}
	}

	return el(
		'section',
		{
			'aria-label': __( 'About this page' ),
			className: 'cnl-page-summary',
		},
		el(
			'label',
			{ className: 'cnl-page-summary__title' },
			el(
				'span',
				{ className: 'cnl-page-summary__title-label' },
				__( 'Page title' )
			),
			el( 'input', {
				onChange: ( event ) =>
					editEntityRecord( 'postType', 'page', pageId, {
						title: event.target.value,
					} ),
				placeholder: __( 'Add a title' ),
				type: 'text',
				value: typeof title === 'string' ? title : '',
			} )
		),
		el(
			Stack,
			{
				align: 'center',
				className: 'cnl-page-summary__meta',
				direction: 'row',
				gap: 'sm',
				wrap: 'wrap',
			},
			role && el( Badge, { intent: 'informational' }, role ),
			statusBadge
				? el( Badge, { intent: statusBadge.intent }, statusBadge.label )
				: el( Badge, { intent: 'stable' }, __( 'Published' ) ),
			path &&
				isPublished &&
				el(
					'a',
					{
						className: 'cnl-page-summary__link',
						href: page.link,
						rel: 'noreferrer',
						target: '_blank',
					},
					path,
					el( Icon, { icon: externalIcon, size: 16 } )
				)
		),
		el(
			'dl',
			{ className: 'cnl-page-summary__facts' },
			menuFact &&
				el(
					'div',
					null,
					el( 'dt', null, __( 'Menu' ) ),
					el( 'dd', null, menuFact )
				),
			edited &&
				el(
					'div',
					null,
					el( 'dt', null, __( 'Last changed' ) ),
					el( 'dd', null, el( Text, { variant: 'body-sm' }, edited ) )
				)
		)
	);
}

function LayoutCard( { isSelected, label, onPick, outline, sectionCount } ) {
	const descriptionId = useId();

	return el(
		'li',
		{ className: 'cnl-page-layouts__item' },
		el(
			'button',
			{
				'aria-describedby': descriptionId,
				'aria-pressed': isSelected,
				className: 'cnl-page-layout',
				disabled: ! onPick,
				onClick: onPick,
				type: 'button',
			},
			el(
				'span',
				{ className: 'cnl-page-layout__preview' },
				el( LayoutSketch, { outline, sectionCount } )
			),
			el(
				'span',
				{ className: 'cnl-page-layout__footer' },
				el( 'span', { className: 'cnl-page-layout__name' }, label ),
				isSelected &&
					el( Icon, {
						className: 'cnl-page-layout__check',
						icon: checkIcon,
						size: 20,
					} )
			),
			el(
				'span',
				{ hidden: true, id: descriptionId },
				getLayoutDescription( outline )
			)
		)
	);
}

/**
 * The layouts a page can use, each drawn with the page's sections in it, so
 * picking one is picking how this page looks. The canvas follows the choice
 * straight away; it is saved with the page.
 *
 * Layouts are drawn from their templates rather than rendered. Rendering each
 * one with the page in it, again on every change to the page, made typing on
 * this screen crawl.
 *
 * @param {Object}  props              Component props.
 * @param {boolean} props.isFrontPage  Whether the page is the homepage.
 * @param {number}  props.pageId       Page ID.
 * @param {number}  props.sectionCount How many sections the page has.
 * @param {string}  props.slug         Page slug.
 * @param {string}  props.template     The page's chosen template slug, if any.
 * @return {Element} The layout picker.
 */
function PageLayouts( {
	isFrontPage,
	pageId,
	sectionCount,
	slug,
	template: current = '',
} ) {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const { custom, defaultTemplate, frontPageTemplate, isLoading, patterns } =
		usePageLayouts( slug, isFrontPage );
	const options = useMemo( () => {
		const resolvePattern = ( name ) =>
			patterns.find( ( pattern ) => pattern.name === name )?.content;
		const toOption = ( template, label, value ) => ( {
			label,
			outline: getLayoutOutline( template.content?.raw, {
				resolvePattern,
			} ),
			value,
		} );

		if ( frontPageTemplate ) {
			return [
				toOption(
					frontPageTemplate,
					getTemplateDisplayTitle( frontPageTemplate ) ||
						__( 'Homepage' )
				),
			];
		}

		return [
			defaultTemplate &&
				toOption( defaultTemplate, __( 'Standard' ), '' ),
			...custom
				.filter( ( template ) => template.content?.raw )
				.map( ( template ) =>
					toOption(
						template,
						getTemplateDisplayTitle( template ) || template.slug,
						template.slug
					)
				),
		].filter( Boolean );
	}, [ custom, defaultTemplate, frontPageTemplate, patterns ] );
	let body;

	if ( isLoading ) {
		body = el(
			'div',
			{ 'aria-hidden': true, className: 'cnl-page-layouts__grid' },
			[ 0, 1 ].map( ( key ) =>
				el( Skeleton, { key, style: { height: 150 } } )
			)
		);
	} else {
		body = el(
			'ul',
			{
				'aria-label': __( 'Layouts' ),
				className: 'cnl-page-layouts__grid',
				role: 'list',
			},
			options.map( ( option ) =>
				el( LayoutCard, {
					isSelected:
						Boolean( frontPageTemplate ) ||
						option.value === current,
					key: option.value || 'default',
					label: option.label,
					onPick: frontPageTemplate
						? undefined
						: () =>
								editEntityRecord( 'postType', 'page', pageId, {
									template: option.value,
								} ),
					outline: option.outline,
					sectionCount,
				} )
			)
		);
	}

	return el(
		'section',
		{ 'aria-label': __( 'Layout' ), className: 'cnl-page-layouts' },
		el(
			Stack,
			{ direction: 'column', gap: 'xs' },
			el(
				'h3',
				{ className: 'cnl-page-sections__title' },
				__( 'Layout' )
			),
			el(
				Text,
				{ className: 'cnl-page-sections__hint', variant: 'body-sm' },
				frontPageTemplate
					? __(
							'Your homepage always uses this layout. WordPress calls layouts templates.'
						)
					: __(
							'How the page is set out around its sections, like whether the title shows. WordPress calls these templates.'
						)
			)
		),
		body
	);
}

// Typing the title changes the page on every key, but none of what this shows.
const MemoizedPageLayouts = memo( PageLayouts );

function SectionGap( { index, isActive, onAdd } ) {
	return el(
		'li',
		{
			className: `cnl-page-sections__gap${ isActive ? ' is-active' : '' }`,
			onMouseEnter: () => sectionBridge.setInsertionIndex( index ),
			onMouseLeave: () => sectionBridge.setInsertionIndex( null ),
		},
		el(
			'button',
			{
				'aria-label': __( 'Add a section here' ),
				className: 'cnl-page-sections__gap-button',
				onBlur: () => sectionBridge.setInsertionIndex( null ),
				onClick: () => onAdd( index ),
				onFocus: () => sectionBridge.setInsertionIndex( index ),
				type: 'button',
			},
			el( Icon, { icon: plusIcon, size: 16 } )
		)
	);
}

function SectionCard( {
	block,
	dropPosition,
	index,
	isDragging,
	isHovered,
	isLast,
	isNew,
	isSelected,
	onDuplicate,
	onEdit,
	onMove,
	onPointerDown,
	onRemove,
	onSelect,
	shouldReveal,
} ) {
	const title = getSectionTitle( block );
	const summary = getSectionSummary( block );
	const ref = useRef();

	/*
	 * Only a section picked on the canvas is brought into view here. One
	 * clicked in this list is already in view, and scrolling the list too
	 * would compete with the canvas scrolling to it.
	 */
	useEffect( () => {
		if ( shouldReveal ) {
			ref.current?.scrollIntoView( {
				block: 'nearest',
				behavior: 'smooth',
			} );
		}
	}, [ shouldReveal ] );

	const onKeyDown = ( event ) => {
		if ( ! event.altKey ) {
			return;
		}

		if ( event.key === 'ArrowUp' && index > 0 ) {
			event.preventDefault();
			onMove( index, index - 1 );
		}

		if ( event.key === 'ArrowDown' && ! isLast ) {
			event.preventDefault();
			onMove( index, index + 1 );
		}
	};

	const className = [
		'cnl-page-section',
		isSelected && 'is-selected',
		isHovered && 'is-hovered',
		isDragging && 'is-dragging',
		isNew && 'is-new',
		dropPosition && `is-drop-${ dropPosition }`,
	]
		.filter( Boolean )
		.join( ' ' );

	return el(
		'li',
		{
			className,
			'data-section-index': index,
			onMouseEnter: () => sectionBridge.hover( block.clientId ),
			onPointerDown: ( event ) => onPointerDown( event, index ),
			onMouseLeave: () => sectionBridge.hover( null ),
			ref,
		},
		el(
			'div',
			{ className: 'cnl-page-section__row' },
			el(
				'span',
				{
					'aria-hidden': true,
					className: 'cnl-page-section__handle',
					title: __( 'Drag to move' ),
				},
				el( Icon, { icon: dragHandleIcon, size: 20 } )
			),
			el(
				'button',
				{
					'aria-current': isSelected ? 'true' : undefined,
					'aria-description': __(
						'Press Alt and an arrow key to move this section.'
					),
					className: 'cnl-page-section__main',
					onClick: () => onSelect( block.clientId ),
					onKeyDown,
					type: 'button',
				},
				isSingleBlockSection( block )
					? el(
							'span',
							{
								'aria-hidden': true,
								className: 'cnl-page-section__part-icon',
							},
							el( BlockIcon, {
								icon: getBlockType( block.name )?.icon,
							} )
						)
					: el( SectionSketch, { block } ),
				el(
					'span',
					{ className: 'cnl-page-section__text' },
					el(
						'span',
						{ className: 'cnl-page-section__title' },
						title
					),
					summary &&
						el(
							'span',
							{ className: 'cnl-page-section__summary' },
							summary
						)
				)
			),
			el(
				DropdownMenu,
				{
					className: 'cnl-page-section__menu',
					icon: moreVerticalIcon,
					label: sprintf(
						/* translators: %s: section name. */
						__( 'Options for %s' ),
						title
					),
					popoverProps: { placement: 'bottom-end' },
					toggleProps: { size: 'small' },
				},
				( { onClose } ) => [
					el(
						MenuGroup,
						{ key: 'edit' },
						el(
							MenuItem,
							{
								icon: pencilIcon,
								onClick: () => {
									onClose();
									onEdit( index );
								},
							},
							__( 'Edit words and images' )
						)
					),
					el(
						MenuGroup,
						{ key: 'move' },
						el(
							MenuItem,
							{
								disabled: index === 0,
								icon: arrowUpIcon,
								onClick: () => {
									onMove( index, index - 1 );
									onClose();
								},
								shortcut: 'Alt+↑',
							},
							__( 'Move up' )
						),
						el(
							MenuItem,
							{
								disabled: isLast,
								icon: arrowDownIcon,
								onClick: () => {
									onMove( index, index + 1 );
									onClose();
								},
								shortcut: 'Alt+↓',
							},
							__( 'Move down' )
						),
						el(
							MenuItem,
							{
								icon: copyIcon,
								onClick: () => {
									onDuplicate( index );
									onClose();
								},
							},
							__( 'Duplicate' )
						)
					),
					el(
						MenuGroup,
						{ key: 'remove' },
						el(
							MenuItem,
							{
								icon: trashIcon,
								isDestructive: true,
								onClick: () => {
									onRemove( index );
									onClose();
								},
							},
							__( 'Remove' )
						)
					),
				]
			)
		)
	);
}

function getTemplateElementIcon( element ) {
	// A site part's icon is a plain SVG, like the sections' own icons. Any
	// other block's icon comes from the block type, normalized to
	// `{ src, background, foreground }`, which only `BlockIcon` understands.
	if ( element.area === 'header' ) {
		return el( Icon, { icon: headerIcon } );
	}

	if ( element.area === 'footer' ) {
		return el( Icon, { icon: footerIcon } );
	}

	return el( BlockIcon, { icon: getBlockType( element.name )?.icon } );
}

/*
 * A block the template puts around the page rather than the page itself: its
 * header or footer, or anything else the layout adds, like a title or a
 * featured image. Shown, but fixed, since it isn't this page's to move.
 */
function TemplateElementCard( { element, isHovered, isSelected, onEdit } ) {
	const title = getTemplateElementLabel( element );
	const key = getTemplateElementKey( element );
	// Only a site part is its own entity with something to open and edit.
	const isEditable = Boolean( element.area );
	const className = [
		'cnl-page-section',
		'is-template-element',
		isSelected && 'is-selected',
		isHovered && 'is-hovered',
	]
		.filter( Boolean )
		.join( ' ' );

	return el(
		'li',
		{
			className,
			onMouseEnter: () => sectionBridge.hover( key ),
			onMouseLeave: () => sectionBridge.hover( null ),
		},
		el(
			'div',
			{ className: 'cnl-page-section__row' },
			el( 'span', {
				'aria-hidden': true,
				className: 'cnl-page-section__handle',
			} ),
			el(
				'button',
				{
					'aria-current': isSelected ? 'true' : undefined,
					className: 'cnl-page-section__main',
					onClick: () => sectionBridge.select( key, 'stage' ),
					type: 'button',
				},
				el(
					'span',
					{
						'aria-hidden': true,
						className: 'cnl-page-section__part-icon',
					},
					getTemplateElementIcon( element )
				),
				el(
					'span',
					{ className: 'cnl-page-section__text' },
					el(
						'span',
						{ className: 'cnl-page-section__title' },
						title
					),
					el(
						'span',
						{ className: 'cnl-page-section__summary' },
						__( 'Same on every page' )
					)
				)
			),
			el( Icon, {
				'aria-hidden': true,
				className: 'cnl-page-section__lock',
				icon: lockSmallIcon,
				size: 20,
			} ),
			// Without a menu, keep the lock where it sits when one is there.
			! isEditable &&
				el( 'span', {
					'aria-hidden': true,
					className: 'cnl-page-section__menu-spacer',
				} ),
			isEditable &&
				el(
					DropdownMenu,
					{
						className: 'cnl-page-section__menu',
						icon: moreVerticalIcon,
						label: sprintf(
							/* translators: %s: site part name, like Header. */
							__( 'Options for %s' ),
							title
						),
						popoverProps: { placement: 'bottom-end' },
						toggleProps: { size: 'small' },
					},
					( { onClose } ) =>
						el(
							MenuGroup,
							null,
							el(
								MenuItem,
								{
									icon: pencilIcon,
									info: __( 'Changes it on every page' ),
									onClick: () => {
										onClose();
										onEdit( element.id );
									},
								},
								element.area === 'header'
									? __( 'Edit header' )
									: __( 'Edit footer' )
							)
						)
				)
		)
	);
}

function SectionList( {
	blocks,
	isReady,
	onAdd,
	onEdit,
	onEditPart,
	setBlocks,
} ) {
	const structure = usePreviewStructure();
	const { createSuccessNotice } = useDispatch( noticesStore );
	const hoveredId = useSectionBridge( ( state ) => state.hoveredId );
	const selectedId = useSectionBridge( ( state ) => state.selectedId );
	const selectedFrom = useSectionBridge( ( state ) => state.selectedFrom );
	const insertionIndex = useSectionBridge(
		( state ) => state.insertionIndex
	);
	const [ dragIndex, setDragIndex ] = useState( null );
	const [ dropTarget, setDropTarget ] = useState( null );
	const [ newId, setNewId ] = useState( null );
	const listRef = useRef();
	const latestRef = useRef();
	const dragRef = useRef( null );

	// Stop a drag that is still going if the list goes away.
	useEffect( () => () => dragRef.current?.stop(), [] );

	useEffect( () => {
		if ( ! newId ) {
			return undefined;
		}

		const timeout = window.setTimeout( () => setNewId( null ), 1600 );

		return () => window.clearTimeout( timeout );
	}, [ newId ] );

	const move = ( from, to ) => {
		const block = blocks[ from ];
		setBlocks( moveItem( blocks, from, to ) );
		sectionBridge.select( block.clientId, 'stage' );
	};
	const duplicate = ( index ) => {
		const copy = cloneBlock( blocks[ index ] );
		setBlocks( insertItems( blocks, index + 1, [ copy ] ) );
		setNewId( copy.clientId );
		sectionBridge.select( copy.clientId, 'stage' );
	};
	const remove = ( index ) => {
		const previous = blocks;
		const title = getSectionTitle( blocks[ index ] );

		setBlocks( removeItem( blocks, index ) );
		sectionBridge.select( null, 'stage' );
		sectionBridge.hover( null );
		createSuccessNotice(
			sprintf(
				/* translators: %s: section name. */
				__( 'Removed “%s”.' ),
				title
			),
			{
				actions: [
					{
						label: __( 'Undo' ),
						onClick: () => setBlocks( previous ),
					},
				],
				id: 'cnl-page-section-removed',
				type: 'snackbar',
			}
		);
	};
	const selectSection = ( clientId ) =>
		sectionBridge.select( clientId, 'stage' );

	/*
	 * Sections are dragged with pointer events rather than native drag and
	 * drop, which hands the cursor to the browser: this way it stays a grab
	 * hand the whole time. The list scrolls when dragged near its edges, and
	 * Escape puts the section back.
	 */
	latestRef.current = { blocks, move };

	const onPointerDown = ( event, index ) => {
		if (
			event.button !== 0 ||
			event.target.closest( '.cnl-page-section__menu' )
		) {
			return;
		}

		const startX = event.clientX;
		const startY = event.clientY;
		const scroller = listRef.current?.closest( '.cnl-pages-detail__body' );
		const drag = { active: false, frame: 0, lastY: startY, target: null };

		const findTarget = ( clientY ) => {
			const cards = [
				...listRef.current.querySelectorAll( '[data-section-index]' ),
			];
			const card =
				cards.find(
					( item ) => clientY < item.getBoundingClientRect().bottom
				) || cards[ cards.length - 1 ];

			if ( ! card ) {
				return null;
			}

			const rect = card.getBoundingClientRect();

			return {
				index: Number( card.dataset.sectionIndex ),
				position:
					clientY < rect.top + rect.height / 2 ? 'before' : 'after',
			};
		};
		const update = () => {
			const target = findTarget( drag.lastY );

			if (
				target &&
				( target.index !== drag.target?.index ||
					target.position !== drag.target?.position )
			) {
				drag.target = target;
				setDropTarget( target );
				sectionBridge.setInsertionIndex(
					target.index + ( target.position === 'after' ? 1 : 0 )
				);
			}
		};
		const autoScroll = () => {
			const rect = scroller?.getBoundingClientRect();
			const edge = 48;
			let delta = 0;

			if ( rect && drag.lastY < rect.top + edge ) {
				delta = -Math.ceil( ( rect.top + edge - drag.lastY ) / 4 );
			} else if ( rect && drag.lastY > rect.bottom - edge ) {
				delta = Math.ceil( ( drag.lastY - rect.bottom + edge ) / 4 );
			}

			if ( delta ) {
				scroller.scrollTop += delta;
				update();
			}

			drag.frame = window.requestAnimationFrame( autoScroll );
		};
		const stop = () => {
			window.removeEventListener( 'pointermove', onMove );
			window.removeEventListener( 'pointerup', onUp );
			window.removeEventListener( 'pointercancel', stop );
			window.removeEventListener( 'keydown', onKeyDown, true );
			window.cancelAnimationFrame( drag.frame );
			document.body.classList.remove( 'cnl-is-dragging-section' );
			dragRef.current = null;

			if ( drag.active ) {
				setDragIndex( null );
				setDropTarget( null );
				sectionBridge.setInsertionIndex( null );
			}
		};
		function onMove( moveEvent ) {
			drag.lastY = moveEvent.clientY;

			if ( ! drag.active ) {
				if (
					Math.hypot(
						moveEvent.clientX - startX,
						moveEvent.clientY - startY
					) < 5
				) {
					return;
				}

				drag.active = true;
				setDragIndex( index );
				document.body.classList.add( 'cnl-is-dragging-section' );
				sectionBridge.select(
					latestRef.current.blocks[ index ].clientId,
					'stage'
				);
				drag.frame = window.requestAnimationFrame( autoScroll );
			}

			moveEvent.preventDefault();
			update();
		}
		function onUp() {
			if ( drag.active ) {
				// Letting go over a card would otherwise count as clicking it.
				const swallowClick = ( clickEvent ) => {
					clickEvent.preventDefault();
					clickEvent.stopPropagation();
				};

				window.addEventListener( 'click', swallowClick, true );
				window.setTimeout( () =>
					window.removeEventListener( 'click', swallowClick, true )
				);

				if ( drag.target ) {
					const to = getDropIndex(
						index,
						drag.target.index,
						drag.target.position
					);

					if ( to !== index ) {
						latestRef.current.move( index, to );
					}
				}
			}

			stop();
		}
		function onKeyDown( keyEvent ) {
			if ( keyEvent.key === 'Escape' && drag.active ) {
				keyEvent.preventDefault();
				keyEvent.stopPropagation();
				stop();
			}
		}

		window.addEventListener( 'pointermove', onMove );
		window.addEventListener( 'pointerup', onUp );
		window.addEventListener( 'pointercancel', stop );
		window.addEventListener( 'keydown', onKeyDown, true );
		dragRef.current = { stop };
	};

	if ( ! isReady ) {
		return el(
			Stack,
			{
				'aria-hidden': true,
				className: 'cnl-page-sections__loading',
				direction: 'column',
				gap: 'sm',
			},
			[ 0, 1, 2 ].map( ( index ) =>
				el( Skeleton, { key: index, style: { height: 56 } } )
			)
		);
	}

	const items = [];

	blocks.forEach( ( block, index ) => {
		items.push(
			el( SectionGap, {
				index,
				isActive: insertionIndex === index && dragIndex === null,
				key: `gap-${ block.clientId }`,
				onAdd,
			} ),
			el( SectionCard, {
				block,
				dropPosition:
					dropTarget?.index === index && dragIndex !== index
						? dropTarget.position
						: null,
				index,
				isDragging: dragIndex === index,
				isHovered: hoveredId === block.clientId,
				isLast: index === blocks.length - 1,
				isNew: newId === block.clientId,
				isSelected: selectedId === block.clientId,
				shouldReveal:
					selectedId === block.clientId && selectedFrom === 'canvas',
				key: block.clientId,
				onDuplicate: duplicate,
				onEdit,
				onMove: move,
				onPointerDown,
				onRemove: remove,
				onSelect: selectSection,
			} )
		);
	} );

	const addButton = el(
		'button',
		{
			className: `cnl-page-sections__add${
				blocks.length ? '' : ' is-empty'
			}${ insertionIndex === blocks.length ? ' is-active' : '' }`,
			onBlur: () => sectionBridge.setInsertionIndex( null ),
			onClick: () => onAdd( blocks.length ),
			onFocus: () => sectionBridge.setInsertionIndex( blocks.length ),
			onMouseEnter: () =>
				sectionBridge.setInsertionIndex( blocks.length ),
			onMouseLeave: () => sectionBridge.setInsertionIndex( null ),
			type: 'button',
		},
		! blocks.length &&
			el(
				Text,
				{
					className: 'cnl-page-sections__add-hint',
					variant: 'body-sm',
				},
				__(
					'Nothing here yet. Pages are built from sections, like a banner, a row of pictures or a contact form.'
				)
			),
		el(
			'span',
			{ className: 'cnl-page-sections__add-label' },
			el( Icon, { icon: plusIcon } ),
			__( 'Add a section' )
		)
	);
	const renderElement = ( element ) => {
		const key = getTemplateElementKey( element );

		return el( TemplateElementCard, {
			element,
			isHovered: hoveredId === key,
			isSelected: selectedId === key,
			key,
			onEdit: onEditPart,
		} );
	};

	return el(
		'ol',
		{
			'aria-label': __( 'The page, top to bottom' ),
			ref: listRef,
			className: `cnl-page-sections__list${
				dragIndex !== null ? ' is-dragging' : ''
			}`,
		},
		structure.before.map( renderElement ),
		items,
		el(
			'li',
			{ className: 'cnl-page-sections__add-item', key: 'add' },
			addButton
		),
		structure.after.map( renderElement )
	);
}

/**
 * A page opened up: what it is, and the sections it is made of.
 *
 * @param {Object} props        Component props.
 * @param {number} props.pageId Page ID.
 * @return {Element} The page stage.
 */
export function PageDetailStage( { pageId } ) {
	const navigate = useNavigate();
	const { frontPageId, pages, postsPageId } = usePages();
	const { blocks, isReady, setBlocks } = usePageSections( pageId );
	const { createSuccessNotice } = useDispatch( noticesStore );
	const [ insertAt, setInsertAt ] = useState( null );
	const page = useSelect(
		( selectStore ) =>
			selectStore( coreDataStore ).getEditedEntityRecord(
				'postType',
				'page',
				pageId
			) || null,
		[ pageId ]
	);
	const listPage = pages.find( ( item ) => Number( item.id ) === pageId );
	const roles = useMemo(
		() => ( { frontPageId, postsPageId } ),
		[ frontPageId, postsPageId ]
	);
	const title = getPageTitle( listPage || page );
	const ancestors = getPageAncestorTitles( pages, pageId, getPageTitle );

	// Leaving a page forgets what was picked on it. Arriving keeps a section
	// picked by clicking it on the canvas.
	useEffect( () => () => sectionBridge.reset(), [ pageId ] );

	// While the picker is open, the canvas marks where the section will go.
	useEffect( () => {
		if ( insertAt === null ) {
			return;
		}

		sectionBridge.setInsertionIndex( insertAt );

		return () => sectionBridge.setInsertionIndex( null );
	}, [ insertAt ] );

	const closeAdd = () => setInsertAt( null );
	const pickPattern = ( pattern ) => {
		const newBlocks = getPatternSectionBlocks( pattern );

		setBlocks( insertItems( blocks, insertAt, newBlocks ) );
		setInsertAt( null );

		if ( newBlocks[ 0 ] ) {
			sectionBridge.select( newBlocks[ 0 ].clientId, 'stage' );
		}

		createSuccessNotice(
			sprintf(
				/* translators: %s: section design name. */
				__( 'Added “%s”.' ),
				getPatternTitle( pattern )
			),
			{ id: 'cnl-page-section-added', type: 'snackbar' }
		);
	};
	const editPage = ( sectionIndex ) => {
		navigate( { to: `/types/page/edit/${ pageId }` } );

		if ( Number.isInteger( sectionIndex ) ) {
			selectSectionWhenEditorLoads( sectionIndex );
		}
	};
	const startFromScratch = () => {
		const index = insertAt;

		setBlocks( insertItems( blocks, index, [ createBlankSection() ] ) );
		setInsertAt( null );
		editPage( index );
	};
	const editPart = ( id ) =>
		navigate( { search: { postId: id }, to: '/wp_template_part' } );
	const actions = el(
		Stack,
		{ align: 'center', direction: 'row', gap: 'sm' },
		el(
			DropdownMenu,
			{
				icon: moreVerticalIcon,
				label: __( 'Page options' ),
				popoverProps: { placement: 'bottom-end' },
				toggleProps: { size: 'compact' },
			},
			( { onClose } ) =>
				el(
					MenuGroup,
					null,
					el(
						MenuItem,
						{
							icon: pencilIcon,
							onClick: () => {
								onClose();
								editPage();
							},
						},
						__( 'Open in full editor' )
					),
					listPage?.link &&
						el(
							MenuItem,
							{
								icon: externalIcon,
								onClick: () => {
									onClose();
									window.open(
										listPage.link,
										'_blank',
										'noopener,noreferrer'
									);
								},
							},
							__( 'View on your site' )
						)
				)
		)
	);

	return el(
		Page,
		{
			actions,
			ariaLabel: title,
			breadcrumbs: el( Breadcrumbs, {
				items: [
					{ label: __( 'Pages' ), to: LIST_PATH },
					...ancestors.map( ( label ) => ( { label } ) ),
					{ label: title },
				],
			} ),
			className: 'cnl-editor-stage cnl-drilldown-stage cnl-pages-detail',
			hasPadding: false,
			headingLevel: 2,
		},
		el(
			'div',
			{ className: 'cnl-pages-detail__body' },
			el( PageSummary, {
				page: listPage ? { ...listPage, ...page } : page,
				pageId,
				roles,
			} ),
			el( MemoizedPageLayouts, {
				isFrontPage: pageId === frontPageId,
				pageId,
				sectionCount: blocks.length,
				slug: page?.slug,
				template: page?.template,
			} ),
			el(
				'section',
				{
					'aria-label': __( 'Sections' ),
					className: 'cnl-page-sections',
				},
				el(
					'header',
					{ className: 'cnl-page-sections__header' },
					el(
						Stack,
						{ direction: 'column', gap: 'xs' },
						el(
							'h3',
							{ className: 'cnl-page-sections__title' },
							__( 'On this page' )
						),
						isReady &&
							blocks.length > 0 &&
							el(
								Text,
								{
									className: 'cnl-page-sections__hint',
									variant: 'body-sm',
								},
								__(
									'Top to bottom, as visitors see it. Drag sections to reorder them, or click one to find it on the page.'
								)
							)
					),
					isReady &&
						blocks.length > 0 &&
						el( Button, {
							icon: plusIcon,
							label: __( 'Add a section at the top' ),
							onClick: () => setInsertAt( 0 ),
							size: 'compact',
						} )
				),
				el( SectionList, {
					blocks,
					isReady,
					onAdd: setInsertAt,
					onEdit: editPage,
					onEditPart: editPart,
					setBlocks,
				} )
			),
			insertAt !== null &&
				el( SectionPicker, {
					onClose: closeAdd,
					onPick: pickPattern,
					onStartFromScratch: startFromScratch,
					placement: getPlacementText(
						blocks[ insertAt - 1 ] &&
							getSectionTitle( blocks[ insertAt - 1 ] ),
						blocks[ insertAt ] &&
							getSectionTitle( blocks[ insertAt ] )
					),
					Preview: LazyEditorPreview,
				} )
		)
	);
}
