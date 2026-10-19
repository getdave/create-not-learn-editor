/**
 * A header or footer in the spotlight on the editor's canvas: brought
 * forward, with the rest of the page faded back and dimmed behind a dark
 * backdrop, so it is clear that what is being changed is shared by every
 * page.
 *
 * The Header and Footer screens keep their part in it throughout, and Edit's
 * section layer puts a header or footer in it while one is open on any other
 * page, so it looks the same however it was reached. See
 * `src/routes/site-part/spotlight.js` and `SectionModesLayer`.
 */

/**
 * Internal dependencies
 */
import { GLOBAL_COLOR } from '../global-scope';
import { useEffect } from '../wordpress-packages';

const SPOTLIGHT_ATTRIBUTE = 'data-cnl-spotlight';
const FADED_ATTRIBUTE = 'data-cnl-spotlight-faded';
const FOCUS_ATTRIBUTE = 'data-cnl-spotlight-focus';
const STYLE_ID = 'cnl-site-part-spotlight';

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
export const SPOTLIGHT_STYLES = `
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

/*
 * Not the page's content, so left as they are: what is never drawn, and the
 * editor's layer for what is drawn over the canvas, like section outlines.
 */
const NOT_FADED =
	'style, script, link, meta, template, noscript, body > svg, .block-canvas-cover';

export function addStyles( canvasDocument, css ) {
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
export function markFocus( canvasDocument, nodes ) {
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
 * Put the part in the spotlight: mark it, and fade back everything beside it
 * and beside each of its ancestors, which is the rest of the page. Marks left
 * from an earlier render are cleared, and those still right left alone.
 *
 * @param {HTMLElement} node The part.
 * @param {string}      area `header` or `footer`.
 */
export function markSpotlight( node, area ) {
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

export function clearSpotlight( canvasDocument ) {
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
 * Keep a header or footer in the spotlight on the editor's canvas, and
 * marked as the editor re-renders it.
 *
 * @param {Object}    options
 * @param {?string}   options.area           `header` or `footer`.
 * @param {?Document} options.canvasDocument The editor's canvas document.
 * @param {?string}   options.clientId       The part's client ID, or null
 *                                           for none in the spotlight.
 * @param {string}    options.focusClientIds What is outlined in the part,
 *                                           joined with commas.
 */
export function useEditorSpotlight( {
	area,
	canvasDocument,
	clientId,
	focusClientIds = '',
} ) {
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
}
