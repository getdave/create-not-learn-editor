/**
 * The spotlight on the Header and Footer canvases: the part the screen is
 * about, brought into view, with the rest of the page faded back and dimmed
 * behind a dark backdrop. In Browse this is laid over the saved site; in Edit
 * over the editor, the part's blocks left as they are on any other page.
 *
 * In Edit the part is changed through Edit's section layer, like any other
 * header or footer: its bar offers Edit design and Edit content, and nothing
 * in it can be clicked until one is picked. The canvas tells the layer the
 * part is the only thing it works on, so the rest of the page stays out of
 * reach. See `SectionModesLayer`.
 *
 * Within the part, what the screen's view changes, like its menu, is outlined
 * in purple, the colour for what every page shares, so it is clear what is
 * being edited. See `src/global-scope`.
 *
 * The spotlight itself is shared with Edit's section layer, which puts a
 * header or footer in it on any page. See `src/site-canvas/part-spotlight.js`.
 */

/**
 * Internal dependencies
 */
import {
	addStyles,
	clearSpotlight,
	markFocus,
	markSpotlight,
	SPOTLIGHT_STYLES,
	useEditorSpotlight,
} from '../../site-canvas/part-spotlight';
import {
	blockEditorStore,
	useEffect,
	useSelect,
} from '../../wordpress-packages';

/*
 * What each of the screen's views changes, as the blocks the editor has and
 * as they appear in the saved site. A menu is the part's first, the one the
 * screen edits; the name and logo, and the social links, are all there are.
 */
const FOCUS_TARGETS = {
	identity: {
		blockNames: [
			'core/site-logo',
			'core/site-title',
			'core/site-tagline',
		],
		selector:
			'.wp-block-site-logo, .wp-block-site-title, .wp-block-site-tagline',
	},
	menu: {
		blockNames: [ 'core/navigation' ],
		isFirstOnly: true,
		selector: '.wp-block-navigation',
	},
	// Every one, as the screen keeps them all the same.
	social: {
		blockNames: [ 'core/social-links' ],
		selector: '.wp-block-social-links',
	},
};

/*
 * How long a part is followed while the page around it settles. Long enough
 * for images that are slow to load, or slow to fail.
 */
const FOLLOW_TIMEOUT_MS = 30000;

// Anything the person does on the canvas, after which its scroll is theirs.
const TAKEOVER_EVENTS = [ 'keydown', 'pointerdown', 'touchstart', 'wheel' ];

// In the saved site, the first header on the page or the last footer.
const PREVIEW_SELECTORS = {
	footer: 'footer.wp-block-template-part',
	header: 'header.wp-block-template-part',
};

/**
 * What a view changes in the part, in the saved site.
 *
 * @param {HTMLElement} part  The part.
 * @param {?string}     focus The screen's view.
 * @return {HTMLElement[]} The nodes to outline.
 */
function getPreviewFocusNodes( part, focus ) {
	const target = FOCUS_TARGETS[ focus ];

	if ( ! target ) {
		return [];
	}

	const nodes = [ ...part.querySelectorAll( target.selector ) ];

	return target.isFirstOnly ? nodes.slice( 0, 1 ) : nodes;
}

/**
 * What a view changes in the part, as blocks in the editor.
 *
 * @param {Object}  store    `blockEditorStore` selectors.
 * @param {string}  clientId The part's client ID.
 * @param {?string} focus    The screen's view.
 * @return {string[]} Client IDs of the blocks to outline.
 */
function getFocusClientIds( store, clientId, focus ) {
	const target = FOCUS_TARGETS[ focus ];

	if ( ! target || ! clientId ) {
		return [];
	}

	const clientIds = store
		.getClientIdsOfDescendants( clientId )
		.filter( ( id ) =>
			target.blockNames.includes( store.getBlockName( id ) )
		);

	return target.isFirstOnly ? clientIds.slice( 0, 1 ) : clientIds;
}

/**
 * Bring a node into view on the canvas's own window, rather than with
 * `scrollIntoView`, which also scrolls every container around the iframe.
 *
 * @param {HTMLElement} node Node to show.
 * @param {string}      area `header`, brought in from its top, or `footer`,
 *                           from its bottom.
 */
function scrollToPart( node, area ) {
	const view = node.ownerDocument.defaultView;
	const rect = node.getBoundingClientRect();
	const reduceMotion = view.matchMedia(
		'(prefers-reduced-motion: reduce)'
	).matches;

	view.scrollTo( {
		behavior: reduceMotion ? 'auto' : 'smooth',
		top:
			area === 'footer'
				? view.scrollY + rect.bottom - view.innerHeight
				: view.scrollY + rect.top,
	} );
}

