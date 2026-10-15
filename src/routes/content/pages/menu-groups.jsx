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
import {
	getHomeLinkContext,
	getHomepageSummary,
	parseTarget,
	registerHomeLinkVariation,
	useHomepageState,
} from './homepage';
import {
	findHomeMenuItem,
	HOMEPAGE,
	isHomeMenuItem,
	withoutHomepagePage,
} from './homepage-state';
import { getPageIcon, getPageRole, getStatusBadge } from './page-labels';
import { PagesTree, usePageTrash } from './page-tree-list';
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
	homeIcon,
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
 * The menu item for the homepage: a Home link, which goes to the homepage
 * whatever it shows.
 *
 * @return {Object} Serialized-shape menu item.
 */
function createHomeLinkBlock() {
	return {
		attributes: { label: __( 'Home' ) },
		innerBlocks: [],
		name: 'core/home-link',
	};
}

/**
 * The menu items being dragged, if they are all links to pages or Home links,
 * and so can be dropped out of the menu.
 *
 * @param {Object}   selectors                          Block editor selectors for the menu.
 * @param {Function} selectors.getBlock                 Gets a block.
 * @param {Function} selectors.getDraggedBlockClientIds Gets the dragged blocks.
 * @return {string[]} Dragged client IDs, or none if they can't leave the menu.
 */
function getDraggedPageItems( { getBlock, getDraggedBlockClientIds } ) {
	const clientIds = getDraggedBlockClientIds();

	return clientIds.length &&
		clientIds.every(
			( clientId ) =>
				getLinkedPageId( getBlock( clientId ) ) ||
				getBlock( clientId )?.name === 'core/home-link'
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
	return (
		<div className="cnl-pages-menu__group-header">
			<h3 className="cnl-pages-menu__group-title">
				{ title }
				<span className="cnl-pages-menu__group-count">{ count }</span>
			</h3>
			{ info && (
				<Button
					className="cnl-pages-menu__info"
					icon={ infoIcon }
					label={ info }
					showTooltip
					size="small"
				/>
			) }
			<div className="cnl-pages-menu__group-actions">
				{ actions }
				{
					// Placed here so the link control opens beside the + button.
					linkControl
				}
				<Button
					aria-expanded={ isOpen }
					icon={
						isOpen ? chevronDownSmallIcon : chevronRightSmallIcon
					}
					label={
						isOpen
							? sprintf(
									/* translators: %s: group name. */
									__( 'Hide %s' ),
									title
								)
							: sprintf(
									/* translators: %s: group name. */
									__( 'Show %s' ),
									title
								)
					}
					onClick={ onToggle }
					size="small"
				/>
			</div>
		</div>
	);
}

const HOME_ICON_PATH =
	'M12 4L4 7.9V20h16V7.9L12 4zm6.5 14.5H14V13h-4v5.5H5.5V8.8L12 5.7l6.5 3.1v9.7z';
const LINK_ICON_PATH =
	'M12.5 14.5h-1V16h1c2.2 0 4-1.8 4-4s-1.8-4-4-4h-1v1.5h1c1.4 0 2.5 1.1 2.5 2.5s-1.1 2.5-2.5 2.5zm-4 1.5v-1.5h-1C6.1 14.5 5 13.4 5 12s1.1-2.5 2.5-2.5h1V8h-1c-2.2 0-4 1.8-4 4s1.8 4 4 4h1zm-1-3.2h5v-1.5h-5v1.5zM18 4H9c-1.1 0-2 .9-2 2v.5h1.5V6c0-.3.2-.5.5-.5h9c.3 0 .5.2.5.5v12c0 .3-.2.5-.5.5H9c-.3 0-.5-.2-.5-.5v-.5H7v.5c0 1.1.9 2 2 2h9c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z';

function getIconRule( clientId, path ) {
	const icon = encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${ path }"/></svg>`
	);
	const target = `.cnl-pages-menu [data-block="${ clientId }"] .block-editor-list-view-block-select-button > .block-editor-block-icon`;

	return `${ target } svg { visibility: hidden; } ${ target } { background-color: currentColor; mask: url("data:image/svg+xml,${ icon }") center / 24px 24px no-repeat; }`;
}

