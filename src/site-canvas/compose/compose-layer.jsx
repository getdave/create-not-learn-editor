/**
 * The Compose layer: everything Compose lets you do, drawn over the zoomed-out
 * editor.
 *
 * It takes every click, key and scroll over the canvas, so nothing on the page
 * can be typed into and none of core's own zoom-out tools ever come up. The
 * page's sections, header and footer are drawn over as outlines to point at
 * and pick. A picked section can be moved, removed, given another layout or
 * colours, or opened in Edit; a header or footer can be given another design.
 * New sections are added from the section picker, from the gaps between
 * sections and the box after the last one, or a page with none.
 *
 * Changes go straight to the editor's blocks, so they are undone like any
 * other edit, and the page's sidebar list follows them.
 */

/**
 * Internal dependencies
 */
import { openSectionPicker } from '../../editor-layer/section-picker';
import {
	getDropIndex,
	getSectionTitle,
	getTemplateElementLabel,
} from '../../routes/content/pages/page-sections';
import {
	__,
	blockEditorStore,
	Button,
	coreDataStore,
	EmptyState,
	noticesStore,
	plusIcon,
	sprintf,
	UiButton,
	useCallback,
	useDispatch,
	useEffect,
	useMemo,
	useRef,
	useRegistry,
	useSelect,
	useState,
} from '../../wordpress-packages';
import { sectionsIcon } from '../icons';
import { useCanvasStyles } from '../use-canvas-styles';
import { getCanvasFrame, useBlockRects } from './use-block-rects';
import { useComposeStructure } from './use-compose-structure';
import { PartToolbar, SectionToolbar } from './section-toolbar';

const STYLE_ID = 'cnl-compose';

// Room left under the last section for the box to add another, in pixels on
// screen.
const END_SPACE = 104;

// Height kept for a page with no sections, in pixels on screen.
const EMPTY_SPACE = 320;

// How close to the canvas's top and bottom a dragged section scrolls it.
const SCROLL_EDGE = 48;

// Core's block toolbar, with its border, and the gap core leaves between it
// and its block.
const TOOLBAR_HEIGHT = 50;
const TOOLBAR_GAP = 8;

// The zone around each "+" that keeps it showing, in pixels on screen.
const GAP_ZONE = { height: 40, width: 96 };

/**
 * Styles Compose adds to the canvas: room for its boxes, and none of the
 * zoomed-out page's own appenders and separators.
 *
 * @param {string}  rootClientId The sections' parent.
 * @param {boolean} isEmpty      Whether the page has no sections.
 * @return {string} CSS.
 */
function getCanvasStyles( rootClientId, isEmpty ) {
	const scale = 'var(--wp-block-editor-iframe-zoom-out-scale, 1)';
	const root = rootClientId ? `#block-${ rootClientId }` : null;

	return [
		`.block-editor-block-list__zoom-out-separator,
		.block-list-appender,
		.block-editor-default-block-appender {
			display: none !important;
		}`,
		root &&
			`${ root } {
				padding-bottom: calc(${ END_SPACE }px / ${ scale }) !important;
			}`,
		root &&
			isEmpty &&
			`${ root } {
				min-height: calc(${ EMPTY_SPACE }px / ${ scale }) !important;
			}`,
	]
		.filter( Boolean )
		.join( '\n' );
}

/**
 * Scroll the canvas to a block, unless it is already in view.
 *
 * Scrolled on the canvas's own window rather than with `scrollIntoView`,
 * which also scrolls every container around the iframe.
 *
 * @param {Object} editorRef Ref to the editor's container.
 * @param {string} clientId  The block's client ID.
 */
export function scrollCanvasTo( editorRef, clientId ) {
	const doc = getCanvasFrame( editorRef.current )?.contentDocument;
	const node = doc?.getElementById( `block-${ clientId }` );

	if ( ! node ) {
		return;
	}

	const view = doc.defaultView;
	const rect = node.getBoundingClientRect();

	if ( rect.top >= 0 && rect.bottom <= view.innerHeight ) {
		return;
	}

	const reduceMotion = view.matchMedia(
		'(prefers-reduced-motion: reduce)'
	).matches;

	view.scrollTo( {
		behavior: reduceMotion ? 'auto' : 'smooth',
		top: view.scrollY + rect.top - 24,
	} );
}

