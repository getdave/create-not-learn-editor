/**
 * Internal dependencies
 */
import {
	CARD_HEIGHT,
	CARD_WIDTH,
	getEdgePath,
	layoutSiteOverview,
} from '../layout';

const SITE_OVERVIEW = {
	groups: [
		{ label: 'Homepage', name: 'home' },
		{ label: 'Pages', name: 'page' },
		{ label: 'Posts', name: 'post' },
		{ label: 'Products', name: 'product' },
	],
	nodes: [
		{ group: 'home', id: 'home', kind: 'home' },
		{ group: 'page', id: 'page-1', kind: 'page' },
		{ group: 'page', id: 'page-2', kind: 'page' },
		{ group: 'page', id: 'page-3', kind: 'page' },
		{ group: 'page', id: 'page-4', kind: 'page' },
		{ group: 'post', id: 'collection-post', kind: 'collection' },
		{ group: 'post', id: 'single-post', kind: 'single' },
		{ group: 'product', id: 'collection-product', kind: 'collection' },
		{ group: 'product', id: 'single-product', kind: 'single' },
	],
	edges: [
		{ from: 'home', kind: 'child', to: 'page-1' },
		{ from: 'page-1', kind: 'child', to: 'page-2' },
		{ from: 'page-1', kind: 'child', to: 'page-3' },
		{ from: 'home', kind: 'child', to: 'page-4' },
		{ from: 'home', kind: 'link', to: 'collection-post' },
		{ from: 'collection-post', kind: 'items', to: 'single-post' },
		{ from: 'home', kind: 'link', to: 'collection-product' },
		{ from: 'collection-product', kind: 'items', to: 'single-product' },
	],
};

function byId( layout ) {
	return Object.fromEntries(
		layout.nodes.map( ( node ) => [ node.id, node ] )
	);
}

