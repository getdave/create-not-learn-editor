/**
 * Internal dependencies
 */
import {
	MAX_ZOOM,
	MIN_ZOOM,
	centerOn,
	clampZoom,
	fitView,
	getNextZoomStep,
	isRectInView,
	zoomAt,
} from '../viewport';

describe( 'site overview viewport', () => {
	test( 'keeps zoom within limits', () => {
		expect( clampZoom( 0.01 ) ).toBe( MIN_ZOOM );
		expect( clampZoom( 10 ) ).toBe( MAX_ZOOM );
		expect( clampZoom( 0.5 ) ).toBe( 0.5 );
	} );

	test( 'zooms around a point, keeping it in place', () => {
		const view = { k: 1, x: 10, y: 20 };
		const point = { x: 110, y: 120 };
		const next = zoomAt( view, 2, point );

		// The canvas point under the cursor was (100, 100), and still is.
		expect( ( point.x - next.x ) / next.k ).toBe( 100 );
		expect( ( point.y - next.y ) / next.k ).toBe( 100 );
		expect( next.k ).toBe( 2 );
	} );

	test( 'steps through zoom levels', () => {
		expect( getNextZoomStep( 1, 1 ) ).toBe( 1.5 );
		expect( getNextZoomStep( 1, -1 ) ).toBe( 0.75 );
		expect( getNextZoomStep( 0.6, 1 ) ).toBe( 0.75 );
		expect( getNextZoomStep( 0.6, -1 ) ).toBe( 0.5 );
		expect( getNextZoomStep( MAX_ZOOM, 1 ) ).toBe( MAX_ZOOM );
		expect( getNextZoomStep( MIN_ZOOM, -1 ) ).toBe( MIN_ZOOM );
	} );

	test( 'fits a rectangle, centred, without zooming in past the limit', () => {
		const size = { height: 600, width: 1000 };

		expect(
			fitView( { height: 1000, width: 2000, x: 0, y: 0 }, size, 0 )
		).toEqual( { k: 0.5, x: 0, y: 50 } );
		expect(
			fitView( { height: 100, width: 100, x: 0, y: 0 }, size, 0 )
		).toEqual( { k: 1, x: 450, y: 250 } );
	} );

	test( 'centres a rectangle at the current zoom level', () => {
		expect(
			centerOn(
				{ k: 0.5, x: 0, y: 0 },
				{ height: 100, width: 200, x: 400, y: 400 },
				{ height: 600, width: 1000 }
			)
		).toEqual( { k: 0.5, x: 250, y: 75 } );
	} );

	test( 'knows when a rectangle is on screen', () => {
		const size = { height: 600, width: 1000 };
		const rect = { height: 100, width: 100, x: 0, y: 0 };

		expect( isRectInView( { k: 1, x: 10, y: 10 }, rect, size ) ).toBe(
			true
		);
		expect( isRectInView( { k: 1, x: -10, y: 10 }, rect, size ) ).toBe(
			false
		);
		expect( isRectInView( { k: 1, x: 10, y: 10 }, rect, size, 20 ) ).toBe(
			false
		);
	} );
} );
