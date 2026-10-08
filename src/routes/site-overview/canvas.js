/**
 * WordPress dependencies
 */
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { namespace } from '../../settings';
import { cnlEditorStore, getErrorMessage } from '../../records';
import {
	getItemCountLabel,
	getNodeIcon,
	getNodeKindLabel,
	hasNotableStatus,
	isDynamicNode,
	useSelectedNode,
	useSiteOverview,
} from './data';
import {
	CARD_WIDTH,
	THUMBNAIL_VIEWPORT_HEIGHT,
	THUMBNAIL_VIEWPORT_WIDTH,
	getEdgePath,
	layoutSiteOverview,
} from './layout';
import {
	centerOn,
	fitView,
	getNextZoomStep,
	isRectInView,
	zoomAt,
} from './viewport';
import {
	Badge,
	Button,
	Icon,
	Link,
	Notice,
	Spinner,
	Stack,
	Text,
	Tooltip,
	UiButton,
	__,
	_n,
	el,
	fullscreenIcon,
	helpIcon,
	homeIcon,
	minusIcon,
	plusIcon,
	sprintf,
	useCallback,
	useDispatch,
	useEffect,
	useMemo,
	useRef,
	useState,
} from '../../wordpress-packages';

const THUMBNAIL_SCALE = CARD_WIDTH / THUMBNAIL_VIEWPORT_WIDTH;
const DOT_SPACING = 24;
const PAN_STEP = 80;
const DRAG_THRESHOLD = 4;
const ANIMATION_MS = 280;
// Space to keep between a page brought into view and the screen's edges.
const VIEW_MARGIN = 32;
// Space kept between a lane's name and the next lane.
const LANE_LABEL_GAP = 12;

function prefersReducedMotion() {
	return Boolean(
		window.matchMedia?.( '(prefers-reduced-motion: reduce)' ).matches
	);
}

function useElementSize( ref ) {
	const [ size, setSize ] = useState( { height: 0, width: 0 } );

	useEffect( () => {
		const element = ref.current;

		if ( ! element ) {
			return;
		}

		const update = () =>
			setSize( ( current ) =>
				current.width === element.clientWidth &&
				current.height === element.clientHeight
					? current
					: {
							height: element.clientHeight,
							width: element.clientWidth,
						}
			);

		update();

		if ( ! window.ResizeObserver ) {
			return;
		}

		const observer = new window.ResizeObserver( update );
		observer.observe( element );

		return () => observer.disconnect();
	}, [ ref ] );

	return size;
}

/**
 * Whether an element has come near the screen yet. Stays true once it has,
 * so a thumbnail is loaded once and kept.
 *
 * @param {Object} ref     Element.
 * @param {Object} rootRef Scrolling ancestor to watch within.
 * @return {boolean} Whether it has been near the screen.
 */
function useHasBeenVisible( ref, rootRef ) {
	const [ hasBeenVisible, setHasBeenVisible ] = useState( false );

	useEffect( () => {
		if ( hasBeenVisible || ! ref.current ) {
			return;
		}

		if ( ! window.IntersectionObserver ) {
			setHasBeenVisible( true );
			return;
		}

		const observer = new window.IntersectionObserver(
			( entries ) => {
				if ( entries.some( ( entry ) => entry.isIntersecting ) ) {
					setHasBeenVisible( true );
				}
			},
			{ root: rootRef.current, rootMargin: '200px' }
		);
		observer.observe( ref.current );

		return () => observer.disconnect();
	}, [ hasBeenVisible, ref, rootRef ] );

	return hasBeenVisible;
}

function getPlaceholderText( node ) {
	if ( node.kind === 'single' && ! node.count ) {
		return __( 'Nothing to show yet' );
	}

	if ( ! node.previewUrl ) {
		return __( 'Not on your site yet' );
	}

	return '';
}

/**
 * A small, live picture of the page: the real front end, scaled down.
 *
 * It only loads once it comes near the screen, so a big site doesn't load
 * every page at once, and it can't be clicked or focused.
 *
 * @param {Object} props         Component props.
 * @param {Object} props.node    Site Overview node.
 * @param {Object} props.rootRef The canvas's viewport.
 * @return {Element} Thumbnail.
 */
