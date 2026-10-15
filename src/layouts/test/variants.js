// The real package imports JSON without the import attribute Node needs, so
// its `cloneBlock` is mirrored here, as other tests in the repo mock it too.
vi.mock( '@wordpress/blocks', () => {
	let id = 0;

	function cloneBlock( block, mergeAttributes = {}, newInnerBlocks ) {
		return {
			...block,
			clientId: `client-id-${ ++id }`,
			attributes: { ...block.attributes, ...mergeAttributes },
			innerBlocks:
				newInnerBlocks ||
				block.innerBlocks.map( ( inner ) => cloneBlock( inner ) ),
		};
	}

	return { cloneBlock };
} );

/**
 * External dependencies
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * WordPress dependencies
 */
import { parse as parseRaw } from '@wordpress/block-serialization-default-parser';
import { cloneBlock } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import { getLayoutSlug, getSectionArrangements } from '../variants';

const PATTERNS = join( __dirname, '../../../patterns/layouts' );
const PREFIX = 'create-not-learn-editor/layout-';

// The arrangement each layout is in as it ships.
const SHIPPED = {
	'image-text': 'image-left',
	'text-image': 'image-right',
	profile: 'image-left',
	'large-two-small': 'image-left',
	'alternating-image-text': 'alternate-left',
	'image-above-text': 'image-above',
	'hero-image': 'image-below',
	'cta-image': 'text-centre',
	'image-overlay': 'text-centre',
	hero: 'text-centre',
	'heading-text': 'text-centre',
	'big-statement': 'text-centre',
};

/**
 * Parse pattern markup into editor-shaped blocks. Block attributes come from
 * the comment delimiters, which is all a layout has: its blocks are empty.
 *
 * @param {string} content Block markup.
 * @return {Object[]} Blocks.
 */
function parse( content ) {
	const toBlock = ( { blockName, attrs, innerBlocks } ) =>
		cloneBlock( {
			name: blockName,
			attributes: { ...attrs },
			innerBlocks: innerBlocks
				.filter( ( inner ) => inner.blockName )
				.map( toBlock ),
		} );

	return parseRaw( content )
		.filter( ( block ) => block.blockName )
		.map( toBlock );
}

function walk( blocks, visit ) {
	blocks.forEach( ( block ) => {
		visit( block );
		walk( block.innerBlocks, visit );
	} );
}

/**
 * A layout as it lands on a page, named after its pattern, with every empty
 * block filled in so there is content to lose.
 *
 * @param {string} slug Layout slug.
 * @return {Object} Section block.
 */
function loadSection( slug ) {
	const [ block ] = parse(
		readFileSync( join( PATTERNS, `${ slug }.html` ), 'utf8' )
	);
	let count = 0;

	walk( [ block ], ( inner ) => {
		count++;

		if ( [ 'core/heading', 'core/paragraph' ].includes( inner.name ) ) {
			inner.attributes.content = `Words ${ count }`;
		} else if ( inner.name === 'core/button' ) {
			inner.attributes.text = `Button ${ count }`;
			inner.attributes.url = `https://example.com/${ count }`;
		} else if ( [ 'core/image', 'core/cover' ].includes( inner.name ) ) {
			inner.attributes.url = `https://example.com/${ count }.jpg`;
			inner.attributes.alt = `Picture ${ count }`;
		}
	} );

	return cloneBlock( block, {
		metadata: { name: slug, patternName: `${ PREFIX }${ slug }` },
	} );
}

// The block tree without client IDs, to compare structure.
function strip( block ) {
	return {
		name: block.name,
		attributes: block.attributes,
		innerBlocks: block.innerBlocks.map( strip ),
	};
}

// Every block that holds content, by what it holds, in a stable order.
function getContent( block ) {
	const content = [];

	walk( block.innerBlocks, ( inner ) => {
		if ( inner.name === 'core/column' ) {
			return;
		}

		const { content: text, text: label, url, alt } = inner.attributes;

		content.push(
			[ inner.name, text, label, url, alt ].map( String ).join( '|' )
		);
	} );

	return content.sort();
}

function getClientIds( block ) {
	const ids = [];

	walk( [ block ], ( inner ) => ids.push( inner.clientId ) );

	return ids;
}

function apply( block, name ) {
	return getSectionArrangements( block ).options.find(
		( option ) => option.name === name
	).block;
}

describe( 'getLayoutSlug', () => {
	it( 'reads the slug from a layout pattern name', () => {
		expect(
			getLayoutSlug( {
				attributes: { metadata: { patternName: `${ PREFIX }hero` } },
			} )
		).toBe( 'hero' );
	} );

	it( 'ignores other patterns and unnamed blocks', () => {
		expect(
			getLayoutSlug( {
				attributes: { metadata: { patternName: 'theme/hero' } },
			} )
		).toBeNull();
		expect( getLayoutSlug( { attributes: {} } ) ).toBeNull();
		expect( getLayoutSlug( undefined ) ).toBeNull();
	} );
} );

