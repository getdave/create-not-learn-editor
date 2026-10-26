/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import {
	getActiveStyle,
	getStyleChoices,
	getStyleClassName,
} from '../block-style-details';

const BUTTON_STYLES = [
	{ name: 'fill', label: 'Fill', isDefault: true },
	{ name: 'outline', label: 'Outline' },
];

const IMAGE_STYLES = [
	{ name: 'rounded', label: 'Rounded' },
	{ name: 'mainstay-arch', label: 'Arch' },
];

describe( 'getStyleChoices', () => {
	it( 'offers nothing for a block without styles', () => {
		expect( getStyleChoices( undefined ) ).toEqual( [] );
		expect( getStyleChoices( [] ) ).toEqual( [] );
	} );

	it( 'keeps styles that have a default as they are', () => {
		expect( getStyleChoices( BUTTON_STYLES ) ).toBe( BUTTON_STYLES );
	} );

	it( 'puts Default first when no style is the default', () => {
		expect(
			getStyleChoices( IMAGE_STYLES ).map( ( style ) => style.name )
		).toEqual( [ 'default', 'rounded', 'mainstay-arch' ] );
	} );
} );

describe( 'getActiveStyle', () => {
	it( 'reads the style from the class name', () => {
		expect(
			getActiveStyle( BUTTON_STYLES, 'custom is-style-outline' ).name
		).toBe( 'outline' );
	} );

	it( 'is the default without a style class', () => {
		expect( getActiveStyle( BUTTON_STYLES, 'custom' ).name ).toBe( 'fill' );
		expect( getActiveStyle( BUTTON_STYLES, undefined ).name ).toBe(
			'fill'
		);
	} );

	it( 'ignores style classes the block does not have', () => {
		expect(
			getActiveStyle(
				getStyleChoices( IMAGE_STYLES ),
				'is-style-unknown'
			).name
		).toBe( 'default' );
	} );
} );

describe( 'getStyleClassName', () => {
	it( 'swaps the style in use, keeping other classes', () => {
		expect(
			getStyleClassName(
				'custom is-style-outline',
				BUTTON_STYLES[ 1 ],
				BUTTON_STYLES[ 0 ]
			)
		).toBe( 'custom is-style-fill' );
	} );

	it( 'adds a style to a block without one', () => {
		expect( getStyleClassName( undefined, null, BUTTON_STYLES[ 1 ] ) ).toBe(
			'is-style-outline'
		);
	} );
} );