function Thumbnail( { node, rootRef } ) {
	const ref = useRef();
	const hasBeenVisible = useHasBeenVisible( ref, rootRef );
	const [ isLoaded, setIsLoaded ] = useState( false );
	const placeholderText = getPlaceholderText( node );

	return el(
		'div',
		{
			'aria-hidden': true,
			className: `cnl-site-overview-card__thumbnail${
				isLoaded ? ' is-loaded' : ''
			}`,
			ref,
		},
		el(
			'div',
			{ className: 'cnl-site-overview-card__placeholder' },
			el( Icon, { icon: getNodeIcon( node ), size: 32 } ),
			placeholderText &&
				el(
					'span',
					{ className: 'cnl-site-overview-card__placeholder-text' },
					placeholderText
				)
		),
		node.previewUrl &&
			hasBeenVisible &&
			el( 'iframe', {
				className: 'cnl-site-overview-card__frame',
				onLoad: () => setIsLoaded( true ),
				src: node.previewUrl,
				style: {
					height: THUMBNAIL_VIEWPORT_HEIGHT,
					transform: `scale(${ THUMBNAIL_SCALE })`,
					width: THUMBNAIL_VIEWPORT_WIDTH,
				},
				tabIndex: -1,
				title: node.title,
			} )
	);
}

function SiteOverviewCard( {
	group,
	isActive,
	isRelated,
	isSelected,
	node,
	onFocusCard,
	onHover,
	onOpen,
	onSelect,
	rootRef,
} ) {
	const kindLabel = getNodeKindLabel( node );
	const className = [
		'cnl-site-overview-card',
		`is-${ node.kind }`,
		isDynamicNode( node ) && 'is-dynamic',
		hasNotableStatus( node ) && 'is-unpublished',
		isSelected && 'is-selected',
		isActive && 'is-active',
		isRelated && 'is-related',
	]
		.filter( Boolean )
		.join( ' ' );

	return el(
		'div',
		{
			className,
			'data-node-id': node.id,
			onDoubleClick: () => onOpen( node ),
			onMouseEnter: () => onHover( node.id ),
			onMouseLeave: () => onHover( '' ),
			style: {
				height: node.height,
				left: node.x,
				top: node.y,
				width: node.width,
			},
		},
		el( Thumbnail, { node, rootRef } ),
		el(
			'div',
			{ className: 'cnl-site-overview-card__caption' },
			el(
				'button',
				{
					'aria-current': isSelected ? 'true' : undefined,
					className: 'cnl-site-overview-card__select',
					onClick: () => onSelect( node.id ),
					onFocus: () => onFocusCard( node ),
					type: 'button',
				},
				el(
					'span',
					{ className: 'cnl-site-overview-card__title' },
					node.title
				),
				el(
					'span',
					{ className: 'screen-reader-text' },
					`, ${ kindLabel }`
				)
			),
			el(
				'div',
				{
					'aria-hidden': true,
					className: 'cnl-site-overview-card__meta',
				},
				el( Icon, { icon: getNodeIcon( node ), size: 16 } ),
				el( 'span', null, kindLabel ),
				node.kind === 'single' &&
					el(
						'span',
						{ className: 'cnl-site-overview-card__count' },
						getItemCountLabel( node.count, group )
					),
				hasNotableStatus( node ) &&
					el( Badge, { intent: 'draft' }, node.statusLabel )
			)
		)
	);
}

function getLaneDescription( lane, group ) {
	if ( lane.name === 'home' ) {
		return __( 'The first page visitors see' );
	}

	if ( lane.name === 'page' ) {
		return __( 'Made by you' );
	}

	return sprintf(
		/* translators: %s: Content type label, e.g. "posts". */
		__( 'Made from your %s' ),
		String( group?.label || '' ).toLowerCase()
	);
}

