/**
 * Internal dependencies
 */
import { getItemCountLabel } from './data';
import { getEdgePath } from './layout';
import {
	Icon,
	Tooltip,
	__,
	helpIcon,
	homeIcon,
	memo,
	sprintf,
} from '../../wordpress-packages';

// Space kept between a lane's name and the next lane.
const LANE_LABEL_GAP = 12;

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

// How far each sheet behind a single page sits from the one in front.
const STACK_OFFSETS = [ 12, 24 ];

/**
 * Sheets behind a single page, so it reads as one of many: the page every
 * post, or every product, is shown on. Drawn before the cards, so behind
 * them, and not one per item.
 *
 * @param {Object} props      Component props.
 * @param {Object} props.node Single page node.
 * @return {Element[]} Sheets, back first.
 */
function StackSheets( { node } ) {
	return [ ...STACK_OFFSETS ].reverse().map( ( offset ) => (
		<div
			aria-hidden
			className="cnl-site-overview__stack-sheet"
			key={ offset }
			style={ {
				height: node.height,
				left: node.x + offset,
				top: node.y + offset,
				width: node.width,
			} }
		/>
	) );
}

function Lane( { lane } ) {
	const kind = { home: 'is-home', page: 'is-pages' }[ lane.name ];

	return (
		<div
			className={ `cnl-site-overview__lane ${ kind || 'is-dynamic' }` }
			style={ {
				height: lane.height,
				left: lane.x,
				top: lane.y,
				width: lane.width,
			} }
		/>
	);
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
 *                                must stop short of.
 * @param {Object} props.view     Current view.
 * @return {Element} Lane label.
 */
export function LaneLabel( { group, lane, nextLane, view } ) {
	const width = nextLane
		? ( nextLane.x - lane.x ) * view.k - LANE_LABEL_GAP
		: Infinity;

	return (
		<div
			className="cnl-site-overview__lane-header"
			style={ {
				left: lane.x * view.k + view.x,
				maxWidth: Number.isFinite( width ) ? width : undefined,
				top: lane.y * view.k + view.y,
			} }
		>
			{ lane.name === 'home' && (
				<Icon
					className="cnl-site-overview__lane-icon"
					icon={ homeIcon }
					size={ 20 }
				/>
			) }
			<span className="cnl-site-overview__lane-label">
				{ lane.label }
			</span>
			<Tooltip.Root>
				<Tooltip.Trigger
					aria-label={ sprintf(
						/* translators: 1: Lane name, e.g. "Pages". 2: What it holds. */
						__( 'About %1$s: %2$s' ),
						lane.label,
						getLaneDescription( lane, group )
					) }
					className="cnl-site-overview__lane-help"
					type="button"
				>
					<Icon icon={ helpIcon } size={ 18 } />
				</Tooltip.Trigger>
				<Tooltip.Popup>
					{ getLaneDescription( lane, group ) }
				</Tooltip.Popup>
			</Tooltip.Root>
		</div>
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
		<svg aria-hidden className="cnl-site-overview__edges" key="edges">
			{ sorted.map( ( path ) => (
				<path
					className={ `cnl-site-overview__edge is-${ path.kind }${
						path.isActive ? ' is-active' : ''
					}` }
					d={ path.d }
					key={ path.id }
				/>
			) ) }
		</svg>,
		...paths
			.filter( ( path ) => path.kind === 'items' )
			.map( ( path ) => (
				<div
					aria-hidden
					className={ `cnl-site-overview__edge-label${
						path.isActive ? ' is-active' : ''
					}` }
					key={ `label-${ path.id }` }
					style={ { left: path.label.x, top: path.label.y } }
				>
					{ sprintf(
						/* translators: %s: Number of items, e.g. "12 posts". */
						__( 'Shows each of %s' ),
						getItemCountLabel(
							path.count || 0,
							groupsByName.get( nodesById.get( path.to )?.group )
						)
					) }
				</div>
			) ),
	];
}

export const MemoizedLane = memo( Lane );
export const MemoizedStackSheets = memo( StackSheets );
export const MemoizedEdges = memo( Edges );
