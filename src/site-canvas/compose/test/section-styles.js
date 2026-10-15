/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import {
	getActiveSectionStyle,
	getSectionStyles,
	withSectionStyle,
} from '../section-styles';

const BLOCK_STYLES = [
	{ isDefault: true, label: 'Default', name: 'default' },
	{ label: 'Dark', name: 'section-dark' },
	{ label: 'Accent', name: 'section-accent' },
	{ label: 'Rounded', name: 'rounded' },
];

const VARIATIONS = {
	rounded: { border: { radius: '8px' } },
	'section-accent': {
		elements: { link: { color: { text: 'var(--accent)' } } },
	},
	'section-dark': { color: { background: '#000', text: '#fff' } },
};

describe( 'getSectionStyles', () => {
	it( 'keeps only styles the theme gives colours to', () => {
		expect( getSectionStyles( BLOCK_STYLES, VARIATIONS ) ).toEqual( [
			BLOCK_STYLES[ 1 ],
			BLOCK_STYLES[ 2 ],
		] );
	} );

	it( 'offers nothing when the theme has no variations', () => {
		expect( getSectionStyles( BLOCK_STYLES, undefined ) ).toEqual( [] );
		expect( getSectionStyles( undefined, VARIATIONS ) ).toEqual( [] );
	} );
} );

describe( 'getActiveSectionStyle', () => {
	const styles = getSectionStyles( BLOCK_STYLES, VARIATIONS );

	it( 'finds the style a block has on', () => {
		expect(
			getActiveSectionStyle( 'alignfull is-style-section-dark', styles )
		).toBe( 'section-dark' );
	} );

	it( 'finds none on a block without one', () => {
		expect( getActiveSectionStyle( 'alignfull', styles ) ).toBeNull();
		expect( getActiveSectionStyle( undefined, styles ) ).toBeNull();
		expect(
			getActiveSectionStyle( 'is-style-rounded', styles )
		).toBeNull();
	} );
} );

describe( 'withSectionStyle', () => {
	it( 'swaps one style for another, keeping other classes', () => {
		expect(
			withSectionStyle(
				'alignfull is-style-section-dark',
				'section-accent'
			)
		).toBe( 'alignfull is-style-section-accent' );
	} );

	it( 'takes the style off', () => {
		expect(
			withSectionStyle( 'alignfull is-style-section-dark', null )
		).toBe( 'alignfull' );
		expect( withSectionStyle( 'is-style-section-dark', null ) ).toBe(
			undefined
		);
	} );

	it( 'puts a style on a block without classes', () => {
		expect( withSectionStyle( undefined, 'section-dark' ) ).toBe(
			'is-style-section-dark'
		);
	} );
} );