/**
 * Bring the part into view, and keep it there while the page settles.
 * Images that finish loading, or fail to, after the part is first in view
 * change the height of the page above it, which would leave a footer out of
 * sight. It is followed until the person scrolls, clicks or types on the
 * canvas themselves, or for a while.
 *
 * @param {Document}           frameDocument The canvas's document.
 * @param {() => ?HTMLElement} getNode       Returns the part's node, or
 *                                           nothing while it hasn't
 *                                           rendered yet.
 * @param {string}             area          `header` or `footer`.
 * @return {() => void} Stops following the part.
 */
function followPart( frameDocument, getNode, area ) {
	const view = frameDocument.defaultView;
	let request;

	const update = () => {
		view.cancelAnimationFrame( request );
		request = view.requestAnimationFrame( () => {
			const node = getNode();

			if ( node ) {
				scrollToPart( node, area );
			}
		} );
	};

	// Called once straight away, and again whenever the page changes size.
	const observer = new view.ResizeObserver( update );
	observer.observe( frameDocument.body, { box: 'border-box' } );

	const stop = () => {
		observer.disconnect();
		view.cancelAnimationFrame( request );
		view.clearTimeout( timeout );
		TAKEOVER_EVENTS.forEach( ( type ) =>
			view.removeEventListener( type, stop, true )
		);
	};
	const timeout = view.setTimeout( stop, FOLLOW_TIMEOUT_MS );

	TAKEOVER_EVENTS.forEach( ( type ) =>
		view.addEventListener( type, stop, { capture: true, passive: true } )
	);

	return stop;
}

/**
 * Keep the part in the spotlight in the saved site that Browse shows. The
 * page is a new document with each load, so it is marked again every time.
 *
 * @param {Object}  options
 * @param {string}  options.area         `header` or `footer`.
 * @param {?string} options.focus        The screen's view.
 * @param {Object}  options.frame        The canvas's preview frame.
 * @param {boolean} options.isPreviewing Whether Browse is on.
 */
function usePreviewSpotlight( { area, focus, frame, isPreviewing } ) {
	const iframeRef = frame.frameProps.ref;
	const isLoading = frame.isLoading;

	useEffect( () => {
		let previewDocument;

		try {
			previewDocument = iframeRef.current?.contentDocument;
		} catch {
			// The preview left the site.
			return undefined;
		}

		if ( isLoading || ! previewDocument?.body ) {
			return undefined;
		}

		const parts = previewDocument.querySelectorAll(
			PREVIEW_SELECTORS[ area ]
		);
		const node = area === 'footer' ? parts[ parts.length - 1 ] : parts[ 0 ];

		// No such part on this page, so nothing to dim the page around.
		if ( ! node ) {
			return undefined;
		}

		const style = addStyles( previewDocument, SPOTLIGHT_STYLES );
		markSpotlight( node, area );
		markFocus( previewDocument, getPreviewFocusNodes( node, focus ) );

		const stopFollowing = isPreviewing
			? followPart( previewDocument, () => node, area )
			: undefined;

		return () => {
			stopFollowing?.();
			style.remove();
			clearSpotlight( previewDocument );
		};
	}, [ area, focus, iframeRef, isLoading, isPreviewing ] );
}

/**
 * Keep the part in the spotlight, in Browse and in Edit.
 *
 * @param {Object}    options
 * @param {string}    options.area           `header` or `footer`.
 * @param {?Document} options.canvasDocument The editor's canvas document.
 * @param {?string}   options.clientId       The part's client ID.
 * @param {?string}   options.focus          The screen's view, which picks
 *                                           what is outlined in the part.
 * @param {Object}    options.frame          The canvas's preview frame.
 * @param {boolean}   options.isPreviewing   Whether Browse is on.
 */
export function useSitePartSpotlight( {
	area,
	canvasDocument,
	clientId,
	focus,
	frame,
	isPreviewing,
} ) {
	usePreviewSpotlight( { area, focus, frame, isPreviewing } );

	// Joined, so the selector returns a value that only changes when they do.
	const focusClientIds = useSelect(
		( select ) =>
			getFocusClientIds(
				select( blockEditorStore ),
				clientId,
				focus
			).join( ',' ),
		[ clientId, focus ]
	);
	const isActive = Boolean( clientId && canvasDocument && ! isPreviewing );

	// Kept while Browse is on too, so the editor under the preview is ready.
	useEditorSpotlight( { area, canvasDocument, clientId, focusClientIds } );

	/*
	 * Bring it into view whenever it comes on show. Its blocks render a moment
	 * after it does, so it is looked up each time the page changes size.
	 */
	useEffect( () => {
		if ( ! isActive ) {
			return undefined;
		}

		return followPart(
			canvasDocument,
			() => canvasDocument.getElementById( `block-${ clientId }` ),
			area
		);
	}, [ area, canvasDocument, clientId, isActive ] );
}
