/**
 * External dependencies
 */
import { describe, expect, test } from 'vitest';

/**
 * Internal dependencies
 */
import {
	MAX_SCALE,
	centerOn,
	constrainView,
	fitView,
	getNextZoomStep,
	getPopoverPosition,
	getScaleLimits,
	getZoomLevel,
	isRectInView,
	zoomAt,
} from '../viewport';

describe( 'site overview viewport', () => {
	const bounds = { height: 1000, width: 2000, x: 0, y: 0 };
	const size = { height: 600, width: 1000 };

	test( 'zooms out no further than fitting the whole site', () => {
		const fit = fitView( bounds, size );

		expect( getScaleLimits( bounds, size ) ).toEqual( {
			max: MAX_SCALE,
			min: fit.k,
		} );
		expect( getZoomLevel( fit, bounds, size ) ).toBe( 1 );
		expect(
			constrainView( { k: 0.01, x: 0, y: 0 }, bounds, size )
		).toEqual( fit );
		expect( constrainView( { k: 10, x: 0, y: 0 }, bounds, size ).k ).toBe(
			MAX_SCALE
		);
	} );

	test( 'keeps the site from being moved off screen', () => {
		// At 1:1 the site is bigger than the screen, so it can only be moved
		// until its edges, plus the padding, reach the screen's.
		expect(
			constrainView( { k: 1, x: 500, y: 500 }, bounds, size )
		).toEqual( { k: 1, x: 48, y: 48 } );
		expect(
			constrainView( { k: 1, x: -5000, y: -5000 }, bounds, size )
		).toEqual( { k: 1, x: -1048, y: -448 } );
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

	test( 'steps through zoom levels, counted from the fit', () => {
		expect( getNextZoomStep( 1, 1 ) ).toBe( 1.5 );
		expect( getNextZoomStep( 1, -1 ) ).toBe( 1 );
		expect( getNextZoomStep( 1.2, 1 ) ).toBe( 1.5 );
		expect( getNextZoomStep( 1.2, -1 ) ).toBe( 1 );
		expect( getNextZoomStep( 3, -1 ) ).toBe( 2 );
		expect( getNextZoomStep( 100, 1 ) ).toBe( Infinity );
	} );

	test( 'fits a rectangle, centred, without zooming in past the limit', () => {
		expect( fitView( bounds, size, 0 ) ).toEqual( {
			k: 0.5,
			x: 0,
			y: 50,
		} );
		expect(
			fitView( { height: 100, width: 100, x: 0, y: 0 }, size, 0 )
		).toEqual( {
			k: MAX_SCALE,
			x: 400,
			y: 200,
		} );
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

	test( 'puts a popover beside its card, on the side with room', () => {
		const popover = { height: 200, width: 280 };

		expect(
			getPopoverPosition(
				{ bottom: 300, left: 100, right: 300, top: 100 },
				popover,
				size
			)
		).toEqual( { left: 312, top: 100 } );
		expect(
			getPopoverPosition(
				{ bottom: 300, left: 700, right: 900, top: 100 },
				popover,
				size
			)
		).toEqual( { left: 408, top: 100 } );
		// Kept on screen when the card runs off the bottom.
		expect(
			getPopoverPosition(
				{ bottom: 700, left: 100, right: 300, top: 500 },
				popover,
				size
			)
		).toEqual( { left: 312, top: 388 } );
	} );

	test( 'knows when a rectangle is on screen', () => {
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
