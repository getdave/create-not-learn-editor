/**
 * In Edit, sections are outlined and named as Compose outlines and names
 * them: the section pointed at, and the section being worked in, which stays
 * outlined while the caret is in one of its blocks, so it is clear which
 * section a change lands in.
 *
 * Core outlines only the page's content as a whole when pointed at, never one
 * section, so its outline is hidden and these are drawn over the canvas
 * instead, where Compose draws its own. They let every click through to the
 * page underneath.
 *
 * They are drawn inside the editor's content region rather than over the
 * editor as a whole. The region isolates its own stacking, so only from inside
 * it can the outlines sit under core's block toolbars.
 */

/**
 * WordPress dependencies
 */
import { createPortal } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { observeHost } from '../editor-layer/portal-host';
import { unlock } from '../lock-unlock';
import { getSectionTitle } from '../routes/content/pages/page-sections';
import {
	__,
	blockEditorStore,
	useEffect,
	useMemo,
	useRef,
	useRegistry,
	useSelect,
	useState,
} from '../wordpress-packages';
import { useBlockRects } from './compose/use-block-rects';
import { useCanvasDocument } from './use-canvas-document';
import { useCanvasStyles } from './use-canvas-styles';

const STYLE_ID = 'cnl-section-outline';

const CONTENT_REGION = '.interface-interface-skeleton__content';

// The label's inset from the outline, and its height, in pixels on screen.
const LABEL_INSET = 8;
const LABEL_HEIGHT = 24;

/**
 * The section, among the page's top-level blocks, that a block is in, or is.
 *
 * @param {Object}  store    The block editor's selectors, unlocked.
 * @param {?string} clientId A block.
 * @return {?string} The section's client ID.
 */
function getSectionOf( store, clientId ) {
	const root = store.getSectionRootClientId();

	if ( ! root || ! clientId ) {
		return null;
	}

	return (
		[ ...store.getBlockParents( clientId ), clientId ].find(
			( id ) => store.getBlockRootClientId( id ) === root
		) || null
	);
}

/**
 * The section pointed at in the canvas.
 *
 * @param {boolean} isActive  Whether Edit is on.
 * @param {Object}  editorRef Ref to the editor's container.
 * @return {?string} The section's client ID.
 */
function useHoveredSection( isActive, editorRef ) {
	const registry = useRegistry();
	const canvasDocument = useCanvasDocument( editorRef );
	const [ hoveredId, setHoveredId ] = useState( null );

	useEffect( () => {
		if ( ! isActive || ! canvasDocument ) {
			setHoveredId( null );
			return undefined;
		}

		const store = unlock( registry.select( blockEditorStore ) );
		const onPointerOver = ( event ) => {
			const block = event.target.closest?.( '[data-block]' );

			setHoveredId(
				block ? getSectionOf( store, block.dataset.block ) : null
			);
		};
		// Leaving the canvas altogether.
		const onPointerOut = ( event ) => {
			if ( ! event.relatedTarget ) {
				setHoveredId( null );
			}
		};

		canvasDocument.addEventListener( 'pointerover', onPointerOver );
		canvasDocument.addEventListener( 'pointerout', onPointerOut );

		return () => {
			canvasDocument.removeEventListener( 'pointerover', onPointerOver );
			canvasDocument.removeEventListener( 'pointerout', onPointerOut );
		};
	}, [ canvasDocument, isActive, registry ] );

	return hoveredId;
}

/**
 * A host for the outlines in this editor's content region.
 *
 * @param {boolean} isActive  Whether Edit is on.
 * @param {Object}  editorRef Ref to the editor's container.
 * @return {?HTMLElement} The host, or null until the region exists.
 */
function useContentHost( isActive, editorRef ) {
	const [ host, setHost ] = useState( null );

	useEffect( () => {
		if ( ! isActive || ! editorRef.current ) {
			setHost( null );
			return undefined;
		}

		return observeHost(
			CONTENT_REGION,
			'cnl-section-outline-host',
			setHost,
			editorRef.current
		);
	}, [ editorRef, isActive ] );

	return host;
}

/**
 * @param {Object}  props
 * @param {Object}  props.editorRef Ref to the editor's container.
 * @param {boolean} props.isActive  Whether the canvas is in Edit.
 * @return {?Element} The outlines.
 */
export function SectionOutline( { editorRef, isActive } ) {
	const layerRef = useRef();
	const host = useContentHost( isActive, editorRef );
	const hoveredId = useHoveredSection( isActive, editorRef );
	const { activeId, activeTitle, hoveredTitle, rootId } = useSelect(
		( select ) => {
			if ( ! isActive ) {
				return {
					activeId: null,
					activeTitle: '',
					hoveredTitle: '',
					rootId: null,
				};
			}

			const store = unlock( select( blockEditorStore ) );
			const active = getSectionOf(
				store,
				store.getBlockSelectionStart()
			);
			const getTitle = ( id ) => {
				const block = id && store.getBlock( id );

				return block ? getSectionTitle( block ) : __( 'Section' );
			};

			return {
				activeId: active,
				activeTitle: active ? getTitle( active ) : '',
				hoveredTitle: hoveredId ? getTitle( hoveredId ) : '',
				rootId: store.getSectionRootClientId() || null,
			};
		},
		[ hoveredId, isActive ]
	);
	const shownIds = useMemo(
		() => [ ...new Set( [ activeId, hoveredId ].filter( Boolean ) ) ],
		[ activeId, hoveredId ]
	);
	const { frame, rects } = useBlockRects( {
		clientIds: shownIds,
		editorRef,
		isActive: shownIds.length > 0,
		layerRef,
	} );

	// Core's outline around the page's content as a whole, drawn as it is
	// pointed at, gives way to the section's own.
	useCanvasStyles(
		isActive && Boolean( rootId ),
		editorRef,
		STYLE_ID,
		rootId ? `#block-${ rootId }.is-hovered::after { display: none; }` : ''
	);

	const renderOutline = ( clientId, title ) => {
		const rect = rects[ clientId ];

		if ( ! rect ) {
			return null;
		}

		return (
			<div
				className="cnl-section-outline__box"
				key={ clientId }
				style={ {
					height: rect.height,
					left: rect.left - frame.left,
					top: rect.top - frame.top,
					width: rect.width,
				} }
			>
				<span
					className="cnl-section-outline__label"
					// Kept in view while the section's top is scrolled out
					// of it, and inside the section.
					style={ {
						top: Math.max(
							LABEL_INSET,
							Math.min(
								frame.top - rect.top + LABEL_INSET,
								rect.height - LABEL_HEIGHT - LABEL_INSET
							)
						),
					} }
				>
					{ title }
				</span>
			</div>
		);
	};

	if ( ! host ) {
		return null;
	}

	return createPortal(
		<div aria-hidden className="cnl-section-outline" ref={ layerRef }>
			{ frame && (
				<div
					className="cnl-section-outline__clip"
					style={ {
						height: frame.height,
						left: frame.left,
						top: frame.top,
						width: frame.width,
					} }
				>
					{ hoveredId &&
						hoveredId !== activeId &&
						renderOutline( hoveredId, hoveredTitle ) }
					{ activeId && renderOutline( activeId, activeTitle ) }
				</div>
			) }
		</div>,
		host
	);
}
