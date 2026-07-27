/**
 * Internal dependencies
 */
import {
	assignNavigationMenuToFirstBlock,
	buildNavigationLocationsMap,
	getLocationsSummary,
	getReferencedMenuIdsFromContent,
	getTemplatePartMenuRefs,
	removeNavigationMenuFromFirstBlock,
	templatePartHasNavigationBlock,
} from '../navigation-locations';

const headerPart = {
	area: 'header',
	content: {
		raw: '<!-- wp:navigation {"ref":10} /-->',
	},
	id: 'theme//header',
	title: {
		rendered: 'Main Header',
	},
};

const footerPart = {
	area: 'footer',
	content: {
		raw: '<!-- wp:navigation {"ref":20} /-->',
	},
	id: 'theme//footer',
	title: {
		rendered: 'Footer',
	},
};

describe( 'navigation location helpers', () => {
	test( 'reads explicit navigation menu refs from template part content', () => {
		expect(
			getReferencedMenuIdsFromContent(
				'<!-- wp:navigation {"ref":123} /-->'
			)
		).toEqual( [ 123 ] );
	} );

	test( 'uses the fallback menu for empty navigation blocks', () => {
		expect(
			getReferencedMenuIdsFromContent( '<!-- wp:navigation /-->', 456 )
		).toEqual( [ 456 ] );
	} );

	test( 'ignores explicitly unassigned navigation blocks', () => {
		expect(
			getReferencedMenuIdsFromContent(
				'<!-- wp:navigation {"__unstableLocation":"rsm-unassigned"} /-->',
				456
			)
		).toEqual( [] );
	} );

	test( 'does not fallback when the navigation block has inline items', () => {
		expect(
			getReferencedMenuIdsFromContent(
				[
					'<!-- wp:navigation -->',
					'<!-- wp:navigation-link {"label":"Home","url":"/"} /-->',
					'<!-- /wp:navigation -->',
				].join( '' ),
				456
			)
		).toEqual( [] );
	} );

	test( 'builds a menu-to-locations map sorted by template part area', () => {
		const map = buildNavigationLocationsMap( [ footerPart, headerPart ] );

		expect( map[ 10 ] ).toEqual( [
			expect.objectContaining( {
				area: 'header',
				areaLabel: 'Header',
				id: 'theme//header',
				label: 'Main Header',
			} ),
		] );
		expect( map[ 20 ] ).toEqual( [
			expect.objectContaining( {
				area: 'footer',
				areaLabel: 'Footer',
				id: 'theme//footer',
				label: 'Footer',
			} ),
		] );
		expect(
			getTemplatePartMenuRefs( [ footerPart, headerPart ] ).map(
				( ref ) => ref.part.id
			)
		).toEqual( [ 'theme//header', 'theme//footer' ] );
	} );

	test( 'summarizes usage counts for navigation menu rows', () => {
		expect( getLocationsSummary( [] ) ).toBe( 'Not used' );
		expect( getLocationsSummary( [ { id: 'header' } ] ) ).toBe(
			'1 location'
		);
		expect(
			getLocationsSummary( [ { id: 'header' }, { id: 'footer' } ] )
		).toBe( '2 locations' );
	} );

	test( 'detects template parts with navigation blocks', () => {
		expect( templatePartHasNavigationBlock( headerPart ) ).toBe( true );
		expect(
			templatePartHasNavigationBlock( {
				content: {
					raw: '<!-- wp:paragraph --><p>No menu</p><!-- /wp:paragraph -->',
				},
			} )
		).toBe( false );
	} );

	test( 'assigns a navigation menu to the first navigation block in a template part', () => {
		const content = assignNavigationMenuToFirstBlock(
			{
				content: {
					raw: [
						'<!-- wp:group -->',
						'<div class="wp-block-group">',
						'<!-- wp:navigation {"ref":10} /-->',
						'</div>',
						'<!-- /wp:group -->',
					].join( '' ),
				},
			},
			55
		);

		expect( getReferencedMenuIdsFromContent( content ) ).toEqual( [ 55 ] );
		expect( content ).toContain( '<div class="wp-block-group">' );
	} );

	test( 'removes a navigation menu assignment by marking the location unassigned', () => {
		const content = removeNavigationMenuFromFirstBlock(
			{
				content: {
					raw: '<!-- wp:navigation {"ref":55} /-->',
				},
			},
			55
		);

		expect( getReferencedMenuIdsFromContent( content, 55 ) ).toEqual( [] );
		expect( content ).toContain( '__unstableLocation' );
		expect( content ).toContain( 'rsm-unassigned' );
	} );

	test( 'marks an implicit fallback navigation block as unassigned on removal', () => {
		const content = removeNavigationMenuFromFirstBlock(
			{
				content: {
					raw: '<!-- wp:navigation /-->',
				},
			},
			55
		);

		expect( getReferencedMenuIdsFromContent( content, 55 ) ).toEqual( [] );
		expect( content ).toContain( 'rsm-unassigned' );
	} );
} );