function Lane( { lane } ) {
	const kind = { home: 'is-home', page: 'is-pages' }[ lane.name ];

	return el( 'div', {
		className: `cnl-site-overview__lane ${ kind || 'is-dynamic' }`,
		style: {
			height: lane.height,
			left: lane.x,
			top: lane.y,
			width: lane.width,
		},
	} );
}

/**
 * A lane's name, sitting just above its top-left corner.
 *
 * Drawn on screen rather than on the canvas, so it stays the same size and
 * lined up with the lane at any zoom level, the way design tools label frames.
 *
 * @param {Object} props          Component props.
 * @param {Object} props.group    Content type the lane shows.
 * @param {Object} props.lane     Lane, on the canvas.
 * @param {Object} props.nextLane Lane to its right, if any, which the name
 *                                must stop short of. Without one, the name
 *                                keeps to its own lane's width.
 * @param {Object} props.view     Current view.
 * @return {Element} Lane label.
 */
function LaneLabel( { group, lane, nextLane, view } ) {
	let width = lane.width * view.k;

	if ( lane.name === 'home' ) {
		// Alone above the rest, with room either side.
		width = Infinity;
	} else if ( nextLane ) {
		width = ( nextLane.x - lane.x ) * view.k - LANE_LABEL_GAP;
	}

	return el(
		'div',
		{
			className: 'cnl-site-overview__lane-header',
			style: {
				left: lane.x * view.k + view.x,
				maxWidth: Number.isFinite( width ) ? width : undefined,
				top: lane.y * view.k + view.y,
			},
		},
		lane.name === 'home' &&
			el( Icon, {
				className: 'cnl-site-overview__lane-icon',
				icon: homeIcon,
				size: 20,
			} ),
		el(
			'span',
			{ className: 'cnl-site-overview__lane-label' },
			lane.label
		),
		el(
			Tooltip.Root,
			null,
			el(
				Tooltip.Trigger,
				{
					'aria-label': sprintf(
						/* translators: 1: Lane name, e.g. "Pages". 2: What it holds. */
						__( 'About %1$s: %2$s' ),
						lane.label,
						getLaneDescription( lane, group )
					),
					className: 'cnl-site-overview__lane-help',
					type: 'button',
				},
				el( Icon, { icon: helpIcon, size: 18 } )
			),
			el( Tooltip.Popup, null, getLaneDescription( lane, group ) )
		)
	);
}

function Edges( { activeId, edges, nodesById, groupsByName } ) {
	const paths = edges.map( ( edge ) => {
		const path = getEdgePath(
			nodesById.get( edge.from ),
			nodesById.get( edge.to )
		);

		return {
			...edge,
			...path,
			isActive: Boolean(
				activeId && ( edge.from === activeId || edge.to === activeId )
			),
		};
	} );
	// Lines to and from the active page are drawn last, so on top.
	const sorted = [
		...paths.filter( ( path ) => ! path.isActive ),
		...paths.filter( ( path ) => path.isActive ),
	];

	return [
		el(
			'svg',
			{
				'aria-hidden': true,
				className: 'cnl-site-overview__edges',
				key: 'edges',
			},
			sorted.map( ( path ) =>
				el( 'path', {
					className: `cnl-site-overview__edge is-${ path.kind }${
						path.isActive ? ' is-active' : ''
					}`,
					d: path.d,
					key: path.id,
				} )
			)
		),
		...paths
			.filter( ( path ) => path.kind === 'items' )
			.map( ( path ) =>
				el(
					'div',
					{
						'aria-hidden': true,
						className: `cnl-site-overview__edge-label${
							path.isActive ? ' is-active' : ''
						}`,
						key: `label-${ path.id }`,
						style: { left: path.label.x, top: path.label.y },
					},
					sprintf(
						/* translators: %s: Number of items, e.g. "12 posts". */
						__( 'Shows each of %s' ),
						getItemCountLabel(
							path.count || 0,
							groupsByName.get( nodesById.get( path.to )?.group )
						)
					)
				)
			),
	];
}

