/**
 * External dependencies
 */
import { describe, expect, test } from 'vitest';

/**
 * Internal dependencies
 */
import { isSiteWide } from '../scope';

describe( 'isSiteWide', () => {
	test.each( [
		'colors',
		'fonts',
		'footer',
		'header',
		'logo',
		'look',
		'menu',
		'site-part',
		'site-title',
		'social-links',
	] )( '%s changes every page', ( skill ) => {
		expect( isSiteWide( skill ) ).toBe( true );
	} );

	test.each( [ 'add-page', 'add-section', 'section-design', 'undo', null ] )(
		'%s changes one page, or nothing',
		( skill ) => {
			expect( isSiteWide( skill ) ).toBe( false );
		}
	);
} );
