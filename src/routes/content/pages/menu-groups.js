/**
 * The Pages screen's list: the pages in the site's main menu, in menu order,
 * and the pages that aren't in it.
 *
 * "In your menu" is the main menu itself, edited in place: pages and links can
 * be moved, nested into submenus and removed, and every change waits for
 * Review changes like any other site edit. A menu that lists every page is
 * shown as those pages, and the first change turns it into a menu set by hand.
 */

/**
 * WordPress dependencies
 */
import { useNavigate, useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import {
	NavigationListViewContent,
	NavigationMenuEditorProvider,
	useMenuRootClientId,
} from '../../navigation-edit/list-view';
import { createCustomNavigationLinkBlock } from '../../navigation-edit/navigation-list-view-insertions';
import NavigationListViewLinkUI from '../../navigation-edit/navigation-list-view-link-ui';
import NavigationListViewMoreMenu from '../../navigation-edit/navigation-list-view-more-menu';
import {
	createEditorBlocksFromNavigationBlocks,
	createNavigationLinkBlockFromPage,
	getNavigationContentFromEditedRecord,
	getNavigationItemLabel,
} from '../../navigation-edit/navigation-blocks';
import { getMenuPagesFromBlocks } from '../menu-status';
import ScreenLinks from '../../../screen-links';
import useMainMenu from '../use-main-menu';
import { getPageTitle, usePages } from './data';
import { getPageIcon, getPageRole, getStatusBadge } from './page-labels';
import { PagesTree, usePageTrash } from './stage';
import {
	__,
	Badge,
	blockEditorStore,
	Button,
	compassIcon,
	coreDataStore,
	chevronDownSmallIcon,
	chevronRightSmallIcon,
	DropdownMenu,
	el,
	Icon,
	infoIcon,
	MenuGroup,
	MenuItem,
	noticesStore,
	pencilIcon,
	plusIcon,
	select as selectFromRegistry,
	Skeleton,
	sprintf,
	Stack,
	Text,
	trashIcon,
	useDispatch,
	useEffect,
	useMemo,
	useRef,
	useSelect,
	useState,
} from '../../../wordpress-packages';

const LIST_PATH = '/types/page/list/all';
const SELECT_BUTTON = '.block-editor-list-view-block-select-button';
const EMPTY_ARRAY = [];

/**
 * The page a menu item links to, if it links to one.
 *
 * @param {Object} block Menu item block.
 * @return {number} Page ID, or 0.
 */
function getLinkedPageId( block ) {
	const attributes = block?.attributes || {};

	return attributes.kind === 'post-type' &&
		( ! attributes.type || attributes.type === 'page' )
		? Number( attributes.id ) || 0
		: 0;
}

function createMenuItemFromPage( page ) {
	return createEditorBlocksFromNavigationBlocks( [
		createNavigationLinkBlockFromPage( { ...page, type: 'page' } ),
	] )[ 0 ];
}

/**
 * The menu items being dragged, if they are all links to pages and so can be
 * dropped out of the menu.
 *
 * @param {Object}   selectors                          Block editor selectors for the menu.
 * @param {Function} selectors.getBlock                 Gets a block.
 * @param {Function} selectors.getDraggedBlockClientIds Gets the dragged blocks.
 * @return {string[]} Dragged client IDs, or none if they can't leave the menu.
 */
function getDraggedPageItems( { getBlock, getDraggedBlockClientIds } ) {
	const clientIds = getDraggedBlockClientIds();

	return clientIds.length &&
		clientIds.every( ( clientId ) =>
			getLinkedPageId( getBlock( clientId ) )
		)
		? clientIds
		: EMPTY_ARRAY;
}

function GroupHeader( {
	actions,
	count,
	info,
	isOpen,
	linkControl,
	onToggle,
	title,
} ) {
	return el(
		'div',
		{ className: 'cnl-pages-menu__group-header' },
		el(
			'h3',
			{ className: 'cnl-pages-menu__group-title' },
			title,
			el( 'span', { className: 'cnl-pages-menu__group-count' }, count )
		),
		info &&
			el( Button, {
				className: 'cnl-pages-menu__info',
				icon: infoIcon,
				label: info,
				showTooltip: true,
				size: 'small',
			} ),
		el(
			'div',
			{ className: 'cnl-pages-menu__group-actions' },
			actions,
			// Placed here so the link control opens beside the + button.
			linkControl,
			el( Button, {
				'aria-expanded': isOpen,
				icon: isOpen ? chevronDownSmallIcon : chevronRightSmallIcon,
				label: isOpen
					? sprintf(
							/* translators: %s: group name. */
							__( 'Hide %s' ),
							title
						)
					: sprintf(
							/* translators: %s: group name. */
							__( 'Show %s' ),
							title
						),
				onClick: onToggle,
				size: 'small',
			} )
		)
	);
}

/**
 * A menu item's options, with ways to edit or delete the page it links to, and
 * a badge when visitors can't see that page yet.
 *
 * @param {Object} props Props from the list view.
 * @return {Element} The badge and options.
 */
function MenuItemOptions( props ) {
	const { clientId, isAutomatic, pageActions, statusById } = props;
	const { removeBlocks } = useDispatch( blockEditorStore );
	const block = useSelect(
		( selectFromStore ) =>
			selectFromStore( blockEditorStore ).getBlock( clientId ),
		[ clientId ]
	);
	const pageId = getLinkedPageId( block );
	const title = getNavigationItemLabel( block );
	const status = getStatusBadge( statusById.get( pageId ) );

	return el(
		'div',
		{ className: 'cnl-pages-menu__item-options' },
		status &&
			el(
				Badge,
				{
					className: 'cnl-pages-menu__status',
					intent: status.intent,
					title: __( 'Shows in your menu once published.' ),
				},
				status.label
			),
		pageId > 0 &&
			el( Button, {
				className: 'cnl-pages-menu__edit',
				icon: pencilIcon,
				label: sprintf(
					/* translators: %s: page title. */
					__( 'Edit %s' ),
					title
				),
				onClick: () => pageActions.editPage( pageId ),
				size: 'small',
			} ),
		pageId > 0 &&
			el( Button, {
				className: 'cnl-pages-menu__delete',
				icon: trashIcon,
				label: sprintf(
					/* translators: %s: page title. */
					__( 'Delete %s' ),
					title
				),
				// A menu that lists every page drops it by itself.
				onClick: () =>
					pageActions.requestDelete(
						pageId,
						isAutomatic
							? undefined
							: () => removeBlocks( [ clientId ], false )
					),
				size: 'small',
			} ),
		el( NavigationListViewMoreMenu, props )
	);
}

/**
 * What the two groups are called. With one menu it is just "your menu"; once
 * the site has others, the groups say which menu they mean.
 *
 * @param {Object}   mainMenu                Result of `useMainMenu`.
 * @param {string}   mainMenu.menuArea       Where the main menu shows.
 * @param {string[]} mainMenu.otherMenuAreas Where other menus show.
 * @return {Object} `{ inMenu, notInMenu, notInMenuInfo }`.
 */
function getGroupNames( { menuArea, otherMenuAreas } ) {
	if ( ! otherMenuAreas.length ) {
		return {
			inMenu: __( 'In your menu' ),
			notInMenu: __( 'Not in your menu' ),
			notInMenuInfo: __(
				'These pages are on your site, but visitors can only reach them from a link or their address.'
			),
		};
	}

	if ( menuArea === 'header' ) {
		return {
			inMenu: __( 'In your header menu' ),
			notInMenu: __( 'Not in your header menu' ),
			notInMenuInfo: __(
				'These pages aren’t in your header menu. Some may be in your other menus.'
			),
		};
	}

	return {
		inMenu: __( 'In your main menu' ),
		notInMenu: __( 'Not in your main menu' ),
		notInMenuInfo: __(
			'These pages aren’t in your main menu. Some may be in your other menus.'
		),
	};
}

/**
 * The line under "Other menus", saying what other menus the site has.
 *
 * @param {string[]} otherMenuAreas Where other menus show.
 * @return {string} Description.
 */
function getOtherMenusDescription( otherMenuAreas ) {
	if ( ! otherMenuAreas.length ) {
		return __( 'Add a menu for your footer, or anywhere else.' );
	}

	if ( otherMenuAreas.length === 1 && otherMenuAreas[ 0 ] === 'footer' ) {
		return __(
			'Your footer has a menu too. Change it, and any others, here.'
		);
	}

	return __( 'Your site has other menus too. Change them here.' );
}

function InMenuGroup( {
	canCreate,
	groupNames,
	menuBlocks,
	menuId,
	menuTitle,
	onAddPage,
	pageActions,
	pages,
} ) {
	const { insertBlock } = useDispatch( blockEditorStore );
	const rootClientId = useMenuRootClientId();
	const [ isOpen, setIsOpen ] = useState( true );
	const { editEntityRecord } = useDispatch( coreDataStore );
	const { removeNotice } = useDispatch( noticesStore );
	const { getBlock, getSelectedBlockClientId } =
		useSelect( blockEditorStore );
	// The link being added, edited in place with the link control.
	const [ linkClientId, setLinkClientId ] = useState( null );
	// What an automatic menu held before the link went in, to go back to if
	// the link is cancelled.
	const contentBeforeLink = useRef( null );
	const [ isDropTarget, setIsDropTarget ] = useState( false );
	// The list view also selects items for its own reasons, like after one is
	// removed, so only a click or Enter on an item previews its page.
	const activatedAt = useRef( 0 );
	const statusById = useMemo(
		() =>
			new Map(
				pages.map( ( page ) => [ Number( page.id ), page.status ] )
			),
		[ pages ]
	);
	const { previewPage } = pageActions;
	const isAutomatic = useSelect(
		( selectFromStore ) =>
			getNavigationContentFromEditedRecord(
				selectFromStore( coreDataStore ).getEditedEntityRecord(
					'postType',
					'wp_navigation',
					menuId
				)
			).includes( '<!-- wp:page-list' ),
		[ menuId ]
	);
	const blockSettingsMenu = useMemo(
		() => ( props ) =>
			el( MenuItemOptions, {
				...props,
				isAutomatic,
				pageActions,
				statusById,
			} ),
		[ isAutomatic, pageActions, statusById ]
	);
	const openPage = ( block ) => {
		const pageId = getLinkedPageId( block );

		if ( pageId && Date.now() - activatedAt.current < 500 ) {
			previewPage( pageId );
		}
	};
	const isEmpty = ! menuBlocks.length;
	const { previewedId } = pageActions;
	const { clearSelectedBlock, selectBlock } = useDispatch( blockEditorStore );
	const previewedClientId = useSelect(
		( selectFromStore ) => {
			const store = selectFromStore( blockEditorStore );

			return [
				...store.getBlocksByName( 'core/navigation-link' ),
				...store.getBlocksByName( 'core/navigation-submenu' ),
			].find(
				( clientId ) =>
					getLinkedPageId( store.getBlock( clientId ) ) ===
					previewedId
			);
		},
		[ previewedId ]
	);

	// Mark the page in the canvas as the picked item, however it got there.
	useEffect( () => {
		const selectedClientId = getSelectedBlockClientId();

		if ( previewedClientId && selectedClientId !== previewedClientId ) {
			selectBlock( previewedClientId, null );
		} else if ( ! previewedClientId && selectedClientId ) {
			clearSelectedBlock();
		}
	}, [
		clearSelectedBlock,
		getSelectedBlockClientId,
		previewedClientId,
		selectBlock,
	] );

	const addLink = () => {
		const link = createCustomNavigationLinkBlock();

		contentBeforeLink.current = isAutomatic
			? getNavigationContentFromEditedRecord(
					selectFromRegistry( coreDataStore ).getEditedEntityRecord(
						'postType',
						'wp_navigation',
						menuId
					)
				)
			: null;
		insertBlock( link, undefined, rootClientId, false );
		setLinkClientId( link.clientId );
	};
	const finishLink = ( clientId ) => {
		// Cancelled, the empty link is removed. A menu that listed every page
		// goes back to doing so, rather than staying set by hand.
		if (
			! clientId &&
			contentBeforeLink.current !== null &&
			! getBlock( linkClientId )
		) {
			editEntityRecord( 'postType', 'wp_navigation', menuId, {
				blocks: undefined,
				content: contentBeforeLink.current,
				selection: undefined,
			} );
			removeNotice( 'cnl-menu-set-by-hand' );
		}

		if ( ! clientId ) {
			contentBeforeLink.current = null;
		}

		setLinkClientId( clientId );
	};

	return el(
		'section',
		{
			'aria-label': groupNames.inMenu,
			className: 'cnl-pages-menu__group',
		},
		el( GroupHeader, {
			actions: el(
				DropdownMenu,
				{
					icon: plusIcon,
					label: __( 'Add to your menu' ),
					popoverProps: { placement: 'bottom-end' },
					toggleProps: { size: 'small' },
				},
				( { onClose } ) =>
					el(
						MenuGroup,
						null,
						canCreate &&
							el(
								MenuItem,
								{
									onClick: () => {
										onAddPage( 'menu' );
										onClose();
									},
								},
								__( 'New page' )
							),
						el(
							MenuItem,
							{
								onClick: () => {
									onClose();
									// Let the menu close before the link
									// control takes focus.
									window.requestAnimationFrame( addLink );
								},
							},
							__( 'Link' )
						)
					)
			),
			linkControl:
				linkClientId &&
				el( NavigationListViewLinkUI, {
					insertedBlockClientId: linkClientId,
					setInsertedBlockClientId: finishLink,
				} ),
			count: menuBlocks.length,
			isOpen,
			onToggle: () => setIsOpen( ! isOpen ),
			title: groupNames.inMenu,
		} ),
		isOpen &&
			! isEmpty &&
			el(
				'div',
				{
					onClickCapture: ( event ) => {
						if ( event.target.closest?.( SELECT_BUTTON ) ) {
							activatedAt.current = Date.now();
						}
					},
					onKeyDownCapture: ( event ) => {
						if (
							event.key === 'Enter' &&
							event.target.closest?.( SELECT_BUTTON )
						) {
							activatedAt.current = Date.now();
						}
					},
				},
				el( NavigationListViewContent, {
					blockSettingsMenu,
					menuTitle,
					onSelect: openPage,
					showAppender: false,
				} )
			),
		isOpen &&
			isEmpty &&
			el(
				'div',
				{
					className: `cnl-pages-menu__empty${
						isDropTarget ? ' is-drop-target' : ''
					}`,
					onDragLeave: () => setIsDropTarget( false ),
					onDragOver: ( event ) => {
						if (
							event.dataTransfer.types.includes( 'wp-blocks' )
						) {
							event.preventDefault();
							setIsDropTarget( true );
						}
					},
					onDrop: ( event ) => {
						event.preventDefault();
						setIsDropTarget( false );

						try {
							const data = JSON.parse(
								event.dataTransfer.getData( 'wp-blocks' )
							);

							if ( data.type === 'inserter' ) {
								createEditorBlocksFromNavigationBlocks(
									data.blocks
								).forEach( ( block ) =>
									insertBlock(
										block,
										undefined,
										rootClientId,
										false
									)
								);
							}
						} catch {
							// Not something that can go in the menu.
						}
					},
				},
				__( 'Nothing in your menu yet. Drag pages here, or use +.' )
			)
	);
}

function NotInMenuRow( {
	isPreviewed,
	onAddToMenu,
	page,
	pageActions,
	roles,
} ) {
	const id = Number( page.id );
	const title = getPageTitle( page );
	const role = getPageRole( page, roles );
	const status = getStatusBadge( page.status );

	return el(
		'li',
		{
			className: `cnl-pages-menu__page${ isPreviewed ? ' is-previewed' : '' }`,
			draggable: true,
			onDragStart: ( event ) => {
				event.dataTransfer.effectAllowed = 'copyMove';
				event.dataTransfer.setData(
					'wp-blocks',
					JSON.stringify( {
						blocks: [
							createNavigationLinkBlockFromPage( {
								...page,
								type: 'page',
							} ),
						],
						type: 'inserter',
					} )
				);
				event.dataTransfer.setData( 'text/plain', title );
			},
		},
		el(
			'button',
			{
				'aria-current': isPreviewed ? 'page' : undefined,
				'aria-description': __(
					'Drag into your menu to add it to the menu.'
				),
				className: 'cnl-pages-menu__page-link',
				onClick: () => pageActions.previewPage( id ),
				type: 'button',
			},
			el( Icon, {
				className: 'cnl-pages-menu__page-icon',
				icon: getPageIcon( page, roles ),
			} ),
			el( 'span', { className: 'cnl-pages-menu__page-title' }, title ),
			role &&
				el( 'span', { className: 'cnl-pages-menu__page-role' }, role ),
			status &&
				el(
					Badge,
					{
						className: 'cnl-pages-menu__status',
						intent: status.intent,
					},
					status.label
				)
		),
		el(
			'div',
			{ className: 'cnl-pages-menu__page-actions' },
			el( Button, {
				icon: pencilIcon,
				label: sprintf(
					/* translators: %s: page title. */
					__( 'Edit %s' ),
					title
				),
				onClick: () => pageActions.editPage( id ),
				size: 'small',
			} ),
			el( Button, {
				icon: plusIcon,
				label: sprintf(
					/* translators: %s: page title. */
					__( 'Add %s to your menu' ),
					title
				),
				onClick: () => onAddToMenu( page ),
				size: 'small',
			} ),
			el( Button, {
				icon: trashIcon,
				label: sprintf(
					/* translators: %s: page title. */
					__( 'Delete %s' ),
					title
				),
				onClick: () => pageActions.requestDelete( id ),
				size: 'small',
			} )
		)
	);
}

function NotInMenuGroup( {
	canCreate,
	groupNames,
	menuBlocks,
	onAddPage,
	pageActions,
	pages,
	roles,
} ) {
	const { insertBlock, removeBlocks } = useDispatch( blockEditorStore );
	const menuSelectors = useSelect( blockEditorStore );
	const rootClientId = useMenuRootClientId();
	const [ isOpen, setIsOpen ] = useState( true );
	const [ isDropTarget, setIsDropTarget ] = useState( false );
	const linkedPageIds = useMemo(
		() => getMenuPagesFromBlocks( menuBlocks ).pageIds,
		[ menuBlocks ]
	);
	const notInMenu = useMemo(
		() =>
			pages
				.filter( ( page ) => ! linkedPageIds.has( Number( page.id ) ) )
				.sort( ( a, b ) =>
					getPageTitle( a ).localeCompare( getPageTitle( b ) )
				),
		[ linkedPageIds, pages ]
	);
	const addToMenu = ( page ) =>
		insertBlock(
			createMenuItemFromPage( page ),
			undefined,
			rootClientId,
			false
		);

	return el(
		'section',
		{
			'aria-label': groupNames.notInMenu,
			className: `cnl-pages-menu__group${
				isDropTarget ? ' is-drop-target' : ''
			}`,
			onDragLeave: ( event ) => {
				if ( ! event.currentTarget.contains( event.relatedTarget ) ) {
					setIsDropTarget( false );
				}
			},
			onDragOver: ( event ) => {
				if ( getDraggedPageItems( menuSelectors ).length ) {
					event.preventDefault();
					event.dataTransfer.dropEffect = 'move';
					setIsDropTarget( true );
				}
			},
			onDrop: ( event ) => {
				const clientIds = getDraggedPageItems( menuSelectors );

				setIsDropTarget( false );

				if ( clientIds.length ) {
					event.preventDefault();
					removeBlocks( clientIds, false );
				}
			},
		},
		el( GroupHeader, {
			actions:
				canCreate &&
				el( Button, {
					icon: plusIcon,
					label: __( 'New page, not in your menu' ),
					onClick: () => onAddPage( 'not-in-menu' ),
					size: 'small',
				} ),
			count: notInMenu.length,
			info: groupNames.notInMenuInfo,
			isOpen,
			onToggle: () => setIsOpen( ! isOpen ),
			title: groupNames.notInMenu,
		} ),
		isOpen &&
			( notInMenu.length
				? el(
						'ul',
						{ className: 'cnl-pages-menu__pages', role: 'list' },
						notInMenu.map( ( page ) =>
							el( NotInMenuRow, {
								isPreviewed:
									Number( page.id ) ===
									pageActions.previewedId,
								key: page.id,
								onAddToMenu: addToMenu,
								page,
								pageActions,
								roles,
							} )
						)
					)
				: el(
						Text,
						{
							className: 'cnl-pages-menu__none',
							variant: 'body-sm',
						},
						__( 'Every page is in your menu.' )
					) )
	);
}

/**
 * Every page, split into the ones in the site's main menu and the rest.
 *
 * Without a main menu to manage, this falls back to the page tree.
 *
 * @param {Object}   props           Component props.
 * @param {boolean}  props.canCreate Whether the user can add pages.
 * @param {Function} props.onAddPage Opens the add page flow, given where the
 *                                   new page goes: 'menu' or 'not-in-menu'.
 * @return {Element} The two groups.
 */
export default function PagesMenuGroups( { canCreate, onAddPage } ) {
	const mainMenu = useMainMenu();
	const { isLoading: isLoadingMenu, menuId, menuTitle } = mainMenu;
	const { frontPageId, isLoading, pages, postsPageId } = usePages();
	const navigate = useNavigate();
	const searchParams = useSearch( { strict: false } );
	const [ menuBlocks, setMenuBlocks ] = useState( null );
	const roles = useMemo(
		() => ( { frontPageId, postsPageId } ),
		[ frontPageId, postsPageId ]
	);
	const previewedId =
		Number( searchParams.previewId ) ||
		frontPageId ||
		Number( pages[ 0 ]?.id ) ||
		0;
	const trash = usePageTrash( { pages, previewedId } );
	const pageActions = useMemo(
		() => ( {
			editPage: ( pageId ) =>
				navigate( {
					search: {
						...searchParams,
						postId: pageId,
						previewId: pageId,
					},
					to: LIST_PATH,
				} ),
			previewPage: ( pageId ) =>
				navigate( {
					search: { ...searchParams, previewId: pageId },
					to: LIST_PATH,
				} ),
			previewedId,
			requestDelete: trash.requestDelete,
		} ),
		[ navigate, previewedId, searchParams, trash.requestDelete ]
	);

	if ( ( isLoading && ! pages.length ) || isLoadingMenu ) {
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

	if ( ! menuId ) {
		return el( PagesTree, { canCreate, onAddPage: () => onAddPage() } );
	}

	const groupNames = getGroupNames( mainMenu );

	return el(
		'div',
		{ className: 'cnl-pages-menu' },
		el(
			NavigationMenuEditorProvider,
			{ navigationId: menuId, onBlocksChange: setMenuBlocks },
			menuBlocks &&
				el( InMenuGroup, {
					canCreate,
					groupNames,
					menuBlocks,
					menuId,
					menuTitle,
					onAddPage,
					pageActions,
					pages,
				} ),
			menuBlocks &&
				el( NotInMenuGroup, {
					canCreate,
					groupNames,
					menuBlocks,
					onAddPage,
					pageActions,
					pages,
					roles,
				} )
		),
		// The menu here is the main one; any others are managed on Menus.
		el( ScreenLinks, {
			label: __( 'More menu options' ),
			links: [
				{
					description: getOtherMenusDescription(
						mainMenu.otherMenuAreas
					),
					icon: compassIcon,
					title: __( 'Other menus' ),
					to: '/navigation',
				},
			],
		} ),
		trash.modal
	);
}