function ZoomControls( { onFit, onReset, onZoom, zoom } ) {
	return el(
		'div',
		{
			'aria-label': __( 'Zoom' ),
			className: 'cnl-site-overview__zoom',
			role: 'group',
		},
		el( Button, {
			icon: minusIcon,
			label: __( 'Zoom out' ),
			onClick: () => onZoom( -1 ),
			shortcut: '-',
			showTooltip: true,
			size: 'compact',
		} ),
		el(
			Button,
			{
				className: 'cnl-site-overview__zoom-level',
				label: __( 'Zoom to 100%' ),
				onClick: onReset,
				showTooltip: true,
				size: 'compact',
			},
			`${ Math.round( zoom * 100 ) }%`
		),
		el( Button, {
			icon: plusIcon,
			label: __( 'Zoom in' ),
			onClick: () => onZoom( 1 ),
			shortcut: '+',
			showTooltip: true,
			size: 'compact',
		} ),
		el( Button, {
			icon: fullscreenIcon,
			label: __( 'Fit everything on screen' ),
			onClick: onFit,
			shortcut: '0',
			showTooltip: true,
			size: 'compact',
		} )
	);
}

/**
 * What the selected page is, and ways to edit or visit it, floating over the
 * canvas.
 *
 * @param {Object}   props         Component props.
 * @param {Object}   props.group   Content type the page belongs to.
 * @param {Object}   props.node    Selected page.
 * @param {Function} props.onClose Clears the selection.
 * @param {Function} props.onOpen  Opens the page's editor.
 * @return {Element} Panel.
 */
