jest.mock( '@wordpress/blocks', () => ( {
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
	appendNavigationBlocksToContent,
	createEditorBlocksFromNavigationBlocks,
	createManualNavigationContentFromPages,
	createNavigationLinkBlock,
	createNavigationLinkBlockFromPage,
	createNavigationSubmenuBlock,
	createNavigationSubmenuBlockFromPage,
	expandPageListBlocks,
	getManualNavigationItems,
	getNavigationBlocksFromEditedRecord,
	getNavigationContentFromEditedRecord,
	getPageListNavigationBlocks,
	getParsedBlocks,
	hasPageListBlock,
	isAutoMenuContent,
	normalizeMenuItems,
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

	test( 'serializes label-only submenu attributes', () => {
		const content = serializeNavigationBlocks( [
			createNavigationSubmenuBlock( {
				label: 'Resources',
				url: '#',
			} ),
		] );
		const blocks = getParsedBlocks( content );

		expect( blocks[ 0 ].blockName ).toBe( 'core/navigation-submenu' );
		expect( blocks[ 0 ].attrs ).toMatchObject( {
			label: 'Resources',
			url: '#',
		} );
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

	test( 'creates editor blocks for block-editor insertion', () => {
		const blocks = createEditorBlocksFromNavigationBlocks( [
			createNavigationSubmenuBlock( {
				innerBlocks: [
					createNavigationLinkBlock( {
						label: 'Child',
						url: '/child/',
					} ),
				],
				label: 'Parent',
				url: '#',
			} ),
		] );

		expect( blocks ).toHaveLength( 1 );
		expect( blocks[ 0 ] ).toMatchObject( {
			attributes: {
				label: 'Parent',
				url: '#',
			},
			name: 'core/navigation-submenu',
		} );
		expect( blocks[ 0 ].clientId ).toEqual( expect.any( String ) );
		expect( blocks[ 0 ].innerBlocks[ 0 ] ).toMatchObject( {
			attributes: {
				label: 'Child',
				url: '/child/',
			},
			name: 'core/navigation-link',
		} );
	} );

	test( 'reads lazy edited navigation content from staged blocks', () => {
		const blocks = [
			createNavigationLinkBlock( {
				label: 'Staged',
				url: '/staged/',
			} ),
		];
		const record = {
			blocks,
			content: ( { blocks: blocksForSerialization } ) =>
				serializeNavigationBlocks( blocksForSerialization ),
		};

		const content = getNavigationContentFromEditedRecord( record );

		expect( content ).toContain( '"label":"Staged"' );
		expect( getNavigationBlocksFromEditedRecord( record ) ).toBe( blocks );
	} );

	describe( 'menus that list every page', () => {
		const pages = [
			{ id: 1, menu_order: 2, parent: 0, title: { raw: 'Services' } },
			{ id: 2, menu_order: 1, parent: 0, title: { raw: 'About' } },
			{ id: 3, menu_order: 0, parent: 1, title: { raw: 'Web design' } },
			{ id: 4, menu_order: 0, parent: 9, title: { raw: 'Orphan' } },
			{ id: 5, menu_order: 1, parent: 0, title: { raw: 'Contact' } },
		];
		const describeBlocks = ( blocks ) =>
			blocks.map( ( block ) => [
				block.name.replace( 'core/navigation-', '' ),
				block.attributes.label,
				...( block.innerBlocks.length
					? [ describeBlocks( block.innerBlocks ) ]
					: [] ),
			] );

		test( 'lists pages the way Page List does', () => {
			expect(
				describeBlocks( getPageListNavigationBlocks( pages ) )
			).toEqual( [
				[ 'link', 'About' ],
				[ 'link', 'Contact' ],
				[ 'submenu', 'Services', [ [ 'link', 'Web design' ] ] ],
			] );
		} );

		test( 'lists only the pages under a Page List’s parent page', () => {
			expect(
				describeBlocks( getPageListNavigationBlocks( pages, 1 ) )
			).toEqual( [ [ 'link', 'Web design' ] ] );
		} );

		test( 'swaps a Page List for the pages it shows, wherever it is', () => {
			const blocks = [
				{
					attributes: { label: 'Home', url: '/' },
					innerBlocks: [],
					name: 'core/navigation-link',
				},
				{
					attributes: { label: 'More', url: '#' },
					innerBlocks: [
						{
							attributes: { parentPageID: 1 },
							innerBlocks: [],
							name: 'core/page-list',
						},
					],
					name: 'core/navigation-submenu',
				},
			];

			expect( hasPageListBlock( blocks ) ).toBe( true );

			const expanded = expandPageListBlocks( blocks, pages );

			expect( hasPageListBlock( expanded ) ).toBe( false );
			expect( expanded[ 0 ] ).toBe( blocks[ 0 ] );
			expect( describeBlocks( expanded ) ).toEqual( [
				[ 'link', 'Home' ],
				[ 'submenu', 'More', [ [ 'link', 'Web design' ] ] ],
			] );
		} );

		test( 'keeps sub-pages nested when setting a menu by hand', () => {
			const content = createManualNavigationContentFromPages( pages );

			expect( content ).toContain( '<!-- wp:navigation-submenu' );
			expect( content ).not.toContain( 'Orphan' );
		} );
	} );

	describe( 'keeping links and submenus the right kind', () => {
		const item = (
			clientId,
			name,
			innerBlocks = [],
			attributes = {}
		) => ( {
			attributes: {
				label: clientId,
				url: `/${ clientId }`,
				...attributes,
			},
			clientId,
			innerBlocks,
			name: `core/navigation-${ name }`,
		} );

		test( 'makes a link with items under it a submenu, keeping its ID', () => {
			const child = item( 'child', 'link' );
			const next = [ item( 'parent', 'link', [ child ] ) ];
			const [ parent ] = normalizeMenuItems( next, [] );

			expect( parent.name ).toBe( 'core/navigation-submenu' );
			expect( parent.clientId ).toBe( 'parent' );
			expect( parent.attributes.label ).toBe( 'parent' );
			expect( parent.innerBlocks[ 0 ] ).toBe( child );
		} );

		test( 'makes a submenu that lost its last item a link again', () => {
			const previous = [
				item( 'parent', 'submenu', [ item( 'child', 'link' ) ] ),
			];
			const next = [
				item( 'parent', 'submenu' ),
				item( 'child', 'link' ),
			];
			const [ parent ] = normalizeMenuItems( next, previous );

			expect( parent.name ).toBe( 'core/navigation-link' );
			expect( parent.clientId ).toBe( 'parent' );
		} );

		test( 'leaves a submenu that was made empty on purpose', () => {
			const next = [
				item( 'new', 'submenu' ),
				item( 'label', 'submenu', [], { url: '#' } ),
			];

			expect( normalizeMenuItems( next, [] ) ).toBe( next );
		} );

		test( 'hands back the same blocks when nothing changes', () => {
			const next = [
				item( 'a', 'link' ),
				item( 'b', 'submenu', [ item( 'c', 'link' ) ] ),
			];

			expect( normalizeMenuItems( next, next ) ).toBe( next );
		} );

		test( 'works at any depth', () => {
			const next = [
				item( 'top', 'submenu', [
					item( 'middle', 'link', [ item( 'bottom', 'link' ) ] ),
				] ),
			];
			const [ top ] = normalizeMenuItems( next, [] );

			expect( top ).not.toBe( next[ 0 ] );
			expect( top.innerBlocks[ 0 ].name ).toBe(
				'core/navigation-submenu'
			);
		} );
	} );
} );