/**
 * Icons for the menu items that go home, which the list view draws from the
 * kind of block rather than what it means here. Only the item standing for
 * the homepage has a house, even when it is a link to its page. Any other
 * Home link is just another link, so it doesn't look like the homepage too.
 *
 * @param {Object[]} items `{ clientId, name }` for each item that goes home,
 *                         the one standing for the homepage first.
 * @return {string} CSS.
 */
function getHomeIconStyles( items ) {
	return items
		.map( ( { clientId, name }, index ) => {
			if ( index === 0 ) {
				return name === 'core/home-link'
					? ''
					: getIconRule( clientId, HOME_ICON_PATH );
			}

			return name === 'core/home-link'
				? getIconRule( clientId, LINK_ICON_PATH )
				: '';
		} )
		.join( '\n' );
}

/**
 * A menu item's options, with ways to edit or delete the page it links to, and
 * a badge when visitors can't see that page yet.
 *
 * @param {Object} props Props from the list view.
 * @return {Element} The badge and options.
 */
function MenuItemOptions( props ) {
	const {
		clientId,
		homepage,
		homepageClientId,
		isAutomatic,
		pageActions,
		statusById,
	} = props;
	const { removeBlocks } = useDispatch( blockEditorStore );
	const block = useSelect(
		( selectFromStore ) =>
			selectFromStore( blockEditorStore ).getBlock( clientId ),
		[ clientId ]
	);

	// The homepage, linked one way or another. Its house says so. It opens as
	// the homepage, and can be taken out of the menu but not deleted.
	if ( block && clientId === homepageClientId ) {
		const { badge } = getHomepageSummary( homepage );

		return (
			<div className="cnl-pages-menu__item-options">
				{ badge && (
					<Badge
						className="cnl-pages-menu__status"
						intent={ badge.intent }
					>
						{ badge.label }
					</Badge>
				) }
				<Button
					className="cnl-pages-menu__edit"
					icon={ pencilIcon }
					label={ __( 'Edit Homepage' ) }
					onClick={ () => pageActions.editPage( HOMEPAGE ) }
					size="small"
				/>
				<NavigationListViewMoreMenu { ...props } />
			</div>
		);
	}

	const pageId = getLinkedPageId( block );
	const title = getNavigationItemLabel( block );
	const status = getStatusBadge( statusById.get( pageId ) );

	return (
		<div className="cnl-pages-menu__item-options">
			{ status && (
				<Badge
					className="cnl-pages-menu__status"
					intent={ status.intent }
					title={ __( 'Shows in your menu once published.' ) }
				>
					{ status.label }
				</Badge>
			) }
			{ pageId > 0 && (
				<Button
					className="cnl-pages-menu__edit"
					icon={ pencilIcon }
					label={ sprintf(
						/* translators: %s: page title. */
						__( 'Edit %s' ),
						title
					) }
					onClick={ () => pageActions.editPage( pageId ) }
					size="small"
				/>
			) }
			{ pageId > 0 && (
				<Button
					className="cnl-pages-menu__delete"
					icon={ trashIcon }
					label={ sprintf(
						/* translators: %s: page title. */
						__( 'Delete %s' ),
						title
					) }
					// A menu that lists every page drops it by itself.
					onClick={ () =>
						pageActions.requestDelete(
							pageId,
							isAutomatic
								? undefined
								: () => removeBlocks( [ clientId ], false )
						)
					}
					size="small"
				/>
			) }
			<NavigationListViewMoreMenu { ...props } />
		</div>
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
	homepage,
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
	const homeContext = useMemo(
		() => getHomeLinkContext( homepage ),
		[ homepage ]
	);
	// Every item that goes home, as `clientId:name`, top to bottom. The first
	// stands for the homepage.
	const homeItems = useSelect(
		( selectFromStore ) => {
			const store = selectFromStore( blockEditorStore );
			const found = [];
			const visit = ( clientIds ) =>
				clientIds.forEach( ( clientId ) => {
					const block = store.getBlock( clientId );

					if ( isHomeMenuItem( block, homeContext ) ) {
						found.push( `${ clientId }:${ block.name }` );
					}

					visit( store.getBlockOrder( clientId ) );
				} );

			visit( store.getBlockOrder( store.getBlockOrder()[ 0 ] || '' ) );

			return found.join( ',' );
		},
		[ homeContext ]
	);
	const homeItemList = useMemo(
		() =>
			homeItems
				.split( ',' )
				.filter( Boolean )
				.map( ( item ) => {
					const [ clientId, name ] = item.split( ':' );

					return { clientId, name };
				} ),
		[ homeItems ]
	);
	const homepageClientId = homeItemList[ 0 ]?.clientId;
	const homeIconStyles = useMemo(
		() => getHomeIconStyles( homeItemList ),
		[ homeItemList ]
	);
	const blockSettingsMenu = useMemo(
		() => ( props ) => (
			<MenuItemOptions
				{ ...props }
				homepage={ homepage }
				homepageClientId={ homepageClientId }
				isAutomatic={ isAutomatic }
				pageActions={ pageActions }
				statusById={ statusById }
			/>
		),
		[ homepage, homepageClientId, isAutomatic, pageActions, statusById ]
	);
	const openPage = ( block ) => {
		if ( Date.now() - activatedAt.current >= 500 ) {
			return;
		}

		if ( isHomeMenuItem( block, homeContext ) ) {
			previewPage( HOMEPAGE );
		} else if ( getLinkedPageId( block ) ) {
			previewPage( getLinkedPageId( block ) );
		}
	};

	useEffect( () => registerHomeLinkVariation(), [] );
	const isEmpty = ! menuBlocks.length;
	const { previewedId } = pageActions;
	const { clearSelectedBlock, selectBlock } = useDispatch( blockEditorStore );
	const previewedClientId = useSelect(
		( selectFromStore ) => {
			if ( previewedId === HOMEPAGE ) {
				return homepageClientId;
			}

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
		[ homepageClientId, previewedId ]
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

	return (
		<section
			aria-label={ groupNames.inMenu }
			className="cnl-pages-menu__group"
		>
			<GroupHeader
				actions={
					<DropdownMenu
						icon={ plusIcon }
						label={ __( 'Add to your menu' ) }
						popoverProps={ { placement: 'bottom-end' } }
						toggleProps={ { size: 'small' } }
					>
						{ ( { onClose } ) => (
							<MenuGroup>
								{ canCreate && (
									<MenuItem
										onClick={ () => {
											onAddPage( 'menu' );
											onClose();
										} }
									>
										{ __( 'New page' ) }
									</MenuItem>
								) }
								<MenuItem
									onClick={ () => {
										onClose();
										// Let the menu close before the link
										// control takes focus.
										window.requestAnimationFrame( addLink );
									} }
								>
									{ __( 'Link' ) }
								</MenuItem>
							</MenuGroup>
						) }
					</DropdownMenu>
				}
				linkControl={
					linkClientId && (
						<NavigationListViewLinkUI
							insertedBlockClientId={ linkClientId }
							setInsertedBlockClientId={ finishLink }
						/>
					)
				}
				count={ menuBlocks.length }
				isOpen={ isOpen }
				onToggle={ () => setIsOpen( ! isOpen ) }
				title={ groupNames.inMenu }
			/>
			{ homeIconStyles && <style>{ homeIconStyles }</style> }
			{ isOpen && ! isEmpty && (
				<div
					onClickCapture={ ( event ) => {
						if ( event.target.closest?.( SELECT_BUTTON ) ) {
							activatedAt.current = Date.now();
						}
					} }
					onKeyDownCapture={ ( event ) => {
						if (
							event.key === 'Enter' &&
							event.target.closest?.( SELECT_BUTTON )
						) {
							activatedAt.current = Date.now();
						}
					} }
				>
					<NavigationListViewContent
						blockSettingsMenu={ blockSettingsMenu }
						menuTitle={ menuTitle }
						onSelect={ openPage }
						showAppender={ false }
					/>
				</div>
			) }
			{ isOpen && isEmpty && (
				<div
					className={ `cnl-pages-menu__empty${
						isDropTarget ? ' is-drop-target' : ''
					}` }
					onDragLeave={ () => setIsDropTarget( false ) }
					onDragOver={ ( event ) => {
						if (
							event.dataTransfer.types.includes( 'wp-blocks' )
						) {
							event.preventDefault();
							setIsDropTarget( true );
						}
					} }
					onDrop={ ( event ) => {
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
					} }
				>
					{ __(
						'Nothing in your menu yet. Drag pages here, or use +.'
					) }
				</div>
			) }
		</section>
	);
}

/**
 * The homepage, while the menu doesn't go to it. It can be dragged into the
 * menu, or added with +, as a Home link. It can't be deleted.
 *
 * @param {Object}   props             Component props.
 * @param {Object}   props.homepage    Result of `useHomepageState`.
 * @param {boolean}  props.isPreviewed Whether the canvas shows it.
 * @param {Function} props.onAddToMenu Adds it to the menu.
 * @param {Object}   props.pageActions Ways to show and open pages.
 * @return {Element} The row.
 */
function HomepageMenuRow( {
	homepage,
	isPreviewed,
	onAddToMenu,
	pageActions,
} ) {
	const { badge, summary } = getHomepageSummary( homepage );

	return (
		<li
			className={ `cnl-pages-menu__page cnl-pages-menu__page--homepage${
				isPreviewed ? ' is-previewed' : ''
			}` }
			draggable
			onDragStart={ ( event ) => {
				event.dataTransfer.effectAllowed = 'copyMove';
				event.dataTransfer.setData(
					'wp-blocks',
					JSON.stringify( {
						blocks: [ createHomeLinkBlock() ],
						type: 'inserter',
					} )
				);
				event.dataTransfer.setData( 'text/plain', __( 'Homepage' ) );
			} }
		>
			{ /* eslint-disable-next-line jsx-a11y/role-supports-aria-props -- aria-description is a global attribute in ARIA 1.3. */ }
			<button
				aria-current={ isPreviewed ? 'page' : undefined }
				aria-description={ __(
					'Drag into your menu to add it to the menu.'
				) }
				className="cnl-pages-menu__page-link"
				onClick={ () => pageActions.previewPage( HOMEPAGE ) }
				type="button"
			>
				<Icon className="cnl-pages-menu__page-icon" icon={ homeIcon } />
				<span className="cnl-pages-menu__page-title">
					{ __( 'Homepage' ) }
				</span>
				{ summary && (
					<span className="cnl-pages-menu__page-role">
						{ summary }
					</span>
				) }
				{ badge && (
					<Badge
						className="cnl-pages-menu__status"
						intent={ badge.intent }
					>
						{ badge.label }
					</Badge>
				) }
			</button>
			<div className="cnl-pages-menu__page-actions">
				<Button
					icon={ pencilIcon }
					label={ __( 'Edit Homepage' ) }
					onClick={ () => pageActions.editPage( HOMEPAGE ) }
					size="small"
				/>
				<Button
					icon={ plusIcon }
					label={ __( 'Add Homepage to your menu' ) }
					onClick={ onAddToMenu }
					size="small"
				/>
			</div>
		</li>
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

	return (
		<li
			className={ `cnl-pages-menu__page${ isPreviewed ? ' is-previewed' : '' }` }
			draggable
			onDragStart={ ( event ) => {
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
			} }
		>
			{ /* eslint-disable-next-line jsx-a11y/role-supports-aria-props -- aria-description is a global attribute in ARIA 1.3. */ }
			<button
				aria-current={ isPreviewed ? 'page' : undefined }
				aria-description={ __(
					'Drag into your menu to add it to the menu.'
				) }
				className="cnl-pages-menu__page-link"
				onClick={ () => pageActions.previewPage( id ) }
				type="button"
			>
				<Icon
					className="cnl-pages-menu__page-icon"
					icon={ getPageIcon( page, roles ) }
				/>
				<span className="cnl-pages-menu__page-title">{ title }</span>
				{ role && (
					<span className="cnl-pages-menu__page-role">{ role }</span>
				) }
				{ status && (
					<Badge
						className="cnl-pages-menu__status"
						intent={ status.intent }
					>
						{ status.label }
					</Badge>
				) }
			</button>
			<div className="cnl-pages-menu__page-actions">
				<Button
					icon={ pencilIcon }
					label={ sprintf(
						/* translators: %s: page title. */
						__( 'Edit %s' ),
						title
					) }
					onClick={ () => pageActions.editPage( id ) }
					size="small"
				/>
				<Button
					icon={ plusIcon }
					label={ sprintf(
						/* translators: %s: page title. */
						__( 'Add %s to your menu' ),
						title
					) }
					onClick={ () => onAddToMenu( page ) }
					size="small"
				/>
				<Button
					icon={ trashIcon }
					label={ sprintf(
						/* translators: %s: page title. */
						__( 'Delete %s' ),
						title
					) }
					onClick={ () => pageActions.requestDelete( id ) }
					size="small"
				/>
			</div>
		</li>
	);
}

function NotInMenuGroup( {
	canCreate,
	groupNames,
	homepage,
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
	// The homepage is listed as itself, never as its page too.
	const isHomeInMenu = useMemo(
		() =>
			Boolean(
				findHomeMenuItem( menuBlocks, getHomeLinkContext( homepage ) )
			),
		[ homepage, menuBlocks ]
	);
	const showsHomepage = ! homepage.isLoading && ! isHomeInMenu;
	const notInMenu = useMemo(
		() =>
			withoutHomepagePage( pages, homepage.pageId )
				.filter( ( page ) => ! linkedPageIds.has( Number( page.id ) ) )
				.sort( ( a, b ) =>
					getPageTitle( a ).localeCompare( getPageTitle( b ) )
				),
		[ homepage.pageId, linkedPageIds, pages ]
	);
	const addToMenu = ( page ) =>
		insertBlock(
			createMenuItemFromPage( page ),
			undefined,
			rootClientId,
			false
		);
	const addHomepageToMenu = () =>
		insertBlock(
			createEditorBlocksFromNavigationBlocks( [
				createHomeLinkBlock(),
			] )[ 0 ],
			undefined,
			rootClientId,
			false
		);
	const count = notInMenu.length + ( showsHomepage ? 1 : 0 );

	return (
		<section
			aria-label={ groupNames.notInMenu }
			className={ `cnl-pages-menu__group${
				isDropTarget ? ' is-drop-target' : ''
			}` }
			onDragLeave={ ( event ) => {
				if ( ! event.currentTarget.contains( event.relatedTarget ) ) {
					setIsDropTarget( false );
				}
			} }
			onDragOver={ ( event ) => {
				if ( getDraggedPageItems( menuSelectors ).length ) {
					event.preventDefault();
					event.dataTransfer.dropEffect = 'move';
					setIsDropTarget( true );
				}
			} }
			onDrop={ ( event ) => {
				const clientIds = getDraggedPageItems( menuSelectors );

				setIsDropTarget( false );

				if ( clientIds.length ) {
					event.preventDefault();
					removeBlocks( clientIds, false );
				}
			} }
		>
			<GroupHeader
				actions={
					canCreate && (
						<Button
							icon={ plusIcon }
							label={ __( 'New page, not in your menu' ) }
							onClick={ () => onAddPage( 'not-in-menu' ) }
							size="small"
						/>
					)
				}
				count={ count }
				info={ groupNames.notInMenuInfo }
				isOpen={ isOpen }
				onToggle={ () => setIsOpen( ! isOpen ) }
				title={ groupNames.notInMenu }
			/>
			{ isOpen &&
				( count ? (
					<ul className="cnl-pages-menu__pages" role="list">
						{ showsHomepage && (
							<HomepageMenuRow
								homepage={ homepage }
								isPreviewed={
									pageActions.previewedId === HOMEPAGE
								}
								onAddToMenu={ addHomepageToMenu }
								pageActions={ pageActions }
							/>
						) }
						{ notInMenu.map( ( page ) => (
							<NotInMenuRow
								isPreviewed={
									Number( page.id ) ===
									pageActions.previewedId
								}
								key={ page.id }
								onAddToMenu={ addToMenu }
								page={ page }
								pageActions={ pageActions }
								roles={ roles }
							/>
						) ) }
					</ul>
				) : (
					<Text className="cnl-pages-menu__none" variant="body-sm">
						{ __( 'Every page is in your menu.' ) }
					</Text>
				) ) }
		</section>
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
	const homepage = useHomepageState();
	const navigate = useNavigate();
	const searchParams = useSearch( { strict: false } );
	const [ menuBlocks, setMenuBlocks ] = useState( null );
	const roles = useMemo(
		() => ( { frontPageId, postsPageId } ),
		[ frontPageId, postsPageId ]
	);
	// The canvas shows the homepage until something else is picked.
	let previewedId = parseTarget( searchParams.previewId ) || HOMEPAGE;

	if ( previewedId === homepage.pageId ) {
		previewedId = HOMEPAGE;
	}

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
		return (
			<Stack
				aria-hidden
				className="cnl-pages-tree cnl-pages-tree--loading"
				direction="column"
				gap="md"
			>
				{ [ 62, 48, 70, 40, 56 ].map( ( width, index ) => (
					<Skeleton
						key={ index }
						style={ { height: 16, width: `${ width }%` } }
					/>
				) ) }
			</Stack>
		);
	}

	if ( ! menuId ) {
		return (
			<PagesTree
				canCreate={ canCreate }
				onAddPage={ () => onAddPage() }
			/>
		);
	}

	const groupNames = getGroupNames( mainMenu );

	return (
		<div className="cnl-pages-menu">
			<NavigationMenuEditorProvider
				navigationId={ menuId }
				onBlocksChange={ setMenuBlocks }
			>
				{ menuBlocks && (
					<InMenuGroup
						canCreate={ canCreate }
						groupNames={ groupNames }
						homepage={ homepage }
						menuBlocks={ menuBlocks }
						menuId={ menuId }
						menuTitle={ menuTitle }
						onAddPage={ onAddPage }
						pageActions={ pageActions }
						pages={ pages }
					/>
				) }
				{ menuBlocks && (
					<NotInMenuGroup
						canCreate={ canCreate }
						groupNames={ groupNames }
						homepage={ homepage }
						menuBlocks={ menuBlocks }
						onAddPage={ onAddPage }
						pageActions={ pageActions }
						pages={ pages }
						roles={ roles }
					/>
				) }
			</NavigationMenuEditorProvider>
			{ /* The menu here is the main one; any others are managed on Menus. */ }
			<ScreenLinks
				label={ __( 'More menu options' ) }
				links={ [
					{
						description: getOtherMenusDescription(
							mainMenu.otherMenuAreas
						),
						icon: compassIcon,
						title: __( 'Other menus' ),
						to: '/navigation',
					},
				] }
			/>
			{ trash.modal }
		</div>
	);
}