/**
 * The block in the canvas under a point on screen, through the layer.
 *
 * @param {Object} editorRef Ref to the editor's container.
 * @param {Object} event     A pointer event, for its position.
 * @return {?string} The innermost block's client ID.
 */
function getBlockAtPoint( editorRef, event ) {
	const iframe = getCanvasFrame( editorRef.current );
	const doc = iframe?.contentDocument;

	if ( ! doc ) {
		return null;
	}

	const frame = iframe.getBoundingClientRect();
	const x = event.clientX - frame.left;
	const y = event.clientY - frame.top;
	const hit = doc.elementFromPoint( x, y )?.closest( '[data-block]' );

	if ( ! hit ) {
		return null;
	}

	/*
	 * Zoomed out, core stops pointer events inside each section, so the hit
	 * is the section. The innermost block under the point is found by where
	 * the section's blocks are drawn instead: in document order, a block
	 * comes after the blocks around it, so the last to contain the point is
	 * the innermost.
	 */
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

function useNoSync() {
	return null;
}

/**
 * Position a box on the layer, relative to the canvas it is clipped to.
 *
 * @param {Object} rect  `{ top, left, width, height }` on the layer.
 * @param {Object} frame The canvas's own rect on the layer.
 * @return {Object} Inline style.
 */
function place( rect, frame ) {
	return {
		height: rect.height,
		left: rect.left - frame.left,
		top: rect.top - frame.top,
		width: rect.width,
	};
}

/**
 * @param {Object}   props
 * @param {Object}   props.editorRef Ref to the editor's container.
 * @param {Function} props.onEdit    Opens a section, header or footer in
 *                                   Edit. Called with its client ID, and
 *                                   whether it is a header or footer.
 * @param {Function} props.onExit    Leaves Compose for Edit, on Escape with
 *                                   nothing picked.
 * @param {Function} props.onOpen    Opens Edit on a block double-clicked on
 *                                   the page, called with its client ID, or
 *                                   nothing when no block was hit.
 * @param {Function} props.useSync   A hook linking the layer to a list of
 *                                   the same sections elsewhere, such as
 *                                   the Pages sidebar. It returns
 *                                   `{ hoveredId, selectedId, onHover,
 *                                   onSelect }`, all in the editor's
 *                                   client IDs.
 * @return {Element} The layer.
 */
export function ComposeLayer( {
	editorRef,
	onEdit,
	onExit,
	onOpen,
	useSync = useNoSync,
} ) {
	const registry = useRegistry();
	const sync = useSync();
	const layerRef = useRef();
	const { parts, rootClientId, sectionIds, templateElements } =
		useComposeStructure();
	const [ hoveredId, setHoveredId ] = useState( null );
	const [ hoveredGap, setHoveredGap ] = useState( null );
	const [ selectedId, setSelectedId ] = useState( null );
	const [ drag, setDrag ] = useState( null );
	const dragRef = useRef( null );
	const { moveBlocksToPosition, removeBlocks } =
		useDispatch( blockEditorStore );
	const { createSuccessNotice } = useDispatch( noticesStore );

	const isEmpty = sectionIds.length === 0;
	const measuredIds = useMemo(
		() => [
			...( rootClientId ? [ rootClientId ] : [] ),
			...sectionIds,
			...templateElements.map( ( element ) => element.clientId ),
		],
		[ rootClientId, sectionIds, templateElements ]
	);
	const { frame, rects } = useBlockRects( {
		clientIds: measuredIds,
		editorRef,
		isActive: true,
		layerRef,
	} );

	useCanvasStyles(
		true,
		editorRef,
		STYLE_ID,
		useMemo(
			() => getCanvasStyles( rootClientId, isEmpty ),
			[ isEmpty, rootClientId ]
		)
	);

	const sections = useSelect(
		( select ) =>
			select( blockEditorStore ).getBlocksByClientId( sectionIds ),
		[ sectionIds ]
	);
	const titles = useMemo(
		() =>
			sections.map( ( block ) =>
				block ? getSectionTitle( block ) : __( 'Section' )
			),
		[ sections ]
	);
	const getPartTitle = ( part ) => getTemplateElementLabel( part );

	const pick = useCallback(
		( clientId ) => {
			setSelectedId( clientId );
			sync?.onSelect?.( clientId );
		},
		[ sync ]
	);
	const hover = ( clientId ) => {
		setHoveredId( clientId );
		sync?.onHover?.( clientId );
	};

	// What the sidebar points at and picks, the layer does too.
	const syncedSelectedId = sync?.selectedId ?? null;
	useEffect( () => {
		if ( syncedSelectedId ) {
			setSelectedId( syncedSelectedId );
			scrollCanvasTo( editorRef, syncedSelectedId );
		}
	}, [ editorRef, syncedSelectedId ] );

	// Something picked gone, removed say, is no longer picked.
	useEffect( () => {
		if (
			selectedId &&
			! sectionIds.includes( selectedId ) &&
			! parts.some( ( part ) => part.clientId === selectedId )
		) {
			setSelectedId( null );
		}
	}, [ parts, sectionIds, selectedId ] );

	/*
	 * A block selected in the editor, as the section picker does with what it
	 * adds, picks its section here instead, and is let go of in the editor so
	 * core's zoom-out has nothing to draw its toolbar over.
	 */
	const editorSelectedId = useSelect(
		( selectStore ) =>
			selectStore( blockEditorStore ).getSelectedBlockClientId(),
		[]
	);
	useEffect( () => {
		if ( ! editorSelectedId ) {
			return;
		}

		const { getBlockParents } = registry.select( blockEditorStore );
		const lineage = [
			...getBlockParents( editorSelectedId ),
			editorSelectedId,
		];
		const picked =
			lineage.find( ( clientId ) => sectionIds.includes( clientId ) ) ||
			lineage.find( ( clientId ) =>
				parts.some( ( part ) => part.clientId === clientId )
			);

		registry.dispatch( blockEditorStore ).clearSelectedBlock();

		if ( picked ) {
			pick( picked );
			window.setTimeout( () => scrollCanvasTo( editorRef, picked ), 50 );
		}
	}, [ editorRef, editorSelectedId, parts, pick, registry, sectionIds ] );

	/*
	 * Escape lets go of what is picked, or with nothing picked, leaves
	 * Compose for Edit. Not while a menu or the section picker is open,
	 * where Escape closes that instead.
	 */
	const latestKeyRef = useRef();
	latestKeyRef.current = { onExit, pick, selectedId };
	useEffect( () => {
		const onKeyDown = ( event ) => {
			if (
				event.key !== 'Escape' ||
				event.defaultPrevented ||
				dragRef.current ||
				event.target.closest?.(
					'.components-popover, .components-modal__frame'
				)
			) {
				return;
			}

			const latest = latestKeyRef.current;

			event.preventDefault();

			if ( latest.selectedId ) {
				latest.pick( null );
			} else {
				latest.onExit?.();
			}
		};

		window.addEventListener( 'keydown', onKeyDown );

		return () => window.removeEventListener( 'keydown', onKeyDown );
	}, [] );

	// Scrolling over the layer scrolls the canvas under it.
	useEffect( () => {
		const layer = layerRef.current;

		if ( ! layer ) {
			return undefined;
		}

		const onWheel = ( event ) => {
			const view = getCanvasFrame( editorRef.current )?.contentWindow;

			if ( ! view || event.target.closest( '.components-popover' ) ) {
				return;
			}

			event.preventDefault();
			view.scrollBy( { left: 0, top: event.deltaY } );
		};

		layer.addEventListener( 'wheel', onWheel, { passive: false } );

		return () => layer.removeEventListener( 'wheel', onWheel );
	}, [ editorRef ] );

	const addAt = ( index ) =>
		openSectionPicker( { index, rootClientId: rootClientId || '' } );

	const remove = ( clientId, index ) => {
		removeBlocks( [ clientId ], false );
		setSelectedId( null );
		createSuccessNotice(
			sprintf(
				/* translators: %s: section name. */
				__( 'Removed “%s”.' ),
				titles[ index ]
			),
			{
				actions: [
					{
						label: __( 'Undo' ),
						onClick: () =>
							registry.dispatch( coreDataStore ).undo(),
					},
				],
				id: 'cnl-compose-section-removed',
				type: 'snackbar',
			}
		);
	};

	/*
	 * Sections are dragged with pointer events rather than native drag and
	 * drop, as in the Pages sidebar, so the cursor stays a grab hand. The
	 * canvas scrolls when dragged near its edges, and Escape puts the section
	 * back.
	 */
	const latestRef = useRef();
	latestRef.current = { frame, rects, rootClientId, sectionIds };

	const startDrag = ( event, clientId, from ) => {
		if ( event.button !== 0 ) {
			return;
		}

		event.preventDefault();
		dragRef.current?.stop();

		const getTarget = ( clientY ) => {
			const latest = latestRef.current;
			const origin = layerRef.current.getBoundingClientRect();
			const y = clientY - origin.top;
			const ids = latest.sectionIds;
			let over = ids.length - 1;
			let position = 'after';

			for ( let index = 0; index < ids.length; index++ ) {
				const rect = latest.rects[ ids[ index ] ];

				if ( rect && y < rect.top + rect.height / 2 ) {
					over = index;
					position = 'before';
					break;
				}
			}

			return {
				slot: over + ( position === 'after' ? 1 : 0 ),
				to: getDropIndex( from, over, position ),
			};
		};

		const onMove = ( moveEvent ) => {
			const latest = latestRef.current;
			const view = getCanvasFrame( editorRef.current )?.contentWindow;
			const origin = layerRef.current.getBoundingClientRect();
			const y = moveEvent.clientY - origin.top;

			if ( view && latest.frame ) {
				if ( y < latest.frame.top + SCROLL_EDGE ) {
					view.scrollBy( 0, -16 );
				} else if (
					y >
					latest.frame.top + latest.frame.height - SCROLL_EDGE
				) {
					view.scrollBy( 0, 16 );
				}
			}

			setDrag( { clientId, from, ...getTarget( moveEvent.clientY ) } );
		};

		const stop = () => {
			window.removeEventListener( 'pointermove', onMove );
			window.removeEventListener( 'pointerup', onUp );
			window.removeEventListener( 'keydown', onKey, true );
			document.body.classList.remove( 'is-dragging-compose-section' );
			dragRef.current = null;
			setDrag( null );
		};

		const onUp = ( upEvent ) => {
			const { to } = getTarget( upEvent.clientY );
			const latest = latestRef.current;

			stop();

			if ( to !== from ) {
				moveBlocksToPosition(
					[ clientId ],
					latest.rootClientId,
					latest.rootClientId,
					to
				);
			}
		};

		const onKey = ( keyEvent ) => {
			if ( keyEvent.key === 'Escape' ) {
				keyEvent.preventDefault();
				keyEvent.stopPropagation();
				stop();
			}
		};

		window.addEventListener( 'pointermove', onMove );
		window.addEventListener( 'pointerup', onUp );
		// Captured, so Escape reaches it before the layer's own handler.
		window.addEventListener( 'keydown', onKey, true );
		document.body.classList.add( 'is-dragging-compose-section' );
		dragRef.current = { stop };
		pick( clientId );
		setDrag( { clientId, from, slot: from, to: from } );
	};

	// Stop a drag that is still going if the layer goes away.
	useEffect( () => () => dragRef.current?.stop(), [] );

	const shownHoveredId = drag ? null : sync?.hoveredId || hoveredId;
	const rootRect = rootClientId ? rects[ rootClientId ] : null;
	const lastRect = rects[ sectionIds[ sectionIds.length - 1 ] ];

	/**
	 * An outline over a section, or over something the template puts around
	 * them, drawn in the template's purple so the page's own content stands
	 * apart. Of the template, only the header and footer can be picked.
	 *
	 * @param {string}  clientId           Block client ID.
	 * @param {string}  label              Its name.
	 * @param {Object}  options
	 * @param {boolean} options.isTemplate Whether the template adds it.
	 * @param {boolean} options.isPickable Whether it can be picked.
	 * @return {?Element} The outline.
	 */
	const renderOutline = (
		clientId,
		label,
		{ isTemplate = false, isPickable = true } = {}
	) => {
		const rect = rects[ clientId ];

		if ( ! rect || ! frame ) {
			return null;
		}

		const isSelected = selectedId === clientId;
		const isHovered = shownHoveredId === clientId;
		const isDragged = drag?.clientId === clientId;
		const className = [
			'cnl-compose-layer__target',
			isTemplate && 'is-template',
			isSelected && 'is-selected',
			isHovered && 'is-hovered',
			isDragged && 'is-dragged',
		]
			.filter( Boolean )
			.join( ' ' );
		// The picked one's name is on its toolbar.
		const name = isHovered && ! isSelected && (
			<span aria-hidden className="cnl-compose-layer__label">
				{ label }
				{ isTemplate && (
					<span className="cnl-compose-layer__label-note">
						{ __( 'Same on every page' ) }
					</span>
				) }
			</span>
		);

		if ( ! isPickable ) {
			return (
				<div
					aria-hidden
					className={ className }
					key={ clientId }
					onPointerEnter={ () => hover( clientId ) }
					onPointerLeave={ () => hover( null ) }
					style={ place( rect, frame ) }
				>
					{ name }
				</div>
			);
		}

		return (
			<button
				aria-label={
					isTemplate
						? sprintf(
								/* translators: %s: a part of the page, like Header. */
								__( '%s, same on every page' ),
								label
							)
						: label
				}
				aria-pressed={ isSelected }
				className={ className }
				key={ clientId }
				onClick={ ( event ) => {
					event.stopPropagation();
					pick( clientId );
				} }
				onPointerEnter={ () => hover( clientId ) }
				onPointerLeave={ () => hover( null ) }
				style={ place( rect, frame ) }
				type="button"
			>
				{ name }
			</button>
		);
	};
	const renderTemplateElement = ( element ) =>
		renderOutline( element.clientId, getTemplateElementLabel( element ), {
			isPickable: Boolean( element.area ),
			isTemplate: true,
		} );

	/*
	 * A "+" between sections, shown around the section pointed at or picked.
	 * It sits in a small zone of its own, which keeps it showing once the
	 * pointer leaves the section on its way to it. Every one can be reached
	 * from the keyboard, and shows when focused.
	 */
	const renderGap = ( index, top, isActive ) => (
		// eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- Only stops clicks reaching the section underneath.
		<div
			className={ `cnl-compose-layer__gap${
				isActive || hoveredGap === index ? ' is-visible' : ''
			}` }
			key={ `gap-${ index }` }
			// Near the "+" but not on it, a click is neither here nor on
			// the section underneath.
			onClick={ ( event ) => event.stopPropagation() }
			onPointerEnter={ () => setHoveredGap( index ) }
			onPointerLeave={ () => setHoveredGap( null ) }
			style={ {
				left:
					( rootRect ? rootRect.left : frame.left ) -
					frame.left +
					( rootRect ? rootRect.width : frame.width ) / 2 -
					GAP_ZONE.width / 2,
				top: top - frame.top - GAP_ZONE.height / 2,
			} }
		>
			<Button
				className="cnl-compose-layer__gap-button"
				icon={ plusIcon }
				label={ __( 'Add a section here' ) }
				onClick={ ( event ) => {
					event.stopPropagation();
					addAt( index );
				} }
				showTooltip
				size="small"
				variant="primary"
			/>
		</div>
	);

	// A "+" above each section; after the last, the box to add one does.
	const activeIndex = sectionIds.indexOf( shownHoveredId || selectedId );
	const gaps =
		frame && ! drag
			? sectionIds.map( ( clientId, index ) => {
					const rect = rects[ clientId ];

					return (
						rect &&
						renderGap(
							index,
							rect.top,
							activeIndex !== -1 &&
								( index === activeIndex ||
									index === activeIndex + 1 )
						)
					);
				} )
			: [];

	const renderToolbar = () => {
		const rect = rects[ selectedId ];

		if ( ! rect || ! frame || drag ) {
			return null;
		}

		/*
		 * Above what is picked, or else below it, as for a header at the top
		 * of the page, or else just inside it.
		 */
		const top = rect.top - frame.top;
		const bottom = top + rect.height;
		let toolbarTop = top + 8;

		if ( top >= TOOLBAR_HEIGHT + TOOLBAR_GAP ) {
			toolbarTop = top - TOOLBAR_HEIGHT - TOOLBAR_GAP;
		} else if ( bottom + TOOLBAR_HEIGHT + TOOLBAR_GAP <= frame.height ) {
			toolbarTop = bottom + TOOLBAR_GAP;
		}

		const style = {
			left: rect.left - frame.left,
			top: Math.max( 8, toolbarTop ),
		};
		const part = parts.find( ( item ) => item.clientId === selectedId );
		const index = sectionIds.indexOf( selectedId );

		return (
			// eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- Only stops clicks reaching the section underneath.
			<div
				className={ `cnl-compose-layer__toolbar${
					part ? ' is-template' : ''
				}` }
				onClick={ ( event ) => event.stopPropagation() }
				style={ style }
			>
				{ part ? (
					<PartToolbar
						onEdit={ () => onEdit( part.clientId, true ) }
						part={ part }
						title={ getPartTitle( part ) }
					/>
				) : (
					index !== -1 && (
						<SectionToolbar
							clientId={ selectedId }
							count={ sectionIds.length }
							index={ index }
							onDragStart={ ( event ) =>
								startDrag( event, selectedId, index )
							}
							onEdit={ () => onEdit( selectedId, false ) }
							onRemove={ () => remove( selectedId, index ) }
							onReplace={ ( block ) => pick( block.clientId ) }
							rootClientId={ rootClientId || '' }
							title={ titles[ index ] }
						/>
					)
				) }
			</div>
		);
	};

	const renderDropLine = () => {
		if ( ! drag || ! frame || drag.to === drag.from ) {
			return null;
		}

		const target = rects[ sectionIds[ drag.slot ] ];
		const top = target
			? target.top
			: lastRect && lastRect.top + lastRect.height;

		return (
			top !== undefined && (
				<div
					className="cnl-compose-layer__drop-line"
					style={ {
						left: rootRect ? rootRect.left - frame.left : 0,
						top: top - frame.top,
						width: rootRect ? rootRect.width : frame.width,
					} }
				/>
			)
		);
	};

	const renderAddBox = () => {
		if ( ! frame || ! rootRect ) {
			return null;
		}

		if ( isEmpty ) {
			return (
				<div
					className="cnl-compose-layer__add is-empty"
					style={ place(
						{
							height: Math.max( rootRect.height - 24, 120 ),
							left: rootRect.left + 12,
							top: rootRect.top + 12,
							width: rootRect.width - 24,
						},
						frame
					) }
				>
					<EmptyState.Root>
						<EmptyState.Icon icon={ sectionsIcon } />
						<EmptyState.Title>
							{ __( 'This page has no sections yet' ) }
						</EmptyState.Title>
						<EmptyState.Description>
							{ __(
								'Sections are the building blocks of a page, like a banner, a few columns or a contact form.'
							) }
						</EmptyState.Description>
						<EmptyState.Actions>
							<UiButton
								onClick={ ( event ) => {
									event.stopPropagation();
									addAt( 0 );
								} }
							>
								{ __( 'Add a section' ) }
							</UiButton>
						</EmptyState.Actions>
					</EmptyState.Root>
				</div>
			);
		}

		if ( ! lastRect ) {
			return null;
		}

		const top = lastRect.top + lastRect.height + 16;

		return (
			<div
				className="cnl-compose-layer__add"
				style={ place(
					{
						height: Math.max(
							40,
							Math.min(
								END_SPACE - 32,
								rootRect.top + rootRect.height - top - 16
							)
						),
						left: rootRect.left + 12,
						top,
						width: rootRect.width - 24,
					},
					frame
				) }
			>
				<Button
					__next40pxDefaultSize
					icon={ plusIcon }
					onClick={ ( event ) => {
						event.stopPropagation();
						addAt( sectionIds.length );
					} }
					variant="secondary"
				>
					{ __( 'Add a section' ) }
				</Button>
			</div>
		);
	};

	return (
		<div
			className="cnl-compose-layer"
			onClick={ () => pick( null ) }
			/*
			 * Double-clicking the page opens Edit on whatever block is under
			 * the pointer, found in the zoomed-out canvas underneath. Compose's
			 * own controls keep their clicks to themselves.
			 */
			onDoubleClick={ ( event ) => {
				if (
					event.target.closest(
						'.cnl-compose-layer__toolbar, .cnl-compose-layer__gap, .cnl-compose-layer__add, .components-popover'
					)
				) {
					return;
				}

				onOpen( getBlockAtPoint( editorRef, event ) );
			} }
			ref={ layerRef }
			role="presentation"
		>
			{ frame && (
				<div
					className="cnl-compose-layer__clip"
					style={ {
						height: frame.height,
						left: frame.left,
						top: frame.top,
						width: frame.width,
					} }
				>
					<div
						aria-label={ __( 'Sections' ) }
						className="cnl-compose-layer__targets"
						role="group"
					>
						{ templateElements
							.filter(
								( element ) => element.position === 'before'
							)
							.map( renderTemplateElement ) }
						{ sectionIds.map( ( clientId, index ) =>
							renderOutline( clientId, titles[ index ] )
						) }
						{ templateElements
							.filter(
								( element ) => element.position === 'after'
							)
							.map( renderTemplateElement ) }
					</div>
					{ gaps }
					{ renderAddBox() }
					{ renderDropLine() }
					{ renderToolbar() }
				</div>
			) }
		</div>
	);
}
