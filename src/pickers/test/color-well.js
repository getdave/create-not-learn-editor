/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { withBlackAndWhite } from '../color-well';

describe( 'withBlackAndWhite', () => {
	it( 'adds pure black and white after the palette', () => {
		expect(
			withBlackAndWhite( [
				{ slug: 'accent', name: 'Accent', color: '#2e6b4f' },
			] ).map( ( item ) => item.color )
		).toEqual( [ '#2e6b4f', '#000000', '#ffffff' ] );
	} );

	it( 'leaves out those the palette already has', () => {
		expect(
			withBlackAndWhite( [
				{ slug: 'base', name: 'Base', color: '#FFF' },
				{ slug: 'ink', name: 'Ink', color: '#1b2a22' },
			] ).map( ( item ) => item.color )
		).toEqual( [ '#FFF', '#1b2a22', '#000000' ] );
	} );
} );
