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
 *   `{ name, path, search }`, offered under the picker.
 * - `chip` and `done`: how a pick reads once kept, where its picker was and
 *   in the reply confirming it.
 * - `hasFooter( params )`: whether the picker has that button, when that
 *   depends on the request.
 * - `savesOnPick`: each pick is saved as it is made, with no button to keep
 *   it. The picker stays open to swap it, with Undo and Done under it.
 * - `commit` and `undo`: for skills that don't edit a record in place.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * because the chat is mounted from app init. See `src/editor-layer/index.jsx`.
 */

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { cloneBlock } from '@wordpress/blocks';
import { Button } from '@wordpress/components';
import { store as coreDataStore } from '@wordpress/core-data';
import {
	dispatch,
	resolveSelect,
	select as selectFromRegistry,
	useDispatch,
	useSelect,
} from '@wordpress/data';
import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	home as homeIcon,
	layout as layoutIcon,
	page as pageIcon,
} from '@wordpress/icons';
import { Icon, InputControl, Spinner, Text } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { StartFromScratch } from '../design-picker';
import { getEditedEntityRecords } from '../edited-records';
import { SiteIdentityFields } from '../pickers/identity';
import { PageLayoutCard, usePageLayoutPatterns } from '../pickers/page-designs';
import {
	getColorChoices,
	getColorOffer,
	getColorUpdate,
	SectionColorSwatches,
	SectionLayouts,
	useSectionVariations,
} from '../pickers/section-design';
import { SitePartLayouts } from '../pickers/site-part-layouts';
import { FontPicker, LookPicker, PalettePicker } from '../pickers/styles';
import {
	getPatternContent,
	getPatternTitle,
} from '../routes/content/page-layouts';
import { GlobalScope } from '../global-scope';
import { getSectionArrangements } from '../layouts/variants';
import { getSectionTitle } from '../routes/content/pages/page-sections';
import { MODE_COMPOSE, setCanvasMode } from '../site-canvas/mode';
import {
	SectionDesignCard,
	getPatternSectionBlocks,
	searchSectionDesigns,
	useSectionDesigns,
} from '../section-picker';
import { getStartPlaces } from '../start-places';
import { Carousel } from './carousel';
import { cancelPending } from './conversation';
import { getBlocksEdit } from './entity-changes';
import { mentionsSectionLayout } from './engine';
import {
	PAGES_QUERY,
	findNamedPage,
	findTargetPage,
	toPages,
} from './target-page';
import {
	getSectionIds,
	getSelectedSection,
	isEditingPage,
} from './target-section';
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
		<GlobalScope>
			<Carousel label={ __( 'Layouts' ) }>
				<SitePartLayouts
					area={ message.params.area }
					id={ entity[ 2 ] }
					onPick={ onPick }
					Preview={ Preview }
				/>
			</Carousel>
		</GlobalScope>
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
 * a "Contact" page leads with contact designs. The picker's own button goes
 * on to the designs, as `onStep` sets it.
 */
