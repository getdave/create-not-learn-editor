/**
 * The spotlight on the Header and Footer canvases: the part the screen is
 * about, brought into view, with the rest of the page faded back and dimmed
 * behind a dark backdrop. In Browse this is laid over the saved site; in Edit
 * the part is editable too, and the rest of the page out of reach.
 *
 * In Edit the part is entered as a section, as core does when a pattern or
 * template part is edited in place. That makes everything outside it inert,
 * so all that is added here is keeping it entered and scrolled to.
 */

/**
 * Internal dependencies
 */
import { unlock } from '../../lock-unlock';
import {
	blockEditorStore,
	useEffect,
	useRegistry,
	useSelect,
} from '../../wordpress-packages';

const SPOTLIGHT_ATTRIBUTE = 'data-cnl-spotlight';
const FADED_ATTRIBUTE = 'data-cnl-spotlight-faded';
const STYLE_ID = 'cnl-site-part-spotlight';

/*
 * The rest of the page is faded back, and the dark backdrop laid over it.
 * The backdrop is the part's own shadow, spread far enough to cover any
 * page, with the part lifted over what follows it so the shadow lies on top.
 * `:where()` keeps a theme's sticky or fixed header as it is.
 */
const SPOTLIGHT_STYLES = `
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
	style.textContent = css;
	canvasDocument.head.appendChild( style );

	return style;
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
			`[${ SPOTLIGHT_ATTRIBUTE }], [${ FADED_ATTRIBUTE }]`
		)
		.forEach( ( node ) => {
			node.removeAttribute( SPOTLIGHT_ATTRIBUTE );
			node.removeAttribute( FADED_ATTRIBUTE );
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
 * @param {Object}  options.frame        The canvas's preview frame.
 * @param {boolean} options.isPreviewing Whether Browse is on.
 */
function usePreviewSpotlight( { area, frame, isPreviewing } ) {
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

		if ( isPreviewing ) {
			scrollToPart( node, area );
		}

		return () => {
			style.remove();
			clearSpotlight( previewDocument );
		};
	}, [ area, iframeRef, isLoading, isPreviewing ] );
}

/**
 * Keep the part in the spotlight, in Browse and in Edit.
 *
 * @param {Object}    options
 * @param {string}    options.area           `header` or `footer`.
 * @param {?Document} options.canvasDocument The editor's canvas document.
 * @param {?string}   options.clientId       The part's client ID.
 * @param {Object}    options.frame          The canvas's preview frame.
 * @param {boolean}   options.isPreviewing   Whether Browse is on.
 */
export function useSitePartSpotlight( {
	area,
	canvasDocument,
	clientId,
	frame,
	isPreviewing,
} ) {
	usePreviewSpotlight( { area, frame, isPreviewing } );

	const registry = useRegistry();
	const editedSection = useSelect(
		( select ) =>
			unlock( select( blockEditorStore ) ).getEditedContentOnlySection(),
		[]
	);
	const isActive = Boolean( clientId && canvasDocument && ! isPreviewing );

	/*
	 * Enter the part, and again whenever it is left: Escape, or a click
	 * outside it, would otherwise drop out of the spotlight.
	 */
	useEffect( () => {
		if ( isActive && editedSection !== clientId ) {
			unlock(
				registry.dispatch( blockEditorStore )
			).editContentOnlySection( clientId );
		}
	}, [ clientId, editedSection, isActive, registry ] );

	// Leave it on the way out, so other canvases find the page unlocked.
	useEffect(
		() => () =>
			unlock(
				registry.dispatch( blockEditorStore )
			).stopEditingContentOnlySection(),
		[ registry ]
	);

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
	}, [ area, canvasDocument, clientId ] );

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
