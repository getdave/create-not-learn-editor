// Pattern markup stands for the blocks it parses to, so these tests don't
// need the block library.
const parsed = new Map();

vi.mock( '@wordpress/blocks', () => ( {
	parse: ( content ) => parsed.get( content ) || [],
	store: {},
} ) );
vi.mock( '@wordpress/core-data', () => ( { store: {} } ) );
vi.mock( '@wordpress/data', () => ( { useSelect: () => [] } ) );
vi.mock( '@wordpress/element', () => ( { useMemo: ( fn ) => fn() } ) );

/**
 * External dependencies
 */
import { describe, expect, it, vi } from 'vitest';

/**
 * Internal dependencies
 */
import { getPreviewBlocks, PREVIEW_VIEWPORT_HEIGHT } from '../preview-blocks';

function block( name, attributes = {}, innerBlocks = [] ) {
	return { attributes, innerBlocks, name };
}

describe( 'getPreviewBlocks', () => {
	it( 'measures a viewport height against a screen-sized preview', () => {
		expect( PREVIEW_VIEWPORT_HEIGHT ).toBe( 800 );

		const [ cover ] = getPreviewBlocks( [
			block( 'core/cover', { minHeight: 85, minHeightUnit: 'vh' } ),
		] );

		expect( cover.attributes ).toEqual( {
			minHeight: 680,
			minHeightUnit: 'px',
		} );
	} );

	it( 'leaves other units alone', () => {
		const attributes = { minHeight: 500, minHeightUnit: 'px' };
		const [ cover ] = getPreviewBlocks( [
			block( 'core/cover', attributes ),
		] );

		expect( cover.attributes ).toEqual( attributes );
	} );

	it( 'converts viewport heights in styles and spacers, nested or not', () => {
		const [ group ] = getPreviewBlocks( [
			block(
				'core/group',
				{
					style: {
						color: { background: '#123456' },
						dimensions: { minHeight: '100svh' },
						spacing: { padding: { top: 'calc(10vh + 2rem)' } },
					},
				},
				[ block( 'core/spacer', { height: '50dvh' } ) ]
			),
		] );

		expect( group.attributes.style ).toEqual( {
			color: { background: '#123456' },
			dimensions: { minHeight: '800px' },
			spacing: { padding: { top: 'calc(80px + 2rem)' } },
		} );
		expect( group.innerBlocks[ 0 ].attributes.height ).toBe( '400px' );
	} );

	it( 'swaps pattern blocks for their blocks, so their sections are fixed too', () => {
		parsed.set( 'hero markup', [
			block( 'core/cover', { minHeight: 60, minHeightUnit: 'vh' } ),
		] );

		const blocks = getPreviewBlocks(
			[
				block( 'core/pattern', { slug: 'theme/hero' } ),
				block( 'core/pattern', { slug: 'theme/missing' } ),
			],
			[ { content: 'hero markup', name: 'theme/hero' } ]
		);

		expect( blocks.map( ( { name } ) => name ) ).toEqual( [
			'core/cover',
			'core/pattern',
		] );
		expect( blocks[ 0 ].attributes.minHeight ).toBe( 480 );
	} );

	it( 'stops at a pattern that contains itself', () => {
		parsed.set( 'loop markup', [
			block( 'core/pattern', { slug: 'theme/loop' } ),
		] );

		const blocks = getPreviewBlocks(
			[ block( 'core/pattern', { slug: 'theme/loop' } ) ],
			[ { content: 'loop markup', name: 'theme/loop' } ]
		);

		expect( blocks ).toEqual( [
			block( 'core/pattern', { slug: 'theme/loop' } ),
		] );
	} );
} );
