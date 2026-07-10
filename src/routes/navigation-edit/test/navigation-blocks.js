/**
 * Internal dependencies
 */
import {
	appendNavigationBlocksToContent,
	createManualNavigationContentFromPages,
	createNavigationLinkBlock,
	createNavigationLinkBlockFromPage,
	createNavigationSubmenuBlock,
	createNavigationSubmenuBlockFromPage,
	getManualNavigationItems,
	getParsedBlocks,
	isAutoMenuContent,
	serializeNavigationBlocks,
} from '../navigation-blocks';

const samplePage = {
	id: 12,
	link: 'https://example.com/sample/',
	title: {
		rendered: 'Sample Page',
	},
	type: 'page',
};

describe( 'navigation edit block helpers', () => {
	test( 'detects auto-menu page-list content', () => {
		expect( isAutoMenuContent( '<!-- wp:page-list /-->' ) ).toBe( true );
		expect( isAutoMenuContent( '\n<!-- wp:page-list /-->\n' ) ).toBe(
			true
		);
		expect( isAutoMenuContent( '' ) ).toBe( false );
		expect( isAutoMenuContent( '   ' ) ).toBe( false );
		expect( isAutoMenuContent( '<!-- wp:navigation /-->' ) ).toBe( false );
		expect(
			isAutoMenuContent(
				'<!-- wp:navigation-link {"label":"Home","url":"/"} /-->'
			)
		).toBe( false );
		expect(
			isAutoMenuContent(
				'<!-- wp:page-list /--><!-- wp:navigation-link {"label":"Home","url":"/"} /-->'
			)
		).toBe( false );
	} );

	test( 'converts pages to serialized manual navigation links', () => {
		const content = createManualNavigationContentFromPages( [
			samplePage,
		] );
		const blocks = getParsedBlocks( content );

		expect( blocks ).toHaveLength( 1 );
		expect( blocks[ 0 ].blockName ).toBe( 'core/navigation-link' );
		expect( blocks[ 0 ].attrs ).toMatchObject( {
			id: 12,
			kind: 'post-type',
			label: 'Sample Page',
			type: 'page',
			url: 'https://example.com/sample/',
		} );
	} );

	test( 'appends custom link blocks to existing menu content', () => {
		const content = appendNavigationBlocksToContent(
			createManualNavigationContentFromPages( [ samplePage ] ),
			[
				createNavigationLinkBlock( {
					kind: 'custom',
					label: 'External',
					url: 'https://example.com/',
				} ),
			]
		);
		const items = getManualNavigationItems( getParsedBlocks( content ) );

		expect( items.map( ( item ) => item.label ) ).toEqual( [
			'Sample Page',
			'External',
		] );
	} );

	test( 'serializes page-backed submenu blocks', () => {
		const content = serializeNavigationBlocks( [
			createNavigationSubmenuBlockFromPage( samplePage, [
				createNavigationLinkBlock( {
					kind: 'custom',
					label: 'Child link',
					url: '/child/',
				} ),
			] ),
		] );
		const blocks = getParsedBlocks( content );
		const items = getManualNavigationItems( blocks );

		expect( blocks[ 0 ].blockName ).toBe( 'core/navigation-submenu' );
		expect( blocks[ 0 ].attrs ).toMatchObject( {
			id: 12,
			kind: 'post-type',
			label: 'Sample Page',
			type: 'page',
		} );
		expect( items ).toEqual( [
			expect.objectContaining( {
				depth: 0,
				isSubmenu: true,
				label: 'Sample Page',
			} ),
			expect.objectContaining( {
				depth: 1,
				isSubmenu: false,
				label: 'Child link',
			} ),
		] );
	} );

	test( 'escapes unsafe comment sequences in serialized attributes', () => {
		const content = serializeNavigationBlocks( [
			createNavigationSubmenuBlock( {
				label: 'A -- B < C & D',
				url: '#',
			} ),
		] );

		expect( content ).toContain( '\\u002d\\u002d' );
		expect( content ).toContain( '\\u003c' );
		expect( content ).toContain( '\\u0026' );
		expect(
			getManualNavigationItems( getParsedBlocks( content ) )
		).toEqual( [
			expect.objectContaining( {
				isSubmenu: true,
				label: 'A -- B < C & D',
			} ),
		] );
	} );

	test( 'creates page-backed navigation link blocks', () => {
		expect( createNavigationLinkBlockFromPage( samplePage ) ).toMatchObject(
			{
				attributes: {
					id: 12,
					kind: 'post-type',
					label: 'Sample Page',
					type: 'page',
					url: 'https://example.com/sample/',
				},
				name: 'core/navigation-link',
			}
		);
	} );
} );
