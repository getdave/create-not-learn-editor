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
 */

/**
 * Internal dependencies
 */
import { GLOBAL_COLOR } from '../../global-scope';
import {
	blockEditorStore,
	useEffect,
	useSelect,
} from '../../wordpress-packages';

const SPOTLIGHT_ATTRIBUTE = 'data-cnl-spotlight';
const FADED_ATTRIBUTE = 'data-cnl-spotlight-faded';
const FOCUS_ATTRIBUTE = 'data-cnl-spotlight-focus';
const STYLE_ID = 'cnl-site-part-spotlight';

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
 * The rest of the page is faded back, and the dark backdrop laid over it.
 * The backdrop is the part's own shadow, spread far enough to cover any
 * page, with the part lifted over what follows it so the shadow lies on top.
 * `:where()` keeps a theme's sticky or fixed header as it is.
 *
 * What is being edited in the part is outlined, a little outside itself so
 * the outline doesn't sit on its text. The colour is set on the root when
 * the styles are added, as the canvas has the theme's styles, not ours.
 */
const SPOTLIGHT_STYLES = `
[${ FOCUS_ATTRIBUTE }] {
	outline: 2px solid var(--cnl-spotlight-accent) !important;
	outline-offset: 4px !important;
	border-radius: 2px;
}
:where([${ SPOTLIGHT_ATTRIBUTE }]) { position: relative; }
[${ SPOTLIGHT_ATTRIBUTE }] {
	z-index: 99999;
	box-shadow: 0 0 0 100000px rgba(0, 0, 0, 0.6);
}
[${ FADED_ATTRIBUTE }] { opacity: 0.3; }
@media not (prefers-reduced-motion) {
	[${ SPOTLIGHT_ATTRIBUTE }] { animation: cnl-spotlight-in 0.3s ease-out; }
	[${ FADED_ATTRIBUTE }] { animation: cnl-spotlight-fade 0.3s ease-out; }
}
@keyframes cnl-spotlight-in {
	from { box-shadow: 0 0 0 100000px rgba(0, 0, 0, 0); }
}
@keyframes cnl-spotlight-fade {
	from { opacity: 1; }
}
@media not (prefers-reduced-motion) {
	[${ FOCUS_ATTRIBUTE }] { animation: cnl-spotlight-focus 0.3s ease-out; }
}
@keyframes cnl-spotlight-focus {
	from { outline-color: transparent; outline-offset: 10px; }
}
`;

/*
 * Core fades the page around an entered section too, but only once something
 * in it is picked, and the section itself until then. The page is faded here
 * whatever is picked, so core's fade gives way to it, and the part always
 * stays clear.
 */
const EDITOR_STYLES = `${ SPOTLIGHT_STYLES }
.block-editor-block-list__block { opacity: 1 !important; }
.block-editor-block-list__block[${ FADED_ATTRIBUTE }],
[${ FADED_ATTRIBUTE }] { opacity: 0.3 !important; }
`;

// In the saved site, the first header on the page or the last footer.
const PREVIEW_SELECTORS = {
	footer: 'footer.wp-block-template-part',
	header: 'header.wp-block-template-part',
};

/*
 * Not the page's content, so left as they are: what is never drawn, and the
 * editor's layer for what is drawn over the canvas, like section outlines.
 */
const NOT_FADED =
	'style, script, link, meta, template, noscript, body > svg, .block-canvas-cover';

function addStyles( canvasDocument, css ) {
	canvasDocument.getElementById( STYLE_ID )?.remove();

	const style = canvasDocument.createElement( 'style' );
	style.id = STYLE_ID;
	style.textContent = `:root { --cnl-spotlight-accent: ${ GLOBAL_COLOR }; }
${ css }`;
	canvasDocument.head.appendChild( style );

	return style;
}

/**
 * Outline what is being edited, and only that. Marks left from an earlier
 * render are cleared, and those still right left alone.
 *
 * @param {Document}      canvasDocument The canvas document.
 * @param {HTMLElement[]} nodes          What is being edited.
 */
