/**
 * Internal dependencies
 */
import {
	DEFAULT_HOMEPAGE_DEVICE,
	getHomepageDevice,
	getHomepagePreviewUrl,
	getHomepageStatusTone,
	getPreviewHistoryState,
} from '../preview';

describe( 'homepage preview helpers', () => {
	test( 'builds a homepage preview URL with optional refresh key', () => {
		expect( getHomepagePreviewUrl( 'https://example.com/home/?a=1' ) ).toBe(
			'https://example.com/home/?a=1&cnl-editor-preview=1'
		);
		expect( getHomepagePreviewUrl( 'https://example.com/', '123' ) ).toBe(
			'https://example.com/?cnl-editor-preview=1&cnl-editor-preview-refresh=123'
		);
		expect( getHomepagePreviewUrl( '' ) ).toBe( '' );
	} );

	test( 'normalizes unsupported devices to desktop', () => {
		expect( getHomepageDevice( 'mobile' ) ).toBe( 'mobile' );
		expect( getHomepageDevice( 'tablet' ) ).toBe( 'tablet' );
		expect( getHomepageDevice( 'wide' ) ).toBe( DEFAULT_HOMEPAGE_DEVICE );
	} );

	test( 'maps preview statuses to indicator tones', () => {
		expect( getHomepageStatusTone( 'homepage' ) ).toBe( 'success' );
		expect( getHomepageStatusTone( 'publish' ) ).toBe( 'success' );
		expect( getHomepageStatusTone( 'draft' ) ).toBe( 'warning' );
		expect( getHomepageStatusTone( 'pending' ) ).toBe( 'warning' );
		expect( getHomepageStatusTone( 'private' ) ).toBe( 'muted' );
		expect( getHomepageStatusTone( 'archive' ) ).toBe( 'neutral' );
	} );

	test( 'derives history button availability from tracked position', () => {
		expect( getPreviewHistoryState( 0, 0 ) ).toEqual( {
			canGoBack: false,
			canGoForward: false,
		} );
		expect( getPreviewHistoryState( 1, 1 ) ).toEqual( {
			canGoBack: true,
			canGoForward: false,
		} );
		expect( getPreviewHistoryState( 1, 3 ) ).toEqual( {
			canGoBack: true,
			canGoForward: true,
		} );
	} );
} );
