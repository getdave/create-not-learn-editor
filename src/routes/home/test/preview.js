/**
 * Internal dependencies
 */
import { getHomepageDocumentIconStatus } from '../preview';

describe( 'homepage preview helpers', () => {
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
} );
