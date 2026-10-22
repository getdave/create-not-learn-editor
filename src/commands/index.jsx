/**
 * Commands: what the command palette, behind the top bar's search, finds.
 *
 * Core's palette comes with commands for every wp-admin menu item and every
 * Site Editor screen, which all lead out of this editor. So core's palette is
 * left out, and this mounts the palette with the editor's own screens and the
 * site's pages instead. Commands the editor registers once it loads, like
 * those for blocks, still show; ones that only make sense in wp-admin are
 * taken back out.
 *
 * Imported package by package rather than through `src/wordpress-packages`, as
 * it is mounted from app init.
 */

/**
 * WordPress dependencies
 */
import {
	CommandMenu,
	store as commandsStore,
	useCommandLoader,
	useCommands,
} from '@wordpress/commands';
import { store as coreDataStore } from '@wordpress/core-data';
import { dispatch, select, subscribe, useSelect } from '@wordpress/data';
import { createRoot, useEffect, useMemo, useState } from '@wordpress/element';
import { decodeEntities } from '@wordpress/html-entities';
import { __ } from '@wordpress/i18n';
import {
	brush as brushIcon,
	color as colorIcon,
	external as externalIcon,
	footer as footerIcon,
	header as headerIcon,
	home as homeIcon,
	layout as layoutIcon,
	navigation as navigationIcon,
	page as pageIcon,
	pages as pagesIcon,
	post as postIcon,
	siteLogo as siteLogoIcon,
	symbol as symbolIcon,
	symbolFilled as symbolFilledIcon,
	tableOfContents as tableOfContentsIcon,
	typography as typographyIcon,
} from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { openRoute } from '../open-route';
import { HOMEPAGE } from '../routes/content/pages/homepage-state';
import { getPostTypes, settings } from '../settings';
import { MODE_EDIT, setCanvasMode } from '../site-canvas/mode';
import sitePartsIcon from '../site-parts-icon';

const PAGES_PATH = '/types/page/list/all';

// Commands registered by others that lead into wp-admin or don't belong here.
const HIDDEN_COMMANDS = [
	// Gutenberg's demo post, added to every block editor.
	'gutenberg/insert-demo-content',
];

const EMPTY_ARRAY = [];

/**
 * Open a page on the Pages screen, in Edit, as the homepage is from "Your
 * site".
 *
 * @param {number|string} pageId Page ID, or `HOMEPAGE`.
 */
function openPage( pageId ) {
	setCanvasMode( MODE_EDIT );
	openRoute( PAGES_PATH, { postId: pageId, previewId: pageId } );
}

/**
 * The editor's screens, each under the name it has in the sidebar or on its
 * own heading, with the words someone might search for it by.
 *
 * The palette lists matches in the order they were registered rather than by
 * how well they match, so the places "Your site" offers come first, in its
 * order, ahead of the screens under Design and Advanced.
 *
 * @return {Object[]} Commands.
 */
