/**
 * What the pointer does in the editor's canvas while Edit's section layer is
 * on: which section it is over, and which clicks reach the page.
 *
 * The canvas is the page itself, in an iframe, so both are watched from
 * inside it. The layer's own controls sit over the iframe in the editor's
 * document, so moving onto them leaves the canvas without leaving the
 * section, and the section is held a moment for the pointer to arrive.
 */

/**
 * Internal dependencies
 */
import {
	useCallback,
	useEffect,
	useRef,
	useState,
} from '../../wordpress-packages';

// How long the section stays pointed at after the pointer leaves it, for
// the pointer to reach the controls over it.
const LEAVE_DELAY_MS = 120;

// Every event that would select a block, place the caret or follow a link.
const POINTER_EVENTS = [
	'pointerdown',
	'mousedown',
	'mouseup',
	'click',
	'dblclick',
];

/**
 * The section, header or footer a block belongs to.
 *
 * @param {Object}      store    `blockEditorStore` selectors.
 * @param {Set<string>} targets  Client IDs of the sections, header and
 *                               footer.
 * @param {?string}     clientId A block.
 * @return {?string} The client ID of the one it is in, or is.
 */
export function getTargetOf( store, targets, clientId ) {
	if ( ! clientId ) {
		return null;
	}

	return (
		[ ...store.getBlockParents( clientId ), clientId ].find( ( id ) =>
			targets.has( id )
		) || null
	);
}

/**
 * The section pointed at, from the canvas and from the layer's controls.
 *
 * @param {Object}    options
 * @param {boolean}   options.isActive       Whether the layer is on.
 * @param {?Document} options.canvasDocument The editor's canvas, shared
 *                                           with `useCanvasGuard` so the
 *                                           two start together.
 * @param {Function}  options.findTarget     Called with a block's client
 *                                           ID, returns its section's.
 * @return {Object} `{ hoveredId, hold, release }`. `hold` keeps a section
 *                  pointed at while the pointer is on its controls, and
 *                  `release` lets it go when the pointer leaves them.
 */
export function useCanvasHover( { canvasDocument, findTarget, isActive } ) {
	const [ hoveredId, setHoveredId ] = useState( null );
	const timerRef = useRef();
	const findRef = useRef( findTarget );

	findRef.current = findTarget;

	const cancel = () => window.clearTimeout( timerRef.current );
	const release = useCallback( () => {
		cancel();
		timerRef.current = window.setTimeout(
			() => setHoveredId( null ),
			LEAVE_DELAY_MS
		);
	}, [] );
	const hold = useCallback( ( clientId ) => {
		cancel();
		setHoveredId( clientId );
	}, [] );

	useEffect( () => {
		if ( ! isActive || ! canvasDocument ) {
			cancel();
			setHoveredId( null );
			return undefined;
		}

		const onPointerOver = ( event ) => {
			const block = event.target.closest?.( '[data-block]' );

			cancel();
			setHoveredId(
				block ? findRef.current( block.dataset.block ) : null
			);
		};
		// Leaving the canvas, perhaps for the controls over it.
		const onPointerOut = ( event ) => {
			if ( ! event.relatedTarget ) {
				release();
			}
		};

		canvasDocument.addEventListener( 'pointerover', onPointerOver );
		canvasDocument.addEventListener( 'pointerout', onPointerOut );

		return () => {
			cancel();
			canvasDocument.removeEventListener( 'pointerover', onPointerOver );
			canvasDocument.removeEventListener( 'pointerout', onPointerOut );
		};
	}, [ canvasDocument, isActive, release ] );

	return { hold, hoveredId, release };
}

/**
 * Keep clicks off the page unless they land in the section being edited in
 * a mode that edits it in place. Anything else is caught before core sees
 * it, so no block is selected, no caret placed and no link followed.
 *
 * @param {Object}    options
 * @param {?Document} options.canvasDocument The editor's canvas.
 * @param {boolean}   options.isActive       Whether the layer is on.
 * @param {Function}  options.findTarget     Called with a block's client ID,
 *                                           returns its section's.
 * @param {Function}  options.allows         Called with a section's client ID,
 *                                           or null, returns whether a click
 *                                           there reaches the page.
 * @param {Function}  options.onBlocked      Called on each click kept off it.
 * @param {Function}  options.onDoubleClick  Called with a section's client ID
 *                                           and the event, on a double click
 *                                           kept off it.
 * @param {Function}  options.onEscape       Called on Escape in the canvas.
 */
export function useCanvasGuard( {
	allows,
	canvasDocument,
	findTarget,
	isActive,
	onBlocked,
	onDoubleClick,
	onEscape,
} ) {
	const latestRef = useRef();

	latestRef.current = {
		allows,
		findTarget,
		onBlocked,
		onDoubleClick,
		onEscape,
	};

	useEffect( () => {
		if ( ! isActive || ! canvasDocument ) {
			return undefined;
		}

		const guard = ( event ) => {
			const latest = latestRef.current;
			const block = event.target.closest?.( '[data-block]' );
			const target = block
				? latest.findTarget( block.dataset.block )
				: null;

			if ( latest.allows( target ) ) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();

			if ( event.type === 'pointerdown' ) {
				latest.onBlocked( target );
			}

			if ( event.type === 'dblclick' && target ) {
				latest.onDoubleClick( target, event );
			}
		};
		const onKeyDown = ( event ) => {
			if ( event.key === 'Escape' ) {
				latestRef.current.onEscape( event );
			}
		};

		POINTER_EVENTS.forEach( ( type ) =>
			canvasDocument.addEventListener( type, guard, true )
		);
		canvasDocument.addEventListener( 'keydown', onKeyDown, true );

		return () => {
			POINTER_EVENTS.forEach( ( type ) =>
				canvasDocument.removeEventListener( type, guard, true )
			);
			canvasDocument.removeEventListener( 'keydown', onKeyDown, true );
		};
	}, [ canvasDocument, isActive ] );
}
