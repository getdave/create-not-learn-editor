/**
 * The Header and Footer screens, reached from the "Your site" screen through
 * a screen that offers the two, "Header & footer".
 *
 * Like a page on the Pages screen: the stage holds what can be changed about
 * the part as a whole, and the canvas shows the homepage with the part in the
 * spotlight, editable in place.
 *
 * Each thing that can be changed opens as a view of the same screen, rather
 * than another screen, so the part stays in the spotlight throughout, with
 * what the view changes outlined in it.
 */

/**
 * WordPress dependencies
 */
import { Preview as LazyEditorPreview } from '@wordpress/lazy-editor';
import { useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { cnlEditorStore, getTitleText } from '../../records';
import ScreenLinks from '../../screen-links';
import { settings } from '../../settings';
import { getSiteCrumb } from '../../site-trail';
import {
	SiteCanvas,
	useCanvasDocument,
	useSiteCanvas,
} from '../../site-canvas';
import { withCanvasRecovery } from '../../canvas-recovery';
import { GlobalScope } from '../../global-scope';
import { withUiTheme } from '../../theme';
import { getPatternTitle } from '../content/page-layouts';
import { useMenuItemsEditor } from '../navigation-edit/menu-items-editor';
import { SiteIdentityFields, useSiteIdentity } from '../../pickers/identity';
import { SitePartLayouts } from '../../pickers/site-part-layouts';
import {
	SITE_PART_PATHS,
	SITE_PARTS_PATH,
	useSitePart,
	useSitePartContents,
	useSitePartLayouts,
} from './data';
import {
	getAddableServices,
	getService,
	getSocialLinksDescription,
	isPlaceholderUrl,
	useSocialLinks,
	withSocialLinks,
} from './social-links';
import { useSitePartSpotlight } from './spotlight';
import sitePartsIcon from '../../site-parts-icon';
import {
	BlockIcon,
	Breadcrumbs,
	Button,
	Dropdown,
	DropdownMenu,
	Icon,
	InputControl,
	InputLayout,
	MenuGroup,
	MenuItem,
	Spinner,
	Stack,
	Text,
	__,
	_n,
	chevronDownIcon,
	chevronUpIcon,
	compassIcon,
	coreDataStore,
	footerIcon,
	headerIcon,
	layoutIcon,
	moreVerticalIcon,
	plusIcon,
	shareIcon,
	siteLogoIcon,
	sprintf,
	trashIcon,
	useCallback,
	useRef,
	useSelect,
	useState,
} from '../../wordpress-packages';

// The search params that open a part's views, over the same canvas.
const LAYOUTS_VIEW = 'layouts';
const IDENTITY_VIEW = 'identity';
const MENU_VIEW = 'menu';
const SOCIAL_VIEW = 'social';

// What each view is called, and the line under its heading.
const VIEWS = {
	[ IDENTITY_VIEW ]: {
		description: () =>
			__(
				'Change them here, and see them on the right. Save to keep them.'
			),
		title: () => __( 'Name & logo' ),
	},
	[ LAYOUTS_VIEW ]: {
		description: () =>
			__( 'Pick one to try it on the right. Save to keep it.' ),
		title: () => __( 'Layouts' ),
	},
	[ MENU_VIEW ]: {
		description: () =>
			__(
				'The links in your menu. Change them here, and see them on the right. Save to keep them.'
			),
		title: () => __( 'Menu' ),
	},
	[ SOCIAL_VIEW ]: {
		description: () =>
			__(
				'Your social profiles. Change them here, and see them on the right. Save to keep them.'
			),
		title: () => __( 'Social links' ),
	},
};

const SITE_PARTS = {
	footer: {
		choice: __( 'Choose how the bottom of every page looks.' ),
		description: __(
			'Shown at the bottom of every page. Pick Edit design or Edit content on it, on the right, to change it.'
		),
		icon: footerIcon,
		linksLabel: __( 'Footer options' ),
		missing: __( 'Your homepage doesn’t have a footer.' ),
		noOptions: __(
			'Your footer has no name, logo, menu or social links, and your theme offers no other layouts for it.'
		),
		title: __( 'Footer' ),
	},
	header: {
		choice: __( 'Choose how the top of every page looks.' ),
		description: __(
			'Shown at the top of every page. Pick Edit design or Edit content on it, on the right, to change it.'
		),
		icon: headerIcon,
		linksLabel: __( 'Header options' ),
		missing: __( 'Your homepage doesn’t have a header.' ),
		noOptions: __(
			'Your header has no name, logo, menu or social links, and your theme offers no other layouts for it.'
		),
		title: __( 'Header' ),
	},
};

// The screen offering the two, and the first crumb back on each.
const SITE_PARTS_TITLE = __( 'Header & footer' );

function getSitePartsCrumb() {
	return { label: SITE_PARTS_TITLE, to: SITE_PARTS_PATH };
}

function Note( { children } ) {
	return (
		<Text className="routes-styles__muted" variant="body-md">
			{ children }
		</Text>
	);
}

function Loading() {
	return (
		<div className="cnl-editor-spinner">
			<Spinner />
		</div>
	);
}

/**
 * The menu the part shows: the one its Navigation block names, or, as the
 * block does without one, the site's first.
 *
 * @param {?number} navigationRef The menu the Navigation block shows.
 * @return {Object} `{ menuId, title }`. `menuId` is undefined when the site
 *                  has no menus.
 */
function usePartMenu( navigationRef ) {
	return useSelect(
		( select ) => {
			const id =
				navigationRef ||
				select( cnlEditorStore ).getNavigationMenus()?.[ 0 ]?.id;
			const menu = id
				? select( coreDataStore ).getEditedEntityRecord(
						'postType',
						'wp_navigation',
						id
					)
				: null;

			return { menuId: id, title: getTitleText( menu?.title ) };
		},
		[ navigationRef ]
	);
}

function getLayoutsDescription( { currentName, layouts } ) {
	const current = layouts.find( ( pattern ) => pattern.name === currentName );

	return current
		? getPatternTitle( current )
		: sprintf(
				/* translators: %d: Number of layouts. */
				_n( '%d to pick from', '%d to pick from', layouts.length ),
				layouts.length
			);
}

// Each row says what it does, adding what isn't there yet or changing it.
function getIdentityLink( { hasLogo, hasSiteTitle }, site ) {
	if ( ! hasSiteTitle ) {
		return site.site_logo
			? {
					description: __( 'Swap in a different image.' ),
					title: __( 'Change logo' ),
				}
			: {
					description: __( 'Upload one, or pick an image you have.' ),
					title: __( 'Add a logo' ),
				};
	}

	if ( ! site.title ) {
		return {
			description: __( 'Your site has no name yet.' ),
			title: hasLogo ? __( 'Add a name & logo' ) : __( 'Name your site' ),
		};
	}

	return {
		description: site.title,
		title: hasLogo ? __( 'Change name & logo' ) : __( 'Change site name' ),
	};
}

/**
 * What can be changed about the part, each a row leading to its own view:
 * its layouts, then the site's name and logo, the menu and the social links,
 * when it shows them.
 *
 * @param {Object} props
 * @param {string} props.area     `header` or `footer`.
 * @param {string} props.clientId The part's client ID in the editor.
 * @param {string} props.id       The part's template part ID.
 * @return {Element} The rows, or a note when there are none.
 */
function SitePartLinks( { area, clientId, id } ) {
	const part = SITE_PARTS[ area ];
	const contents = useSitePartContents( clientId );
	const layouts = useSitePartLayouts( area, id );
	const identity = useSiteIdentity();
	const menu = usePartMenu( contents.navigationRef );
	const social = useSocialLinks( area );

	if ( identity.isLoading ) {
		return <Loading />;
	}

	const links = [];

	// The theme's patterns can be slow to arrive, so the row shows while
	// they load and goes if the theme turns out to have none.
	if ( ! layouts.hasResolved || layouts.layouts.length ) {
		links.push( {
			description: layouts.hasResolved
				? getLayoutsDescription( layouts )
				: __( 'Finding layouts…' ),
			icon: layoutIcon,
			search: { view: LAYOUTS_VIEW },
			title: __( 'Change layout' ),
			to: SITE_PART_PATHS[ area ],
		} );
	}

	if ( contents.hasSiteTitle || contents.hasLogo ) {
		links.push( {
			...getIdentityLink( contents, identity.site ),
			icon: siteLogoIcon,
			search: { view: IDENTITY_VIEW },
			to: SITE_PART_PATHS[ area ],
		} );
	}

	if ( contents.showsMenu && menu.menuId ) {
		links.push( {
			description: menu.title || __( 'Your menu' ),
			icon: compassIcon,
			search: { view: MENU_VIEW },
			title: __( 'Edit menu' ),
			to: SITE_PART_PATHS[ area ],
		} );
	}

	if ( contents.hasSocialLinks && social.links ) {
		links.push( {
			description: getSocialLinksDescription(
				social.links,
				social.services
			),
			icon: shareIcon,
			search: { view: SOCIAL_VIEW },
			title: __( 'Social links' ),
			to: SITE_PART_PATHS[ area ],
		} );
	}

	if ( ! links.length ) {
		return <Note>{ part.noOptions }</Note>;
	}

	return <ScreenLinks label={ part.linksLabel } links={ links } />;
}

/**
 * The menu the part shows, its items edited in place. Changes wait for the
 * save, like any other.
 *
 * @param {Object} props
 * @param {string} props.clientId The part's client ID in the editor.
 * @return {Element} The menu's items.
 */
function PartMenu( { clientId } ) {
	const { navigationRef } = useSitePartContents( clientId );
	const { menuId } = usePartMenu( navigationRef );
	const { editor, isMenuReady } = useMenuItemsEditor( menuId );

	if ( ! menuId ) {
		return <Note>{ __( 'Your site doesn’t have a menu yet.' ) }</Note>;
	}

	if ( ! isMenuReady ) {
		return <Loading />;
	}

	return <div className="cnl-site-part__menu">{ editor }</div>;
}

function SocialLinkOptions( { index, isLast, onMove, onRemove, title } ) {
	return (
		<DropdownMenu
			icon={ moreVerticalIcon }
			label={ sprintf(
				/* translators: %s: Social service, like Instagram. */
				__( '%s options' ),
				title
			) }
			popoverProps={ { placement: 'bottom-end' } }
		>
			{ ( { onClose } ) => (
				<MenuGroup>
					<MenuItem
						accessibleWhenDisabled
						disabled={ index === 0 }
						icon={ chevronUpIcon }
						onClick={ () => {
							onMove( index, index - 1 );
							onClose();
						} }
					>
						{ __( 'Move up' ) }
					</MenuItem>
					<MenuItem
						accessibleWhenDisabled
						disabled={ isLast }
						icon={ chevronDownIcon }
						onClick={ () => {
							onMove( index, index + 1 );
							onClose();
						} }
					>
						{ __( 'Move down' ) }
					</MenuItem>
					<MenuItem
						icon={ trashIcon }
						onClick={ () => {
							onRemove( index );
							onClose();
						} }
					>
						{ __( 'Remove' ) }
					</MenuItem>
				</MenuGroup>
			) }
		</DropdownMenu>
	);
}

/**
 * Core's services not in the list yet, to search and pick one from.
 *
 * @param {Object}   props
 * @param {Object[]} props.services Core's Social Icon variations not used.
 * @param {Function} props.onAdd    Called with the picked service's name.
 * @return {Element} The button and its list.
 */
function AddSocialLink( { onAdd, services } ) {
	const [ search, setSearch ] = useState( '' );
	const term = search.trim().toLowerCase();
	const matches = term
		? services.filter( ( service ) =>
				service.title.toLowerCase().includes( term )
			)
		: services;

	if ( ! services.length ) {
		return null;
	}

	return (
		<Dropdown
			contentClassName="cnl-site-part__add-social"
			onClose={ () => setSearch( '' ) }
			popoverProps={ { placement: 'bottom-start' } }
			renderContent={ ( { onClose } ) => (
				<div className="cnl-site-part__add-social-content">
					<InputControl
						hideLabelFromVision
						label={ __( 'Search services' ) }
						onValueChange={ setSearch }
						placeholder={ __( 'Search' ) }
						value={ search }
					/>
					<MenuGroup className="cnl-site-part__add-social-list">
						{ matches.map( ( service ) => (
							<MenuItem
								icon={ <BlockIcon icon={ service.icon } /> }
								iconPosition="left"
								key={ service.name }
								onClick={ () => {
									onAdd( service.name );
									onClose();
								} }
							>
								{ service.title }
							</MenuItem>
						) ) }
					</MenuGroup>
					{ ! matches.length && (
						<Note>{ __( 'No services match.' ) }</Note>
					) }
				</div>
			) }
			renderToggle={ ( { isOpen, onToggle } ) => (
				<Button
					__next40pxDefaultSize
					aria-expanded={ isOpen }
					icon={ plusIcon }
					onClick={ onToggle }
					variant="secondary"
				>
					{ __( 'Add social link' ) }
				</Button>
			) }
		/>
	);
}

// Keyed by service, so a row keeps its field as links move around it. A
// service listed twice is told apart by which time it is.
function getLinkKey( links, index ) {
	const { service } = links[ index ];
	const seen = links
		.slice( 0, index )
		.filter( ( link ) => link.service === service ).length;

	return `${ service }-${ seen }`;
}

/**
 * The site's social links, a row for each, with its address to fill in.
 * Changes show on the canvas as they are made and wait for the save.
 *
 * @param {Object} props
 * @param {string} props.area `header` or `footer`.
 * @return {Element} The links.
 */
function SocialLinks( { area } ) {
	const { links, services, setLinks, setUrl } = useSocialLinks( area );
	// The service just added, whose address is focused once it shows.
	const [ added, setAdded ] = useState( null );
	const focusAdded = useCallback( ( node ) => {
		if ( node ) {
			node.focus();
			setAdded( null );
		}
	}, [] );

	if ( ! links ) {
		return (
			<Note>{ __( 'Your site doesn’t show social links here.' ) }</Note>
		);
	}

	const move = ( from, to ) => {
		const next = [ ...links ];
		next.splice( to, 0, ...next.splice( from, 1 ) );
		setLinks( next );
	};
	const remove = ( index ) =>
		setLinks( links.filter( ( link, i ) => i !== index ) );
	const add = ( name ) => {
		setLinks( [ ...links, { service: name, url: '' } ] );
		setAdded( name );
	};

	return (
		<div className="routes-styles__section cnl-site-part__social">
			{ ! links.length && <Note>{ __( 'No social links yet.' ) }</Note> }
			{ links.length > 0 && (
				<ul
					aria-label={ __( 'Social links' ) }
					className="cnl-site-part__social-links"
				>
					{ links.map( ( link, index ) => {
						const service = getService( services, link.service );

						return (
							<li
								className="cnl-site-part__social-link"
								key={ getLinkKey( links, index ) }
							>
								<InputControl
									label={ service.title }
									onValueChange={ ( url ) =>
										setUrl( index, url )
									}
									placeholder={ __( 'Add your address' ) }
									prefix={
										service.icon && (
											<InputLayout.Slot padding="minimal">
												<BlockIcon
													icon={ service.icon }
												/>
											</InputLayout.Slot>
										)
									}
									ref={
										link.service === added
											? focusAdded
											: undefined
									}
									type="url"
									value={
										isPlaceholderUrl( link.url )
											? ''
											: link.url
									}
								/>
								<SocialLinkOptions
									index={ index }
									isLast={ index === links.length - 1 }
									onMove={ move }
									onRemove={ remove }
									title={ service.title }
								/>
							</li>
						);
					} ) }
				</ul>
			) }
			<AddSocialLink
				onAdd={ add }
				services={ getAddableServices( services, links ) }
			/>
		</div>
	);
}

/**
 * The theme's layouts for the part, from the picker the chat shares. The
 * site's social links go into any layout that has a place for them. They are
 * remembered while the layouts are open, so passing through one without
 * social links doesn't lose them.
 *
 * @param {Object} props
 * @param {string} props.area `header` or `footer`.
 * @param {string} props.id   The part's template part ID.
 * @return {Element} The layouts.
 */
function Layouts( { area, id } ) {
	const { links: socialLinks } = useSocialLinks( area );
	const socialLinksRef = useRef();
	if ( socialLinks?.length ) {
		socialLinksRef.current = socialLinks;
	}

	return (
		<SitePartLayouts
			area={ area }
			id={ id }
			prepareBlocks={ ( blocks ) =>
				socialLinksRef.current
					? withSocialLinks( blocks, socialLinksRef.current )
					: blocks
			}
			Preview={ LazyEditorPreview }
		/>
	);
}

function SitePartView( { area, clientId, id, view } ) {
	if ( view === LAYOUTS_VIEW ) {
		return <Layouts area={ area } id={ id } />;
	}

	if ( view === IDENTITY_VIEW ) {
		return <SiteIdentityFields />;
	}

	if ( view === MENU_VIEW ) {
		return <PartMenu clientId={ clientId } />;
	}

	if ( view === SOCIAL_VIEW ) {
		return <SocialLinks area={ area } />;
	}

	return <SitePartLinks area={ area } clientId={ clientId } id={ id } />;
}

function createStage( area ) {
	const part = SITE_PARTS[ area ];

	return function SitePartStage() {
		const { view: viewName } = useSearch( { strict: false } );
		const { clientId, id, isEditorReady } = useSitePart( area );
		const view = Object.hasOwn( VIEWS, viewName )
			? VIEWS[ viewName ]
			: null;

		return (
			<div className="cnl-editor-stage routes-styles cnl-site-part">
				<Stack direction="column" gap="xs">
					<Breadcrumbs
						items={
							view
								? [
										getSiteCrumb(),
										getSitePartsCrumb(),
										{
											label: part.title,
											to: SITE_PART_PATHS[ area ],
										},
										{ label: view.title() },
									]
								: [
										getSiteCrumb(),
										getSitePartsCrumb(),
										{ label: part.title },
									]
						}
					/>
					<Note>
						{ view ? view.description() : part.description }
					</Note>
				</Stack>
				{ ! isEditorReady && <Loading /> }
				{ isEditorReady && ! id && <Note>{ part.missing }</Note> }
				{ id && (
					<SitePartView
						area={ area }
						clientId={ clientId }
						id={ id }
						view={ view && viewName }
					/>
				) }
			</div>
		);
	};
}

/*
 * The screen "Your site" opens for the header and footer: a row for each,
 * leading on to its own screen.
 */
function SitePartsStage() {
	const links = [ 'header', 'footer' ].map( ( area ) => ( {
		description: SITE_PARTS[ area ].choice,
		icon: SITE_PARTS[ area ].icon,
		title: SITE_PARTS[ area ].title,
		to: SITE_PART_PATHS[ area ],
	} ) );

	return (
		<div className="cnl-editor-stage routes-styles cnl-site-part">
			<Stack direction="column" gap="xs">
				<Breadcrumbs
					items={ [ getSiteCrumb(), { label: SITE_PARTS_TITLE } ] }
				/>
				<Note>
					{ __(
						'Every page shares the same header and footer. Pick one to change it.'
					) }
				</Note>
			</Stack>
			<ScreenLinks label={ SITE_PARTS_TITLE } links={ links } />
		</div>
	);
}

function PartDocument( { icon, title } ) {
	return (
		<div className="cnl-editor-homepage-document is-global">
			<div className="cnl-editor-homepage-document__text">
				<div className="cnl-editor-homepage-document__heading">
					<Icon
						className="cnl-editor-homepage-document__icon"
						icon={ icon }
					/>
					<h1 className="cnl-editor-homepage-document__title">
						{ title }
					</h1>
				</div>
				<p className="cnl-editor-homepage-document__meta">
					{ __( 'Same on every page' ) }
				</p>
			</div>
		</div>
	);
}

function createCanvas( area ) {
	return function SitePartCanvas() {
		const { view } = useSearch( { strict: false } );
		const canvas = useSiteCanvas( { url: settings.homeUrl } );
		const editorRef = useRef();
		const { clientId, id } = useSitePart( area );
		const canvasDocument = useCanvasDocument(
			editorRef,
			canvas.editorEntity?.postId
		);

		useSitePartSpotlight( {
			area,
			canvasDocument,
			clientId,
			focus: view,
			frame: canvas.frame,
			isPreviewing: canvas.isPreviewing,
		} );

		// The full editor opens the part itself.
		const editRoute = id
			? { search: { postId: id }, to: '/wp_template_part' }
			: null;

		return (
			<SiteCanvas
				// The screen is about one part, not the page's sections.
				canCompose={ false }
				canvas={ { ...canvas, editRoute } }
				className={ `cnl-site-part-canvas is-${ area }` }
				document={
					<PartDocument
						icon={ SITE_PARTS[ area ].icon }
						title={ SITE_PARTS[ area ].title }
					/>
				}
				editorRef={ editorRef }
				// The part is all Edit offers, the rest of the page dimmed.
				focusId={ clientId }
			/>
		);
	};
}

/*
 * The homepage, with its header and footer, before either is picked. Edit
 * offers both, and the page's sections, as on any page.
 */
function SitePartsCanvas() {
	const canvas = useSiteCanvas( { url: settings.homeUrl } );

	return (
		<SiteCanvas
			canCompose={ false }
			canvas={ canvas }
			className="cnl-site-part-canvas"
			document={
				<PartDocument
					icon={ sitePartsIcon }
					title={ SITE_PARTS_TITLE }
				/>
			}
		/>
	);
}

/**
 * Everything on the screen edits a part every page shares, so all of it is
 * in purple. See `src/global-scope`.
 *
 * @param {Function} Component The stage or canvas.
 * @return {Function} The component, in purple.
 */
function withGlobalScope( Component ) {
	return function GlobalSitePart( props ) {
		return (
			<GlobalScope>
				<Component { ...props } />
			</GlobalScope>
		);
	};
}

export const sitePartsStage = withUiTheme( withGlobalScope( SitePartsStage ) );
export const sitePartsCanvas = withCanvasRecovery(
	withUiTheme( withGlobalScope( SitePartsCanvas ) )
);
export const headerStage = withUiTheme(
	withGlobalScope( createStage( 'header' ) )
);
export const headerCanvas = withCanvasRecovery(
	withUiTheme( withGlobalScope( createCanvas( 'header' ) ) )
);
export const footerStage = withUiTheme(
	withGlobalScope( createStage( 'footer' ) )
);
export const footerCanvas = withCanvasRecovery(
	withUiTheme( withGlobalScope( createCanvas( 'footer' ) ) )
);