function getScreenCommands() {
	const contentTypes = getPostTypes()
		.filter( ( type ) => type.name !== 'page' )
		.map( ( type ) => ( {
			name: `create-not-learn-editor/screen-${ type.name }`,
			label: type.menuName || type.label,
			icon: postIcon,
			to: `/types/${ type.name }`,
			keywords:
				type.name === 'post'
					? [ __( 'blog' ), __( 'articles' ), __( 'news' ) ]
					: [],
		} ) );

	return [
		{
			name: 'create-not-learn-editor/screen-site',
			label: __( 'Your site' ),
			icon: homeIcon,
			to: '/',
			keywords: [ __( 'start' ), __( 'dashboard' ), __( 'my site' ) ],
		},
		{
			name: 'create-not-learn-editor/screen-homepage',
			label: __( 'Your homepage' ),
			icon: homeIcon,
			callback: () => openPage( HOMEPAGE ),
			keywords: [
				__( 'homepage' ),
				__( 'home page' ),
				__( 'front page' ),
				__( 'landing page' ),
			],
		},
		{
			name: 'create-not-learn-editor/screen-pages',
			label: __( 'Pages & menu' ),
			icon: pagesIcon,
			to: '/types/page/list/default',
			keywords: [
				__( 'pages' ),
				__( 'menu' ),
				__( 'navigation' ),
				__( 'links' ),
			],
		},
		{
			name: 'create-not-learn-editor/screen-identity',
			label: __( 'Name & logo' ),
			icon: siteLogoIcon,
			to: '/design/identity',
			keywords: [
				__( 'logo' ),
				__( 'site name' ),
				__( 'site title' ),
				__( 'tagline' ),
				__( 'site icon' ),
				__( 'favicon' ),
				__( 'brand' ),
			],
		},
		{
			name: 'create-not-learn-editor/screen-design',
			label: __( 'Design' ),
			icon: brushIcon,
			to: '/design',
			// Not colors or fonts: they have screens of their own, which
			// should come first for them.
			keywords: [ __( 'style' ), __( 'look' ), __( 'theme' ) ],
		},
		{
			name: 'create-not-learn-editor/screen-site-parts',
			label: __( 'Header & footer' ),
			icon: sitePartsIcon,
			to: '/design/header-footer',
			keywords: [ __( 'top' ), __( 'bottom' ) ],
		},
		{
			name: 'create-not-learn-editor/screen-colors',
			label: __( 'Colors' ),
			icon: colorIcon,
			to: '/design/colors',
			keywords: [ __( 'colours' ), __( 'palette' ) ],
		},
		{
			name: 'create-not-learn-editor/screen-fonts',
			label: __( 'Fonts' ),
			icon: typographyIcon,
			to: '/design/fonts',
			keywords: [ __( 'typography' ), __( 'text' ), __( 'typeface' ) ],
		},
		{
			name: 'create-not-learn-editor/screen-header',
			label: __( 'Header' ),
			icon: headerIcon,
			to: '/design/header',
			keywords: [ __( 'top' ), __( 'banner' ) ],
		},
		{
			name: 'create-not-learn-editor/screen-footer',
			label: __( 'Footer' ),
			icon: footerIcon,
			to: '/design/footer',
			keywords: [ __( 'bottom' ) ],
		},
		{
			name: 'create-not-learn-editor/screen-site-overview',
			label: __( 'Site overview' ),
			icon: tableOfContentsIcon,
			to: '/site-overview',
			keywords: [ __( 'sitemap' ), __( 'structure' ), __( 'map' ) ],
		},
		...contentTypes,
		{
			name: 'create-not-learn-editor/screen-menus',
			label: __( 'Menus' ),
			icon: navigationIcon,
			to: '/navigation',
			keywords: [ __( 'menu' ), __( 'navigation' ), __( 'links' ) ],
		},
		{
			name: 'create-not-learn-editor/screen-sections',
			label: __( 'Sections' ),
			icon: symbolIcon,
			to: '/patterns',
			keywords: [ __( 'patterns' ), __( 'blocks' ) ],
		},
		{
			name: 'create-not-learn-editor/screen-site-part-list',
			label: __( 'Site parts' ),
			icon: symbolFilledIcon,
			to: '/template-parts',
			keywords: [ __( 'template parts' ), __( 'headers' ) ],
		},
		{
			name: 'create-not-learn-editor/screen-layouts',
			label: __( 'Layouts' ),
			icon: layoutIcon,
			to: '/templates',
			keywords: [ __( 'templates' ) ],
		},
	];
}

function useScreenCommands() {
	const commands = useMemo(
		() =>
			getScreenCommands().map( ( { callback, to, ...command } ) => ( {
				...command,
				category: 'view',
				callback: ( { close } ) => {
					close();

					if ( callback ) {
						callback();
					} else {
						openRoute( to );
					}
				},
			} ) ),
		[]
	);

	useCommands( commands );
}

function useViewSiteCommand() {
	const commands = useMemo(
		() =>
			settings.homeUrl
				? [
						{
							name: 'create-not-learn-editor/view-site',
							label: __( 'View site' ),
							icon: externalIcon,
							category: 'view',
							keywords: [ __( 'live site' ), __( 'visit' ) ],
							callback: ( { close } ) => {
								close();
								window.open( settings.homeUrl, '_blank' );
							},
						},
					]
				: EMPTY_ARRAY,
		[]
	);

	useCommands( commands );
}

