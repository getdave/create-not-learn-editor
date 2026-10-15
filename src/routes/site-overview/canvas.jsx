/**
 * WordPress dependencies
 */
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { namespace } from '../../settings';
import { cnlEditorStore, getErrorMessage } from '../../records';
import { isDynamicNode, useSelectedNode, useSiteOverview } from './data';
import { layoutSiteOverview } from './layout';
import {
	centerOn,
	fitView,
	getNextZoomStep,
	isRectInView,
	zoomAt,
} from './viewport';
import { prefersReducedMotion, useElementSize } from './hooks';
import { MemoizedSiteOverviewCard } from './card';
import {
	LaneLabel,
	MemoizedEdges,
	MemoizedLane,
	MemoizedStackSheets,
} from './lanes';
import { ZoomControls } from './zoom-controls';
import { SelectedPage } from './selected-page';
import {
	Notice,
	Spinner,
	__,
	_n,
	select,
	sprintf,
	useCallback,
	useDispatch,
	useEffect,
	useMemo,
	useRef,
	useState,
} from '../../wordpress-packages';

const DOT_SPACING = 24;
const PAN_STEP = 80;
const DRAG_THRESHOLD = 4;
const ANIMATION_MS = 280;
// Space to keep between a page brought into view and the screen's edges.
const VIEW_MARGIN = 32;

function getSummary( nodes ) {
	const dynamicCount = nodes.filter( isDynamicNode ).length;
	const pageCount = nodes.length - dynamicCount;

	return [
		sprintf(
			/* translators: %d: Number of pages. */
			_n( '%d page', '%d pages', pageCount ),
			pageCount
		),
		sprintf(
			/* translators: %d: Number of dynamic pages. */
			_n( '%d dynamic page', '%d dynamic pages', dynamicCount ),
			dynamicCount
		),
	].join( ' · ' );
}

