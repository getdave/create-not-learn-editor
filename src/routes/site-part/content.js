/**
 * The Header and Footer screens, reached from the "Your site" checklist.
 *
 * Like a page on the Pages screen: the stage holds what can be changed about
 * the part as a whole, and the canvas shows the homepage with the part in the
 * spotlight, editable in place.
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
import { getFromSitePartSearch, getSiteCrumb } from '../../site-trail';
import {
	SiteCanvas,
	useCanvasDocument,
	useSiteCanvas,
} from '../../site-canvas';
import { LOCKED_PART_CONTENT_SETTING } from '../../site-canvas/constants';
import { withUiTheme } from '../../theme';
import { getPatternContent, getPatternTitle } from '../content/page-layouts';
import useMainMenu from '../content/use-main-menu';
import { useSiteIdentity } from '../static/identity';
import {
	SITE_PART_PATHS,
	putLayoutFirst,
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
	checkIcon,
	compassIcon,
	coreDataStore,
	el,
	footerIcon,
	headerIcon,
	layoutIcon,
	parseBlocks,
	serialize,
	siteLogoIcon,
	sprintf,
	useDispatch,
	useMemo,
	useRef,
	useSelect,
} from '../../wordpress-packages';

const LOCKED_PART_SETTINGS = { [ LOCKED_PART_CONTENT_SETTING ]: true };
const PAGES_PATH = '/types/page/list/default';
const IDENTITY_PATH = '/design/identity';

// The search param that opens a part's layouts, over the same canvas.
const LAYOUTS_VIEW = 'layouts';

const SITE_PARTS = {
	footer: {
		description: __(
			'Shown at the bottom of every page. Click its text on the right to change it.'
		),
		icon: footerIcon,
		linksLabel: __( 'Footer options' ),
		missing: __( 'Your homepage doesn’t have a footer.' ),
		noLayouts: __( 'Your theme doesn’t offer any layouts for its footer.' ),
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
		noLayouts: __( 'Your theme doesn’t offer any layouts for its header.' ),
		noOptions: __(
			'Your header has no name, logo or menu, and your theme offers no other layouts for it.'
		),
		title: __( 'Header' ),
	},
};

function Note( { children } ) {
	return el(
		Text,
		{ className: 'routes-styles__muted', variant: 'body-md' },
		children
	);
}

function Loading() {
	return el( 'div', { className: 'cnl-editor-spinner' }, el( Spinner ) );
}

/**
 * The menu the part shows, and where to change it. The site's main menu is
 * managed with its pages, on Pages & menu; any other on its own.
 *
 * @param {?number} navigationRef The menu the Navigation block shows.
 * @return {Object} `{ title, to }`.
 */
function usePartMenu( navigationRef ) {
	const { menuId: mainMenuId } = useMainMenu();
	const { menuId, title } = useSelect(
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

	return {
		title,
		to:
			! menuId || menuId === mainMenuId
				? PAGES_PATH
				: `/navigation/edit/${ encodeURIComponent( menuId ) }`,
	};
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
 * What can be changed about the part, each a row leading to its own screen:
 * its layouts, then the site's name and logo and the menu, when it shows
 * them. Those screens lead back here in their breadcrumbs.
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
		return el( Loading );
	}

	const from = getFromSitePartSearch( area );
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
			search: from,
			to: IDENTITY_PATH,
		} );
	}

	if ( contents.showsMenu ) {
		links.push( {
			description: menu.title || __( 'Your menu' ),
			icon: compassIcon,
			search: from,
			title: __( 'Edit menu' ),
			to: menu.to,
		} );
	}

	if ( ! links.length ) {
		return el( Note, null, part.noOptions );
	}

	return el( ScreenLinks, { label: part.linksLabel, links } );
}

function LayoutCard( { isCurrent, onSelect, pattern } ) {
	const title = getPatternTitle( pattern );

	return el(
		'li',
		null,
		el(
			'button',
			{
				'aria-pressed': isCurrent,
				className: `cnl-site-part__layout${
					isCurrent ? ' is-current' : ''
				}`,
				onClick: () => ! isCurrent && onSelect( pattern ),
				type: 'button',
			},
			el(
				'span',
				{
					'aria-hidden': true,
					className: 'cnl-site-part__layout-preview',
				},
				el( LazyEditorPreview, {
					content: getPatternContent( pattern ),
					description: title,
				} )
			),
			el(
				'span',
				{ className: 'cnl-site-part__layout-footer' },
				el(
					'span',
					{ className: 'cnl-site-part__layout-title' },
					title
				),
				isCurrent &&
					el(
						'span',
						{ className: 'cnl-site-part__layout-current' },
						el( Icon, { icon: checkIcon, size: 16 } ),
						__( 'Current' )
					)
			)
		)
	);
}

