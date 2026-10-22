/**
 * Edit's section layer. Pointing at a section outlines and names it, lays a
 * light tint over it, and shows a bar of controls: Add, the two ways to
 * edit it, and its moves. Nothing on the page can be clicked until one of
 * those is picked, and only one section is in a mode at a time.
 *
 * - Edit design turns the bar into the section's design choices, Layout,
 *   Colour, Width and More control, each drilled into in the same bar, and
 *   applied as soon as it is picked. More control is Freeform: core's own
 *   unlock, for core's full block tools, left with Done as Edit content is.
 * - Edit content lets clicks through to the section, so its words and
 *   pictures can be changed with core's own tools, and lays nothing over
 *   it.
 *
 * A double click on a section opens it in Edit content, with the caret
 * where the click landed. Escape, or a click anywhere else, leaves Edit
 * design, its changes kept, the section staying picked; so do Done in Edit
 * content and Freeform. In Edit design, Escape steps back from a design
 * choice to the choices first.
 *
 * Compose uses the same layer over the editor zoomed out. Sections are
 * dragged there to reorder them, and their layouts, colours and place on
 * the page change without leaving. Anything else goes back to Edit to do it.
 *
 * Drawn inside the editor's content region, as core's own toolbars are, so
 * it sits under core's block toolbars. Changes go to the editor's blocks, so
 * they are undone like any other edit.
 */

/**
 * WordPress dependencies
 */
import { BlockPreview } from '@wordpress/block-editor';
import { createPortal, Fragment } from '@wordpress/element';
import { plus as plusIcon } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { observeHost } from '../../editor-layer/portal-host';
import { GLOBAL_CANVAS_CSS, GlobalScope } from '../../global-scope';
import {
	addPatternSection,
	EditorPreview,
	openSectionPicker,
} from '../../editor-layer/section-picker';
import { unlock } from '../../lock-unlock';
import { getSectionTitle } from '../../routes/content/pages/page-sections';
import {
	__,
	blockEditorStore,
	Button,
	coreDataStore,
	MediaUpload,
	noticesStore,
	sprintf,
	useCallback,
	useDispatch,
	useEffect,
	useMemo,
	useRef,
	useRegistry,
	useSelect,
	useState,
} from '../../wordpress-packages';
import {
	getCanvasFrame,
	scrollCanvasTo,
	useBlockRects,
} from '../compose/use-block-rects';
import { useComposeStructure } from '../compose/use-compose-structure';
import { afterZoomIn } from '../compose/use-compose-zoom';
import {
	PART_CONTENT,
	PART_FREEFORM,
	setOpenPart,
	setPickedSection as setSharedPickedSection,
} from '../mode';
import { useEditorSpotlight } from '../part-spotlight';
import { useCanvasDocument } from '../use-canvas-document';
import { useCanvasStyles } from '../use-canvas-styles';
import { createBlankSection, InlineSectionPicker } from '../../section-picker';
import { EmptyPage } from './empty-page';
import { RemoveControl } from './remove-control';
import DesignBar, { MAX_PER_SLIDE } from './design-bar';
import {
	getSitewideText,
	HoverBar,
	MODE_CONTENT,
	MODE_FREEFORM,
	MODE_DESIGN,
	ModeBar,
	SectionTab,
} from './section-chrome';
import {
	getTargetOf,
	useCanvasGuard,
	useCanvasHover,
} from './use-canvas-events';
import { useSectionDrag } from './use-section-drag';
import { useSectionItems } from './use-section-items';

const CONTENT_REGION = '.interface-interface-skeleton__content';

const STYLE_ID = 'cnl-section-modes';
const GLOBAL_STYLE_ID = 'cnl-section-modes-global';

// Sizes on screen, in pixels.
const INSET = 12;
const BAR_HEIGHT = 40;
// Narrower than this, the bar puts the three modes on a row of their own.
const NARROW_WIDTH = 760;
const BAR_ROW_GAP = 8;
// Room either side of the "Add section" button, at the middle of the top
// edge, that the section's name in its tab keeps clear of.
const ADD_SECTION_CLEARANCE = 90;
// The bar naming the mode sits inside a section at least this big, at its
// top, the size of the bar over a section pointed at; a smaller section has
// a smaller one outside it, so it hides none of what is being edited.
const MODE_BAR_ROOM_HEIGHT = 240;
const MODE_BAR_ROOM_WIDTH = 480;
const SMALL_MODE_BAR_HEIGHT = 40;
// Between the small bar and the section's edge.
const MODE_BAR_GAP = 6;
const TAB_HEIGHT = 24;
// Edit design's bar is never narrower than this, even on a narrow section.
const DESIGN_BAR_MIN_WIDTH = 360;
// Edit design's bar is never shorter than this, scrolling its tray rather
// than running off the canvas.
const DESIGN_BAR_MIN_HEIGHT = 200;
// Between a section and what is placed against it, outside.
const PLACE_GAP = 8;
// A layout card and the gap after it, and the tray's room around its cards
// for its padding and the carousel's arrows.
const LAYOUT_CARD_WIDTH = 144;
const TRAY_CHROME_WIDTH = 132;
// Room kept for the placeholder on an empty page.
const EMPTY_SPACE = 320;
// The gap opened for adding a section in place: room around its picker,
// and the picker's height until it is measured.
const INLINE_ADD_GAP = 16;
const INLINE_ADD_HEIGHT = 520;
// The picker's narrowest, wider than a zoomed-out section if need be.
const INLINE_ADD_MIN_WIDTH = 560;
// How long its gap takes to open, before it is scrolled into view.
const INLINE_ADD_SETTLE_MS = 260;
// How long a new block is kept focused while it settles, in frames.
const FOCUS_FRAMES = 30;

// How long a new item is highlighted.
const FRESH_MS = 900;

const EMPTY_ARRAY = [];

/*
 * Section titles, by block. Working one out walks the whole section, and the
 * layer asks for several on every render. The editor's blocks are replaced,
 * never changed, when they're edited, so a block's title stays right for as
 * long as the block is around.
 */
const sectionTitles = new WeakMap();

function getCachedSectionTitle( block ) {
	if ( ! sectionTitles.has( block ) ) {
		sectionTitles.set( block, getSectionTitle( block ) );
	}

	return sectionTitles.get( block );
}

/**
 * Position a box relative to the canvas it is clipped to.
 *
 * @param {Object} rect  `{ top, left, width, height }` on the layer.
 * @param {Object} frame The canvas's own rect on the layer.
 * @return {Object} `{ top, left, width, height }` on the canvas.
 */
function local( rect, frame ) {
	return {
		height: rect.height,
		left: rect.left - frame.left,
		top: rect.top - frame.top,
		width: rect.width,
	};
}

/**
 * Where a section's name goes, in a tab against its outline: over its top
 * edge, or inside it while there is no room above it on the canvas. The
 * section at the very top of the page, usually the header, has nothing above
 * it to sit on, so its tab hangs under its bottom edge instead, clear of what
 * is in it.
 *
 * @param {Object}  box          The section, on the canvas.
 * @param {boolean} isPageTop    Whether it is at the very top of the page.
 * @param {number}  canvasHeight The canvas's height.
 * @return {Object} `{ isBelow, isInside, style }` for `SectionTab`.
 */
function placeTab( box, isPageTop, canvasHeight ) {
	const bottom = box.top + box.height;
	const isBelow = isPageTop && bottom + TAB_HEIGHT <= canvasHeight;
	const isInside = ! isBelow && box.top < TAB_HEIGHT;
	let top = box.top - TAB_HEIGHT;

	if ( isBelow ) {
		top = bottom;
	} else if ( isInside ) {
		top = box.top;
	}

	return {
		isBelow,
		isInside,
		style: {
			left: box.left,
			maxWidth: box.width / 2 - ADD_SECTION_CLEARANCE,
			top,
		},
	};
}

