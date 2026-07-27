jest.mock( '../../../wordpress-packages', () => ( {
	createBlock: ( name, attributes = {}, innerBlocks = [] ) => ( {
		attributes,
		clientId: `mock-client-id-${ name }`,
		innerBlocks,
		name,
	} ),
} ) );

/**
 * Internal dependencies
 */
import {
	createCustomNavigationLinkBlock,
	createCustomNavigationSubmenuBlock,
	createExistingPageNavigationLinkBlock,
	createLabelOnlyNavigationSubmenuBlock,
	createPageNavigationSubmenuBlock,
	getBlockListRootClientId,
	getLabelOnlyNavigationSubmenuAttributes,
	insertBlockAtListAppenderPosition,
} from '../navigation-list-view-insertions';

describe( 'navigation ListView insertion helpers', () => {
	test( 'normalizes root and submenu insertion targets', () => {
		expect( getBlockListRootClientId( null ) ).toBe( '' );
		expect( getBlockListRootClientId( undefined ) ).toBe( '' );
		expect( getBlockListRootClientId( 'submenu-client-id' ) ).toBe(
			'submenu-client-id'
		);
	} );

	test( 'inserts blocks at the appender position without mutating input', () => {
		const existingBlocks = [
			{ clientId: 'first' },
			{ clientId: 'second' },
		];
		const insertedBlock = { clientId: 'inserted' };
		const nextBlocks = insertBlockAtListAppenderPosition(
			existingBlocks,
			insertedBlock,
			1
		);

		expect( nextBlocks.map( ( block ) => block.clientId ) ).toEqual( [
			'first',
			'inserted',
			'second',
		] );
		expect( existingBlocks.map( ( block ) => block.clientId ) ).toEqual( [
			'first',
			'second',
		] );
	} );

	test( 'creates the prototype page Navigation Link variation', () => {
		expect( createExistingPageNavigationLinkBlock() ).toMatchObject( {
			attributes: {
				kind: 'post-type',
				type: 'page',
			},
			name: 'core/navigation-link',
		} );
	} );

	test( 'creates the prototype custom link variation', () => {
		expect( createCustomNavigationLinkBlock() ).toMatchObject( {
			attributes: {},
			name: 'core/navigation-link',
		} );
	} );

	test( 'creates submenu variations for page, custom, and label-only flows', () => {
		expect( createPageNavigationSubmenuBlock() ).toMatchObject( {
			attributes: {
				kind: 'post-type',
				type: 'page',
			},
			name: 'core/navigation-submenu',
		} );
		expect( createCustomNavigationSubmenuBlock() ).toMatchObject( {
			attributes: {},
			name: 'core/navigation-submenu',
		} );
		expect( createLabelOnlyNavigationSubmenuBlock() ).toMatchObject( {
			attributes: {},
			name: 'core/navigation-submenu',
		} );
	} );

	test( 'creates label-only submenu attributes with hash URL', () => {
		expect(
			getLabelOnlyNavigationSubmenuAttributes( '  Resources  ' )
		).toEqual( {
			label: 'Resources',
			url: '#',
		} );
	} );
} );