/**
 * The theme's layouts for the part. Picking one swaps the part's blocks for
 * it as an unsaved change, saved with everything else.
 *
 * @param {Object} props
 * @param {string} props.area `header` or `footer`.
 * @param {string} props.id   The part's template part ID.
 * @return {Element} The layouts, or a note when the theme has none.
 */
function Layouts( { area, id } ) {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const { content, currentName, hasResolved, layouts } = useSitePartLayouts(
		area,
		id
	);
	/*
	 * The layout in use when the screen opens leads the list. Picking another
	 * leaves the order alone, so the list doesn't jump under the pointer.
	 */
	const leadRef = useRef();
	if ( leadRef.current === undefined && layouts.length && content ) {
		leadRef.current = currentName;
	}
	const lead = leadRef.current;
	const orderedLayouts = useMemo(
		() => putLayoutFirst( layouts, lead ),
		[ layouts, lead ]
	);

	if ( ! hasResolved ) {
		return el( Loading );
	}

	if ( ! layouts.length ) {
		return el( Note, null, SITE_PARTS[ area ].noLayouts );
	}

	const select = ( pattern ) =>
		editEntityRecord( 'postType', 'wp_template_part', id, {
			blocks: parseBlocks( getPatternContent( pattern ) ),
			// A new function on every edit, as the editor does, so each
			// change makes the part dirty and gets its own undo level.
			content: ( { blocks = [] } ) => serialize( blocks ),
		} );

	return el(
		'ul',
		{ 'aria-label': __( 'Layouts' ), className: 'cnl-site-part__layouts' },
		orderedLayouts.map( ( pattern ) =>
			el( LayoutCard, {
				isCurrent: pattern.name === currentName,
				key: pattern.name,
				onSelect: select,
				pattern,
			} )
		)
	);
}

function createStage( area ) {
	const part = SITE_PARTS[ area ];

	return function SitePartStage() {
		const { view } = useSearch( { strict: false } );
		const { clientId, id, isEditorReady } = useSitePart( area );
		const isLayouts = view === LAYOUTS_VIEW;

		return el(
			'div',
			{
				className:
					'cnl-editor-stage cnl-drilldown-stage routes-styles cnl-site-part',
			},
			el(
				Stack,
				{ direction: 'column', gap: 'xs' },
				el( Breadcrumbs, {
					items: isLayouts
						? [
								getSiteCrumb(),
								{
									label: part.title,
									to: SITE_PART_PATHS[ area ],
								},
								{ label: __( 'Layouts' ) },
							]
						: [ getSiteCrumb(), { label: part.title } ],
				} ),
				el(
					Note,
					null,
					isLayouts
						? __(
								'Pick one to try it on the right. Save to keep it.'
							)
						: part.description
				)
			),
			! isEditorReady && el( Loading ),
			isEditorReady && ! id && el( Note, null, part.missing ),
			id &&
				( isLayouts
					? el( Layouts, { area, id } )
					: el( SitePartLinks, { area, clientId, id } ) )
		);
	};
}

function PartDocument( { area } ) {
	const part = SITE_PARTS[ area ];

	return el(
		'div',
		{ className: 'cnl-editor-homepage-document' },
		el(
			'div',
			{ className: 'cnl-editor-homepage-document__text' },
			el(
				'div',
				{ className: 'cnl-editor-homepage-document__heading' },
				el( Icon, {
					className: 'cnl-editor-homepage-document__icon',
					icon: part.icon,
				} ),
				el(
					'h1',
					{ className: 'cnl-editor-homepage-document__title' },
					part.title
				)
			),
			el(
				'p',
				{ className: 'cnl-editor-homepage-document__meta' },
				__( 'Same on every page' )
			)
		)
	);
}

function createCanvas( area ) {
	return function SitePartCanvas() {
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

		return el( SiteCanvas, {
			// The screen is about one part, not the page's sections.
			canCompose: false,
			canvas: { ...canvas, editRoute },
			className: `cnl-site-part-canvas is-${ area }`,
			document: el( PartDocument, { area } ),
			editorRef,
		} );
	};
}

export const headerStage = withUiTheme( createStage( 'header' ) );
export const headerCanvas = withUiTheme( createCanvas( 'header' ) );
export const footerStage = withUiTheme( createStage( 'footer' ) );
export const footerCanvas = withUiTheme( createCanvas( 'footer' ) );
