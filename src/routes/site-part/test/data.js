/**
 * External dependencies
 */
import { describe, expect, test, vi } from 'vitest';

/**
 * Internal dependencies
 */
import {
	getCurrentPatternName,
	getSitePartContents,
	getSitePartPatterns,
	pickSitePart,
	putLayoutFirst,
} from '../data';

/*
 * The real parser, and a stand-in serializer that keeps what comparing two
 * parts needs: each block's name, attributes and inner blocks.
 */
vi.mock( '@wordpress/blocks', async () => {
	const { parse } = await vi.importActual(
		'@wordpress/block-serialization-default-parser'
	);
	const strip = ( blocks ) =>
		blocks
			.filter( ( block ) => block.blockName )
			.map( ( block ) => [
				block.blockName,
				block.attrs,
				strip( block.innerBlocks ),
			] );

	return {
		createBlock: vi.fn(),
		parse,
		serialize: ( blocks ) => JSON.stringify( strip( blocks ) ),
		store: 'core/blocks',
	};
} );

vi.mock( '@wordpress/core-data', () => ( { store: {} } ) );
const BLOCK_TYPES = [];

vi.mock( '@wordpress/data', () => ( {
	select: () => ( { getBlockTypes: () => BLOCK_TYPES } ),
	useSelect: () => ( {} ),
} ) );
vi.mock( '@wordpress/element', () => ( { useMemo: ( fn ) => fn() } ) );

vi.mock( '../../../wordpress-packages', () => ( {
	blockEditorStore: {},
	coreDataStore: {},
	useMemo: ( fn ) => fn(),
	useSelect: () => ( {} ),
} ) );

vi.mock( '../../content/pages/data', () => ( {
	getSitePartArea: () => undefined,
} ) );

vi.mock( '../../../records', () => ( {
	getTitleText: ( title ) =>
		typeof title === 'string' ? title : title?.rendered || '',
} ) );

const HEADER = '<!-- wp:site-title /-->\n\n<!-- wp:navigation /-->';
const PATTERNS = [
	{
		blockTypes: [ 'core/template-part/header' ],
		content: HEADER,
		name: 'theme/header-default',
	},
	{
		blockTypes: [ 'core/template-part/header' ],
		content: '<!-- wp:site-logo /-->',
		name: 'theme/header-logo',
	},
	{
		blockTypes: [ 'core/template-part/footer' ],
		content: '<!-- wp:site-title /-->',
		name: 'theme/footer',
	},
	{
		blockTypes: [ 'core/template-part/footer' ],
		content:
			'<!-- wp:social-links --><!-- wp:social-link {"url":"#","service":"facebook"} /--><!-- /wp:social-links -->',
		name: 'theme/footer-social',
	},
	{
		blockTypes: [ 'core/template-part/header' ],
		content: '<!-- wp:site-title /-->',
		inserter: false,
		name: 'theme/hidden',
	},
];

describe( 'site part data', () => {
	test( 'picks the first header and the last footer', () => {
		const parts = [
			{ area: 'header', clientId: 'a' },
			{ area: 'header', clientId: 'b' },
			{ area: 'footer', clientId: 'c' },
			{ area: 'footer', clientId: 'd' },
		];

		expect( pickSitePart( parts, 'header' ).clientId ).toBe( 'a' );
		expect( pickSitePart( parts, 'footer' ).clientId ).toBe( 'd' );
		expect( pickSitePart( [], 'header' ) ).toBeNull();
	} );

	test( 'reports what a part holds', () => {
		expect(
			getSitePartContents( [ 'core/group', 'core/site-title' ] )
		).toEqual( {
			hasLogo: false,
			hasNavigation: false,
			hasSiteTitle: true,
			hasSocialLinks: false,
		} );
		expect(
			getSitePartContents( [ 'core/social-links' ] ).hasSocialLinks
		).toBe( true );
	} );

	test( 'offers the theme’s layouts for the area', () => {
		expect(
			getSitePartPatterns( PATTERNS, 'header' ).map( ( p ) => p.name )
		).toEqual( [ 'theme/header-default', 'theme/header-logo' ] );
	} );

	test( 'finds the layout a part uses', () => {
		const layouts = getSitePartPatterns( PATTERNS, 'header' );

		expect(
			getCurrentPatternName(
				'<!-- wp:pattern {"slug":"theme/header-logo"} /-->',
				layouts
			)
		).toBe( 'theme/header-logo' );
		expect(
			getCurrentPatternName(
				'<!-- wp:site-title /-->\n<!-- wp:navigation {"ref":5} /-->',
				layouts
			)
		).toBe( 'theme/header-default' );
		expect(
			getCurrentPatternName(
				'<!-- wp:site-logo {"metadata":{"patternName":"theme/header-logo"}} /-->',
				layouts
			)
		).toBe( 'theme/header-logo' );
		expect(
			getCurrentPatternName( '<!-- wp:site-tagline /-->', layouts )
		).toBeNull();
		expect(
			getCurrentPatternName(
				'<!-- wp:social-links --><!-- wp:social-link {"url":"https://instagram.com/me","service":"instagram"} /--><!-- /wp:social-links -->',
				getSitePartPatterns( PATTERNS, 'footer' )
			)
		).toBe( 'theme/footer-social' );
		expect( getCurrentPatternName( '', layouts ) ).toBeNull();
	} );

	test( 'finds the layout whatever colours the part has on', () => {
		const layouts = getSitePartPatterns( PATTERNS, 'header' );

		expect(
			getCurrentPatternName(
				'<!-- wp:site-title {"className":"is-style-section-dark"} /-->\n<!-- wp:navigation /-->',
				layouts
			)
		).toBe( 'theme/header-default' );
		expect(
			getCurrentPatternName(
				'<!-- wp:site-title {"backgroundColor":"contrast","textColor":"base","style":{"elements":{"link":{"color":{"text":"var:preset|color|base"}}}}} /-->\n<!-- wp:navigation /-->',
				layouts
			)
		).toBe( 'theme/header-default' );
	} );

	test( 'leads with a layout, keeping the rest in order', () => {
		const layouts = getSitePartPatterns( PATTERNS, 'header' );
		const names = ( list ) => list.map( ( pattern ) => pattern.name );

		expect(
			names( putLayoutFirst( layouts, 'theme/header-logo' ) )
		).toEqual( [ 'theme/header-logo', 'theme/header-default' ] );
		expect( putLayoutFirst( layouts, null ) ).toBe( layouts );
		expect( putLayoutFirst( layouts, 'theme/missing' ) ).toBe( layouts );
	} );
} );
