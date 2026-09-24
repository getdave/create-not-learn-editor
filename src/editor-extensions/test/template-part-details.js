/**
 * Internal dependencies
 */
import {
	getTemplatePartEditLabel,
	getTemplatePartId,
} from '../template-part-details';

describe( 'getTemplatePartEditLabel', () => {
	it( 'names the part by its area', () => {
		expect( getTemplatePartEditLabel( 'Header', 'Site header' ) ).toBe(
			'Edit Header'
		);
	} );

	it( 'falls back to the part title when the area has no label', () => {
		expect( getTemplatePartEditLabel( undefined, 'Sidebar' ) ).toBe(
			'Edit Sidebar'
		);
	} );

	it( 'falls back to a generic label when neither is known', () => {
		expect( getTemplatePartEditLabel( '  ', undefined ) ).toBe(
			'Edit template part'
		);
	} );
} );

describe( 'getTemplatePartId', () => {
	it( 'prefers the theme named by the block', () => {
		expect(
			getTemplatePartId(
				{ slug: 'header', theme: 'twentytwentyfour' },
				'twentytwentyfive'
			)
		).toBe( 'twentytwentyfour//header' );
	} );

	it( 'falls back to the current theme', () => {
		expect(
			getTemplatePartId( { slug: 'footer' }, 'twentytwentyfive' )
		).toBe( 'twentytwentyfive//footer' );
	} );

	it( 'has no ID for a part that has not been chosen yet', () => {
		expect( getTemplatePartId( {}, 'twentytwentyfive' ) ).toBeNull();
		expect( getTemplatePartId( { slug: 'header' }, undefined ) ).toBeNull();
	} );
} );