function PageNameStep( { onContinue, onStep, title, setTitle } ) {
	const canContinue = !! title.trim();

	useEffect( () => {
		onStep( {
			disabled: ! canContinue,
			label: __( 'Show designs' ),
			onClick: onContinue,
		} );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ canContinue, title ] );

	return (
		<form
			className="cnl-chat-widget__stack"
			onSubmit={ ( event ) => {
				event.preventDefault();

				if ( canContinue ) {
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
		</form>
	);
}

function PageWidget( { message, onPick, onStep } ) {
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
				onStep={ onStep }
				onContinue={ () => {
					onStep( null );
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
				<Button
					onClick={ () => {
						/*
						 * Renaming starts the steps again: a design suited to
						 * the new name is picked after it, not kept from before.
						 */
						cancelPending();
						setChoice( undefined );
						setIsNaming( true );
					} }
					variant="link"
				>
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
			records: getEditedEntityRecords( store, ...args ),
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
		// Each pick saves, so nothing more can be picked while one does.
		if ( message.saveState === 'saving' ) {
			return;
		}

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

/**
 * The section style a request names, like "brand" in "make this section
 * brand", among a section's colours.
 *
 * @param {string}   request What was asked.
 * @param {Object[]} options The section's colours.
 * @return {?Object} The colour, or null.
 */
function findNamedColor( request, options ) {
	const text = ( request || '' ).toLowerCase();

	return (
		options.find(
			( option ) =>
				option.name &&
				new RegExp(
					`(^|[^\\p{L}\\p{N}])${ option.label
						.toLowerCase()
						.replace(
							/[.*+?^${}()|[\]\\]/g,
							'\\$&'
						) }($|[^\\p{L}\\p{N}])`,
					'u'
				).test( text )
		) || null
	);
}

/**
 * What a request about a section shows: its colours, its layouts, or both,
 * as far as the section has them. Naming one of its colours, and nothing
 * about layout, is about colour.
 *
 * @param {Object}    params       The request's params.
 * @param {?Object[]} colorOptions The section's colours, `{ label, name }`,
 *                                 or nothing when it has none.
 * @param {boolean}   hasLayouts   Whether it can be laid out another way.
 * @return {Object} `{ focus, showColors, showLayouts }`, `focus` being
 *                  `color`, `layout` or `both`.
 */
function getSectionOffer( params, colorOptions, hasLayouts ) {
	let focus = params.focus || 'both';

	if (
		focus === 'both' &&
		colorOptions?.length &&
		findNamedColor( params.request, colorOptions ) &&
		! mentionsSectionLayout( params.request )
	) {
		focus = 'color';
	}

	return {
		focus,
		showColors: focus !== 'layout' && !! colorOptions?.length,
		showLayouts: focus !== 'color' && hasLayouts,
	};
}

/**
 * What the chat says over a section's layouts and colours.
 *
 * @param {Object} offer From `getSectionOffer`.
 * @param {string} title The section's name.
 * @return {string} The reply.
 */
function getSectionOfferText( offer, title ) {
	if ( offer.showLayouts && offer.showColors ) {
		return sprintf(
			/* translators: %s: section name. */
			__(
				'Here are the layouts and colors for “%s”. Pick either, or both, and you’ll see them on your page as you go.'
			),
			title
		);
	}

	if ( offer.showColors ) {
		return sprintf(
			/* translators: %s: section name. */
			__(
				'Here are the colors your theme has for “%s”. Pick one and you’ll see it on your page straight away.'
			),
			title
		);
	}

	if ( offer.showLayouts ) {
		return sprintf(
			/* translators: %s: section name. */
			__(
				'Here are the other ways “%s” can be laid out, keeping what’s in it. Pick one to try it.'
			),
			title
		);
	}

	return getNothingOfferedText( offer.focus, title );
}

/**
 * What the chat says when a section has nothing of what was asked for.
 *
 * @param {string} focus `color`, `layout` or `both`.
 * @param {string} title The section's name.
 * @return {string} The reply.
 */
function getNothingOfferedText( focus, title ) {
	if ( focus === 'color' ) {
		return __(
			'Your theme doesn’t offer any colors for sections. Compose has other ways to change it.'
		);
	}

	if ( focus === 'layout' ) {
		return sprintf(
			/* translators: %s: section name. */
			__(
				'“%s” can’t be laid out another way without changing what’s in it. Compose has other ways to change it.'
			),
			title
		);
	}

	return sprintf(
		/* translators: %s: section name. */
		__(
			'There’s nothing about “%s” I can change here yet. Compose has other ways to change it.'
		),
		title
	);
}

/**
 * How a section's pick reads: its layout, its colours, or both.
 *
 * @param {Object} payload `{ color, layout }`, each `{ label }` if picked.
 * @return {string} The pick, in a few words.
 */
function getSectionPickLabel( payload ) {
	return [ payload.layout?.label, payload.color?.label ]
		.filter( Boolean )
		.join( ' · ' );
}

/*
 * Which section to change, asked when none is selected. Picking one on the
 * page answers too.
 */
function SectionChooser( { onChoose, sectionIds } ) {
	const blocks = useSelect(
		( select ) =>
			select( blockEditorStore ).getBlocksByClientId( sectionIds ),
		[ sectionIds ]
	);

	if ( ! sectionIds.length ) {
		return (
			<Text className="routes-styles__muted" variant="body-md">
				{ __( 'This page doesn’t have any sections yet.' ) }
			</Text>
		);
	}

	return (
		<ul className="cnl-chat-choices" role="list">
			{ sectionIds.map( ( clientId, index ) => (
				<li key={ clientId }>
					<button
						className="cnl-chat-choices__item"
						onClick={ () => onChoose( clientId ) }
						type="button"
					>
						<Icon icon={ layoutIcon } size={ 20 } />
						<span className="cnl-chat-choices__label">
							{ blocks[ index ]
								? getSectionTitle( blocks[ index ] )
								: __( 'Section' ) }
						</span>
					</button>
				</li>
			) ) }
		</ul>
	);
}

function SectionDesignPicker( { message, onPick } ) {
	const Preview = useLazyPreview();
	const { replaceBlock, selectBlock, updateBlockAttributes } =
		useDispatch( blockEditorStore );
	const { params } = message;
	const [ chosen, setChosen ] = useState( () =>
		params.sectionId
			? { clientId: params.sectionId, index: params.sectionIndex }
			: null
	);
	const { isReady, sectionIds, selectedId } = useSelect(
		( select ) => ( {
			isReady: isEditingPage( select, params.pageId ),
			sectionIds: getSectionIds( select ),
			selectedId: getSelectedSection( select, params.pageId ),
		} ),
		[ params.pageId ]
	);

	/*
	 * The section stays the one chosen. Its blocks can be swapped from under
	 * it, by a new layout or by a pick being put back, so where it was on the
	 * page finds it again.
	 */
	const clientId =
		( chosen &&
			( sectionIds.includes( chosen.clientId )
				? chosen.clientId
				: sectionIds[ chosen.index ] ) ) ||
		null;
	const { block, colors, layouts } = useSectionVariations( clientId );
	const titleRef = useRef();

	if ( block && ! titleRef.current ) {
		titleRef.current = getSectionTitle( block );
	}

	const choose = ( id ) =>
		setChosen( { clientId: id, index: sectionIds.indexOf( id ) } );

	// Picked on the page while the chat asks which.
	useEffect( () => {
		if ( ! chosen && selectedId ) {
			choose( selectedId );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ chosen, selectedId ] );

	const { focus, showColors, showLayouts } = getSectionOffer(
		params,
		colors?.options,
		!! layouts
	);

	const pickSection = ( patch ) => {
		const payload = {
			...message.pickedPayload,
			title: titleRef.current,
			...patch,
		};

		onPick( getSectionPickLabel( payload ), payload );
	};

	const pickColor = ( option ) => {
		updateBlockAttributes(
			clientId,
			getColorUpdate( block, colors.options, option.name )
		);
		pickSection( { color: { label: option.label, name: option.name } } );
	};

	const pickLayout = ( option ) => {
		const next = cloneBlock( option.block );

		replaceBlock( clientId, next );
		// Picked again, as it was, without taking the chat's focus.
		selectBlock( next.clientId, null );
		setChosen( { clientId: next.clientId, index: chosen.index } );
		pickSection( { layout: { label: option.label, name: option.name } } );
	};

	// A colour named in the request goes straight on, once.
	const hasNamedColorRef = useRef( false );
	useEffect( () => {
		if ( hasNamedColorRef.current || ! colors || focus === 'layout' ) {
			return;
		}

		hasNamedColorRef.current = true;
		const named = findNamedColor( params.request, colors.options );

		if ( named && named.name !== colors.current ) {
			pickColor( named );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ colors ] );

	if ( ! isReady ) {
		return <Loading />;
	}

	if ( ! chosen ) {
		return (
			<SectionChooser
				onChoose={ ( id ) => {
					// Picks it on the page too, as clicking it there does.
					selectBlock( id, null );
					choose( id );
				} }
				sectionIds={ sectionIds }
			/>
		);
	}

	if ( ! block ) {
		return <Loading />;
	}

	const title = titleRef.current;
	const note =
		! showLayouts && ! showColors
			? getNothingOfferedText( focus, title )
			: null;

	return (
		<div className="cnl-chat-widget__stack">
			<Text variant="body-md">
				{ sprintf(
					/* translators: %s: section name. */
					__( 'Changing “%s”' ),
					title
				) }
			</Text>
			{ showLayouts && (
				<div className="cnl-section-design__group">
					{ showColors && (
						<Text
							className="cnl-section-design__heading"
							variant="body-sm"
						>
							{ __( 'Layout' ) }
						</Text>
					) }
					<Carousel label={ __( 'Layouts' ) }>
						<SectionLayouts
							layouts={ layouts }
							onSelect={ pickLayout }
							Preview={ Preview }
						/>
					</Carousel>
				</div>
			) }
			{ showColors && (
				<div className="cnl-section-design__group">
					{ showLayouts && (
						<Text
							className="cnl-section-design__heading"
							variant="body-sm"
						>
							{ __( 'Colors' ) }
						</Text>
					) }
					<SectionColorSwatches
						colors={ colors }
						onSelect={ pickColor }
					/>
				</div>
			) }
			{ note && (
				<Text className="routes-styles__muted" variant="body-md">
					{ note }
				</Text>
			) }
		</div>
	);
}

function SectionDesignWidget( { entity, message, onChoosePage, onPick } ) {
	if ( message.params?.choosePage ) {
		return <PageChooser onChoose={ onChoosePage } />;
	}

	if ( ! entity ) {
		return null;
	}

	return <SectionDesignPicker message={ message } onPick={ onPick } />;
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
					'Here are some %1$s sections you could add to “%2$s”. Pick one and I’ll add it to the bottom of the page.'
				),
				search,
				title
			)
		: sprintf(
				/* translators: %s: page name. */
				__(
					'Here are some sections you could add to “%s”. Pick one and I’ll add it to the bottom of the page.'
				),
				title
			);
}

/**
 * What the chat says over a section's layouts and colours, and what its
 * picker needs: the section selected on the page, or none, to ask which.
 * Asking which shows Compose, where a section can be picked.
 *
 * @param {Object} params       The request's params.
 * @param {string} params.focus What it is about: `color`, `layout` or `both`.
 * @param {Object} page         `{ id, title }`, the page the section is on.
 * @param {string} request      What was asked.
 * @return {Object} `{ params, text }`.
 */
function getSectionDesignReply( { focus = 'both' }, page, request ) {
	const sectionId = getSelectedSection( selectFromRegistry, page.id );
	const base = {
		focus,
		pageId: page.id,
		pageTitle: page.title,
		request,
	};

	if ( ! sectionId ) {
		setCanvasMode( MODE_COMPOSE );

		return {
			params: base,
			text: __(
				'Which section would you like to change? Pick it here, or click it on your page.'
			),
		};
	}

	const block = selectFromRegistry( blockEditorStore ).getBlock( sectionId );
	const title = getSectionTitle( block );
	const colorOptions =
		getColorOffer(
			[ block ],
			getColorChoices( selectFromRegistry, block.name )
		)?.options || [];
	const offer = getSectionOffer(
		base,
		colorOptions,
		!! getSectionArrangements( block )
	);
	const named = offer.showColors && findNamedColor( request, colorOptions );
	const params = {
		...base,
		sectionId,
		sectionIndex: getSectionIds().indexOf( sectionId ),
	};

	if ( ! offer.showColors && ! offer.showLayouts ) {
		return {
			params,
			text: getSectionOfferText( offer, title ),
			widget: false,
		};
	}

	if ( named ) {
		return {
			params,
			text: sprintf(
				/* translators: 1: section name, 2: section colors name. */
				__(
					'I’ve given “%1$s” the “%2$s” colors, so you can see them on your page now. Pick another if you’d like.'
				),
				title,
				named.label
			),
		};
	}

	const text = getSectionOfferText( offer, title );

	return { params, text };
}

/**
 * What the chat says once a section's pick is kept.
 *
 * @param {Object} payload `{ color, layout, title }`.
 * @return {string} The reply.
 */
function getSectionDesignDone( payload ) {
	const { color, layout, title } = payload;

	if ( layout && color ) {
		return sprintf(
			/* translators: 1: section name, 2: layout name, 3: section colors name. */
			__( 'Done. “%1$s” now uses “%2$s” with the “%3$s” colors.' ),
			title,
			layout.label,
			color.label
		);
	}

	if ( layout ) {
		return sprintf(
			/* translators: 1: section name, 2: layout name. */
			__( 'Done. “%1$s” now uses “%2$s”.' ),
			title,
			layout.label
		);
	}

	return color?.name
		? sprintf(
				/* translators: 1: section name, 2: section colors name. */
				__( 'Done. “%1$s” now has the “%2$s” colors.' ),
				title,
				color.label
			)
		: sprintf(
				/* translators: %s: section name. */
				__( 'Done. “%s” now takes its colors from the page.' ),
				title
			);
}

/**
 * The page a request about a section is about: one it names, or the one
 * being worked on, shown on the canvas. Waits for the pages to load.
 *
 * @param {string} text The request.
 * @return {Promise<?Object>} `{ id, title }`, or null when there is none.
 */
async function findRequestedPage( text ) {
	await Promise.all( [
		resolveSelect( coreDataStore ).getEntityRecords(
			'postType',
			'page',
			PAGES_QUERY
		),
		resolveSelect( coreDataStore ).getEntityRecord( 'root', 'site' ),
	] );

	const named = findNamedPage( text );
	const current = findTargetPage();

	// Show the page named on the canvas, to see the change.
	if ( named && named.id !== current?.id ) {
		openRoute( '/types/page/list/all', { previewId: named.id } );
	}

	return named || current;
}

// What to ask for in each place to start.
const PLACE_SUGGESTIONS = {
	home: [
		{ text: __( 'Add a section to my homepage' ), icon: 'section' },
		{ text: __( 'Change a section on my homepage' ), icon: 'layout' },
	],
	pages: [
		{ text: __( 'Add a page' ), icon: 'page' },
		{ text: __( 'Change my menu' ), icon: 'navigation' },
	],
	identity: [
		{ text: __( 'Change site title' ), icon: 'siteTitle' },
		{
			text: () =>
				hasSavedLogo() ? __( 'Change site logo' ) : __( 'Add a logo' ),
			icon: 'siteLogo',
		},
	],
	style: [
		{ text: __( 'Try a new look' ), icon: 'styles' },
		{ text: __( 'Change my colors' ), icon: 'color' },
		{ text: __( 'Pick new fonts' ), icon: 'typography' },
	],
	siteParts: [
		{ text: __( 'Change my header' ), icon: 'header' },
		{ text: __( 'Change my footer' ), icon: 'footer' },
	],
};

/*
 * What to ask for, grouped into the same places to start as "Your site"
 * offers, so the first thing seen is a short, familiar list. A group with
 * one thing in it is that thing.
 */
export const SUGGESTION_GROUPS = getStartPlaces()
	// The chat can't help with the shop yet.
	.filter( ( place ) => PLACE_SUGGESTIONS[ place.id ] )
	.map( ( place ) => ( {
		...place,
		suggestions: PLACE_SUGGESTIONS[ place.id ],
	} ) );

// What to ask for about the page being worked on, when there is one.
export const PAGE_SUGGESTIONS = [
	{ text: __( 'Add a section' ), icon: 'section' },
	{
		text: () =>
			getSelectedSection( selectFromRegistry, findTargetPage()?.id )
				? __( 'Change this section' )
				: __( 'Change a section' ),
		icon: 'layout',
	},
];

export const SKILLS = {
	look: {
		screen: () => ( { name: __( 'Design' ), path: '/design' } ),
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
		done: ( { label } ) =>
			/* translators: %s: look name. */
			sprintf( __( 'Done. Your site now has the “%s” look.' ), label ),
	},
	colors: {
		screen: () => ( {
			name: __( 'Colors' ),
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
		done: ( { label } ) =>
			/* translators: %s: palette name. */
			sprintf( __( 'Done. Your site now uses the “%s” colors.' ), label ),
	},
	fonts: {
		screen: () => ( {
			name: __( 'Fonts' ),
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
		done: ( { label } ) =>
			/* translators: %s: font pairing name. */
			sprintf( __( 'Done. Your site now uses the “%s” fonts.' ), label ),
	},
	'site-title': {
		action: () => __( 'Save site title' ),
		keys: [ 'title' ],
		useEntity: useSiteEntity,
		screen: () => ( {
			name: __( 'Name & logo' ),
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
			name: __( 'Name & logo' ),
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
		done: ( { payload } ) =>
			payload.logoId
				? __( 'Done. Your logo is on your site.' )
				: __( 'Done. I’ve taken your logo off your site.' ),
	},
	header: {
		screen: () => ( {
			name: __( 'Header' ),
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
				'Here are the header layouts your theme comes with. Your header is on every page, so a new layout changes all of them. Pick one to try it.'
			),
		} ),
		Widget: SitePartWidget,
		chip: ( { label } ) =>
			/* translators: %s: layout name. */
			sprintf( __( 'Header: %s' ), label ),
		done: ( { label } ) =>
			sprintf(
				/* translators: %s: layout name. */
				__( 'Done. Your header now uses “%s” on every page.' ),
				label
			),
	},
	footer: {
		screen: () => ( {
			name: __( 'Footer' ),
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
				'Here are the footer layouts your theme comes with. Your footer is on every page, so a new layout changes all of them. Pick one to try it.'
			),
		} ),
		Widget: SitePartWidget,
		chip: ( { label } ) =>
			/* translators: %s: layout name. */
			sprintf( __( 'Footer: %s' ), label ),
		done: ( { label } ) =>
			sprintf(
				/* translators: %s: layout name. */
				__( 'Done. Your footer now uses “%s” on every page.' ),
				label
			),
	},
	'add-page': {
		screen: () => ( {
			name: __( 'Pages' ),
			path: '/types/page/list/all',
		} ),
		action: () => __( 'Create page' ),
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
						name: __( 'Pages' ),
						path: '/types/page/list/all',
						search: {
							postId: params.pageId,
							previewId: params.pageId,
						},
					}
				: null,
		hasFooter: ( { choosePage } ) => ! choosePage,
		// Picking a section adds it: a button to keep it went unnoticed.
		savesOnPick: true,
		keys: [ 'blocks', 'content' ],
		hasBlocks: true,
		useEntity: useTargetPageEntity,
		// Asking which page comes before any page is changed.
		needsRecord: ( { choosePage } ) => ! choosePage,
		async reply( { search }, text ) {
			const page = await findRequestedPage( text );

			if ( ! page ) {
				return {
					params: { choosePage: true },
					text: __( 'Which page should the section go on?' ),
				};
			}

			return SKILLS[ 'add-section' ].replyForPage( { search }, page );
		},
		replyForPage: ( { search }, page ) => ( {
			params: { pageId: page.id, pageTitle: page.title, search },
			text: getSectionsReply( search, page.title ),
		} ),
		Widget: SectionWidget,
		chip: ( { label } ) =>
			/* translators: %s: section design name. */
			sprintf( __( 'Section: %s' ), label ),
		done: ( { label }, message ) =>
			sprintf(
				/* translators: 1: section design name, 2: page name. */
				__( 'Done. I’ve added “%1$s” to “%2$s”.' ),
				label,
				message.params.pageTitle
			),
	},
	'section-design': {
		screen: ( { params } ) =>
			params?.pageId
				? {
						canvasMode: MODE_COMPOSE,
						name: __( 'Compose' ),
						path: '/types/page/list/all',
						search: { previewId: params.pageId },
					}
				: null,
		action: () => __( 'Use this design' ),
		hasFooter: ( { choosePage } ) => ! choosePage,
		keys: [ 'blocks', 'content' ],
		hasBlocks: true,
		useEntity: useTargetPageEntity,
		// Asking which page comes before any page is changed.
		needsRecord: ( { choosePage } ) => ! choosePage,
		async reply( params, text ) {
			const page = await findRequestedPage( text );

			if ( ! page ) {
				return {
					params: { choosePage: true, request: text },
					text: __( 'Which page is the section on?' ),
				};
			}

			return getSectionDesignReply( params, page, text );
		},
		replyForPage: ( params, page ) =>
			getSectionDesignReply( params, page, params.request ),
		Widget: SectionDesignWidget,
		chip: ( { label, payload } ) =>
			sprintf(
				/* translators: 1: section name, 2: what was picked. */
				__( 'Section: %1$s · %2$s' ),
				payload.title,
				label
			),
		done: ( { payload } ) => getSectionDesignDone( payload ),
	},
	menu: {
		screen: ( { entity } ) => ( {
			name: __( 'Menus' ),
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
		done: () => __( 'Done. Your menu is saved.' ),
	},
	exit: {
		reply: () => ( {
			actions: [ 'close-assistant', 'stay' ],
			text: __(
				'Close the assistant and go back to My site? Anything you haven’t kept will be put back.'
			),
		} ),
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