function markFocus( canvasDocument, nodes ) {
	canvasDocument
		.querySelectorAll( `[${ FOCUS_ATTRIBUTE }]` )
		.forEach( ( other ) => {
			if ( ! nodes.includes( other ) ) {
				other.removeAttribute( FOCUS_ATTRIBUTE );
			}
		} );

	nodes.forEach( ( node ) => {
		if ( ! node.hasAttribute( FOCUS_ATTRIBUTE ) ) {
			node.setAttribute( FOCUS_ATTRIBUTE, '' );
		}
	} );
}

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
 * Put the part in the spotlight: mark it, and fade back everything beside it
 * and beside each of its ancestors, which is the rest of the page. Marks left
 * from an earlier render are cleared, and those still right left alone.
 *
 * @param {HTMLElement} node The part.
 * @param {string}      area `header` or `footer`.
 */
function markSpotlight( node, area ) {
	const canvasDocument = node.ownerDocument;
	const faded = new Set();

	for (
		let current = node;
		current?.parentElement && current !== canvasDocument.body;
		current = current.parentElement
	) {
		for ( const sibling of current.parentElement.children ) {
			if ( sibling !== current && ! sibling.matches( NOT_FADED ) ) {
				faded.add( sibling );
			}
		}
	}

	canvasDocument
		.querySelectorAll( `[${ SPOTLIGHT_ATTRIBUTE }]` )
		.forEach( ( other ) => {
			if ( other !== node ) {
				other.removeAttribute( SPOTLIGHT_ATTRIBUTE );
			}
		} );
	canvasDocument
		.querySelectorAll( `[${ FADED_ATTRIBUTE }]` )
		.forEach( ( other ) => {
			if ( ! faded.has( other ) ) {
				other.removeAttribute( FADED_ATTRIBUTE );
			}
		} );

	if ( node.getAttribute( SPOTLIGHT_ATTRIBUTE ) !== area ) {
		node.setAttribute( SPOTLIGHT_ATTRIBUTE, area );
	}

	faded.forEach( ( other ) => {
		if ( ! other.hasAttribute( FADED_ATTRIBUTE ) ) {
			other.setAttribute( FADED_ATTRIBUTE, '' );
		}
	} );
}

function clearSpotlight( canvasDocument ) {
	canvasDocument
		.querySelectorAll(
			`[${ SPOTLIGHT_ATTRIBUTE }], [${ FADED_ATTRIBUTE }], [${ FOCUS_ATTRIBUTE }]`
		)
		.forEach( ( node ) => {
			node.removeAttribute( SPOTLIGHT_ATTRIBUTE );
			node.removeAttribute( FADED_ATTRIBUTE );
			node.removeAttribute( FOCUS_ATTRIBUTE );
		} );
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

		if ( isPreviewing ) {
			scrollToPart( node, area );
		}

		return () => {
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

	// Mark the part, and keep it marked as the editor re-renders it.
	useEffect( () => {
		if ( ! canvasDocument?.body || ! clientId ) {
			return undefined;
		}

		const style = addStyles( canvasDocument, EDITOR_STYLES );

		const mark = () => {
			const node = canvasDocument.getElementById( `block-${ clientId }` );

			if ( node ) {
				markSpotlight( node, area );
				markFocus(
					canvasDocument,
					focusClientIds
						.split( ',' )
						.filter( Boolean )
						.map( ( id ) =>
							canvasDocument.getElementById( `block-${ id }` )
						)
						.filter( Boolean )
				);
			} else {
				clearSpotlight( canvasDocument );
			}
		};

		mark();

		const observer = new canvasDocument.defaultView.MutationObserver(
			mark
		);
		observer.observe( canvasDocument.body, {
			childList: true,
			subtree: true,
		} );

		return () => {
			observer.disconnect();
			style.remove();
			clearSpotlight( canvasDocument );
		};
	}, [ area, canvasDocument, clientId, focusClientIds ] );

	/*
	 * Bring it into view whenever it comes on show. Its blocks render a moment
	 * after it does, and a footer moves down as the page above it fills in, so
	 * this tries again for a little while.
	 */
	useEffect( () => {
		if ( ! isActive ) {
			return undefined;
		}

		const timeouts = [ 0, 300, 900 ].map( ( delay ) =>
			window.setTimeout( () => {
				const node = canvasDocument.getElementById(
					`block-${ clientId }`
				);

				if ( node ) {
					scrollToPart( node, area );
				}
			}, delay )
		);

		return () => timeouts.forEach( window.clearTimeout );
	}, [ area, canvasDocument, clientId, isActive ] );
}