/**
 * Whether a block starts or ends the page: first, or last, among its
 * siblings, and its parents among theirs, all the way up.
 *
 * @param {Function} select   The data registry's `select`.
 * @param {string}   clientId The block.
 * @param {boolean}  isEnd    Whether to check for the end of the page.
 * @return {boolean} Whether it does.
 */
function isAtPageEdge( select, clientId, isEnd ) {
	const { getBlockOrder, getBlockRootClientId } = select( blockEditorStore );
	let id = clientId;

	while ( id ) {
		const parentId = getBlockRootClientId( id );
		const siblings = getBlockOrder( parentId || '' );

		if ( siblings[ isEnd ? siblings.length - 1 : 0 ] !== id ) {
			return false;
		}

		id = parentId;
	}

	return true;
}

/**
 * Where something stuck to the top of a section sits: at its top, or at the
 * top of the canvas while the section's top is scrolled out of view, but
 * never past its bottom.
 *
 * @param {Object} box    The section, on the canvas.
 * @param {number} height The height of what is stuck.
 * @param {number} inset  Its gap from the edges.
 * @return {number} Its top, on the canvas.
 */
function stickyTop( box, height, inset = INSET ) {
	return Math.max(
		box.top + inset,
		Math.min(
			Math.max( box.top, 0 ) + inset,
			box.top + box.height - height - inset
		)
	);
}

/**
 * Where a bar inside a section goes: at its top while that is in view, else
 * at its bottom, kept in view while the section runs past the canvas's
 * bottom, but never past its top.
 *
 * @param {Object} box          The section, on the canvas.
 * @param {number} height       The bar's height.
 * @param {number} canvasHeight The canvas's height.
 * @return {number} Its top, on the canvas.
 */
function placeAtEdge( box, height, canvasHeight ) {
	const top = box.top + INSET;

	if ( top >= 0 && top + height <= canvasHeight - INSET ) {
		return top;
	}

	return Math.max(
		top,
		Math.min( box.top + box.height, canvasHeight ) - height - INSET
	);
}

/**
 * Where something placed against a section goes, outside it so the section
 * stays in view: under its bottom edge if it fits on the canvas there, else
 * over its top edge if it fits there, else wherever on the canvas it is
 * nearest to under the section, overlapping it rather than leaving view.
 *
 * @param {Object}  box          The section, on the canvas.
 * @param {number}  height       What is placed's height.
 * @param {number}  canvasHeight The canvas's height.
 * @param {boolean} isBelow      Whether it always goes under, as for the
 *                               header, at the canvas's top.
 * @return {number} Its top, on the canvas.
 */
function placeOutside( box, height, canvasHeight, isBelow = false ) {
	const below = box.top + box.height + PLACE_GAP;
	const above = box.top - height - PLACE_GAP;

	if ( isBelow || below + height <= canvasHeight - INSET ) {
		return below;
	}

	if ( above >= INSET ) {
		return above;
	}

	return Math.max( INSET, Math.min( below, canvasHeight - height - INSET ) );
}

/**
 * How many layouts a slide of Edit design's carousel holds on a canvas this
 * wide: as many cards as fit beside its arrows, up to the most it takes.
 *
 * @param {number} canvasWidth The canvas's width.
 * @return {number} Layouts a slide.
 */
function getLayoutsPerSlide( canvasWidth ) {
	return Math.max(
		1,
		Math.min(
			MAX_PER_SLIDE,
			Math.floor(
				( canvasWidth - TRAY_CHROME_WIDTH ) / LAYOUT_CARD_WIDTH
			)
		)
	);
}

/**
 * The innermost block at a point on the canvas. Zoomed out, core stops the
 * pointer inside each section, so the section is what the point hits, and
 * the block within it is found by where its blocks are drawn: in document
 * order a block comes after those around it, so the last to hold the point
 * is the innermost.
 *
 * @param {Document} doc The canvas.
 * @param {number}   x   Across the canvas, in pixels.
 * @param {number}   y   Down the canvas, in pixels.
 * @return {?string} The block's client ID.
 */
function getBlockAtPoint( doc, x, y ) {
	const hit = doc.elementFromPoint( x, y )?.closest( '[data-block]' );

	if ( ! hit ) {
		return null;
	}

	let block = hit;

	hit.querySelectorAll( '[data-block]' ).forEach( ( node ) => {
		const rect = node.getBoundingClientRect();

		if (
			x >= rect.left &&
			x <= rect.right &&
			y >= rect.top &&
			y <= rect.bottom
		) {
			block = node;
		}
	} );

	return block.dataset.block;
}

/**
 * The blocks beside a section, and beside each block around it: the rest of
 * the page, without what holds the section.
 *
 * @param {Function} select   The data registry's `select`.
 * @param {string}   clientId The section.
 * @return {string[]} Their client IDs.
 */
function getBlocksBeside( select, clientId ) {
	const { getBlockOrder, getBlockParents, getBlockRootClientId } =
		select( blockEditorStore );

	return [ ...getBlockParents( clientId ), clientId ].flatMap( ( id ) =>
		getBlockOrder( getBlockRootClientId( id ) || '' ).filter(
			( other ) => other !== id
		)
	);
}

/**
 * Styles the layer adds to the canvas: no text cursor, hover outline or
 * block name outside the section being edited in place, none of core's
 * outline around the page's content as a whole, room for the placeholder on
 * an empty page, the rest of the page faded around a section core has
 * opened, and, composing, a hand to grab sections with.
 *
 * @param {?string}  openId       The section whose blocks can be clicked.
 * @param {?string}  rootClientId The sections' parent.
 * @param {boolean}  isEmpty      Whether the page has nothing in it.
 * @param {?string}  compose      While composing, `grab`, or `dragging` while
 *                                a section is dragged.
 * @param {string[]} fadedIds     The blocks faded around a section core has
 *                                opened.
 * @param {?Object}  gap          The gap opened for adding a section in
 *                                place: `{ clientId, isAfter, height }`, the
 *                                section it opens before, or after at the
 *                                page's end, and its height on screen.
 * @return {string} CSS.
 */
