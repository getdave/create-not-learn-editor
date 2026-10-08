jest.mock( '@wordpress/blocks', () => ( {
	getBlockType: jest.fn(),
} ) );

/**
 * WordPress dependencies
 */
import { getBlockType } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import {
	getDropIndex,
	getSectionKind,
	getSectionSketch,
	getSectionSummary,
	getSectionTitle,
	getTemplateElementKey,
	getTemplateElementLabel,
	insertItems,
	isSingleBlockSection,
	moveItem,
	removeItem,
} from '../page-sections';

const heading = ( content ) => ( {
	attributes: { content },
	innerBlocks: [],
	name: 'core/heading',
} );
const button = { attributes: {}, innerBlocks: [], name: 'core/button' };
const image = { attributes: {}, innerBlocks: [], name: 'core/image' };
const column = ( ...innerBlocks ) => ( {
	attributes: {},
	innerBlocks,
	name: 'core/column',
} );

describe( 'page sections', () => {
	test( 'names a section after its given name, then its first heading', () => {
		const group = {
			attributes: {},
			innerBlocks: [ heading( 'Welcome <em>home</em> &amp; stay' ) ],
			name: 'core/group',
		};

		expect( getSectionTitle( group ) ).toBe( 'Welcome home & stay' );
		expect(
			getSectionTitle( {
				...group,
				attributes: { metadata: { name: 'Hero' } },
			} )
		).toBe( 'Hero' );
	} );

	test( 'falls back to the first words of its text', () => {
		const text = {
			attributes: {},
			innerBlocks: [
				{
					attributes: {
						content:
							'Got questions? Feel free to reach out, we love hearing from you.',
					},
					innerBlocks: [],
					name: 'core/paragraph',
				},
			],
			name: 'core/group',
		};

		expect( getSectionTitle( text ) ).toBe(
			'Got questions? Feel free to reach out, we love…'
		);
		expect( getSectionSummary( text ) ).toBe( 'Section' );
	} );

	test( 'describes columns, calls to action and banners', () => {
		const columns = {
			attributes: {},
			innerBlocks: [
				{
					attributes: {},
					innerBlocks: [
						column( image ),
						column( image ),
						column( image ),
					],
					name: 'core/columns',
				},
			],
			name: 'core/group',
		};
		const cta = {
			attributes: {},
			innerBlocks: [
				heading( 'Join us' ),
				{
					attributes: {},
					innerBlocks: [ button, button ],
					name: 'core/buttons',
				},
			],
			name: 'core/group',
		};

		expect( getSectionKind( columns ) ).toBe( '3 columns' );
		expect( getSectionTitle( columns ) ).toBe( '3 columns' );
		expect( getSectionSummary( columns ) ).toBe( '3 images' );
		expect( getSectionKind( cta ) ).toBe( 'Call to action' );
		expect( getSectionSummary( cta ) ).toBe( 'Call to action · 2 buttons' );
		expect(
			getSectionSketch( {
				attributes: {},
				innerBlocks: [ heading( 'Hi' ) ],
				name: 'core/cover',
			} )
		).toEqual(
			expect.objectContaining( {
				heading: true,
				media: 'cover',
				tone: 'filled',
			} )
		);
		expect( getSectionSketch( columns ) ).toEqual(
			expect.objectContaining( { columnImages: true, columns: 3 } )
		);
	} );

	test( 'tells single blocks apart from laid-out sections', () => {
		expect( isSingleBlockSection( heading( 'Hi' ) ) ).toBe( true );
		expect( isSingleBlockSection( image ) ).toBe( true );
		expect(
			isSingleBlockSection( {
				attributes: {},
				innerBlocks: [ button ],
				name: 'core/buttons',
			} )
		).toBe( true );
		expect(
			isSingleBlockSection( {
				attributes: {},
				innerBlocks: [ heading( 'Hi' ) ],
				name: 'core/group',
			} )
		).toBe( false );
	} );

	test( 'moves, inserts and removes items without mutating', () => {
		const list = [ 'a', 'b', 'c', 'd' ];

		expect( moveItem( list, 0, 2 ) ).toEqual( [ 'b', 'c', 'a', 'd' ] );
		expect( moveItem( list, 3, 0 ) ).toEqual( [ 'd', 'a', 'b', 'c' ] );
		expect( moveItem( list, 0, 9 ) ).toBe( list );
		expect( insertItems( list, 1, [ 'x', 'y' ] ) ).toEqual( [
			'a',
			'x',
			'y',
			'b',
			'c',
			'd',
		] );
		expect( insertItems( list, 99, [ 'z' ] ) ).toEqual( [
			'a',
			'b',
			'c',
			'd',
			'z',
		] );
		expect( removeItem( list, 1 ) ).toEqual( [ 'a', 'c', 'd' ] );
		expect( list ).toEqual( [ 'a', 'b', 'c', 'd' ] );
	} );

	test( 'keys and names template elements by their area or block type', () => {
		const header = { area: 'header', clientId: 'header-1' };
		const footer = { area: 'footer', clientId: 'footer-1' };
		const title = { clientId: 'title-1', name: 'core/post-title' };

		expect( getTemplateElementKey( header ) ).toBe( 'header' );
		expect( getTemplateElementKey( footer ) ).toBe( 'footer' );
		expect( getTemplateElementKey( title ) ).toBe( 'title-1' );

		expect( getTemplateElementLabel( header ) ).toBe( 'Header' );
		expect( getTemplateElementLabel( footer ) ).toBe( 'Footer' );

		getBlockType.mockReturnValue( { title: 'Title' } );
		expect( getTemplateElementLabel( title ) ).toBe( 'Title' );

		getBlockType.mockReturnValue( undefined );
		expect(
			getTemplateElementLabel( { clientId: 'x', name: 'core/unknown' } )
		).toBe( 'Section' );
	} );

	test( 'works out where a dropped section lands', () => {
		// Dragging the first item below the third.
		expect( getDropIndex( 0, 2, 'after' ) ).toBe( 2 );
		// Dragging the first item above the third.
		expect( getDropIndex( 0, 2, 'before' ) ).toBe( 1 );
		// Dragging the last item above the first.
		expect( getDropIndex( 3, 0, 'before' ) ).toBe( 0 );
		// Dropping an item next to itself leaves it in place.
		expect( getDropIndex( 1, 1, 'after' ) ).toBe( 1 );
		expect( getDropIndex( 1, 2, 'before' ) ).toBe( 1 );
	} );
} );
