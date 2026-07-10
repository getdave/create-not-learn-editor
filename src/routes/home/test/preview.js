/**
 * Internal dependencies
 */
import {
	DEFAULT_HOMEPAGE_DEVICE,
	getHomepageDevice,
	getHomepageDocumentIconStatus,
	getHomepagePreviewNavigationUrl,
	getHomepagePreviewContextUrl,
	getHomepagePreviewUrl,
	getHomepageStatusTone,
	getPreviewHistoryState,
	isHomepagePreviewNavigationUrl,
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

	test( 'normalizes iframe URLs for preview context lookup', () => {
		expect(
			getHomepagePreviewContextUrl(
				'https://example.com/about/?cnl-editor-preview=1&cnl-editor-preview-refresh=123#content'
			)
		).toBe( 'https://example.com/about/' );
		expect(
			getHomepagePreviewContextUrl( '', 'https://example.com/' )
		).toBe( 'https://example.com/' );
		expect( getHomepagePreviewContextUrl( '' ) ).toBe( '' );
	} );

	test( 'preserves preview mode for same-origin iframe navigation', () => {
		const origin = window.location.origin;

		expect(
			getHomepagePreviewNavigationUrl( `${ origin }/about/?a=1#team` )
		).toBe( `${ origin }/about/?a=1&cnl-editor-preview=1#team` );
		expect(
			getHomepagePreviewNavigationUrl( '/contact/', `${ origin }/` )
		).toBe( `${ origin }/contact/?cnl-editor-preview=1` );
		expect(
			getHomepagePreviewNavigationUrl( 'https://wordpress.org/about/' )
		).toBe( 'https://wordpress.org/about/' );
		expect(
			getHomepagePreviewNavigationUrl( 'mailto:test@example.com' )
		).toBe( 'mailto:test@example.com' );
		expect(
			isHomepagePreviewNavigationUrl(
				`${ origin }/about/?cnl-editor-preview=1`
			)
		).toBe( true );
		expect( isHomepagePreviewNavigationUrl( `${ origin }/about/` ) ).toBe(
			false
		);
	} );

	test( 'normalizes unsupported devices to desktop', () => {
		expect( getHomepageDevice( 'mobile' ) ).toBe( 'mobile' );
		expect( getHomepageDevice( 'tablet' ) ).toBe( 'tablet' );
		expect( getHomepageDevice( 'wide' ) ).toBe( DEFAULT_HOMEPAGE_DEVICE );
	} );

	test( 'allows icons only for special homepage document statuses', () => {
		expect( getHomepageDocumentIconStatus( 'home-static' ) ).toBe(
			'home-static'
		);
		expect( getHomepageDocumentIconStatus( 'home-latest-posts' ) ).toBe(
			'home-latest-posts'
		);
		expect( getHomepageDocumentIconStatus( 'posts-page' ) ).toBe(
			'posts-page'
		);
		expect( getHomepageDocumentIconStatus( 'publish' ) ).toBe( '' );
		expect( getHomepageDocumentIconStatus( 'preview' ) ).toBe( '' );
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
