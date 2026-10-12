/**
 * The spotlight on the Header and Footer canvases: the part the screen is
 * about, brought into view and editable, with the rest of the page faded
 * back and out of reach.
 *
 * The part is entered as a section, as core does when a pattern or template
 * part is edited in place. That makes everything outside it inert and fades
 * it, so all that is added here is keeping it entered and scrolled to.
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

/*
 * Core fades the page around an entered section, but also the section itself
 * until something in it is picked. The part is the point of the screen, so it
 * always stays clear.
 */
const CANVAS_STYLES = `
[${ SPOTLIGHT_ATTRIBUTE }],
[${ SPOTLIGHT_ATTRIBUTE }] .block-editor-block-list__block { opacity: 1 !important; }
`;

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
 * Keep the part in the spotlight while the editor is on show.
 *
 * @param {Object}    options
 * @param {string}    options.area           `header` or `footer`.
 * @param {?Document} options.canvasDocument The editor's canvas document.
 * @param {?string}   options.clientId       The part's client ID.
 * @param {boolean}   options.isPreviewing   Whether Preview is on.
 */
export function useSitePartSpotlight( {
	area,
	canvasDocument,
	clientId,
	isPreviewing,
} ) {
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

		const style = canvasDocument.createElement( 'style' );
		style.id = 'cnl-site-part-spotlight';
		style.textContent = CANVAS_STYLES;
		canvasDocument.head.appendChild( style );

		const mark = () => {
			canvasDocument
				.querySelectorAll( `[${ SPOTLIGHT_ATTRIBUTE }]` )
				.forEach( ( node ) => {
					if ( node.id !== `block-${ clientId }` ) {
						node.removeAttribute( SPOTLIGHT_ATTRIBUTE );
					}
				} );
			canvasDocument
				.getElementById( `block-${ clientId }` )
				?.setAttribute( SPOTLIGHT_ATTRIBUTE, area );
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
			canvasDocument
				.querySelectorAll( `[${ SPOTLIGHT_ATTRIBUTE }]` )
				.forEach( ( node ) =>
					node.removeAttribute( SPOTLIGHT_ATTRIBUTE )
				);
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