function getCanvasCss( openId, rootClientId, isEmpty, compose, fadedIds, gap ) {
	const outside = openId
		? `:not(#block-${ openId }):not(#block-${ openId } *)`
		: '';
	const sections = rootClientId
		? `#block-${ rootClientId } > .block-editor-block-list__block`
		: null;

	return [
		`.is-root-container *${ outside } { cursor: default !important; }`,
		`.is-root-container .block-editor-block-list__block${ outside }.is-hovered::after { display: none !important; }`,
		// The block names shown on hover, from `block-canvas-styles.php`.
		`.is-root-container .block-editor-block-list__block${ outside }:hover::before { content: none !important; }`,
		rootClientId &&
			`#block-${ rootClientId }.is-hovered::after { display: none !important; }`,
		// An empty page keeps room for its placeholder, in place of core's
		// prompt to type, the only thing core draws there.
		rootClientId &&
			isEmpty &&
			`#block-${ rootClientId } { min-height: ${ EMPTY_SPACE }px !important; }
			#block-${ rootClientId } > * { visibility: hidden !important; }`,
		/*
		 * Core fades the page around a section it has opened, but expects
		 * the section selected, and fades it too until something in it is.
		 * The layer never selects a section's own block, so the fade is
		 * drawn here instead, as core leaves it once something in the
		 * section is selected: the section and what holds it clear, the rest
		 * of the page faded. The selectors are kept light, so a canvas's own
		 * spotlight, like the Header screen's, still fades the page its own
		 * way.
		 */
		fadedIds.length > 0 &&
			`:where(.is-focus-mode) .block-editor-block-list__block { opacity: 1 !important; }
			.is-focus-mode :where(${ fadedIds
				.map( ( id ) => `#block-${ id }` )
				.join( ', ' ) }) { opacity: 0.2 !important; }`,
		// Composing, sections are grabbed to move them, and none of core's
		// zoomed-out separators and prompts show.
		compose &&
			`.block-editor-block-list__zoom-out-separator,
			.block-list-appender,
			.block-editor-default-block-appender { display: none !important; }`,
		compose &&
			sections &&
			`${ sections }, ${ sections } * { cursor: ${
				compose === 'dragging' ? 'grabbing' : 'grab'
			} !important; }`,
		// The gap for adding a section in place, opening as the sections
		// move apart. Its height is on screen, so zoomed out it is scaled
		// up by as much as core scales the page down.
		gap &&
			`#block-${ gap.clientId } {
				margin-block-${ gap.isAfter ? 'end' : 'start' }: ${ gap.height }px !important;
				transition: margin var(--wpds-motion-duration-md, 200ms) ease-out;
			}
			html.is-zoomed-out #block-${ gap.clientId } {
				margin-block-${ gap.isAfter ? 'end' : 'start' }: calc(${
					gap.height
				}px / var(--wp-block-editor-iframe-zoom-out-scale, 1)) !important;
			}
			@media (prefers-reduced-motion: reduce) {
				#block-${ gap.clientId } { transition: none; }
			}`,
	]
		.filter( Boolean )
		.join( '\n' );
}

/**
 * A host for the layer in the editor's content region.
 *
 * @param {Object} editorRef Ref to the editor's container.
 * @return {?HTMLElement} The host, or null until the region exists.
 */
function useContentHost( editorRef ) {
	const [ host, setHost ] = useState( null );

	useEffect( () => {
		if ( ! editorRef.current ) {
			return undefined;
		}

		return observeHost(
			CONTENT_REGION,
			'cnl-section-modes-host',
			setHost,
			editorRef.current
		);
	}, [ editorRef ] );

	return host;
}

function useNoSync() {
	return null;
}

/**
 * @param {Object}   props
 * @param {Object}   props.editorRef     Ref to the editor's container.
 * @param {?string}  props.focusId       The one section, header or footer a
 *                                       canvas about it works on, like the
 *                                       Header screen's. Only it can be
 *                                       pointed at, picked and edited, and
 *                                       it starts picked, so its bar shows
 *                                       straight away.
 * @param {boolean}  props.isComposing   Whether the canvas is in Compose,
 *                                       zoomed out: the same controls, with
 *                                       sections dragged to move them, and
 *                                       anything but a section's layout,
 *                                       colours or place on the page done
 *                                       back in Edit.
 * @param {Function} props.onExitCompose Leaves Compose for Edit.
 * @param {Function} props.useSync       A hook linking Compose to a list of
 *                                       the same sections elsewhere, like the
 *                                       Pages sidebar. It returns `{
 *                                       hoveredId, selectedId, onHover,
 *                                       onSelect }`, in the editor's client
 *                                       IDs.
 * @return {?Element} The layer.
 */
export function SectionModesLayer( {
	editorRef,
	focusId = null,
	isComposing = false,
	onExitCompose,
	useSync = useNoSync,
} ) {
	const registry = useRegistry();
	const syncHook = useSync();
	const sync = isComposing ? syncHook : null;
	const layerRef = useRef();
	const openMediaRef = useRef();
	const mediaRequestRef = useRef( null );
	const host = useContentHost( editorRef );
	const { parts, rootClientId, sectionIds } = useComposeStructure();
	const items = useSectionItems();
	// `{ id, mode, view }` for the section in a mode, `view` being the
	// design choice drilled into in Edit design.
	const [ active, setActive ] = useState( null );
	const [ menuOpenFor, setMenuOpenFor ] = useState( null );
	// The section picked, by a click or by leaving a mode, shown as if it
	// were pointed at while nothing else is.
	const [ pickedSection, setPickedSection ] = useState( null );
	const [ freshId, setFreshId ] = useState( null );
	const [ chromeNode, setChromeNode ] = useState( null );
	const [ chromeSize, setChromeSize ] = useState( null );
	// `{ index }` of the gap a section is being added to in place, among
	// the sections.
	const [ inlineAdd, setInlineAdd ] = useState( null );
	const [ inlineAddNode, setInlineAddNode ] = useState( null );
	const [ inlineAddHeight, setInlineAddHeight ] = useState( null );
	const activeRef = useRef( active );

	activeRef.current = active;

	const partsById = useMemo(
		() =>
			Object.fromEntries(
				parts.map( ( part ) => [ part.clientId, part ] )
			),
		[ parts ]
	);
	// The section at the very top of the page, whose name goes under it.
	const pageTopId = useSelect(
		( select ) =>
			[ ...parts.map( ( part ) => part.clientId ), ...sectionIds ].find(
				( clientId ) => isAtPageEdge( select, clientId, false )
			) ?? null,
		[ parts, sectionIds ]
	);
	const targets = useMemo(
		() =>
			new Set(
				focusId
					? [ focusId ]
					: [
							...sectionIds,
							...parts.map( ( part ) => part.clientId ),
						]
			),
		[ focusId, parts, sectionIds ]
	);
	const findTarget = useCallback(
		( clientId ) =>
			getTargetOf(
				registry.select( blockEditorStore ),
				targets,
				clientId
			),
		[ registry, targets ]
	);

	const exitMode = useCallback( () => {
		const store = unlock( registry.select( blockEditorStore ) );
		const actions = unlock( registry.dispatch( blockEditorStore ) );

		if ( store.getEditedContentOnlySection() ) {
			actions.stopEditingContentOnlySection();
		}

		actions.clearSelectedBlock();
		// The section stays picked, ready for the other mode.
		setPickedSection( activeRef.current?.id ?? null );
		setActive( null );
	}, [ registry ] );

	const enterMode = ( clientId, mode ) => {
		const store = unlock( registry.select( blockEditorStore ) );
		const actions = unlock( registry.dispatch( blockEditorStore ) );
		const part = partsById[ clientId ];

		if ( store.getEditedContentOnlySection() ) {
			actions.stopEditingContentOnlySection();
		}

		actions.clearSelectedBlock();

		// A header's or footer's blocks can't be changed until core opens it,
		// for their words and images only.
		if ( part && mode === MODE_CONTENT ) {
			setOpenPart( clientId, PART_CONTENT );
			actions.editContentOnlySection( clientId );
		}

		setMenuOpenFor( null );
		setInlineAdd( null );
		setActive( { id: clientId, mode, view: null } );
	};

	// Composing, anything but a section's layout, colours or place on the
	// page is done in Edit: Compose zooms back in first, then does it.
	const leaveCompose = ( then = () => {} ) => {
		if ( ! isComposing ) {
			then();
			return;
		}

		afterZoomIn( () => then() );
		onExitCompose();
	};

	// From Edit design's More control into Freeform, which Done, Escape or a
	// click elsewhere leaves, as Edit content.
	const enterFreeform = useCallback( () => {
		const actions = unlock( registry.dispatch( blockEditorStore ) );
		const { id } = activeRef.current;

		actions.clearSelectedBlock();

		// A header or footer opens completely, as a section does.
		if ( partsById[ id ] ) {
			setOpenPart( id, PART_FREEFORM );
		}

		actions.editContentOnlySection( id );
		setActive( ( current ) => ( {
			...current,
			mode: MODE_FREEFORM,
			view: null,
		} ) );
	}, [ partsById, registry ] );

	// The design choice drilled into in Edit design's bar, or null for the
	// choices.
	const setDesignView = useCallback( ( view ) => {
		setActive( ( current ) => current && { ...current, view } );
	}, [] );

	// Escape leaves the mode, or steps back from a design choice to the
	// choices.
	const escapeMode = useCallback( () => {
		if (
			activeRef.current?.mode === MODE_DESIGN &&
			activeRef.current.view
		) {
			setDesignView( null );
		} else {
			exitMode();
		}
	}, [ exitMode, setDesignView ] );

	// Select a block, or the nearest one around it that can be, and put the
	// caret in it if it has text.
	const selectSoon = ( clientId ) => {
		const store = registry.select( blockEditorStore );
		let target = clientId;

		while ( target && store.getBlockEditingMode( target ) === 'disabled' ) {
			target = store.getBlockRootClientId( target );
		}

		if ( target ) {
			registry.dispatch( blockEditorStore ).selectBlock( target, 0 );
			focusSoon( target );
		}
	};

	/*
	 * Put the caret at a point on the page, or select the block there when
	 * it has no text, like a picture. Tried again for a few frames while
	 * core opens a header or footer, whose blocks can't be picked until it
	 * has.
	 */
	const placeCaret = ( doc, x, y, blockId, frames = 0 ) => {
		const editable = doc
			.elementFromPoint( x, y )
			?.closest( '[contenteditable="true"]' );

		if ( editable ) {
			const range = doc.caretRangeFromPoint?.( x, y );
			const selection = doc.defaultView.getSelection();

			editable.focus();

			if ( range && selection ) {
				selection.removeAllRanges();
				selection.addRange( range );
			}

			return;
		}

		const store = registry.select( blockEditorStore );
		const isReady =
			! blockId || store.getBlockEditingMode( blockId ) !== 'disabled';

		if ( ! isReady && frames < FOCUS_FRAMES ) {
			window.requestAnimationFrame( () =>
				placeCaret( doc, x, y, blockId, frames + 1 )
			);
			return;
		}

		// No text there: the nearest block that can be picked.
		let clientId = blockId;

		while (
			clientId &&
			store.getBlockEditingMode( clientId ) === 'disabled'
		) {
			clientId = store.getBlockRootClientId( clientId );
		}

		if ( clientId ) {
			registry.dispatch( blockEditorStore ).selectBlock( clientId );
		}
	};

	// One for both, so a section never lights up before its clicks are
	// kept off the page.
	const canvasDocument = useCanvasDocument( editorRef );
	const { hold, hoveredId, release } = useCanvasHover( {
		canvasDocument,
		findTarget,
		isActive: true,
	} );

	const isOpen = ( target ) =>
		Boolean(
			activeRef.current &&
			activeRef.current.mode !== MODE_DESIGN &&
			target === activeRef.current.id
		);

	useCanvasGuard( {
		allows: isOpen,
		canvasDocument,
		findTarget,
		isActive: true,
		// A click picks the section it lands on, or nothing, leaving any
		// mode.
		onBlocked: ( target ) => {
			if ( activeRef.current ) {
				exitMode();
			}

			setInlineAdd( null );

			setPickedSection( target );
		},
		// A double click opens the section in Edit content, with the caret
		// where it landed, or the block there selected, like a picture.
		onDoubleClick: ( target, event ) => {
			const doc = event.target.ownerDocument;
			const { clientX: x, clientY: y } = event;
			const blockId =
				event.target.closest( '[data-block]' )?.dataset.block;

			// Composing, the point moves as the page zooms in, so the block
			// under it now is selected once it has.
			if ( isComposing ) {
				const innerId = getBlockAtPoint( doc, x, y ) || blockId;

				leaveCompose( () => {
					enterMode( target, MODE_CONTENT );
					window.requestAnimationFrame( () =>
						window.requestAnimationFrame( () =>
							selectSoon( innerId )
						)
					);
				} );
				return;
			}

			enterMode( target, MODE_CONTENT );

			// Once the section takes clicks, and core has opened it.
			window.requestAnimationFrame( () =>
				window.requestAnimationFrame( () =>
					placeCaret( doc, x, y, blockId )
				)
			);
		},
		// Escape leaves Edit content or Edit design, the section staying
		// picked, and steps back from a design choice to the choices.
		onEscape: ( event ) => {
			const current = activeRef.current;

			if ( inlineAdd ) {
				event.preventDefault();
				setInlineAdd( null );
				return;
			}

			if ( ! current ) {
				if ( pickedSection ) {
					event.preventDefault();
					setPickedSection( null );
				} else if ( isComposing ) {
					event.preventDefault();
					onExitCompose();
				}

				return;
			}

			event.preventDefault();
			event.stopPropagation();
			// Out of the text too, or core selects its block again.
			event.target.ownerDocument.activeElement?.blur();

			escapeMode();
		},
	} );

	const { editedSection, exists, selectedId } = useSelect(
		( select ) => {
			const store = unlock( select( blockEditorStore ) );

			return {
				editedSection: store.getEditedContentOnlySection(),
				exists: active
					? Boolean( store.getBlockName( active.id ) )
					: true,
				selectedId: store.getSelectedBlockClientId(),
			};
		},
		[ active ]
	);
	const activePart = active ? partsById[ active.id ] : null;

	/*
	 * The header or footer open in Edit content or Freeform, for the editor
	 * extension that opens its blocks. Noted just before core opens it, in
	 * `enterMode` and `enterFreeform`, and cleared here once it closes, however
	 * it does, after core has closed it.
	 */
	const openPartId =
		activePart && active.mode !== MODE_DESIGN ? active.id : null;
	useEffect( () => {
		if ( ! openPartId ) {
			setOpenPart( null );
		}
	}, [ openPartId ] );
	useEffect( () => () => setOpenPart( null ), [] );

	// Compose works on layouts, colours and the page's order: Edit content
	// and Freeform give way to it, the section staying picked.
	useEffect( () => {
		if ( isComposing && activeRef.current?.mode !== undefined ) {
			if ( activeRef.current.mode !== MODE_DESIGN ) {
				exitMode();
			}
		}
	}, [ exitMode, isComposing ] );

	// The section went, as on undo or delete: so does its mode.
	useEffect( () => {
		if ( active && ! exists ) {
			setActive( null );
		}
	}, [ active, exists ] );

	// Core's own Done on a section it opened ends Freeform, the section
	// staying picked, and Edit content on a header or footer.
	useEffect( () => {
		if ( ! active || editedSection === active.id ) {
			return;
		}

		if ( active.mode === MODE_FREEFORM ) {
			exitMode();
		} else if ( activePart && active.mode === MODE_CONTENT ) {
			setActive( null );
		}
	}, [ active, activePart, editedSection, exitMode ] );

	/*
	 * Nothing outside the section being edited in place stays selected in
	 * core. A section selected while no section is in a mode, as the
	 * picker selects the one it adds, is picked instead, and brought into
	 * view.
	 */
	useEffect( () => {
		if ( ! selectedId ) {
			return;
		}

		const target = findTarget( selectedId );

		// A section's own block, when it holds others, is never selected in
		// core, so core's toolbar for it never shows: its blocks are what is
		// edited. A section that is a single block is that block.
		const isSectionItself =
			selectedId === target &&
			registry.select( blockEditorStore ).getBlockOrder( target ).length >
				0;

		if ( isOpen( target ) && ! isSectionItself ) {
			return;
		}

		if ( isOpen( target ) ) {
			registry.dispatch( blockEditorStore ).clearSelectedBlock();
			return;
		}

		registry.dispatch( blockEditorStore ).clearSelectedBlock();

		if ( target && ! activeRef.current ) {
			setPickedSection( target );
			// Once a section just added is drawn.
			window.requestAnimationFrame( () =>
				window.requestAnimationFrame( () =>
					scrollCanvasTo( editorRef, target )
				)
			);
		}
		// `isOpen` reads the latest mode from its ref, set as `active` is.
	}, [ active, editorRef, findTarget, registry, selectedId ] );

	// In Edit content, a block of the section selected can be removed from
	// core's toolbar; Restore on the small bar puts it back.
	const canRemoveSelected =
		active?.mode === MODE_CONTENT &&
		Boolean( selectedId ) &&
		selectedId !== active.id &&
		findTarget( selectedId ) === active.id;

	// A canvas about one section keeps it picked while nothing else is.
	const picked = pickedSection || focusId;
	const pickedId =
		! active && picked && targets.has( picked ) ? picked : null;
	// The section picked or in a mode, for the chat to change. A header or
	// footer isn't one.
	const sharedSectionId = active?.id || pickedId;
	const chatSectionId = sectionIds.includes( sharedSectionId )
		? sharedSectionId
		: null;
	useEffect( () => {
		setSharedPickedSection( chatSectionId );
	}, [ chatSectionId ] );
	useEffect( () => () => setSharedPickedSection( null ), [] );

	const pointedId = hoveredId || sync?.hoveredId || null;
	const shownHoverId =
		menuOpenFor ||
		( pointedId && pointedId !== active?.id ? pointedId : null ) ||
		pickedId;

	const isEmpty =
		! focusId && Boolean( rootClientId ) && sectionIds.length === 0;

	const measuredIds = useMemo(
		() => [
			...( rootClientId ? [ rootClientId ] : EMPTY_ARRAY ),
			...targets,
			...( freshId ? [ freshId ] : EMPTY_ARRAY ),
		],
		[ freshId, rootClientId, targets ]
	);
	const { frame, rects } = useBlockRects( {
		clientIds: measuredIds,
		editorRef,
		isActive: true,
		layerRef,
	} );

	const { moveBlocksToPosition } = useDispatch( blockEditorStore );
	const drag = useSectionDrag( {
		canvasDocument,
		getLatest: () => ( { findTarget, frame, rects, sectionIds } ),
		isActive: isComposing && ! active,
		onDrop: ( clientId, to ) =>
			moveBlocksToPosition(
				[ clientId ],
				rootClientId || '',
				rootClientId || '',
				to
			),
	} );

	const draggedSection = useSelect(
		( select ) =>
			drag ? select( blockEditorStore ).getBlock( drag.clientId ) : null,
		[ drag?.clientId ]
	);
	const draggedBlock = useMemo(
		() => ( draggedSection ? [ draggedSection ] : null ),
		[ draggedSection ]
	);

	/*
	 * Composing, the layer and the list of sections elsewhere, like the Pages
	 * sidebar, point at and pick the same sections.
	 */
	const syncRef = useRef( sync );
	syncRef.current = sync;

	useEffect( () => {
		syncRef.current?.onHover?.( hoveredId );
	}, [ hoveredId ] );

	useEffect( () => {
		if ( pickedSection ) {
			syncRef.current?.onSelect?.( pickedSection );
		}
	}, [ pickedSection ] );

	const syncedSelectedId = sync?.selectedId ?? null;

	useEffect( () => {
		if ( syncedSelectedId ) {
			setPickedSection( syncedSelectedId );
			scrollCanvasTo( editorRef, syncedSelectedId );
		}
	}, [ editorRef, syncedSelectedId ] );

	const openId = active && active.mode !== MODE_DESIGN ? active.id : null;
	// Joined, so the selector returns a value that only changes when they do.
	const fadedIds = useSelect(
		( select ) =>
			openId && editedSection === openId
				? getBlocksBeside( select, openId ).join()
				: '',
		[ editedSection, openId ]
	);

	// The section the gap for adding in place opens before, or after at the
	// end of the page.
	const inlineAddPlace = useMemo( () => {
		if ( ! inlineAdd || drag ) {
			return null;
		}

		const next = sectionIds[ inlineAdd.index ];
		const previous = sectionIds[ inlineAdd.index - 1 ];

		if ( next ) {
			return { clientId: next, isAfter: false };
		}

		return previous ? { clientId: previous, isAfter: true } : null;
	}, [ drag, inlineAdd, sectionIds ] );

	useCanvasStyles(
		true,
		editorRef,
		STYLE_ID,
		getCanvasCss(
			openId,
			rootClientId,
			isEmpty,
			isComposing && ( drag ? 'dragging' : 'grab' ),
			fadedIds ? fadedIds.split( ',' ) : EMPTY_ARRAY,
			inlineAddPlace && {
				...inlineAddPlace,
				height:
					( inlineAddHeight ?? INLINE_ADD_HEIGHT ) +
					INLINE_ADD_GAP * 2,
			}
		)
	);

	/*
	 * A header or footer in a mode is put in the spotlight, the rest of the
	 * page faded and dimmed, as on the Header and Footer screens, so it looks
	 * the same however it is reached. A canvas about one part, like those
	 * screens', keeps it in the spotlight itself.
	 */
	useEditorSpotlight( {
		area: activePart?.area,
		canvasDocument,
		clientId: activePart && ! focusId ? active.id : null,
	} );

	// Core's own inserter between blocks would offer a second way to add
	// in the same gap, so it is hidden while the picker is open.
	useEffect( () => {
		const editor = editorRef.current;

		if ( ! inlineAdd || ! editor ) {
			return undefined;
		}

		editor.classList.add( 'is-adding-section-inline' );

		return () => editor.classList.remove( 'is-adding-section-inline' );
	}, [ editorRef, inlineAdd ] );

	// Dragging a section, or the sections going, closes the gap.
	useEffect( () => {
		if ( inlineAdd && ( drag || ! sectionIds.length ) ) {
			setInlineAdd( null );
		}
	}, [ drag, inlineAdd, sectionIds.length ] );

	// A header or footer's blocks are picked out in purple while it is open.
	useCanvasStyles(
		Boolean( activePart ),
		editorRef,
		GLOBAL_STYLE_ID,
		GLOBAL_CANVAS_CSS
	);

	// Composing, Escape with nothing picked leaves for Edit, from wherever
	// focus is, but not from a dialog or popover's own Escape.
	useEffect( () => {
		if ( ! isComposing || pickedSection || active ) {
			return undefined;
		}

		const onKeyDown = ( event ) => {
			if (
				event.key !== 'Escape' ||
				event.defaultPrevented ||
				event.target.closest?.(
					'.components-modal__frame, .components-popover, [role="dialog"]'
				)
			) {
				return;
			}

			onExitCompose();
		};

		window.addEventListener( 'keydown', onKeyDown );

		return () => window.removeEventListener( 'keydown', onKeyDown );
	}, [ active, isComposing, onExitCompose, pickedSection ] );

	/*
	 * Escape leaves Edit content or Edit design from wherever focus was left,
	 * as when the button that opened the mode went and took focus with it,
	 * the section staying picked, or steps back a level, as `escapeMode` does.
	 * Not from a dialog or popover's own Escape.
	 */
	const isInMode = Boolean( active );

	useEffect( () => {
		if ( ! isInMode ) {
			return undefined;
		}

		const onKeyDown = ( event ) => {
			if (
				event.key !== 'Escape' ||
				event.defaultPrevented ||
				event.target.closest?.(
					'.components-modal__frame, .components-popover, [role="dialog"]'
				)
			) {
				return;
			}

			event.preventDefault();
			escapeMode();
		};

		window.addEventListener( 'keydown', onKeyDown );

		return () => window.removeEventListener( 'keydown', onKeyDown );
	}, [ escapeMode, isInMode ] );

	/*
	 * Edit design has nothing to confirm, so a click anywhere off its bar
	 * leaves it, its changes kept: on the page, as for every mode, and
	 * anywhere else in the editor too. Not from a popover, like a tooltip.
	 */
	const isDesigning = active?.mode === MODE_DESIGN;

	useEffect( () => {
		if ( ! isDesigning ) {
			return undefined;
		}

		const doc = layerRef.current?.ownerDocument;
		const onPointerDown = ( event ) => {
			if (
				layerRef.current?.contains( event.target ) ||
				event.target.closest?.( '.components-popover' )
			) {
				return;
			}

			exitMode();
		};

		doc?.addEventListener( 'pointerdown', onPointerDown );

		return () => doc?.removeEventListener( 'pointerdown', onPointerDown );
	}, [ exitMode, isDesigning ] );

	// Escape un-picks the section from wherever focus was left, as on the
	// page after Done, but not from a dialog or popover's own Escape.
	useEffect( () => {
		if ( ! pickedSection || active ) {
			return undefined;
		}

		const onKeyDown = ( event ) => {
			if (
				event.key !== 'Escape' ||
				event.defaultPrevented ||
				event.target.closest?.(
					'.components-modal__frame, .components-popover, [role="dialog"]'
				)
			) {
				return;
			}

			setPickedSection( null );
		};

		window.addEventListener( 'keydown', onKeyDown );

		return () => window.removeEventListener( 'keydown', onKeyDown );
	}, [ active, pickedSection ] );

	// The size of the panel or bar on the section in a mode, to place it and
	// steer the bins around it. Watched from whenever it mounts, as it does
	// again once a section that was swapped for another is measured.
	useEffect( () => {
		if ( ! chromeNode ) {
			setChromeSize( null );
			return undefined;
		}

		const observer = new window.ResizeObserver( () =>
			setChromeSize( {
				height: chromeNode.offsetHeight,
				width: chromeNode.offsetWidth,
			} )
		);

		observer.observe( chromeNode );

		return () => observer.disconnect();
	}, [ chromeNode ] );

	// The height of the picker for adding a section in place, for the gap
	// it sits in.
	useEffect( () => {
		if ( ! inlineAddNode ) {
			setInlineAddHeight( null );
			return undefined;
		}

		const observer = new window.ResizeObserver( () =>
			setInlineAddHeight( inlineAddNode.offsetHeight )
		);

		observer.observe( inlineAddNode );

		return () => observer.disconnect();
	}, [ inlineAddNode ] );

	// Once its gap has opened, the picker for adding a section in place is
	// scrolled into view, if it isn't, keeping its top in view first.
	useEffect( () => {
		if ( ! inlineAddNode ) {
			return undefined;
		}

		const timer = window.setTimeout( () => {
			const iframe = getCanvasFrame( editorRef.current );

			if ( ! iframe || ! inlineAddNode.isConnected ) {
				return;
			}

			const box = inlineAddNode.getBoundingClientRect();
			const view = iframe.getBoundingClientRect();
			const above = box.top - view.top - INSET;
			const below = box.bottom - view.bottom + INSET;
			let delta = 0;

			if ( above < 0 ) {
				delta = above;
			} else if ( below > 0 ) {
				delta = Math.min( below, above );
			}

			if ( delta ) {
				const reduceMotion = window.matchMedia(
					'(prefers-reduced-motion: reduce)'
				).matches;

				iframe.contentWindow?.scrollBy( {
					behavior: reduceMotion ? 'auto' : 'smooth',
					top: delta,
				} );
			}
		}, INLINE_ADD_SETTLE_MS );

		return () => window.clearTimeout( timer );
	}, [ editorRef, inlineAddNode ] );

	// Scrolling over the layer scrolls the canvas under it.
	useEffect( () => {
		const layer = layerRef.current;

		if ( ! layer ) {
			return undefined;
		}

		const onWheel = ( event ) => {
			const view = getCanvasFrame( editorRef.current )?.contentWindow;

			const bar = event.target.closest( '.cnl-section-modes__design' );

			if (
				! view ||
				event.target.closest( '.components-popover' ) ||
				( bar && bar.scrollHeight > bar.clientHeight )
			) {
				return;
			}

			event.preventDefault();
			view.scrollBy( { left: 0, top: event.deltaY } );
		};

		layer.addEventListener( 'wheel', onWheel, { passive: false } );

		return () => layer.removeEventListener( 'wheel', onWheel );
	}, [ editorRef, host ] );

	// A new item is highlighted a moment, and scrolled to.
	useEffect( () => {
		if ( ! freshId ) {
			return undefined;
		}

		const timer = window.setTimeout( () => setFreshId( null ), FRESH_MS );

		scrollCanvasTo( editorRef, freshId );

		return () => window.clearTimeout( timer );
	}, [ editorRef, freshId ] );

	const getTitle = ( clientId ) => {
		const part = partsById[ clientId ];

		if ( part ) {
			return part.area === 'footer' ? __( 'Footer' ) : __( 'Header' );
		}

		const block = registry.select( blockEditorStore ).getBlock( clientId );

		return block ? getCachedSectionTitle( block ) : __( 'Section' );
	};

	/*
	 * Put the caret in a new block as soon as it is drawn, so typing straight
	 * away lands in it rather than scrolling the page. Kept there for a
	 * moment, as the section's lock redraws it, unless the selection moves
	 * on first.
	 */
	const focusSoon = ( clientId ) => {
		let frames = 0;
		const focus = () => {
			const doc = getCanvasFrame( editorRef.current )?.contentDocument;
			const block = doc?.getElementById( `block-${ clientId }` );
			// The text itself, which in a button sits inside the block.
			const node = block?.matches( '[contenteditable="true"]' )
				? block
				: block?.querySelector( '[contenteditable="true"]' ) || block;
			const isSelected =
				registry
					.select( blockEditorStore )
					.getSelectedBlockClientId() === clientId;

			if ( ! isSelected ) {
				return;
			}

			if ( node && doc.activeElement !== node ) {
				node.focus();
			}

			if ( ++frames < FOCUS_FRAMES ) {
				window.requestAnimationFrame( focus );
			}
		};

		window.requestAnimationFrame( focus );
	};

	// Add a block to the end of a section, and open it in Edit content with
	// the caret in the new block, or the new picture selected.
	const addItem = ( ownerId, type, media ) => {
		const added = items.add( ownerId, type, media );

		if ( ! added ) {
			return;
		}

		setFreshId( added.blockId );
		enterMode( added.sectionId, MODE_CONTENT );

		if ( type === 'image' ) {
			registry.dispatch( blockEditorStore ).selectBlock( added.blockId );
			return;
		}

		registry
			.dispatch( blockEditorStore )
			.selectBlock( added.editableId, 0 );
		focusSoon( added.editableId );
	};

	const requestMedia = ( mediaRequest ) => {
		mediaRequestRef.current = mediaRequest;
		openMediaRef.current?.();
	};

	const onMediaSelect = ( media ) => {
		const mediaRequest = mediaRequestRef.current;

		mediaRequestRef.current = null;

		if ( ! mediaRequest || ! media?.url ) {
			return;
		}

		leaveCompose( () => addItem( mediaRequest.ownerId, 'image', media ) );
	};

	// A blank section, opened in Edit content with the caret in its text.
	const startBlank = ( index = 0 ) => {
		const section = createBlankSection();

		registry
			.dispatch( blockEditorStore )
			.insertBlocks( [ section ], index, rootClientId, false );
		enterMode( section.clientId, MODE_CONTENT );

		const paragraphId = section.innerBlocks[ 0 ].clientId;

		registry.dispatch( blockEditorStore ).selectBlock( paragraphId, 0 );
		focusSoon( paragraphId );
	};

	const deleteSection = ( clientId ) => {
		const title = getTitle( clientId );

		registry
			.dispatch( blockEditorStore )
			.removeBlocks( [ clientId ], false );
		release();
		registry.dispatch( noticesStore ).createSuccessNotice(
			sprintf(
				/* translators: %s: section name. */
				__( '“%s” deleted.' ),
				title
			),
			{
				actions: [
					{
						label: __( 'Undo' ),
						onClick: () =>
							registry.dispatch( coreDataStore ).undo(),
					},
				],
				id: 'cnl-section-modes-deleted',
				type: 'snackbar',
			}
		);
	};

	const moveSection = ( clientId, direction ) => {
		const actions = registry.dispatch( blockEditorStore );

		if ( direction < 0 ) {
			actions.moveBlocksUp( [ clientId ], rootClientId || '' );
		} else {
			actions.moveBlocksDown( [ clientId ], rootClientId || '' );
		}

		window.requestAnimationFrame( () =>
			scrollCanvasTo( editorRef, clientId )
		);
	};

	const onLayoutReplace = ( next ) => {
		items.rename( active.id, next.clientId );
		setActive( ( current ) => ( { ...current, id: next.clientId } ) );
	};

	// Adding a section in place, in a gap opened where it goes, rather than
	// in the modal, which "View all sections" opens for the same gap.
	const openInlineAdd = ( index ) => {
		setMenuOpenFor( null );
		setInlineAdd( { index } );
	};

	const inlineAddActions = {
		onClose: () => setInlineAdd( null ),
		onPick: ( pattern ) => {
			setInlineAdd( null );
			addPatternSection( registry, pattern, {
				index: inlineAdd.index,
				rootClientId: rootClientId || '',
			} );
		},
		// Typed into straight away, which is done in Edit.
		onStartBlank: () => {
			const { index } = inlineAdd;

			setInlineAdd( null );
			leaveCompose( () => startBlank( index ) );
		},
		onViewAll: () => {
			setInlineAdd( null );
			openSectionPicker( {
				index: inlineAdd.index,
				rootClientId: rootClientId || '',
			} );
		},
	};

	/*
	 * The picker for adding a section in place, in its gap: under the
	 * section before it, or over the one after it at the top of the page.
	 * As wide as the sections, but never so narrow, zoomed out, that its
	 * cards can't be made out. The gap itself is marked out behind it, edge
	 * to edge and square, as the place the section will take.
	 */
	const renderInlineAdd = () => {
		const neighbour = inlineAddPlace && rects[ inlineAddPlace.clientId ];

		if ( ! neighbour || ! frame ) {
			return null;
		}

		const previous = rects[ sectionIds[ inlineAdd.index - 1 ] ];
		const box = local( neighbour, frame );
		const height = inlineAddHeight ?? INLINE_ADD_HEIGHT;
		const top = previous
			? previous.top - frame.top + previous.height + INLINE_ADD_GAP
			: box.top - INLINE_ADD_GAP - height;
		const width = Math.min(
			frame.width - INSET * 2,
			Math.max( box.width - INSET * 2, INLINE_ADD_MIN_WIDTH )
		);
		const left = Math.max(
			INSET,
			Math.min(
				box.left + ( box.width - width ) / 2,
				frame.width - INSET - width
			)
		);

		const slotLeft = Math.min( box.left, left - INSET );
		const slotRight = Math.max(
			box.left + box.width,
			left + width + INSET
		);

		return (
			<Fragment key={ inlineAdd.index }>
				<div
					className="cnl-section-modes__inline-add-slot"
					style={ {
						height: height + INLINE_ADD_GAP * 2,
						left: slotLeft,
						top: top - INLINE_ADD_GAP,
						width: slotRight - slotLeft,
					} }
				/>
				<div
					className="cnl-section-modes__inline-add"
					ref={ setInlineAddNode }
					style={ { left, top, width } }
				>
					<InlineSectionPicker
						{ ...inlineAddActions }
						Preview={ EditorPreview }
					/>
				</div>
			</Fragment>
		);
	};

	if ( ! host ) {
		return null;
	}

	const renderHover = () => {
		const rect = ! drag && shownHoverId && rects[ shownHoverId ];

		if ( ! rect || ! frame ) {
			return null;
		}

		const box = local( rect, frame );
		const isPart = Boolean( partsById[ shownHoverId ] );
		const index = sectionIds.indexOf( shownHoverId );
		const title = getTitle( shownHoverId );
		/*
		 * A narrow section has the modes on a row of their own. A section
		 * too short for that, or for the bar at all, has a compact bar, its
		 * modes as icons, over its middle, so it reaches as little as it can
		 * over the sections beside it, which the pointer is headed for.
		 */
		const isNarrow = box.width < NARROW_WIDTH;
		const isCompact =
			box.height <
			( isNarrow ? BAR_HEIGHT * 2 + BAR_ROW_GAP : BAR_HEIGHT ) +
				INSET * 2;
		const barHeight =
			isNarrow && ! isCompact ? BAR_HEIGHT * 2 + BAR_ROW_GAP : BAR_HEIGHT;
		const barTop = isCompact
			? box.top + ( box.height - barHeight ) / 2
			: stickyTop( box, barHeight );
		const holdHover = {
			onBlur: release,
			onFocus: () => hold( shownHoverId ),
			onPointerEnter: () => hold( shownHoverId ),
			onPointerLeave: release,
		};

		// Purple for a header or footer, which every page shares.
		const Scope = isPart ? GlobalScope : Fragment;

		// Remade for each section pointed at, so it fades in afresh.
		return (
			<div className="cnl-section-modes__hover" key={ shownHoverId }>
				<Scope>
					{ /* Tinted while pointed at; only outlined while just picked. */ }
					<div
						className={ `cnl-section-modes__tint${
							shownHoverId === pickedId &&
							hoveredId !== pickedId &&
							menuOpenFor !== pickedId
								? ' is-picked'
								: ''
						}` }
						style={ box }
					/>
					<SectionTab
						{ ...placeTab(
							box,
							shownHoverId === pageTopId,
							frame.height
						) }
						isPart={ isPart }
						title={ title }
					/>
					<div { ...holdHover }>
						{ ! isPart &&
							! active &&
							! inlineAdd &&
							[
								[ box.top, index ],
								[ box.top + box.height, index + 1 ],
							].map( ( [ top, at ] ) => (
								<Button
									className="cnl-section-modes__add-section"
									icon={ plusIcon }
									key={ at }
									onClick={ () => openInlineAdd( at ) }
									size="compact"
									style={ {
										left: box.left + box.width / 2,
										top,
									} }
									variant="primary"
								>
									{ __( 'Add section' ) }
								</Button>
							) ) }
						<HoverBar
							canMoveDown={ index < sectionIds.length - 1 }
							canMoveUp={ index > 0 }
							isCompact={ isCompact }
							isNarrow={ isNarrow && ! isCompact }
							isPart={ isPart }
							onAdd={ ( type ) =>
								type === 'image'
									? requestMedia( {
											ownerId: shownHoverId,
											type: 'add',
										} )
									: leaveCompose( () =>
											addItem( shownHoverId, type )
										)
							}
							onDelete={ () => deleteSection( shownHoverId ) }
							onDuplicate={ () =>
								registry
									.dispatch( blockEditorStore )
									.duplicateBlocks( [ shownHoverId ], false )
							}
							onMenuToggle={ ( isMenuOpen ) =>
								setMenuOpenFor(
									isMenuOpen ? shownHoverId : null
								)
							}
							onMode={ ( mode ) =>
								mode === MODE_CONTENT
									? leaveCompose( () =>
											enterMode( shownHoverId, mode )
										)
									: enterMode( shownHoverId, mode )
							}
							onMove={ ( direction ) =>
								moveSection( shownHoverId, direction )
							}
							style={ {
								left: box.left + INSET,
								top: barTop,
								width: box.width - INSET * 2,
							} }
							title={ title }
						/>
					</div>
				</Scope>
			</div>
		);
	};

	// The picked section, while another is pointed at: outlined and named.
	const renderPicked = () => {
		const rect =
			! drag &&
			pickedId &&
			pickedId !== shownHoverId &&
			frame &&
			rects[ pickedId ];

		if ( ! rect ) {
			return null;
		}

		const box = local( rect, frame );
		const isPart = Boolean( partsById[ pickedId ] );
		const Scope = isPart ? GlobalScope : Fragment;

		return (
			<Scope>
				<div className="cnl-section-modes__outline" style={ box } />
				<SectionTab
					{ ...placeTab( box, pickedId === pageTopId, frame.height ) }
					isPart={ isPart }
					title={ getTitle( pickedId ) }
				/>
			</Scope>
		);
	};

	// A section being dragged: dimmed where it is, a ghost of it under the
	// pointer, and a line where it would drop.
	const renderDrag = () => {
		const rect = drag && frame && rects[ drag.clientId ];

		if ( ! rect ) {
			return null;
		}

		const box = local( rect, frame );
		const gapId = sectionIds[ drag.slot ];
		const lastRect = rects[ sectionIds[ sectionIds.length - 1 ] ];
		let lineTop = null;

		if ( gapId && rects[ gapId ] ) {
			lineTop = rects[ gapId ].top - frame.top;
		} else if ( lastRect ) {
			lineTop = lastRect.top + lastRect.height - frame.top;
		}

		return (
			<>
				<div className="cnl-section-modes__dragged" style={ box } />
				{ draggedBlock && (
					<div
						aria-hidden
						className="cnl-section-modes__ghost"
						style={ {
							left: drag.ghost.left,
							top: drag.ghost.top,
							width: drag.ghost.width,
						} }
					>
						<BlockPreview
							blocks={ draggedBlock }
							viewportWidth={ drag.ghost.viewportWidth }
						/>
					</div>
				) }
				{ lineTop !== null && (
					<div
						className="cnl-section-modes__drop-line"
						style={ {
							left: box.left,
							top: lineTop,
							width: box.width,
						} }
					/>
				) }
			</>
		);
	};

	const renderActive = () => {
		const rect = active && rects[ active.id ];

		if ( ! rect || ! frame ) {
			return null;
		}

		const box = local( rect, frame );
		const title = getTitle( active.id );
		const isHeader = activePart?.area === 'header';
		const Scope = activePart ? GlobalScope : Fragment;
		const tab = placeTab( box, active.id === pageTopId, frame.height );
		// What sits outside the section keeps clear of a tab under it.
		const outerBox = tab.isBelow
			? { ...box, height: box.height + TAB_HEIGHT }
			: box;
		const removedCount = items.removed.filter(
			( entry ) => entry.ownerId === active.id
		).length;
		const restore = () => items.restore( active.id );
		let chrome = null;

		if ( active.mode === MODE_DESIGN ) {
			const height = chromeSize?.height || BAR_HEIGHT;
			/*
			 * Where the bar over the section was, its modes giving way to
			 * the design choices in the same place: at the top of the
			 * section in view, a tray opened under it kept on the canvas,
			 * moving the bar up if it has to. A section too short to hold
			 * it, with its tray, has it outside, under it or over it, so
			 * what is picked can be seen.
			 */
			let top;

			if ( box.height >= height + INSET * 2 ) {
				top = stickyTop( box, height );

				if (
					top < frame.height &&
					top + height > frame.height - INSET
				) {
					top = Math.max( INSET, frame.height - height - INSET );
				}
			} else {
				top = placeOutside( outerBox, height, frame.height, isHeader );
			}

			const maxWidth = Math.min(
				Math.max( DESIGN_BAR_MIN_WIDTH, box.width - INSET * 2 ),
				frame.width - INSET * 2
			);

			chrome = (
				<DesignBar
					clientId={ active.id }
					onClose={ exitMode }
					onFreeform={ () => leaveCompose( enterFreeform ) }
					onReplace={ onLayoutReplace }
					onView={ setDesignView }
					part={ activePart }
					perSlide={ getLayoutsPerSlide( maxWidth ) }
					ref={ setChromeNode }
					style={ {
						left: box.left + box.width / 2,
						// Scrolls rather than run off the canvas.
						maxHeight: Math.max(
							DESIGN_BAR_MIN_HEIGHT,
							frame.height - Math.max( top, 0 ) - INSET
						),
						maxWidth,
						top,
					} }
					title={ title }
					view={ active.view }
				/>
			);
		} else {
			/*
			 * In a big section, in the middle of whichever of its top and
			 * bottom edges is in view, so it is easy to find. In a small
			 * one, smaller and outside it, so it never covers what is being
			 * edited: under its bottom edge while there is room on the
			 * canvas, else over its top edge, at the right, clear of its
			 * name.
			 */
			const isSmall =
				box.height < MODE_BAR_ROOM_HEIGHT ||
				box.width < MODE_BAR_ROOM_WIDTH;
			const below = outerBox.top + outerBox.height + MODE_BAR_GAP;
			const above = box.top - SMALL_MODE_BAR_HEIGHT - MODE_BAR_GAP;
			let place = {
				left: box.left + box.width / 2,
				top: placeAtEdge(
					box,
					chromeSize?.height || BAR_HEIGHT,
					frame.height
				),
			};

			if ( isSmall ) {
				place = {
					left: box.left + box.width - INSET,
					top:
						isHeader ||
						below + SMALL_MODE_BAR_HEIGHT <= frame.height ||
						above < 0
							? below
							: above,
					transform: 'translateX(-100%)',
				};
			}
			chrome = (
				<ModeBar
					isSmall={ isSmall }
					label={
						active.mode === MODE_FREEFORM
							? __( 'Freeform' )
							: __( 'Edit content' )
					}
					onDone={ exitMode }
					onRestore={ restore }
					ref={ setChromeNode }
					removedCount={ removedCount }
					sitewide={ activePart ? getSitewideText( title ) : null }
					style={ place }
				/>
			);
		}

		return (
			<Scope>
				<div className="cnl-section-modes__outline" style={ box } />
				<SectionTab
					{ ...tab }
					isPart={ Boolean( activePart ) }
					title={ title }
				/>
				{ chrome }
			</Scope>
		);
	};

	const freshRect = freshId && frame && rects[ freshId ];

	return createPortal(
		<div
			className="cnl-section-modes"
			onKeyDown={ ( event ) => {
				if ( event.key === 'Escape' && inlineAdd ) {
					event.stopPropagation();
					setInlineAdd( null );
				} else if ( event.key === 'Escape' && active ) {
					event.stopPropagation();
					escapeMode();
				} else if ( event.key === 'Escape' && pickedSection ) {
					event.stopPropagation();
					setPickedSection( null );
				}
			} }
			ref={ layerRef }
			role="presentation"
		>
			{ frame && (
				<div className="cnl-section-modes__clip" style={ frame }>
					{ isEmpty && rects[ rootClientId ] && (
						<EmptyPage
							onAddSection={ () =>
								openSectionPicker( {
									index: 0,
									rootClientId,
								} )
							}
							onStartBlank={ () => startBlank() }
							style={ {
								height: Math.max(
									rects[ rootClientId ].height - INSET * 2,
									EMPTY_SPACE - INSET * 2
								),
								left: INSET,
								top:
									rects[ rootClientId ].top -
									frame.top +
									INSET,
								width: frame.width - INSET * 2,
							} }
						/>
					) }
					{ renderPicked() }
					{ /* Under the section being edited, so another section
					pointed at never covers its Done. */ }
					{ renderHover() }
					{ renderInlineAdd() }
					{ renderActive() }
					{ renderDrag() }
					{ freshRect && (
						<div
							className="cnl-section-modes__fresh"
							style={ local( freshRect, frame ) }
						/>
					) }
				</div>
			) }
			{ canRemoveSelected && (
				<RemoveControl
					onRemove={ () => {
						registry
							.dispatch( blockEditorStore )
							.clearSelectedBlock();
						items.remove( active.id, selectedId );
					} }
				/>
			) }
			<MediaUpload
				allowedTypes={ [ 'image' ] }
				multiple={ false }
				onSelect={ onMediaSelect }
				render={ ( { open } ) => {
					openMediaRef.current = open;
					return null;
				} }
			/>
		</div>,
		host
	);
}