function SelectedPage( { group, node, onClose, onOpen } ) {
	const isDynamic = isDynamicNode( node );
	const details = [
		node.description,
		node.kind === 'single' && node.previewOf
			? sprintf(
					/* translators: %s: Title of the item shown in the preview. */
					__( 'Previewed with “%s”, the latest one.' ),
					node.previewOf
				)
			: '',
		node.layout
			? sprintf(
					/* translators: %s: Layout (template) name. */
					__( 'Uses the “%s” layout.' ),
					node.layout
				)
			: '',
	].filter( Boolean );

	return el(
		'aside',
		{
			'aria-label': __( 'Selected page' ),
			className: 'cnl-site-overview__selected',
			onKeyDown: ( event ) => {
				if ( event.key === 'Escape' ) {
					event.stopPropagation();
					onClose();
				}
			},
		},
		el(
			Stack,
			{ align: 'center', gap: 'sm' },
			el( Icon, { icon: getNodeIcon( node ), size: 24 } ),
			el(
				Text,
				{
					className: 'cnl-site-overview__selected-title',
					render: el( 'h2' ),
					variant: 'heading-md',
				},
				node.title
			)
		),
		el(
			Stack,
			{ gap: 'xs', wrap: 'wrap' },
			el(
				Badge,
				{ intent: isDynamic ? 'informational' : 'none' },
				isDynamic
					? sprintf(
							/* translators: %s: Kind of dynamic page, e.g. "Collection". */
							__( 'Dynamic · %s' ),
							getNodeKindLabel( node )
						)
					: getNodeKindLabel( node )
			),
			node.kind === 'single' &&
				el( Badge, null, getItemCountLabel( node.count, group ) ),
			hasNotableStatus( node ) &&
				el( Badge, { intent: 'draft' }, node.statusLabel )
		),
		details.map( ( detail ) =>
			el(
				Text,
				{
					className: 'cnl-site-overview__selected-detail',
					key: detail,
					variant: 'body-sm',
				},
				detail
			)
		),
		el(
			Stack,
			{ align: 'center', gap: 'sm', wrap: 'wrap' },
			el(
				UiButton,
				{ disabled: ! node.editLink, onClick: () => onOpen( node ) },
				isDynamic ? __( 'Edit layout' ) : __( 'Edit page' )
			),
			node.url &&
				el(
					Link,
					{ href: node.url, openInNewTab: true },
					__( 'View' )
				),
			el(
				UiButton,
				{ onClick: onClose, variant: 'minimal' },
				__( 'Close' )
			)
		)
	);
}

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

	// Pages may have changed since the map was last fetched.
	useEffect( () => {
		invalidateSiteOverview( namespace );
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

	return el(
		'section',
		{ className: 'cnl-editor-canvas cnl-site-overview-canvas' },
		el(
			'header',
			{
				className:
					'cnl-editor-canvas__toolbar cnl-site-overview__toolbar',
			},
			el(
				'div',
				{ className: 'cnl-site-overview__heading' },
				el(
					'h1',
					{ className: 'cnl-site-overview__title' },
					__( 'Site Overview' )
				),
				layout &&
					el(
						'p',
						{ className: 'cnl-site-overview__summary' },
						getSummary( layout.nodes )
					)
			),
			el( ZoomControls, {
				onFit: fit,
				onReset: resetZoom,
				onZoom: zoomBy,
				zoom: view.k,
			} )
		),
		el(
			'div',
			{ className: 'cnl-site-overview__body' },
			selectedNode &&
				el( SelectedPage, {
					group: groupsByName.get( selectedNode.group ),
					key: selectedNode.id,
					node: selectedNode,
					onClose: () => setSelectedId( '' ),
					onOpen,
				} ),
			el(
				'div',
				{
					'aria-describedby': 'cnl-site-overview-help',
					'aria-label': __( 'Site Overview canvas' ),
					className: `cnl-site-overview__viewport${
						isPanning ? ' is-panning' : ''
					}`,
					onClick: onBackgroundClick,
					onClickCapture,
					onKeyDown,
					onPointerCancel: onPointerEnd,
					onPointerDown,
					onPointerMove,
					onPointerUp: onPointerEnd,
					ref: viewportRef,
					role: 'region',
					style: {
						backgroundPosition: `${ view.x }px ${ view.y }px`,
						backgroundSize: `${ dotSpacing }px ${ dotSpacing }px`,
					},
					tabIndex: 0,
				},
				layout &&
					el(
						'div',
						{
							className: [
								'cnl-site-overview__world',
								isAnimating && 'is-animating',
							]
								.filter( Boolean )
								.join( ' ' ),
							style: {
								height: layout.bounds.height,
								transform: `translate(${ view.x }px, ${ view.y }px) scale(${ view.k })`,
								width: layout.bounds.width,
							},
						},
						layout.lanes.map( ( lane ) =>
							el( Lane, { key: lane.name, lane } )
						),
						el( Edges, {
							activeId,
							edges: layout.edges,
							groupsByName,
							nodesById,
						} ),
						layout.nodes.map( ( node ) =>
							el( SiteOverviewCard, {
								group: groupsByName.get( node.group ),
								isActive: node.id === hoveredId,
								isRelated: relatedIds.has( node.id ),
								isSelected: node.id === selectedId,
								key: node.id,
								node,
								onFocusCard,
								onHover: setHoveredId,
								onOpen,
								onSelect: setSelectedId,
								rootRef: viewportRef,
							} )
						)
					),
				layout &&
					el(
						'div',
						{
							className: `cnl-site-overview__lane-labels${
								isAnimating ? ' is-animating' : ''
							}`,
						},
						layout.lanes.map( ( lane ) =>
							el( LaneLabel, {
								group: groupsByName.get( lane.name ),
								key: lane.name,
								lane,
								nextLane: layout.lanes.find(
									( other ) =>
										other.y === lane.y && other.x > lane.x
								),
								view,
							} )
						)
					),
				! layout &&
					isLoading &&
					el(
						'div',
						{ className: 'cnl-site-overview__status' },
						el( Spinner )
					),
				! layout &&
					error &&
					el(
						'div',
						{ className: 'cnl-site-overview__status' },
						el(
							Notice,
							{ isDismissible: false, status: 'error' },
							getErrorMessage( error )
						)
					),
				el(
					'p',
					{
						className: 'cnl-site-overview__help',
						id: 'cnl-site-overview-help',
					},
					__(
						'Drag or scroll to move around. Pinch, or hold Ctrl or ⌘ and scroll, to zoom. Double-click a page to edit it.'
					)
				)
			)
		)
	);
}
