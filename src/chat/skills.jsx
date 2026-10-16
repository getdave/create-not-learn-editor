/**
 * What the chat can do, one skill per kind of change.
 *
 * Most skills show one of the pickers the screens use, in the conversation.
 * Picking makes the same unsaved change it makes on its screen, so the canvas
 * shows it straight away, and sending saves that one record.
 *
 * A skill says:
 * - `reply( params, text )`: what the chat says when asked, as `{ text, ... }`,
 *   or a promise of it.
 * - `Widget`: the picker it shows under the reply, if any.
 * - `useEntity( params )`: the record its picker changes, `[ kind, name, key ]`.
 *   A picker that only knows its record once loaded reports it through
 *   `onEntity` instead.
 * - `keys` and `hasBlocks`: what about the record the picker changes.
 * - `needsRecord( params )`: whether the picker waits for its record to be
 *   noted before it shows, when that depends on the request.
 * - `action( pending )`: the button under the picker that keeps a pick,
 *   named for what it does.
 * - `screen( message )`: the screen with the same controls and more, as
 *   `{ label, path, search }`, offered beside that button.
 * - `chip`, `request` and `done`: how a pick reads, as the message that keeps
 *   it, and once saved.
 * - `hasFooter( params )`: whether the picker has that button, when that
 *   depends on the request.
 * - `commit` and `undo`: for skills that don't edit a record in place.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * because the chat is mounted from app init. See `src/editor-layer/index.jsx`.
 */

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { Button } from '@wordpress/components';
import { store as coreDataStore } from '@wordpress/core-data';
import {
	dispatch,
	resolveSelect,
	select as selectFromRegistry,
	useDispatch,
	useSelect,
} from '@wordpress/data';
import { useEffect, useMemo, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { home as homeIcon, page as pageIcon } from '@wordpress/icons';
import { Icon, InputControl, Spinner, Text } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { StartFromScratch } from '../design-picker';
import { SiteIdentityFields } from '../pickers/identity';
import { PageLayoutCard, usePageLayoutPatterns } from '../pickers/page-designs';
import { SitePartLayouts } from '../pickers/site-part-layouts';
import { FontPicker, LookPicker, PalettePicker } from '../pickers/styles';
import {
	getPatternContent,
	getPatternTitle,
} from '../routes/content/page-layouts';
import {
	SectionDesignCard,
	getPatternSectionBlocks,
	searchSectionDesigns,
	useSectionDesigns,
} from '../section-picker';
import { Carousel } from './carousel';
import { getBlocksEdit } from './entity-changes';
import {
	PAGES_QUERY,
	findNamedPage,
	findTargetPage,
	toPages,
} from './target-page';
import { useChatExtras } from './use-chat-extras';
import { useLazyPreview } from './use-lazy-preview';

/*
 * The site's global styles record: the one the Design, Colors and Fonts
 * screens change.
 */
function useGlobalStylesEntity() {
	const id = useSelect(
		( select ) =>
			select( coreDataStore ).__experimentalGetCurrentGlobalStylesId?.(),
		[]
	);

	return useMemo(
		() => ( id ? [ 'root', 'globalStyles', id ] : null ),
		[ id ]
	);
}

const GLOBAL_STYLES = {
	keys: [ 'settings', 'styles' ],
	useEntity: useGlobalStylesEntity,
};

/*
 * The header or footer the site uses: the theme's part for that area, the one
 * named after it if there are several.
 */
function useSitePartEntity( { area } ) {
	const id = useSelect(
		( select ) => {
			const parts = select( coreDataStore ).getEntityRecords(
				'postType',
				'wp_template_part',
				{ per_page: -1 }
			);
			const matches = ( parts || [] ).filter(
				( part ) => part.area === area
			);

			return (
				(
					matches.find( ( part ) => part.slug === area ) ||
					matches[ 0 ]
				)?.id || null
			);
		},
		[ area ]
	);

	return useMemo(
		() => ( id ? [ 'postType', 'wp_template_part', id ] : null ),
		[ id ]
	);
}

function useTargetPageEntity( { pageId } ) {
	return useMemo(
		() => ( pageId ? [ 'postType', 'page', pageId ] : null ),
		[ pageId ]
	);
}

const SITE_ENTITY = [ 'root', 'site', undefined ];

function useSiteEntity() {
	return SITE_ENTITY;
}

/**
 * Open a screen from outside boot's router, the way the workspace switcher
 * does: boot's router follows `pushState`. The route's search params go
 * inside `p`, after its path, as boot's own links put them.
 *
 * @param {string} path   Route path.
 * @param {Object} search Route search params.
 */
export function openRoute( path, search = {} ) {
	const url = new URL( window.location.href );
	const query = new URLSearchParams(
		Object.entries( search ).map( ( [ key, value ] ) => [
			key,
			String( value ),
		] )
	).toString();

	url.searchParams.set( 'p', query ? `${ path }?${ query }` : path );
	window.history.pushState( null, '', url );
}

/*
 * ---------------------------------------------------------------------------
 * Widgets: the screens' pickers, wired to the chat.
 * ---------------------------------------------------------------------------
 */

function LookWidget( { onPick } ) {
	return <LookPicker onPick={ onPick } />;
}

function ColorsWidget( { onPick } ) {
	return <PalettePicker onPick={ onPick } />;
}

function FontsWidget( { onPick } ) {
	return <FontPicker onPick={ onPick } />;
}

function TitleWidget( { message, onPick } ) {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const name = message.params?.name;
	const isReady = !! message.snapshot;
	const onEdit = ( { title } ) => {
		if ( title !== undefined ) {
			onPick( title, { title } );
		}
	};

	// A name given in the request goes straight in, once.
	useEffect( () => {
		if ( isReady && name && ! message.pickedLabel ) {
			editEntityRecord( 'root', 'site', undefined, { title: name } );
			onEdit( { title: name } );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ isReady ] );

	return (
		<SiteIdentityFields
			fields={ [ 'title' ] }
			hideDiscard
			onEdit={ onEdit }
		/>
	);
}

function LogoWidget( { onPick } ) {
	return (
		<SiteIdentityFields
			fields={ [ 'logo' ] }
			hideDiscard
			onEdit={ ( { site_logo: logoId } ) => {
				if ( logoId !== undefined ) {
					onPick( logoId ? __( 'New logo' ) : __( 'No logo' ), {
						logoId,
					} );
				}
			} }
		/>
	);
}

/**
 * @return {boolean} Whether the site has a logo, as saved.
 */
function hasSavedLogo() {
	return !! selectFromRegistry( coreDataStore ).getEntityRecord(
		'root',
		'site'
	)?.site_logo;
}

function SitePartWidget( { entity, message, onPick } ) {
	const Preview = useLazyPreview();

	if ( ! entity ) {
		return null;
	}

	return (
		<Carousel label={ __( 'Layouts' ) }>
			<SitePartLayouts
				area={ message.params.area }
				id={ entity[ 2 ] }
				onPick={ onPick }
				Preview={ Preview }
			/>
		</Carousel>
	);
}

function Loading() {
	return (
		<div className="cnl-editor-spinner">
			<Spinner />
		</div>
	);
}

/*
 * The menu editor comes from the chat-extras module, which loads the first
 * time it is needed.
 */
function MenuWidget( { onEntity, onPick } ) {
	const extras = useChatExtras();

	if ( ! extras ) {
		return <Loading />;
	}

	return <extras.MenuWidget onEntity={ onEntity } onPick={ onPick } />;
}

/**
 * Designs that suit a request, best first: those matching its words, then
 * the rest.
 *
 * @param {Object[]} patterns Designs.
 * @param {string}   search   Words from the request.
 * @return {Object} `{ designs, hasMatches }`.
 */
function rankDesigns( patterns, search ) {
	if ( ! search ) {
		return { designs: patterns, hasMatches: false };
	}

	const firstWord = search.split( ' ' )[ 0 ].toLowerCase();
	const matches = [
		...searchSectionDesigns( patterns, search ),
		...patterns.filter( ( pattern ) =>
			( pattern.categories || [] ).some( ( category ) =>
				category.toLowerCase().includes( firstWord )
			)
		),
	].filter( ( pattern, index, all ) => all.indexOf( pattern ) === index );

	return {
		designs: [
			...matches,
			...patterns.filter( ( pattern ) => ! matches.includes( pattern ) ),
		],
		hasMatches: matches.length > 0,
		matches,
	};
}

/**
 * The designs to offer: those that suit the request, until asked for all.
 *
 * @param {Object[]} patterns Designs.
 * @param {string}   search   Words from the request.
 * @return {Object} `{ designs, hasMatches, more, showAll }`. `more` is how
 *                  many are held back, and `showAll` shows them.
 */
function useSuitableDesigns( patterns, search ) {
	const [ isShowingAll, setIsShowingAll ] = useState( false );
	const ranked = useMemo(
		() => rankDesigns( patterns, search ),
		[ patterns, search ]
	);
	const isFiltered = ranked.hasMatches && ! isShowingAll;

	return {
		designs: isFiltered ? ranked.matches : ranked.designs,
		hasMatches: ranked.hasMatches,
		more: isFiltered ? ranked.designs.length - ranked.matches.length : 0,
		showAll: () => setIsShowingAll( true ),
	};
}

function ShowAllDesigns( { more, onClick } ) {
	if ( ! more ) {
		return null;
	}

	return (
		<Button
			className="cnl-chat-widget__more"
			onClick={ onClick }
			variant="link"
		>
			{ sprintf(
				/* translators: %d: number of other designs. */
				_n( 'See %d other design', 'See %d other designs', more ),
				more
			) }
		</Button>
	);
}

/*
 * Naming a page comes first, on its own, so the designs offered can suit it:
 * a "Contact" page leads with contact designs.
 */
function PageNameStep( { onContinue, title, setTitle } ) {
	return (
		<form
			className="cnl-chat-widget__stack"
			onSubmit={ ( event ) => {
				event.preventDefault();

				if ( title.trim() ) {
					onContinue();
				}
			} }
		>
			<InputControl
				autoComplete="off"
				label={ __( 'Page name' ) }
				onValueChange={ setTitle }
				placeholder={ __( 'For example, Contact' ) }
				value={ title }
			/>
			<Button
				__next40pxDefaultSize
				accessibleWhenDisabled
				disabled={ ! title.trim() }
				type="submit"
				variant="primary"
			>
				{ __( 'Show designs' ) }
			</Button>
		</form>
	);
}

function PageWidget( { message, onPick } ) {
	const Preview = useLazyPreview();
	const { isResolving, patterns } = usePageLayoutPatterns();
	const [ title, setTitle ] = useState( message.params?.title || '' );
	const [ isNaming, setIsNaming ] = useState( ! message.params?.title );
	const [ choice, setChoice ] = useState();
	const name = title.trim();
	// Ranked once named, so the order holds while the name is edited.
	const [ rankedFor, setRankedFor ] = useState( name );
	const { designs, more, showAll } = useSuitableDesigns(
		patterns,
		rankedFor
	);
	const choose = ( nextChoice ) => {
		setChoice( nextChoice );
		onPick( name, { pattern: nextChoice, title: name } );
	};

	if ( isNaming ) {
		return (
			<PageNameStep
				onContinue={ () => {
					setIsNaming( false );
					setRankedFor( name );

					if ( choice !== undefined ) {
						onPick( name, { pattern: choice, title: name } );
					}
				} }
				setTitle={ setTitle }
				title={ title }
			/>
		);
	}

	return (
		<div className="cnl-chat-widget__stack">
			<div className="cnl-chat-widget__heading">
				<Text variant="body-md">
					{ sprintf(
						/* translators: %s: page name. */
						__( 'Designs for “%s”' ),
						name
					) }
				</Text>
				<Button onClick={ () => setIsNaming( true ) } variant="link">
					{ __( 'Change name' ) }
				</Button>
			</div>
			{ isResolving && ! patterns.length && <Loading /> }
			{ designs.length > 0 && (
				<Carousel label={ __( 'Page designs' ) }>
					<div className="cnl-chat-widget__designs">
						{ designs.map( ( pattern ) => (
							<PageLayoutCard
								isSelected={ choice === pattern }
								key={ pattern.name }
								onSelect={ () => choose( pattern ) }
								pattern={ pattern }
								Preview={ Preview }
							/>
						) ) }
					</div>
				</Carousel>
			) }
			<ShowAllDesigns more={ more } onClick={ showAll } />
			<StartFromScratch
				description={ __( 'A blank page to fill in yourself' ) }
				isSelected={ choice === null }
				onClick={ () => choose( null ) }
			/>
		</div>
	);
}

/**
 * The sections of the page on the canvas, as the editor draws them.
 *
 * @return {Element[]} The sections, top to bottom.
 */
function getCanvasSections() {
	const canvas = document.querySelector(
		'iframe[name="editor-canvas"]'
	)?.contentDocument;

	return [
		...( canvas?.querySelectorAll(
			'.wp-block-post-content > .block-editor-block-list__block'
		) || [] ),
	];
}

/**
 * Bring a new section at the end of the page on the canvas into view, once
 * the editor has drawn it. Gives up after a couple of seconds, for instance
 * when the canvas isn't showing the editor.
 *
 * @param {number} before How many sections the page had before.
 */
function scrollToNewSection( before ) {
	let tries = 0;
	const timer = window.setInterval( () => {
		const sections = getCanvasSections();

		tries += 1;

		if ( sections.length > before ) {
			window.clearInterval( timer );
			sections[ sections.length - 1 ].scrollIntoView( {
				behavior: 'smooth',
				block: 'start',
			} );
		} else if ( tries > 20 ) {
			window.clearInterval( timer );
		}
	}, 100 );
}

/*
 * Which page a section goes on, asked when there is no page being worked on.
 */
function PageChooser( { onChoose } ) {
	const { homeId, isLoading, records } = useSelect( ( select ) => {
		const store = select( coreDataStore );
		const site = store.getEntityRecord( 'root', 'site' );
		const args = [ 'postType', 'page', PAGES_QUERY ];

		return {
			homeId: site?.show_on_front === 'page' ? site.page_on_front : null,
			isLoading: ! store.hasFinishedResolution(
				'getEntityRecords',
				args
			),
			records: store.getEntityRecords( ...args ),
		};
	}, [] );
	// The homepage first, as the Pages screen lists it.
	const ordered = useMemo( () => {
		const pages = toPages( records );

		return [
			...pages.filter( ( page ) => page.id === homeId ),
			...pages.filter( ( page ) => page.id !== homeId ),
		];
	}, [ homeId, records ] );

	if ( isLoading ) {
		return <Loading />;
	}

	return (
		<ul className="cnl-chat-choices" role="list">
			{ ordered.map( ( page ) => (
				<li key={ page.id }>
					<button
						className="cnl-chat-choices__item"
						onClick={ () => onChoose( page ) }
						type="button"
					>
						<Icon
							icon={ page.id === homeId ? homeIcon : pageIcon }
							size={ 20 }
						/>
						<span className="cnl-chat-choices__label">
							{ page.title || __( '(no title)' ) }
						</span>
						{ page.status === 'draft' && (
							<span className="cnl-chat-choices__meta">
								{ __( 'Draft' ) }
							</span>
						) }
					</button>
				</li>
			) ) }
		</ul>
	);
}

function SectionWidget( { entity, message, onChoosePage, onPick, scrollRef } ) {
	const Preview = useLazyPreview();
	const { editEntityRecord } = useDispatch( coreDataStore );
	const { isLoading, patterns } = useSectionDesigns();
	const search = message.params?.search || '';
	const { designs, hasMatches, more, showAll } = useSuitableDesigns(
		patterns,
		search
	);

	if ( message.params?.choosePage ) {
		return <PageChooser onChoose={ onChoosePage } />;
	}

	if ( ! entity ) {
		return null;
	}

	const pick = ( pattern ) => {
		const added = getPatternSectionBlocks( pattern );
		// A pick replaces the last one, so count from the page before it.
		const before =
			getCanvasSections().length -
			( message.pickedPayload?.patternName ? 1 : 0 );

		editEntityRecord(
			...entity,
			getBlocksEdit( [ ...message.snapshot.blocks, ...added ] )
		);
		onPick( getPatternTitle( pattern ), { patternName: pattern.name } );

		scrollToNewSection( before );
	};

	return (
		<div className="cnl-chat-widget__stack">
			{ search && ! isLoading && ! hasMatches && (
				<Text className="routes-styles__muted" variant="body-sm">
					{ sprintf(
						/* translators: %s: what was asked for. */
						__(
							'Your theme has nothing for “%s”, so here is everything else.'
						),
						search
					) }
				</Text>
			) }
			{ isLoading && ! patterns.length && <Loading /> }
			{ designs.length > 0 && (
				<Carousel label={ __( 'Section designs' ) }>
					<ul className="cnl-chat-widget__sections" role="list">
						{ designs.map( ( pattern ) => (
							<SectionDesignCard
								isSelected={
									message.pickedPayload?.patternName ===
									pattern.name
								}
								key={ pattern.name }
								onPick={ pick }
								pattern={ pattern }
								Preview={ Preview }
								scrollRef={ scrollRef }
							/>
						) ) }
					</ul>
				</Carousel>
			) }
			<ShowAllDesigns more={ more } onClick={ showAll } />
		</div>
	);
}

/*
 * ---------------------------------------------------------------------------
 * The skills.
 * ---------------------------------------------------------------------------
 */

/**
 * What the chat says over the section designs.
 *
 * @param {string} search    What kind of section was asked for, if said.
 * @param {string} pageTitle The page it goes on.
 * @return {string} The reply.
 */
export function getSectionsReply( search, pageTitle ) {
	const title = pageTitle || __( 'this page' );

	return search
		? sprintf(
				/* translators: 1: kind of section, 2: page name. */
				__(
					'Here are some %1$s sections you could add to “%2$s”. Pick one and it’ll appear at the bottom of the page.'
				),
				search,
				title
			)
		: sprintf(
				/* translators: %s: page name. */
				__(
					'Here are some sections you could add to “%s”. Pick one and it’ll appear at the bottom of the page.'
				),
				title
			);
}

export const SUGGESTIONS = [
	{ text: __( 'Change my colors' ), icon: 'color' },
	{ text: __( 'Try a new look' ), icon: 'styles' },
	{ text: __( 'Pick new fonts' ), icon: 'typography' },
	{ text: __( 'Change site title' ), icon: 'siteTitle' },
	{
		text: () =>
			hasSavedLogo() ? __( 'Change site logo' ) : __( 'Add a logo' ),
		icon: 'siteLogo',
	},
	{ text: __( 'Change my header' ), icon: 'header' },
	{ text: __( 'Change my footer' ), icon: 'footer' },
	{ text: __( 'Change my menu' ), icon: 'navigation' },
	{ text: __( 'Add a page' ), icon: 'page' },
	{ text: __( 'Add a section' ), icon: 'section' },
];

export const SKILLS = {
	look: {
		screen: () => ( { label: __( 'Open in Design' ), path: '/design' } ),
		action: () => __( 'Use this look' ),
		...GLOBAL_STYLES,
		reply: () => ( {
			text: __(
				'These are the looks your theme comes with. Each one changes your colors, fonts and spacing together. Pick one and you’ll see it on your site straight away.'
			),
		} ),
		Widget: LookWidget,
		chip: ( { label } ) =>
			/* translators: %s: look name. */
			sprintf( __( 'Look: %s' ), label ),
		request: ( { label } ) =>
			/* translators: %s: look name. */
			sprintf( __( 'Use the “%s” look' ), label ),
		done: ( { label } ) =>
			/* translators: %s: look name. */
			sprintf( __( 'Done. Your site now has the “%s” look.' ), label ),
	},
	colors: {
		screen: () => ( {
			label: __( 'Open in Colors' ),
			path: '/design/colors',
		} ),
		action: () => __( 'Use these colors' ),
		...GLOBAL_STYLES,
		reply: () => ( {
			text: __(
				'Here are the color palettes your theme comes with. Pick one and you’ll see it on your site straight away.'
			),
		} ),
		Widget: ColorsWidget,
		chip: ( { label } ) =>
			/* translators: %s: palette name. */
			sprintf( __( 'Colors: %s' ), label ),
		request: ( { label } ) =>
			/* translators: %s: palette name. */
			sprintf( __( 'Use the “%s” colors' ), label ),
		done: ( { label } ) =>
			/* translators: %s: palette name. */
			sprintf( __( 'Done. Your site now uses the “%s” colors.' ), label ),
	},
	fonts: {
		screen: () => ( {
			label: __( 'Open in Fonts' ),
			path: '/design/fonts',
		} ),
		action: () => __( 'Use these fonts' ),
		...GLOBAL_STYLES,
		reply: () => ( {
			text: __(
				'Here are the font pairings your theme comes with: one for headings and one for everything else. Pick one to try it on your site.'
			),
		} ),
		Widget: FontsWidget,
		chip: ( { label } ) =>
			/* translators: %s: font pairing name. */
			sprintf( __( 'Fonts: %s' ), label ),
		request: ( { label } ) =>
			/* translators: %s: font pairing name. */
			sprintf( __( 'Use the “%s” fonts' ), label ),
		done: ( { label } ) =>
			/* translators: %s: font pairing name. */
			sprintf( __( 'Done. Your site now uses the “%s” fonts.' ), label ),
	},
	'site-title': {
		action: () => __( 'Save site title' ),
		keys: [ 'title' ],
		useEntity: useSiteEntity,
		screen: () => ( {
			label: __( 'Open in Name & logo' ),
			path: '/design/identity',
		} ),
		reply: ( { name } ) => ( {
			text: name
				? sprintf(
						/* translators: %s: new site title. */
						__(
							'I’ve put in “%s” as your site title, so you can see it on your site now.'
						),
						name
					)
				: __(
						'What would you like your site to be called? Type it here and you’ll see it on your site as you go.'
					),
		} ),
		Widget: TitleWidget,
		chip: ( { label } ) =>
			/* translators: %s: site title. */
			sprintf( __( 'Site title: %s' ), label ),
		request: ( { label } ) =>
			/* translators: %s: site title. */
			sprintf( __( 'Call my site “%s”' ), label ),
		done: ( { label } ) =>
			sprintf(
				/* translators: %s: site title. */
				__( 'Done. Your site is now called “%s”.' ),
				label
			),
	},
	logo: {
		action: () =>
			hasSavedLogo() ? __( 'Save logo' ) : __( 'Use this logo' ),
		keys: [ 'site_logo' ],
		useEntity: useSiteEntity,
		screen: () => ( {
			label: __( 'Open in Name & logo' ),
			path: '/design/identity',
		} ),
		reply: () => ( {
			text: hasSavedLogo()
				? __(
						'Here’s your logo. Replace it with another image, or remove it, and you’ll see the change on your site.'
					)
				: __(
						'Your site doesn’t have a logo yet. Upload one, or pick an image you already have.'
					),
		} ),
		Widget: LogoWidget,
		chip: ( { label } ) => label,
		request: ( { payload } ) =>
			payload.logoId ? __( 'Use this logo' ) : __( 'Remove my logo' ),
		done: ( { payload } ) =>
			payload.logoId
				? __( 'Done. Your logo is on your site.' )
				: __( 'Done. I’ve taken your logo off your site.' ),
	},
	header: {
		screen: () => ( {
			label: __( 'Open in Header' ),
			path: '/design/header',
			search: { view: 'layouts' },
		} ),
		action: () => __( 'Use this header' ),
		keys: [ 'blocks', 'content' ],
		hasBlocks: true,
		useEntity: useSitePartEntity,
		reply: () => ( {
			params: { area: 'header' },
			text: __(
				'Here are the header layouts your theme comes with. Your header shows on every page. Pick a layout to try it.'
			),
		} ),
		Widget: SitePartWidget,
		chip: ( { label } ) =>
			/* translators: %s: layout name. */
			sprintf( __( 'Header: %s' ), label ),
		request: ( { label } ) =>
			/* translators: %s: layout name. */
			sprintf( __( 'Use the “%s” header' ), label ),
		done: ( { label } ) =>
			/* translators: %s: layout name. */
			sprintf( __( 'Done. Your header now uses “%s”.' ), label ),
	},
	footer: {
		screen: () => ( {
			label: __( 'Open in Footer' ),
			path: '/design/footer',
			search: { view: 'layouts' },
		} ),
		action: () => __( 'Use this footer' ),
		keys: [ 'blocks', 'content' ],
		hasBlocks: true,
		useEntity: useSitePartEntity,
		reply: () => ( {
			params: { area: 'footer' },
			text: __(
				'Here are the footer layouts your theme comes with. Your footer shows on every page. Pick a layout to try it.'
			),
		} ),
		Widget: SitePartWidget,
		chip: ( { label } ) =>
			/* translators: %s: layout name. */
			sprintf( __( 'Footer: %s' ), label ),
		request: ( { label } ) =>
			/* translators: %s: layout name. */
			sprintf( __( 'Use the “%s” footer' ), label ),
		done: ( { label } ) =>
			/* translators: %s: layout name. */
			sprintf( __( 'Done. Your footer now uses “%s”.' ), label ),
	},
	'add-page': {
		screen: () => ( {
			label: __( 'Open in Pages' ),
			path: '/types/page/list/all',
		} ),
		action: ( pending ) =>
			pending
				? sprintf(
						/* translators: %s: page name. */
						__( 'Create “%s”' ),
						pending.label
					)
				: __( 'Create page' ),
		reply: ( { title } ) => ( {
			text: title
				? sprintf(
						/* translators: %s: page name. */
						__(
							'Let’s add a “%s” page. Here are the designs that suit it best. Pick one, or start blank.'
						),
						title
					)
				: __(
						'What should the new page be called? Once it has a name, I’ll show you the designs that suit it.'
					),
		} ),
		Widget: PageWidget,
		chip: ( { label, payload } ) =>
			sprintf(
				/* translators: 1: page name, 2: design name. */
				__( 'New page: %1$s · %2$s' ),
				label,
				payload.pattern
					? getPatternTitle( payload.pattern )
					: __( 'Blank' )
			),
		request: ( { label } ) =>
			/* translators: %s: page name. */
			sprintf( __( 'Create the “%s” page' ), label ),
		done: ( { label } ) =>
			sprintf(
				/* translators: %s: page name. */
				__( 'Done. “%s” is live, and it’s open on the right.' ),
				label
			),
		async commit( { payload } ) {
			const page = await dispatch( coreDataStore ).saveEntityRecord(
				'postType',
				'page',
				{
					content: payload.pattern
						? getPatternContent( payload.pattern )
						: '',
					status: 'publish',
					title: payload.title,
				},
				{ throwOnError: true }
			);

			openRoute( '/types/page/list/all', { previewId: page.id } );

			return { pageId: page.id };
		},
		async undo( { pageId } ) {
			/*
			 * Through the REST API rather than core-data's
			 * `deleteEntityRecord`, which throws in core-data's queries
			 * reducer here once the page has been moved.
			 */
			await apiFetch( {
				method: 'DELETE',
				path: `/wp/v2/pages/${ pageId }`,
			} );
			dispatch( coreDataStore ).invalidateResolutionForStoreSelector(
				'getEntityRecords'
			);
			openRoute( '/types/page/list/all' );
		},
		undone: __( 'Done. I’ve moved the page to the bin.' ),
	},
	'add-section': {
		screen: ( { params } ) =>
			params?.pageId
				? {
						label: sprintf(
							/* translators: %s: page name. */
							__( 'Open “%s” in Pages' ),
							params.pageTitle
						),
						path: '/types/page/list/all',
						search: { previewId: params.pageId },
					}
				: null,
		action: () => __( 'Add this section' ),
		hasFooter: ( { choosePage } ) => ! choosePage,
		keys: [ 'blocks', 'content' ],
		hasBlocks: true,
		useEntity: useTargetPageEntity,
		// Asking which page comes before any page is changed.
		needsRecord: ( { choosePage } ) => ! choosePage,
		async reply( { search }, text ) {
			// A page named in the request wins, once the pages have loaded.
			await Promise.all( [
				resolveSelect( coreDataStore ).getEntityRecords(
					'postType',
					'page',
					PAGES_QUERY
				),
				resolveSelect( coreDataStore ).getEntityRecord(
					'root',
					'site'
				),
			] );

			const named = findNamedPage( text );
			const current = findTargetPage();
			const page = named || current;

			if ( ! page ) {
				return {
					params: { choosePage: true },
					text: __( 'Which page should the section go on?' ),
				};
			}

			// Show the page named on the canvas, to see the section added.
			if ( named && named.id !== current?.id ) {
				openRoute( '/types/page/list/all', { previewId: named.id } );
			}

			return {
				params: { pageId: page.id, pageTitle: page.title },
				text: getSectionsReply( search, page.title ),
			};
		},
		Widget: SectionWidget,
		chip: ( { label } ) =>
			/* translators: %s: section design name. */
			sprintf( __( 'Section: %s' ), label ),
		request: ( { label } ) =>
			/* translators: %s: section design name. */
			sprintf( __( 'Add the “%s” section' ), label ),
		done: ( { label }, message ) =>
			sprintf(
				/* translators: 1: section design name, 2: page name. */
				__( 'Done. I’ve added “%1$s” to “%2$s”.' ),
				label,
				message.params.pageTitle
			),
	},
	menu: {
		screen: ( { entity } ) => ( {
			label: __( 'Open in Menus' ),
			path: entity ? `/navigation/edit/${ entity[ 2 ] }` : '/navigation',
		} ),
		action: () => __( 'Save menu' ),
		keys: [ 'blocks', 'content' ],
		hasBlocks: true,
		reply: () => ( {
			text: __(
				'Here’s your menu. Drag links to reorder them, rename them, or add pages and links. You’ll see each change on your site as you make it.'
			),
		} ),
		Widget: MenuWidget,
		chip: ( { label } ) =>
			/* translators: %s: menu name. */
			sprintf( __( 'Menu: %s' ), label ),
		request: () => __( 'Keep my menu changes' ),
		done: () => __( 'Done. Your menu is saved.' ),
	},
	greeting: {
		reply: () => ( {
			suggestions: true,
			text: __(
				'Hi! What would you like to change on your site? Here are a few things I can help with.'
			),
		} ),
	},
	thanks: {
		reply: () => ( {
			text: __(
				'You’re welcome. Is there anything else you’d like to change?'
			),
		} ),
	},
};

export const FALLBACK_REPLY = {
	suggestions: true,
	text: __( 'I can’t do that yet. Here’s what I can help with for now.' ),
};
