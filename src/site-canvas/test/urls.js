/**
 * Internal dependencies
 */
import {
	getEditRoute,
	getLiveUrl,
	getPreviewFrameUrl,
	isPreviewFrameUrl,
	isSameLocation,
} from '../urls';

const ORIGIN = window.location.origin;

describe( 'site canvas URLs', () => {
	test( 'previews only pages on this site', () => {
		expect( getPreviewFrameUrl( '/about/' ) ).toBe(
			`${ ORIGIN }/about/?cnl-editor-preview=1`
		);
		expect( getPreviewFrameUrl( 'https://wordpress.org/' ) ).toBe( '' );
		expect( getPreviewFrameUrl( 'mailto:hi@example.com' ) ).toBe( '' );
		expect( getPreviewFrameUrl( '' ) ).toBe( '' );
	} );

	test( 'tells a preview URL from a live one', () => {
		expect( isPreviewFrameUrl( '/about/?cnl-editor-preview=1' ) ).toBe(
			true
		);
		expect( isPreviewFrameUrl( '/about/' ) ).toBe( false );
	} );

	test( 'gives the live URL for a preview', () => {
		expect(
			getLiveUrl(
				`${ ORIGIN }/about/?cnl-editor-preview=1&cnl-editor-preview-refresh=2`
			)
		).toBe( `${ ORIGIN }/about/` );
	} );

	test( 'matches a page however it is viewed', () => {
		expect(
			isSameLocation(
				'/about',
				`${ ORIGIN }/about/?cnl-editor-preview=1`
			)
		).toBe( true );
		expect(
			isSameLocation(
				'/?page_id=3&preview=true',
				'/?cnl-editor-preview=1&page_id=3'
			)
		).toBe( true );
		expect( isSameLocation( '/about/', '/contact/' ) ).toBe( false );
		expect( isSameLocation( '', '' ) ).toBe( false );
	} );

	test( 'routes templates and posts to the full-screen editor', () => {
		expect(
			getEditRoute( { postId: 'theme//home', postType: 'wp_template' } )
		).toEqual( { search: { postId: 'theme//home' }, to: '/wp_template' } );
		expect( getEditRoute( { postId: 2, postType: 'page' } ) ).toEqual( {
			to: '/types/page/edit/2',
		} );
		expect( getEditRoute( null ) ).toBeNull();
	} );
} );
