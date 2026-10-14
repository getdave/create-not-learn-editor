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
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { useForcedBlockEditorSettings } from '../../editor-layer/settings-guard';
import { cnlEditorStore, getTitleText } from '../../records';
import { settings } from '../../settings';
import { getSiteCrumb } from '../../site-trail';
import {
	SiteCanvas,
	useCanvasDocument,
	useSiteCanvas,
} from '../../site-canvas';
import { LOCKED_PART_CONTENT_SETTING } from '../../site-canvas/constants';
import { withUiTheme } from '../../theme';
import { getPatternContent, getPatternTitle } from '../content/page-layouts';
import useMainMenu from '../content/use-main-menu';
import { SiteMediaSetting, useSiteIdentity } from '../static/identity';
import {
	getCurrentPatternName,
	getSitePartContent,
	getSitePartPatterns,
	putLayoutFirst,
	useSitePart,
	useSitePartContents,
} from './data';
import { useSitePartSpotlight } from './spotlight';
import {
	Breadcrumbs,
	Button,
	Icon,
	InputControl,
	Spinner,
	Stack,
	Text,
	__,
	checkIcon,
	coreDataStore,
	el,
	footerIcon,
	headerIcon,
	parseBlocks,
	serialize,
	useDispatch,
	useMemo,
	useRef,
	useSelect,
} from '../../wordpress-packages';

const EMPTY_ARRAY = [];

const LOCKED_PART_SETTINGS = { [ LOCKED_PART_CONTENT_SETTING ]: true };
const PAGES_PATH = '/types/page/list/default';

const SITE_PARTS = {
	footer: {
		description: __(
			'Shown at the bottom of every page. Click its text on the right to change it.'
		),
		icon: footerIcon,
		missing: __( 'Your homepage doesn’t have a footer.' ),
		title: __( 'Footer' ),
	},
	header: {
		description: __(
			'Shown at the top of every page. Click its text on the right to change it.'
		),
		icon: headerIcon,
		missing: __( 'Your homepage doesn’t have a header.' ),
		title: __( 'Header' ),
	},
};

function Section( { children, title } ) {
	return el(
		'section',
		{ className: 'routes-styles__section' },
		el( Text, { render: el( 'h2' ), variant: 'heading-sm' }, title ),
		children
	);
}

function NameAndLogo( { hasLogo, hasSiteTitle } ) {
	const { isLoading, site, update } = useSiteIdentity();

	if ( isLoading ) {
		return el( 'div', { className: 'cnl-editor-spinner' }, el( Spinner ) );
	}

	return el(
		Section,
		{ title: hasSiteTitle ? __( 'Name & logo' ) : __( 'Logo' ) },
		hasSiteTitle &&
			el( InputControl, {
				label: __( 'Site name' ),
				onValueChange: ( value ) => update( { title: value } ),
				value: site.title || '',
			} ),
		hasLogo &&
			el( SiteMediaSetting, {
				description: __( 'Wide or square images both work.' ),
				label: __( 'Logo' ),
				onChange: ( id ) => update( { site_logo: id } ),
				value: site.site_logo || 0,
			} )
	);
}

/**
 * Which menu the part shows, and a way through to change it. The site's main
 * menu is managed with its pages, on Pages & menu; any other on its own.
 *
 * @param {Object}  props
 * @param {?number} props.navigationRef The menu the Navigation block shows.
 * @return {Element} The menu row.
 */
function MenuSummary( { navigationRef } ) {
	const navigate = useNavigate();
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
	const to =
		! menuId || menuId === mainMenuId
			? PAGES_PATH
			: `/navigation/edit/${ encodeURIComponent( menuId ) }`;

	return el(
		Section,
		{ title: __( 'Menu' ) },
		el(
			Stack,
			{ align: 'center', gap: 'md', justify: 'space-between' },
			el(
				Text,
				{ className: 'cnl-site-part__menu-name', variant: 'body-md' },
				title || __( 'Your menu' )
			),
			el(
				Button,
				{ onClick: () => navigate( { to } ), variant: 'link' },
				__( 'Edit menu' )
			)
		)
	);
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
 * @return {?Element} The layouts, or nothing when the theme has none.
 */
function Layouts( { area, id } ) {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const { content, patterns } = useSelect(
		( select ) => {
			const store = select( coreDataStore );

			return {
				content: getSitePartContent(
					store.getEditedEntityRecord(
						'postType',
						'wp_template_part',
						id
					)
				),
				patterns: store.getBlockPatterns?.() || EMPTY_ARRAY,
			};
		},
		[ id ]
	);
	const layouts = useMemo(
		() => getSitePartPatterns( patterns, area ),
		[ area, patterns ]
	);
	const currentName = useMemo(
		() => getCurrentPatternName( content, layouts ),
		[ content, layouts ]
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

	if ( ! layouts.length ) {
		return null;
	}

	const select = ( pattern ) =>
		editEntityRecord( 'postType', 'wp_template_part', id, {
			blocks: parseBlocks( getPatternContent( pattern ) ),
			// A new function on every edit, as the editor does, so each
			// change makes the part dirty and gets its own undo level.
			content: ( { blocks = [] } ) => serialize( blocks ),
		} );

	return el(
		Section,
		{ title: __( 'Layouts' ) },
		el(
			'ul',
			{ className: 'cnl-site-part__layouts' },
			orderedLayouts.map( ( pattern ) =>
				el( LayoutCard, {
					isCurrent: pattern.name === currentName,
					key: pattern.name,
					onSelect: select,
					pattern,
				} )
			)
		)
	);
}

function createStage( area ) {
	const part = SITE_PARTS[ area ];

	return function SitePartStage() {
		const { clientId, id, isEditorReady } = useSitePart( area );
		const contents = useSitePartContents( clientId );

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
					items: [ getSiteCrumb(), { label: part.title } ],
				} ),
				el(
					Text,
					{ className: 'routes-styles__muted', variant: 'body-md' },
					part.description
				)
			),
			! isEditorReady &&
				el( 'div', { className: 'cnl-editor-spinner' }, el( Spinner ) ),
			isEditorReady &&
				! id &&
				el(
					Text,
					{ className: 'routes-styles__muted', variant: 'body-md' },
					part.missing
				),
			id &&
				( contents.hasSiteTitle || contents.hasLogo ) &&
				el( NameAndLogo, contents ),
			id &&
				contents.showsMenu &&
				el( MenuSummary, { navigationRef: contents.navigationRef } ),
			id && el( Layouts, { area, id } )
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