/**
 * What's typed, once it has stopped changing for a moment, so typing in the
 * palette asks for pages once rather than on every key.
 *
 * @param {string} value What's typed.
 * @param {number} delay Milliseconds to wait.
 * @return {string} What's typed, once settled.
 */
function useSettledValue( value, delay ) {
	const [ settled, setSettled ] = useState( value );

	useEffect( () => {
		const timeout = window.setTimeout( () => setSettled( value ), delay );

		return () => window.clearTimeout( timeout );
	}, [ value, delay ] );

	return settled;
}

/**
 * The site's pages whose titles match what's typed, each opening on the Pages
 * screen.
 *
 * @param {Object} props        Loader props.
 * @param {string} props.search What's typed in the palette.
 * @return {Object} `{ commands, isLoading }`.
 */
function usePageCommands( { search } ) {
	const settledSearch = useSettledValue( search, 250 );
	const { homepageId, isLoading, records } = useSelect(
		( selectStore ) => {
			if ( ! settledSearch ) {
				return { isLoading: false, records: EMPTY_ARRAY };
			}

			const {
				getEditedEntityRecord,
				getEntityRecords,
				hasFinishedResolution,
			} = selectStore( coreDataStore );
			const query = {
				_fields: 'id,title',
				orderby: 'relevance',
				per_page: 10,
				search: settledSearch,
				search_columns: [ 'post_title' ],
				status: [ 'publish', 'future', 'draft', 'pending', 'private' ],
			};
			const site = getEditedEntityRecord( 'root', 'site' );

			return {
				homepageId:
					site?.show_on_front === 'page'
						? Number( site.page_on_front )
						: 0,
				isLoading: ! hasFinishedResolution( 'getEntityRecords', [
					'postType',
					'page',
					query,
				] ),
				records:
					getEntityRecords( 'postType', 'page', query ) ??
					EMPTY_ARRAY,
			};
		},
		[ settledSearch ]
	);

	const commands = useMemo(
		() =>
			records.map( ( record ) => {
				const pageId =
					homepageId && record.id === homepageId
						? HOMEPAGE
						: record.id;

				return {
					name: `create-not-learn-editor/page-${ record.id }`,
					label:
						decodeEntities( record.title?.rendered ?? '' ) ||
						__( '(no title)' ),
					icon: pageIcon,
					category: 'edit',
					callback: ( { close } ) => {
						close();
						openPage( pageId );
					},
				};
			} ),
		[ homepageId, records ]
	);

	return {
		commands,
		isLoading: isLoading || search !== settledSearch,
	};
}

/**
 * Take commands that don't belong here back out whenever they're registered,
 * which can be at any time: the editor's own scripts add theirs when it loads.
 */
function hideCommands() {
	const unregister = () => {
		const { getCommands } = select( commandsStore );
		const registered = [ ...getCommands(), ...getCommands( true ) ];

		registered
			.filter( ( command ) => HIDDEN_COMMANDS.includes( command.name ) )
			.forEach( ( command ) =>
				dispatch( commandsStore ).unregisterCommand( command.name )
			);
	};

	subscribe( unregister, commandsStore );
	unregister();
}

function CommandPalette() {
	useScreenCommands();
	useViewSiteCommand();
	useCommandLoader( {
		name: 'create-not-learn-editor/pages',
		hook: usePageCommands,
	} );

	/*
	 * The palette keeps what was typed until it's dismissed, so picking a
	 * command left the search filled in next time. A fresh palette each time
	 * it closes always opens empty.
	 */
	const isOpen = useSelect(
		( selectStore ) => selectStore( commandsStore ).isOpen(),
		[]
	);
	const [ closedCount, setClosedCount ] = useState( 0 );

	useEffect( () => {
		if ( ! isOpen ) {
			setClosedCount( ( count ) => count + 1 );
		}
	}, [ isOpen ] );

	return <CommandMenu key={ closedCount } />;
}

/**
 * Mount the command palette, opened from the top bar's search or Cmd+K.
 */
export function mountCommands() {
	hideCommands();

	const container = document.createElement( 'div' );
	document.body.append( container );
	createRoot( container ).render( <CommandPalette /> );
}
