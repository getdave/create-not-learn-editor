/**
 * Internal dependencies
 */
import {
	getActiveFontSizeSlug,
	getFontSizeAttributes,
	getFontSizeHint,
} from '../font-size-details';

const FONT_SIZES = [
	{ name: 'Small', slug: 'small', size: '0.875rem' },
	{ name: 'Large', slug: 'large', size: '1.5rem' },
];

describe( 'getActiveFontSizeSlug', () => {
	it( 'reads a preset slug', () => {
		expect(
			getActiveFontSizeSlug( FONT_SIZES, { fontSize: 'large' } )
		).toBe( 'large' );
	} );

	it( 'reads a preset reference in the style', () => {
		expect(
			getActiveFontSizeSlug( FONT_SIZES, {
				style: {
					typography: { fontSize: 'var:preset|font-size|small' },
				},
			} )
		).toBe( 'small' );
	} );

	it( 'matches a custom value to a preset of the same size', () => {
		expect(
			getActiveFontSizeSlug( FONT_SIZES, {
				style: { typography: { fontSize: '1.5rem' } },
			} )
		).toBe( 'large' );
	} );

	it( 'is null for a custom size no preset matches', () => {
		expect(
			getActiveFontSizeSlug( FONT_SIZES, {
				style: { typography: { fontSize: '13px' } },
			} )
		).toBeNull();
	} );

	it( 'is null for the default size', () => {
		expect( getActiveFontSizeSlug( FONT_SIZES, {} ) ).toBeNull();
	} );
} );

describe( 'getFontSizeAttributes', () => {
	it( 'sets a preset and clears a custom size, keeping other styles', () => {
		expect(
			getFontSizeAttributes(
				{
					style: {
						color: { text: '#000' },
						typography: { fontSize: '13px', lineHeight: '1.2' },
					},
				},
				'large'
			)
		).toEqual( {
			fontSize: 'large',
			style: {
				color: { text: '#000' },
				typography: { lineHeight: '1.2' },
			},
		} );
	} );

	it( 'drops a style left empty', () => {
		expect(
			getFontSizeAttributes(
				{ style: { typography: { fontSize: '13px' } } },
				'small'
			)
		).toEqual( { fontSize: 'small', style: undefined } );
	} );

	it( 'goes back to the default size', () => {
		expect( getFontSizeAttributes( { fontSize: 'large' }, null ) ).toEqual(
			{ fontSize: undefined, style: undefined }
		);
	} );
} );

describe( 'getFontSizeHint', () => {
	it( 'shows a plain size', () => {
		expect( getFontSizeHint( { size: '1.5rem' } ) ).toBe( '1.5rem' );
		expect( getFontSizeHint( { size: 16 } ) ).toBe( '16' );
	} );

	it( "prefers the theme's hint", () => {
		expect( getFontSizeHint( { size: '1rem', hint: '16px' } ) ).toBe(
			'16px'
		);
	} );

	it( 'shows nothing for a size it cannot read as a number', () => {
		expect(
			getFontSizeHint( { size: 'clamp(1rem, 2vw, 2rem)' } )
		).toBeNull();
		expect( getFontSizeHint( { size: 'var(--size)' } ) ).toBeNull();
	} );
} );
