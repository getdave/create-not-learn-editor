/**
 * The Header and Footer screens, reached from the "Your site" checklist.
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
import { useForcedBlockEditorSettings } from '../../editor-layer/settings-guard';
import { cnlEditorStore, getTitleText } from '../../records';
import ScreenLinks from '../../screen-links';
import { settings } from '../../settings';
import { getSiteCrumb } from '../../site-trail';
import {
	SiteCanvas,
	useCanvasDocument,
	useSiteCanvas,
} from '../../site-canvas';
import { LOCKED_PART_CONTENT_SETTING } from '../../site-canvas/constants';
import { withUiTheme } from '../../theme';
import { getPatternTitle } from '../content/page-layouts';
import { useMenuItemsEditor } from '../navigation-edit/menu-items-editor';
import { SiteIdentityFields, useSiteIdentity } from '../../pickers/identity';
import { SitePartLayouts } from '../../pickers/site-part-layouts';
import {
	SITE_PART_PATHS,
	useSitePart,
	useSitePartContents,
	useSitePartLayouts,
} from './data';
import { useSitePartSpotlight } from './spotlight';
import {
	Breadcrumbs,
	Icon,
	Spinner,
	Stack,
	Text,
	__,
	_n,
	compassIcon,
	coreDataStore,
	footerIcon,
	headerIcon,
	layoutIcon,
	siteLogoIcon,
	sprintf,
	useRef,
	useSelect,
} from '../../wordpress-packages';

const LOCKED_PART_SETTINGS = { [ LOCKED_PART_CONTENT_SETTING ]: true };

// The search params that open a part's views, over the same canvas.
const LAYOUTS_VIEW = 'layouts';
const IDENTITY_VIEW = 'identity';
const MENU_VIEW = 'menu';

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
};

const SITE_PARTS = {
	footer: {
		description: __(
			'Shown at the bottom of every page. Click its text on the right to change it.'
		),
		icon: footerIcon,
		linksLabel: __( 'Footer options' ),
		missing: __( 'Your homepage doesn’t have a footer.' ),
		noOptions: __(
			'Your footer has no name, logo or menu, and your theme offers no other layouts for it.'
		),
		title: __( 'Footer' ),
	},
	header: {
		description: __(
			'Shown at the top of every page. Click its text on the right to change it.'
		),
		icon: headerIcon,
		linksLabel: __( 'Header options' ),
		missing: __( 'Your homepage doesn’t have a header.' ),
		noOptions: __(
			'Your header has no name, logo or menu, and your theme offers no other layouts for it.'
		),
		title: __( 'Header' ),
	},
};

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
 * its layouts, then the site's name and logo and the menu, when it shows
 * them.
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

function SitePartView( { area, clientId, id, view } ) {
	if ( view === LAYOUTS_VIEW ) {
		return (
			<SitePartLayouts
				area={ area }
				id={ id }
				Preview={ LazyEditorPreview }
			/>
		);
	}

	if ( view === IDENTITY_VIEW ) {
		return <SiteIdentityFields />;
	}

	if ( view === MENU_VIEW ) {
		return <PartMenu clientId={ clientId } />;
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
			<div className="cnl-editor-stage cnl-drilldown-stage routes-styles cnl-site-part">
				<Stack direction="column" gap="xs">
					<Breadcrumbs
						items={
							view
								? [
										getSiteCrumb(),
										{
											label: part.title,
											to: SITE_PART_PATHS[ area ],
										},
										{ label: view.title() },
									]
								: [ getSiteCrumb(), { label: part.title } ]
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

function PartDocument( { area } ) {
	const part = SITE_PARTS[ area ];

	return (
		<div className="cnl-editor-homepage-document">
			<div className="cnl-editor-homepage-document__text">
				<div className="cnl-editor-homepage-document__heading">
					<Icon
						className="cnl-editor-homepage-document__icon"
						icon={ part.icon }
					/>
					<h1 className="cnl-editor-homepage-document__title">
						{ part.title }
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

		// The part's blocks open for their words and images only.
		useForcedBlockEditorSettings(
			canvas.editorEntity ? LOCKED_PART_SETTINGS : null
		);

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
				document={ <PartDocument area={ area } /> }
				editorRef={ editorRef }
			/>
		);
	};
}

export const headerStage = withUiTheme( createStage( 'header' ) );
export const headerCanvas = withUiTheme( createCanvas( 'header' ) );
export const footerStage = withUiTheme( createStage( 'footer' ) );
export const footerCanvas = withUiTheme( createCanvas( 'footer' ) );
