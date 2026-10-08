/**
 * Where every page sits on the Site Overview.
 *
 * The homepage sits at the top, in a lane of its own. Under it, each content
 * type gets a lane of
 * its own, side by side: hand-made pages as a tree of sub-pages, then each
 * dynamic content type as its collection with the single page under it. Lines
 * run from a page to the pages under it.
 */

export const CARD_WIDTH = 240;
export const THUMBNAIL_HEIGHT = 150;
export const CARD_HEIGHT = 206;

// The size of the screen a thumbnail shows, scaled down to the card.
export const THUMBNAIL_VIEWPORT_WIDTH = 1280;
export const THUMBNAIL_VIEWPORT_HEIGHT = Math.round(
	( THUMBNAIL_VIEWPORT_WIDTH * THUMBNAIL_HEIGHT ) / CARD_WIDTH
);

const SIBLING_GAP = 40;
const LEVEL_GAP = 96;
const LANE_GAP = 80;
const LANE_PADDING = 32;
// Lane names sit above the lanes, so only padding is needed inside.
const LANE_HEADER = 32;
// Room for the lanes' names under the line from the homepage, even zoomed out.
const HOME_GAP = 176;

// How far below a page the lines to the pages under it turn sideways.
const ELBOW_DROP = 48;
const ELBOW_RADIUS = 12;

function getChildren( edges, nodeIds ) {
	const children = new Map();

	edges.forEach( ( edge ) => {
		if ( ! nodeIds.has( edge.from ) || ! nodeIds.has( edge.to ) ) {
			return;
		}

		if ( ! children.has( edge.from ) ) {
			children.set( edge.from, [] );
		}

		children.get( edge.from ).push( edge.to );
	} );

	return children;
}

/**
 * Lay out a lane's pages as trees, each page centred over the pages under it.
 *
 * @param {string[]} rootIds   Pages at the top of the lane.
 * @param {Function} getKids   Returns the pages under a page, in this lane.
 * @param {number}   left      Lane content's left edge.
 * @param {number}   top       Lane content's top edge.
 * @param {Map}      positions Receives each placed page's position.
 * @return {Object} `{ width, height }` of the lane's content.
 */
function layoutLane( rootIds, getKids, left, top, positions ) {
	const widths = new Map();
	const measuring = new Set();

	function measure( id ) {
		if ( widths.has( id ) ) {
			return widths.get( id );
		}

		// A page that is its own ancestor is drawn once, without its loop.
		if ( measuring.has( id ) ) {
			return 0;
		}

		measuring.add( id );
		const kids = getKids( id ).filter( ( kid ) => measure( kid ) > 0 );
		const kidsWidth = kids.reduce(
			( total, kid, index ) =>
				total + widths.get( kid ) + ( index ? SIBLING_GAP : 0 ),
			0
		);
		const width = Math.max( CARD_WIDTH, kidsWidth );

		widths.set( id, width );

		return width;
	}

	let bottom = top;

	function place( id, x, y ) {
		if ( positions.has( id ) ) {
			return;
		}

		const width = widths.get( id );
		const kids = getKids( id ).filter(
			( kid ) => widths.get( kid ) > 0 && ! positions.has( kid )
		);

		// Placed before its kids, so a loop back to it is not drawn again.
		positions.set( id, { x: x + ( width - CARD_WIDTH ) / 2, y } );
		bottom = Math.max( bottom, y + CARD_HEIGHT );

		if ( ! kids.length ) {
			return;
		}

		const kidsWidth = kids.reduce(
			( total, kid, index ) =>
				total + widths.get( kid ) + ( index ? SIBLING_GAP : 0 ),
			0
		);
		let cursor = x + ( width - kidsWidth ) / 2;

		kids.forEach( ( kid ) => {
			place( kid, cursor, y + CARD_HEIGHT + LEVEL_GAP );
			cursor += widths.get( kid ) + SIBLING_GAP;
		} );

		// Centre the page over the pages under it.
		const first = positions.get( kids[ 0 ] );
		const last = positions.get( kids[ kids.length - 1 ] );
		positions.get( id ).x = ( first.x + last.x ) / 2;
	}

	let cursor = left;

	rootIds.forEach( ( id ) => {
		const width = measure( id );

		if ( ! width || positions.has( id ) ) {
			return;
		}

		place( id, cursor, top );
		cursor += width + SIBLING_GAP;
	} );

	return {
		height: bottom - top,
		width: Math.max( CARD_WIDTH, cursor - left - SIBLING_GAP ),
	};
}

/**
 * Lay out the Site Overview.
 *
 * @param {Object}   siteOverview        Site Overview from the REST API.
 * @param {Object[]} siteOverview.groups Content types, in drawing order.
 * @param {Object[]} siteOverview.nodes  Pages.
 * @param {Object[]} siteOverview.edges  Links from a page to a page under it.
 * @return {Object} `{ nodes, edges, lanes, bounds }`, with each node and lane
 *                  given `x`, `y`, `width` and `height`.
 */