describe( 'getSectionArrangements', () => {
	it( 'has nothing for sections not built from a layout', () => {
		const section = loadSection( 'image-text' );

		expect(
			getSectionArrangements(
				cloneBlock( section, { metadata: { patternName: 'theme/x' } } )
			)
		).toBeNull();
		expect(
			getSectionArrangements(
				cloneBlock( section, { metadata: undefined } )
			)
		).toBeNull();
	} );

	it.each( [ 'two-images', 'three-columns', 'wide-image', 'centred-cta' ] )(
		'has nothing for the %s layout',
		( slug ) => {
			expect( getSectionArrangements( loadSection( slug ) ) ).toBeNull();
		}
	);

	it( 'has nothing for a layout whose blocks it cannot read', () => {
		const section = cloneBlock( loadSection( 'heading-text' ), {
			metadata: { patternName: `${ PREFIX }image-text` },
		} );

		expect( getSectionArrangements( section ) ).toBeNull();
	} );

	it( 'offers the same arrangements for both halves of a mirrored pair', () => {
		const names = ( slug ) =>
			getSectionArrangements( loadSection( slug ) ).options.map(
				( option ) => option.name
			);

		expect( names( 'image-text' ) ).toEqual( names( 'text-image' ) );
		expect( names( 'image-above-text' ) ).toEqual( names( 'hero-image' ) );
		expect( names( 'cta-image' ) ).toEqual( names( 'image-overlay' ) );
	} );

	it( 'only stacks an image row whose columns are alike', () => {
		const names = ( slug ) =>
			getSectionArrangements( loadSection( slug ) ).options.map(
				( option ) => option.name
			);

		expect( names( 'image-text' ) ).toEqual( [
			'image-left',
			'image-right',
			'image-above',
		] );
		expect( names( 'profile' ) ).toEqual( [ 'image-left', 'image-right' ] );
	} );

	it( 'recognises a section rearranged by hand', () => {
		const section = loadSection( 'image-text' );
		const swapped = cloneBlock(
			section,
			{},
			[ ...section.innerBlocks ].reverse()
		);

		expect( getSectionArrangements( swapped ).current ).toBe(
			'image-right'
		);
	} );

	it( 'still offers arrangements when the current one is unrecognised', () => {
		const section = loadSection( 'hero-image' );
		const [ heading, paragraph, buttons, image ] = section.innerBlocks;
		const moved = cloneBlock( section, {}, [
			heading,
			image,
			paragraph,
			buttons,
		] );
		const arrangements = getSectionArrangements( moved );

		expect( arrangements.current ).toBeNull();
		expect(
			getSectionArrangements( apply( moved, 'image-above' ) ).current
		).toBe( 'image-above' );
	} );

	it( 'reads mixed text alignment as no arrangement', () => {
		const section = loadSection( 'hero' );
		const [ heading, ...rest ] = section.innerBlocks;
		const mixed = cloneBlock( section, {}, [
			cloneBlock( heading, { style: undefined } ),
			...rest,
		] );

		expect( getSectionArrangements( mixed ).current ).toBeNull();
	} );

	it( 'moves the text over an image to that side of it', () => {
		const section = loadSection( 'cta-image' );

		expect( apply( section, 'text-left' ).attributes.contentPosition ).toBe(
			'center left'
		);
		expect(
			apply( section, 'text-right' ).attributes.contentPosition
		).toBe( 'center right' );
		expect( apply( section, 'text-centre' ).attributes ).not.toHaveProperty(
			'contentPosition'
		);
	} );

	describe.each( Object.entries( SHIPPED ) )( 'the %s layout', ( slug ) => {
		const section = loadSection( slug );
		const arrangements = getSectionArrangements( section );

		it( 'is recognised as it ships', () => {
			expect( arrangements.current ).toBe( SHIPPED[ slug ] );
			expect( arrangements.options.length ).toBeGreaterThan( 1 );
		} );

		it( 'labels every option', () => {
			arrangements.options.forEach( ( option ) => {
				expect( option.label ).toEqual( expect.any( String ) );
				expect( option.label ).not.toBe( '' );
			} );
		} );

		it( 'recognises every arrangement it makes', () => {
			arrangements.options.forEach( ( option ) => {
				expect( getSectionArrangements( option.block ).current ).toBe(
					option.name
				);
			} );
		} );

		it( 'keeps all the content and the pattern name', () => {
			arrangements.options.forEach( ( option ) => {
				expect( getContent( option.block ) ).toEqual(
					getContent( section )
				);
				expect( option.block.attributes.metadata ).toEqual(
					section.attributes.metadata
				);
			} );
		} );

		it( 'gives every block a fresh client ID', () => {
			const ids = getClientIds( section );

			arrangements.options.forEach( ( option ) => {
				getClientIds( option.block ).forEach( ( id ) =>
					expect( ids ).not.toContain( id )
				);
			} );
		} );

		it( 'comes back unchanged after trying every arrangement', () => {
			let block = section;

			arrangements.options.forEach( ( option ) => {
				block = apply( block, option.name );
				expect( getContent( block ) ).toEqual( getContent( section ) );
			} );

			block = apply( block, arrangements.current );

			expect( strip( block ) ).toEqual( strip( section ) );
		} );
	} );
} );
