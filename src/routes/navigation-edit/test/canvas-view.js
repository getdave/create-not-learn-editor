/**
 * Internal dependencies
 */
import {
	DEFAULT_CANVAS_VIEW_DEVICE,
	getCanvasViewDevice,
	getMenuLocationsSummary,
} from '../canvas-view';

describe( 'getCanvasViewDevice', () => {
	it( 'keeps a device the editor canvas has a width for', () => {
		expect( getCanvasViewDevice( 'Tablet' ) ).toBe( 'Tablet' );
		expect( getCanvasViewDevice( 'Mobile' ) ).toBe( 'Mobile' );
	} );

	it( 'falls back to the default for anything else', () => {
		expect( getCanvasViewDevice( 'Watch' ) ).toBe(
			DEFAULT_CANVAS_VIEW_DEVICE
		);
		expect( getCanvasViewDevice( undefined ) ).toBe(
			DEFAULT_CANVAS_VIEW_DEVICE
		);
	} );

	it( 'does not accept the lowercase spelling used in URLs', () => {
		expect( getCanvasViewDevice( 'tablet' ) ).toBe(
			DEFAULT_CANVAS_VIEW_DEVICE
		);
	} );
} );

describe( 'getMenuLocationsSummary', () => {
	it( 'says a menu is not shown when it has no locations', () => {
		expect( getMenuLocationsSummary( 0 ) ).toBe( 'Not shown on your site' );
	} );

	it( 'uses the singular for one location', () => {
		expect( getMenuLocationsSummary( 1 ) ).toBe( 'Shown in 1 location' );
	} );

	it( 'uses the plural for several locations', () => {
		expect( getMenuLocationsSummary( 3 ) ).toBe( 'Shown in 3 locations' );
	} );
} );