export function layoutSiteOverview( {
	groups = [],
	nodes = [],
	edges = [],
} = {} ) {
	const nodesById = new Map( nodes.map( ( node ) => [ node.id, node ] ) );
	const children = getChildren( edges, new Set( nodesById.keys() ) );
	const parents = new Map();

	edges.forEach( ( edge ) => {
		if ( nodesById.has( edge.from ) && ! parents.has( edge.to ) ) {
			parents.set( edge.to, edge.from );
		}
	} );

	const positions = new Map();
	const lanes = [];
	const hasHome = nodesById.has( 'home' );
	const homeLaneHeight = LANE_HEADER + CARD_HEIGHT + LANE_PADDING;
	const laneTop = hasHome ? homeLaneHeight + HOME_GAP : 0;
	let laneLeft = 0;

	groups.forEach( ( group ) => {
		if ( group.name === 'home' ) {
			return;
		}

		const inLane = ( id ) => nodesById.get( id )?.group === group.name;
		const laneNodes = nodes.filter( ( node ) => inLane( node.id ) );

		if ( ! laneNodes.length ) {
			return;
		}

		const rootIds = laneNodes
			.filter( ( node ) => ! inLane( parents.get( node.id ) ) )
			.map( ( node ) => node.id );
		const getKids = ( id ) => ( children.get( id ) || [] ).filter( inLane );
		const content = layoutLane(
			rootIds,
			getKids,
			laneLeft + LANE_PADDING,
			laneTop + LANE_HEADER,
			positions
		);
		const width = content.width + LANE_PADDING * 2;

		lanes.push( {
			count: laneNodes.length,
			height: LANE_HEADER + content.height + LANE_PADDING,
			label: group.label,
			name: group.name,
			width,
			x: laneLeft,
			y: laneTop,
		} );
		laneLeft += width + LANE_GAP;
	} );

	const homeLaneWidth = CARD_WIDTH + LANE_PADDING * 2;
	const lanesWidth = Math.max( homeLaneWidth, laneLeft - LANE_GAP );

	if ( hasHome ) {
		const homeLaneX = ( lanesWidth - homeLaneWidth ) / 2;

		positions.set( 'home', {
			x: homeLaneX + ( homeLaneWidth - CARD_WIDTH ) / 2,
			y: LANE_HEADER,
		} );
		lanes.unshift( {
			count: 1,
			height: homeLaneHeight,
			label:
				groups.find( ( group ) => group.name === 'home' )?.label || '',
			name: 'home',
			width: homeLaneWidth,
			x: homeLaneX,
			y: 0,
		} );
	}

	const placedNodes = nodes
		.filter( ( node ) => positions.has( node.id ) )
		.map( ( node ) => ( {
			...node,
			...positions.get( node.id ),
			height: CARD_HEIGHT,
			width: CARD_WIDTH,
		} ) );
	const placedEdges = edges
		.filter(
			( edge ) => positions.has( edge.from ) && positions.has( edge.to )
		)
		.map( ( edge ) => ( { ...edge, id: `${ edge.from }->${ edge.to }` } ) );
	const height = lanes.reduce(
		( max, lane ) => Math.max( max, lane.y + lane.height ),
		placedNodes.length ? CARD_HEIGHT : 0
	);

	return {
		bounds: { height, width: lanesWidth, x: 0, y: 0 },
		edges: placedEdges,
		lanes,
		nodes: placedNodes,
	};
}

/**
 * The line from a page down to a page under it: down, across, then down,
 * with rounded corners, the way site overviews and org charts are drawn.
 *
 * @param {Object} from Rectangle of the page above.
 * @param {Object} to   Rectangle of the page below.
 * @return {Object} `{ d, label }`: an SVG path, and where a label sits on it.
 */
export function getEdgePath( from, to ) {
	const startX = from.x + from.width / 2;
	const startY = from.y + from.height;
	const endX = to.x + to.width / 2;
	const endY = to.y;
	const turnY = startY + Math.min( ELBOW_DROP, ( endY - startY ) / 2 );
	const deltaX = endX - startX;
	const label = { x: endX, y: ( turnY + endY ) / 2 };

	if ( Math.abs( deltaX ) < 1 ) {
		return {
			d: `M ${ startX } ${ startY } V ${ endY }`,
			label: { x: endX, y: ( startY + endY ) / 2 },
		};
	}

	const direction = Math.sign( deltaX );
	const radius = Math.min(
		ELBOW_RADIUS,
		Math.abs( deltaX ) / 2,
		turnY - startY,
		endY - turnY
	);

	return {
		d: [
			`M ${ startX } ${ startY }`,
			`V ${ turnY - radius }`,
			`Q ${ startX } ${ turnY } ${ startX + direction * radius } ${ turnY }`,
			`H ${ endX - direction * radius }`,
			`Q ${ endX } ${ turnY } ${ endX } ${ turnY + radius }`,
			`V ${ endY }`,
		].join( ' ' ),
		label,
	};
}