describe( 'layoutSiteOverview', () => {
	test( 'gives each content type a lane, in order, side by side', () => {
		const lanes = layoutSiteOverview( SITE_OVERVIEW ).lanes.filter(
			( lane ) => lane.name !== 'home'
		);

		expect( lanes.map( ( lane ) => lane.name ) ).toEqual( [
			'page',
			'post',
			'product',
		] );
		expect( lanes[ 1 ].x ).toBeGreaterThan(
			lanes[ 0 ].x + lanes[ 0 ].width
		);
		expect( lanes[ 2 ].x ).toBeGreaterThan(
			lanes[ 1 ].x + lanes[ 1 ].width
		);
		expect( new Set( lanes.map( ( lane ) => lane.y ) ).size ).toBe( 1 );
	} );

	test( 'puts the homepage in its own lane above the others, centred', () => {
		const layout = layoutSiteOverview( SITE_OVERVIEW );
		const { home } = byId( layout );
		const [ homeLane, firstLane ] = layout.lanes;

		expect( homeLane ).toMatchObject( { label: 'Homepage', name: 'home' } );
		expect( homeLane.y ).toBe( 0 );
		expect( home.x ).toBeGreaterThan( homeLane.x );
		expect( home.y ).toBeGreaterThan( homeLane.y );
		expect( home.x + home.width ).toBeLessThan(
			homeLane.x + homeLane.width
		);
		expect( home.y + home.height ).toBeLessThan(
			homeLane.y + homeLane.height
		);
		expect( homeLane.y + homeLane.height ).toBeLessThan( firstLane.y );
		expect( home.x + home.width / 2 ).toBe( layout.bounds.width / 2 );
	} );

	test( 'draws sub-pages under their page, which is centred over them', () => {
		const nodes = byId( layoutSiteOverview( SITE_OVERVIEW ) );

		expect( nodes[ 'page-2' ].y ).toBeGreaterThan(
			nodes[ 'page-1' ].y + CARD_HEIGHT
		);
		expect( nodes[ 'page-2' ].y ).toBe( nodes[ 'page-3' ].y );
		expect( nodes[ 'page-3' ].x ).toBeGreaterThanOrEqual(
			nodes[ 'page-2' ].x + CARD_WIDTH
		);
		expect( nodes[ 'page-1' ].x ).toBe(
			( nodes[ 'page-2' ].x + nodes[ 'page-3' ].x ) / 2
		);
		expect( nodes[ 'page-4' ].y ).toBe( nodes[ 'page-1' ].y );
		expect( nodes[ 'page-4' ].x ).toBeGreaterThan( nodes[ 'page-3' ].x );
	} );

	test( 'draws a single page under its collection', () => {
		const nodes = byId( layoutSiteOverview( SITE_OVERVIEW ) );

		expect( nodes[ 'single-post' ].x ).toBe( nodes[ 'collection-post' ].x );
		expect( nodes[ 'single-post' ].y ).toBeGreaterThan(
			nodes[ 'collection-post' ].y + CARD_HEIGHT
		);
	} );

	test( 'keeps every page inside its lane', () => {
		const layout = layoutSiteOverview( SITE_OVERVIEW );
		const lanes = Object.fromEntries(
			layout.lanes.map( ( lane ) => [ lane.name, lane ] )
		);

		layout.nodes
			.filter( ( node ) => node.id !== 'home' )
			.forEach( ( node ) => {
				const lane = lanes[ node.group ];

				expect( node.x ).toBeGreaterThanOrEqual( lane.x );
				expect( node.x + node.width ).toBeLessThanOrEqual(
					lane.x + lane.width
				);
				expect( node.y + node.height ).toBeLessThanOrEqual(
					lane.y + lane.height
				);
			} );
	} );

	test( 'hangs a single page from the homepage when it lists the posts', () => {
		const layout = layoutSiteOverview( {
			groups: [ { label: 'Posts', name: 'post' } ],
			nodes: [
				{ group: 'home', id: 'home', kind: 'home' },
				{ group: 'post', id: 'single-post', kind: 'single' },
			],
			edges: [ { from: 'home', kind: 'items', to: 'single-post' } ],
		} );

		expect( layout.nodes.map( ( node ) => node.id ) ).toEqual( [
			'home',
			'single-post',
		] );
		expect( layout.edges ).toHaveLength( 1 );
	} );

	test( 'survives pages that are their own ancestors', () => {
		const layout = layoutSiteOverview( {
			groups: [ { label: 'Pages', name: 'page' } ],
			nodes: [
				{ group: 'home', id: 'home' },
				{ group: 'page', id: 'a' },
				{ group: 'page', id: 'b' },
			],
			edges: [
				{ from: 'home', to: 'a' },
				{ from: 'a', to: 'b' },
				{ from: 'b', to: 'a' },
			],
		} );

		expect( layout.nodes ).toHaveLength( 3 );
	} );

	test( 'drops links to pages that are not on the map', () => {
		const layout = layoutSiteOverview( {
			groups: [ { label: 'Pages', name: 'page' } ],
			nodes: [ { group: 'home', id: 'home' } ],
			edges: [ { from: 'home', to: 'missing' } ],
		} );

		expect( layout.edges ).toEqual( [] );
		expect( layout.lanes.map( ( lane ) => lane.name ) ).toEqual( [
			'home',
		] );
	} );
} );

describe( 'getEdgePath', () => {
	test( 'draws a straight line between pages one above the other', () => {
		const { d, label } = getEdgePath(
			{ height: 100, width: 100, x: 0, y: 0 },
			{ height: 100, width: 100, x: 0, y: 200 }
		);

		expect( d ).toBe( 'M 50 100 V 200' );
		expect( label ).toEqual( { x: 50, y: 150 } );
	} );

	test( 'turns sideways below the page above', () => {
		const { d } = getEdgePath(
			{ height: 100, width: 100, x: 0, y: 0 },
			{ height: 100, width: 100, x: 300, y: 200 }
		);

		expect( d.startsWith( 'M 50 100' ) ).toBe( true );
		expect( d.endsWith( 'V 200' ) ).toBe( true );
		expect( d ).toContain( 'H 338' );
	} );
} );