export default function Canvas() {
	const navigate = useNavigate();
	const { invalidateSiteOverview } = useDispatch( cnlEditorStore );
	const { error, isLoading, siteOverview } = useSiteOverview();
	const [ selectedId, setSelectedId ] = useSelectedNode();
	const [ hoveredId, setHoveredId ] = useState( '' );
	const [ view, setView ] = useState( { k: 1, x: 0, y: 0 } );
	const [ isAnimating, setIsAnimating ] = useState( false );
	const [ isPanning, setIsPanning ] = useState( false );
	const viewportRef = useRef();
	const size = useElementSize( viewportRef );
	const viewRef = useRef( view );
	const sizeRef = useRef( size );
	const dragRef = useRef( null );
	const suppressClickRef = useRef( false );
	const didFitRef = useRef( false );
	const hasSize = size.width > 0 && size.height > 0;

	viewRef.current = view;
	sizeRef.current = size;

	/*
	 * Pages may have changed since the map was last fetched. Only a map
	 * fetched on an earlier visit is fetched again: on the first, the request
	 * is still on its way, and invalidating it would send a second.
	 */
	useEffect( () => {
		if (
			select( cnlEditorStore ).hasFinishedResolution( 'getSiteOverview', [
				namespace,
			] )
		) {
			invalidateSiteOverview( namespace );
		}
	}, [ invalidateSiteOverview ] );

	const layout = useMemo(
		() => ( siteOverview ? layoutSiteOverview( siteOverview ) : null ),
		[ siteOverview ]
	);
	const nodesById = useMemo(
		() => new Map( ( layout?.nodes || [] ).map( ( n ) => [ n.id, n ] ) ),
		[ layout ]
	);
	const groupsByName = useMemo(
		() =>
			new Map(
				( siteOverview?.groups || [] ).map( ( g ) => [ g.name, g ] )
			),
		[ siteOverview ]
	);
	const selectedNode = nodesById.get( selectedId );
	const activeId = hoveredId || selectedId;
	const relatedIds = useMemo( () => {
		const ids = new Set();

		( layout?.edges || [] ).forEach( ( edge ) => {
			if ( edge.from === activeId ) {
				ids.add( edge.to );
			} else if ( edge.to === activeId ) {
				ids.add( edge.from );
			}
		} );

		return ids;
	}, [ activeId, layout ] );

	const animateTo = useCallback( ( nextView ) => {
		setIsAnimating( ! prefersReducedMotion() );
		setView( nextView );
	}, [] );

	useEffect( () => {
		if ( ! isAnimating ) {
			return;
		}

		const timeout = setTimeout(
			() => setIsAnimating( false ),
			ANIMATION_MS
		);

		return () => clearTimeout( timeout );
	}, [ isAnimating, view ] );

	// Fit the whole site on screen at first, then bring the selected page
	// into view whenever it changes, from here or from the sidebar.
	useEffect( () => {
		if ( ! layout || ! hasSize ) {
			return;
		}

		const node = nodesById.get( selectedId );
		const currentSize = sizeRef.current;

		if ( ! didFitRef.current ) {
			didFitRef.current = true;
			let nextView = fitView( layout.bounds, currentSize );

			if (
				node &&
				! isRectInView( nextView, node, currentSize, VIEW_MARGIN )
			) {
				nextView = centerOn(
					{ ...nextView, k: Math.max( nextView.k, 0.5 ) },
					node,
					currentSize
				);
			}

			setView( nextView );
			return;
		}

		if (
			node &&
			! isRectInView( viewRef.current, node, currentSize, VIEW_MARGIN )
		) {
			animateTo( centerOn( viewRef.current, node, currentSize ) );
		}
	}, [ animateTo, hasSize, layout, nodesById, selectedId ] );

	const zoomBy = useCallback(
		( direction ) => {
			const current = viewRef.current;
			const { height, width } = sizeRef.current;

			animateTo(
				zoomAt( current, getNextZoomStep( current.k, direction ), {
					x: width / 2,
					y: height / 2,
				} )
			);
		},
		[ animateTo ]
	);
	const resetZoom = useCallback( () => {
		const { height, width } = sizeRef.current;

		animateTo(
			zoomAt( viewRef.current, 1, { x: width / 2, y: height / 2 } )
		);
	}, [ animateTo ] );
	const fit = useCallback( () => {
		if ( layout ) {
			animateTo( fitView( layout.bounds, sizeRef.current ) );
		}
	}, [ animateTo, layout ] );

	// Scrolling pans; pinching, or scrolling with Ctrl or Cmd held, zooms. The
	// listener is added by hand as React's wheel listeners can't prevent the
	// page from scrolling or zooming.
	useEffect( () => {
		const viewport = viewportRef.current;

		if ( ! viewport ) {
			return;
		}

		const onWheel = ( event ) => {
			event.preventDefault();
			setIsAnimating( false );

			const lineHeight = event.deltaMode === 1 ? 16 : 1;
			const deltaX = event.deltaX * lineHeight;
			const deltaY = event.deltaY * lineHeight;

			if ( event.ctrlKey || event.metaKey ) {
				const rect = viewport.getBoundingClientRect();
				const point = {
					x: event.clientX - rect.left,
					y: event.clientY - rect.top,
				};

				// Capped, so one notch of a mouse wheel isn't a huge jump.
				const step = Math.max( -50, Math.min( 50, deltaY ) );

				setView( ( current ) =>
					zoomAt(
						current,
						current.k * Math.exp( -step * 0.01 ),
						point
					)
				);
				return;
			}

			setView( ( current ) => ( {
				...current,
				x: current.x - deltaX,
				y: current.y - deltaY,
			} ) );
		};

		// Focusing a page makes the browser scroll it into view, which would
		// move the canvas out from under the view. Moving is the view's job.
		const onScroll = () => {
			viewport.scrollLeft = 0;
			viewport.scrollTop = 0;
		};

		viewport.addEventListener( 'wheel', onWheel, { passive: false } );
		viewport.addEventListener( 'scroll', onScroll );

		return () => {
			viewport.removeEventListener( 'wheel', onWheel );
			viewport.removeEventListener( 'scroll', onScroll );
		};
	}, [] );

	const onPointerDown = ( event ) => {
		// Main button, or the wheel button, which pans in many design tools.
		if ( event.button !== 0 && event.button !== 1 ) {
			return;
		}

		dragRef.current = {
			isDragging: false,
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			view: viewRef.current,
		};
	};

	const onPointerMove = ( event ) => {
		const drag = dragRef.current;

		if ( ! drag || drag.pointerId !== event.pointerId ) {
			return;
		}

		const deltaX = event.clientX - drag.startX;
		const deltaY = event.clientY - drag.startY;

		if (
			! drag.isDragging &&
			Math.hypot( deltaX, deltaY ) < DRAG_THRESHOLD
		) {
			return;
		}

		if ( ! drag.isDragging ) {
			drag.isDragging = true;
			viewportRef.current?.setPointerCapture?.( event.pointerId );
			setIsAnimating( false );
			setIsPanning( true );
		}

		setView( {
			...drag.view,
			x: drag.view.x + deltaX,
			y: drag.view.y + deltaY,
		} );
	};

	const onPointerEnd = ( event ) => {
		const drag = dragRef.current;

		if ( ! drag || drag.pointerId !== event.pointerId ) {
			return;
		}

		if ( drag.isDragging ) {
			// The click that ends a drag shouldn't select or deselect.
			suppressClickRef.current = true;
			setTimeout( () => {
				suppressClickRef.current = false;
			} );
			setIsPanning( false );
		}

		dragRef.current = null;
	};

	const onClickCapture = ( event ) => {
		if ( suppressClickRef.current ) {
			suppressClickRef.current = false;
			event.preventDefault();
			event.stopPropagation();
		}
	};

	const onBackgroundClick = ( event ) => {
		if (
			! event.target.closest?.(
				'.cnl-site-overview-card, .cnl-site-overview__lane-header'
			)
		) {
			setSelectedId( '' );
		}
	};

	const onKeyDown = ( event ) => {
		if ( event.altKey || event.ctrlKey || event.metaKey ) {
			return;
		}

		const pans = {
			ArrowDown: [ 0, -PAN_STEP ],
			ArrowLeft: [ PAN_STEP, 0 ],
			ArrowRight: [ -PAN_STEP, 0 ],
			ArrowUp: [ 0, PAN_STEP ],
		};

		if ( pans[ event.key ] ) {
			event.preventDefault();
			const [ deltaX, deltaY ] = pans[ event.key ];
			animateTo( {
				...viewRef.current,
				x: viewRef.current.x + deltaX,
				y: viewRef.current.y + deltaY,
			} );
		} else if ( event.key === '+' || event.key === '=' ) {
			event.preventDefault();
			zoomBy( 1 );
		} else if ( event.key === '-' || event.key === '_' ) {
			event.preventDefault();
			zoomBy( -1 );
		} else if ( event.key === '0' ) {
			event.preventDefault();
			fit();
		} else if ( event.key === 'Escape' && selectedId ) {
			event.preventDefault();
			setSelectedId( '' );
		}
	};

	const onFocusCard = useCallback(
		( node ) => {
			if (
				! isRectInView(
					viewRef.current,
					node,
					sizeRef.current,
					VIEW_MARGIN
				)
			) {
				animateTo( centerOn( viewRef.current, node, sizeRef.current ) );
			}
		},
		[ animateTo ]
	);

	const onOpen = useCallback(
		( node ) => {
			if ( node.editLink ) {
				navigate( { to: node.editLink } );
			}
		},
		[ navigate ]
	);

	const dotSpacing = DOT_SPACING * view.k * ( view.k < 0.4 ? 4 : 1 );

	return (
		<section className="cnl-editor-canvas cnl-site-overview-canvas">
			<header className="cnl-editor-canvas__toolbar cnl-site-overview__toolbar">
				<div className="cnl-site-overview__heading">
					<h1 className="cnl-site-overview__title">
						{ __( 'Site Overview' ) }
					</h1>
					{ layout && (
						<p className="cnl-site-overview__summary">
							{ getSummary( layout.nodes ) }
						</p>
					) }
				</div>
				<ZoomControls
					onFit={ fit }
					onReset={ resetZoom }
					onZoom={ zoomBy }
					zoom={ view.k }
				/>
			</header>
			<div className="cnl-site-overview__body">
				{ selectedNode && (
					<SelectedPage
						group={ groupsByName.get( selectedNode.group ) }
						key={ selectedNode.id }
						node={ selectedNode }
						onClose={ () => setSelectedId( '' ) }
						onOpen={ onOpen }
					/>
				) }
				{ /* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- The canvas pans and zooms from the pointer and keyboard. */ }
				<div
					aria-describedby="cnl-site-overview-help"
					aria-label={ __( 'Site Overview canvas' ) }
					className={ `cnl-site-overview__viewport${
						isPanning ? ' is-panning' : ''
					}` }
					onClick={ onBackgroundClick }
					onClickCapture={ onClickCapture }
					onKeyDown={ onKeyDown }
					onPointerCancel={ onPointerEnd }
					onPointerDown={ onPointerDown }
					onPointerMove={ onPointerMove }
					onPointerUp={ onPointerEnd }
					ref={ viewportRef }
					role="region"
					style={ {
						backgroundPosition: `${ view.x }px ${ view.y }px`,
						backgroundSize: `${ dotSpacing }px ${ dotSpacing }px`,
					} }
					tabIndex={ 0 }
				>
					{ layout && (
						<div
							className={ [
								'cnl-site-overview__world',
								isAnimating && 'is-animating',
							]
								.filter( Boolean )
								.join( ' ' ) }
							style={ {
								height: layout.bounds.height,
								transform: `translate(${ view.x }px, ${ view.y }px) scale(${ view.k })`,
								width: layout.bounds.width,
							} }
						>
							{ layout.lanes.map( ( lane ) => (
								<MemoizedLane key={ lane.name } lane={ lane } />
							) ) }
							<MemoizedEdges
								activeId={ activeId }
								edges={ layout.edges }
								groupsByName={ groupsByName }
								nodesById={ nodesById }
							/>
							{ layout.nodes
								.filter( ( node ) => node.kind === 'single' )
								.map( ( node ) => (
									<MemoizedStackSheets
										key={ `stack-${ node.id }` }
										node={ node }
									/>
								) ) }
							{ layout.nodes.map( ( node ) => (
								<MemoizedSiteOverviewCard
									group={ groupsByName.get( node.group ) }
									isActive={ node.id === hoveredId }
									isRelated={ relatedIds.has( node.id ) }
									isSelected={ node.id === selectedId }
									key={ node.id }
									node={ node }
									onFocusCard={ onFocusCard }
									onHover={ setHoveredId }
									onOpen={ onOpen }
									onSelect={ setSelectedId }
									rootRef={ viewportRef }
								/>
							) ) }
						</div>
					) }
					{ layout && (
						<div
							className={ `cnl-site-overview__lane-labels${
								isAnimating ? ' is-animating' : ''
							}` }
						>
							{ layout.lanes.map( ( lane ) => (
								<LaneLabel
									group={ groupsByName.get( lane.name ) }
									key={ lane.name }
									lane={ lane }
									nextLane={ layout.lanes.find(
										( other ) =>
											other.y === lane.y &&
											other.x > lane.x
									) }
									view={ view }
								/>
							) ) }
						</div>
					) }
					{ ! layout && isLoading && (
						<div className="cnl-site-overview__status">
							<Spinner />
						</div>
					) }
					{ ! layout && error && (
						<div className="cnl-site-overview__status">
							<Notice isDismissible={ false } status="error">
								{ getErrorMessage( error ) }
							</Notice>
						</div>
					) }
					<p
						className="cnl-site-overview__help"
						id="cnl-site-overview-help"
					>
						{ __(
							'Drag or scroll to move around. Pinch, or hold Ctrl or ⌘ and scroll, to zoom. Double-click a page to edit it.'
						) }
					</p>
				</div>
			</div>
		</section>
	);
}
