/**
 * What the chat can do, one skill per kind of change.
 *
 * Most skills show one of the pickers the screens use, in the conversation.
 * Picking makes the same unsaved change it makes on its screen, so the canvas
 * shows it straight away, and sending saves that one record.
 *
 * A skill says:
 * - `reply( params )`: what the chat says when asked, as `{ text, ... }`.
 * - `Widget`: the picker it shows under the reply, if any.
 * - `useEntity( params )`: the record its picker changes, `[ kind, name, key ]`.
 * - `keys` and `hasBlocks`: what about the record the picker changes.
 * - `chip`, `request` and `done`: how a pick reads in the composer, as the
 *   message sent, and once saved.
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
import { dispatch, useDispatch, useSelect } from '@wordpress/data';
import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { InputControl, Text } from '@wordpress/ui';

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
import { getBlocksEdit } from './entity-changes';
import { findTargetPage } from './target-page';
import { useLazyPreview } from './use-lazy-preview';

const DESIGNS_SHOWN = 4;

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

function IdentityWidget( { message, onPick } ) {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const nameRef = useRef( message.pickedLabel );
	const onEdit = ( edits ) => {
		if ( edits.title !== undefined ) {
			nameRef.current = edits.title;
		}

		onPick( nameRef.current || '', { title: nameRef.current } );
	};
	const name = message.params?.name;
	const isReady = !! message.snapshot;

	// A name given in the request goes straight in, once.
	useEffect( () => {
		if ( isReady && name && ! message.pickedLabel ) {
			editEntityRecord( 'root', 'site', undefined, { title: name } );
			onEdit( { title: name } );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ isReady ] );

	return <SiteIdentityFields hideDiscard onEdit={ onEdit } />;
}

function SitePartWidget( { entity, message, onPick } ) {
	const Preview = useLazyPreview();

	if ( ! entity ) {
		return null;
	}

	return (
		<SitePartLayouts
			area={ message.params.area }
			id={ entity[ 2 ] }
			onPick={ onPick }
			Preview={ Preview }
		/>
	);
}

function ShowMore( { count, onClick } ) {
	return (
		<Button
			__next40pxDefaultSize
			className="cnl-chat-widget__more"
			onClick={ onClick }
			variant="secondary"
		>
			{ sprintf(
				/* translators: %d: number of designs not shown yet. */
				__( 'Show %d more' ),
				count
			) }
		</Button>
	);
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
	};
}

function PageWidget( { message, onPick } ) {
	const Preview = useLazyPreview();
	const { isResolving, patterns } = usePageLayoutPatterns();
	const [ title, setTitle ] = useState( message.params?.title || '' );
	const [ choice, setChoice ] = useState();
	const [ shown, setShown ] = useState( DESIGNS_SHOWN );
	const { designs } = useMemo(
		() =>
			rankDesigns(
				patterns,
				( message.params?.title || '' ).toLowerCase()
			),
		[ patterns, message.params?.title ]
	);
	const report = ( nextTitle, nextChoice ) => {
		if ( nextChoice !== undefined && nextTitle.trim() ) {
			onPick( nextTitle.trim(), {
				pattern: nextChoice,
				title: nextTitle.trim(),
			} );
		}
	};

	return (
		<div className="cnl-chat-widget__stack">
			<InputControl
				autoComplete="off"
				label={ __( 'Page name' ) }
				onValueChange={ ( value ) => {
					setTitle( value );
					report( value, choice );
				} }
				placeholder={ __( 'For example, Contact' ) }
				value={ title }
			/>
			<StartFromScratch
				description={ __( 'A blank page to fill in yourself' ) }
				isSelected={ choice === null }
				onClick={ () => {
					setChoice( null );
					report( title, null );
				} }
			/>
			{ isResolving && ! patterns.length && (
				<Text className="routes-styles__muted" variant="body-sm">
					{ __( 'Finding designs…' ) }
				</Text>
			) }
			<div className="cnl-chat-widget__designs">
				{ designs.slice( 0, shown ).map( ( pattern ) => (
					<PageLayoutCard
						isSelected={ choice === pattern }
						key={ pattern.name }
						onSelect={ () => {
							setChoice( pattern );
							report( title, pattern );
						} }
						pattern={ pattern }
						Preview={ Preview }
					/>
				) ) }
			</div>
			{ designs.length > shown && (
				<ShowMore
					count={ Math.min( DESIGNS_SHOWN, designs.length - shown ) }
					onClick={ () => setShown( shown + DESIGNS_SHOWN ) }
				/>
			) }
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

function SectionWidget( { entity, message, onPick, scrollRef } ) {
	const Preview = useLazyPreview();
	const { editEntityRecord } = useDispatch( coreDataStore );
	const { isLoading, patterns } = useSectionDesigns();
	const [ shown, setShown ] = useState( DESIGNS_SHOWN );
	const search = message.params?.search || '';
	const { designs, hasMatches } = useMemo(
		() => rankDesigns( patterns, search ),
		[ patterns, search ]
	);

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
			<ul className="cnl-chat-widget__sections" role="list">
				{ designs.slice( 0, shown ).map( ( pattern ) => (
					<SectionDesignCard
						isSelected={
							message.pickedPayload?.patternName === pattern.name
						}
						key={ pattern.name }
						onPick={ pick }
						pattern={ pattern }
						Preview={ Preview }
						scrollRef={ scrollRef }
					/>
				) ) }
			</ul>
			{ designs.length > shown && (
				<ShowMore
					count={ Math.min( DESIGNS_SHOWN, designs.length - shown ) }
					onClick={ () => setShown( shown + DESIGNS_SHOWN ) }
				/>
			) }
		</div>
	);
}

/*
 * ---------------------------------------------------------------------------
 * The skills.
 * ---------------------------------------------------------------------------
 */

export const SUGGESTIONS = [
	{ text: __( 'Change my colors' ), icon: 'color' },
	{ text: __( 'Try a new look' ), icon: 'styles' },
	{ text: __( 'Pick new fonts' ), icon: 'typography' },
	{ text: __( 'Rename my site' ), icon: 'siteLogo' },
	{ text: __( 'Change my header' ), icon: 'header' },
	{ text: __( 'Change my footer' ), icon: 'footer' },
	{ text: __( 'Add a page' ), icon: 'page' },
	{ text: __( 'Add a section' ), icon: 'section' },
];

export const SKILLS = {
	look: {
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
	identity: {
		keys: [ 'title', 'description', 'site_logo', 'site_icon' ],
		useEntity: useSiteEntity,
		reply: ( { name } ) => ( {
			text: name
				? sprintf(
						/* translators: %s: new site name. */
						__(
							'I’ve put in “%s” as your site’s name, so you can see it on your site now. Change anything else here, then press send to keep it.'
						),
						name
					)
				: __(
						'Here’s how your site introduces itself. Change anything and you’ll see it on your site as you go.'
					),
		} ),
		Widget: IdentityWidget,
		chip: ( { label } ) =>
			label
				? /* translators: %s: site name. */
					sprintf( __( 'Name: %s' ), label )
				: __( 'Name & logo' ),
		request: ( { label } ) =>
			label
				? /* translators: %s: site name. */
					sprintf( __( 'Call my site “%s”' ), label )
				: __( 'Keep my name & logo changes' ),
		done: ( { label } ) =>
			label
				? sprintf(
						/* translators: %s: site name. */
						__( 'Done. Your site is now called “%s”.' ),
						label
					)
				: __( 'Done. Your name and logo are saved.' ),
	},
	header: {
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
		reply: ( { title } ) => ( {
			text: title
				? sprintf(
						/* translators: %s: page name. */
						__(
							'Let’s add a “%s” page. Pick a design to start from, or start blank, and press send when you’re ready.'
						),
						title
					)
				: __(
						'What should the new page be called? Give it a name and pick a design to start from, then press send.'
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
		keys: [ 'blocks', 'content' ],
		hasBlocks: true,
		useEntity: useTargetPageEntity,
		reply: ( { search } ) => {
			const page = findTargetPage();

			if ( ! page ) {
				return {
					actions: [ 'open-pages' ],
					text: __(
						'Which page should it go on? Open a page on the right, then ask me again.'
					),
					widget: false,
				};
			}

			const title = page.title || __( 'this page' );

			return {
				params: { pageId: page.id, pageTitle: title },
				text: search
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
						),
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
