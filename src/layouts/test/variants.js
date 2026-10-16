// The real package imports JSON without the import attribute Node needs, so
// its `cloneBlock` and `createBlock` are mirrored here, as other tests in
// the repo mock them too.
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

	function createBlock( name, attributes = {}, innerBlocks = [] ) {
		return {
			name,
			clientId: `client-id-${ ++id }`,
			attributes: { ...attributes },
			innerBlocks,
		};
	}

	return { cloneBlock, createBlock };
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
import { getSectionArrangements } from '../variants';

const LAYOUTS = join( __dirname, '../../../patterns/layouts' );
const THEME = join( __dirname, '../../../themes/mainstay/patterns' );

// The arrangement each of our layouts is in as it ships. Layouts left out
// have none.
const LAYOUTS_SHIPPED = {
	'image-text': 'image-left',
	'text-image': 'image-right',
	profile: 'image-left',
	'large-two-small': 'image-left',
	'alternating-image-text': 'alternate-left',
	'image-above-text': 'image-above',
	'hero-image': 'image-below',
	'cta-image': 'text-over-image',
	'image-overlay': 'text-over-image',
	'image-grid': 'per-row-3',
	team: 'per-row-3',
	'three-columns': 'per-row-3',
	'three-features': 'per-row-3',
	'three-offers': 'per-row-3',
	'three-quotes': 'per-row-3',
	'key-numbers': 'per-row-3',
	'four-features': 'per-row-4',
};

// The same for the Mainstay theme's section patterns.
const THEME_SHIPPED = {
	'about-stats': 'per-row-4',
	'about-story': 'image-left',
	'about-values': 'per-row-3',
	'contact-split': 'image-right',
	'cta-image': 'text-over-image',
	'gallery-grid': 'per-row-3',
	'gallery-mosaic': 'per-row-3',
	'hero-cover': 'text-over-image',
	'hero-split': 'image-right',
	'portfolio-projects': 'per-row-2',
	'pricing-tiers': 'per-row-3',
	'services-cards': 'per-row-3',
	'team-grid': 'per-row-4',
	'testimonials-grid': 'per-row-3',
};

// Sections with nothing that can be rearranged without changing what they
// are, or only in ways too alike to tell apart, like text lined up another
// way on a plain background.
const NOTHING = [
	[ 'layout', 'hero' ],
	[ 'layout', 'heading-text' ],
	[ 'layout', 'big-statement' ],
	[ 'layout', 'centred-cta' ],
	[ 'layout', 'questions-answers' ],
	[ 'theme', 'newsletter' ],
	[ 'theme', 'text-statement' ],
	[ 'layout', 'two-images' ],
	[ 'layout', 'two-columns-images' ],
	[ 'layout', 'two-column-text' ],
	[ 'layout', 'wide-image' ],
	[ 'layout', 'quote' ],
	[ 'layout', 'intro' ],
	[ 'layout', 'call-to-action' ],
	[ 'theme', 'contact-details' ],
	[ 'theme', 'cta-banner' ],
	[ 'theme', 'events-list' ],
	[ 'theme', 'hero-centred' ],
	[ 'theme', 'hero-collage' ],
	[ 'theme', 'menu-list' ],
	[ 'theme', 'services-list' ],
	[ 'theme', 'testimonial-large' ],
	[ 'theme', 'text-faq' ],
	[ 'theme', 'text-two-column' ],
];

// Sections whose arrangements only reorder blocks or change a count, so
// they come back exactly as they were. The rest change shape on the way,
// leaving behind things like column widths.
const COME_BACK_EXACTLY = [
	'alternating-image-text',
	'image-grid',
	'about-stats',
	'gallery-grid',
	'gallery-mosaic',
	'portfolio-projects',
	'team-grid',
];

/**
 * Parse pattern markup into editor-shaped blocks. Block attributes come from
 * the comment delimiters, which is all a layout has: its blocks are empty.
 * PHP in a theme's pattern is replaced with a word.
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

	return parseRaw( content.replace( /<\?php[\s\S]*?\?>/g, 'php' ) )
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
 * A section as it lands on a page, named after its pattern, with every
 * block filled in so there is content to lose.
 *
 * @param {string} source `layout` or `theme`.
 * @param {string} slug   Pattern slug.
 * @return {Object} Section block.
 */
function loadSection( source, slug ) {
	const file =
		source === 'layout'
			? join( LAYOUTS, `${ slug }.html` )
			: join( THEME, `${ slug }.php` );
	const [ block ] = parse( readFileSync( file, 'utf8' ) );
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

	const patternName =
		source === 'layout'
			? `create-not-learn-editor/layout-${ slug }`
			: `mainstay/${ slug }`;

	return cloneBlock( block, {
		metadata: { ...block.attributes.metadata, name: slug, patternName },
	} );
}

const layout = ( slug ) => loadSection( 'layout', slug );
const theme = ( slug ) => loadSection( 'theme', slug );

// The block tree without client IDs, to compare structure.
function strip( block ) {
	return {
		name: block.name,
		attributes: block.attributes,
		innerBlocks: block.innerBlocks.map( strip ),
	};
}

// Every block that holds content, by what it holds, in a stable order.
// Blocks that only arrange others are left out, as the same content can be
// arranged with other blocks. An image and a cover showing the same
// picture count alike.
function getContent( block ) {
	const content = [];

	walk( [ block ], ( inner ) => {
		if (
			[ 'core/columns', 'core/column', 'core/group' ].includes(
				inner.name
			)
		) {
			return;
		}

		const { content: text, text: label, url, alt } = inner.attributes;
		const name = [ 'core/image', 'core/cover' ].includes( inner.name )
			? 'picture'
			: inner.name;

		content.push(
			[ name, text, label, url, alt ].map( String ).join( '|' )
		);
	} );

	return content.sort();
}

function getClientIds( block ) {
	const ids = [];

	walk( [ block ], ( inner ) => ids.push( inner.clientId ) );

	return ids;
}

function names( block ) {
	return getSectionArrangements( block ).options.map(
		( option ) => option.name
	);
}

function apply( block, name ) {
	return getSectionArrangements( block ).options.find(
		( option ) => option.name === name
	).block;
}

describe( 'getSectionArrangements', () => {
	it( 'works the same whatever pattern a section came from', () => {
		const section = layout( 'image-text' );

		expect(
			names(
				cloneBlock( section, { metadata: { patternName: 'theme/x' } } )
			)
		).toEqual( names( section ) );
		expect(
			names( cloneBlock( section, { metadata: undefined } ) )
		).toEqual( names( section ) );
	} );

	it.each( NOTHING )( 'has nothing for the %s %s', ( source, slug ) => {
		expect(
			getSectionArrangements( loadSection( source, slug ) )
		).toBeNull();
	} );

	it( 'offers the same arrangements for both halves of a mirrored pair', () => {
		expect( names( layout( 'image-text' ) ) ).toEqual(
			names( layout( 'text-image' ) )
		);
		expect( names( layout( 'image-above-text' ) ) ).toEqual(
			names( layout( 'hero-image' ) )
		);
		expect( names( layout( 'cta-image' ) ) ).toEqual(
			names( layout( 'image-overlay' ) )
		);
	} );

	it( 'offers every way of showing an image and its text', () => {
		const all = [
			'image-left',
			'image-right',
			'image-above',
			'image-below',
			'text-over-image',
		];

		expect( names( layout( 'image-text' ) ) ).toEqual( all );
		expect( names( theme( 'hero-split' ) ) ).toEqual( all );
		expect( names( theme( 'hero-cover' ) ) ).toEqual( all );
		expect( names( layout( 'hero-image' ) ) ).toEqual( all );
	} );

	it( 'only puts an image beside other images', () => {
		expect( names( layout( 'large-two-small' ) ) ).toEqual( [
			'image-left',
			'image-right',
		] );
	} );

	it( 'recognises a section rearranged by hand', () => {
		const section = layout( 'image-text' );
		const swapped = cloneBlock(
			section,
			{},
			[ ...section.innerBlocks ].reverse()
		);

		expect( getSectionArrangements( swapped ).current ).toBe(
			'image-right'
		);
	} );

	it( 'keeps column widths while the image only swaps sides', () => {
		const section = theme( 'hero-split' );
		const widths = ( block ) =>
			block.innerBlocks[ 0 ].innerBlocks.map(
				( column ) => column.attributes.width
			);

		expect( widths( apply( section, 'image-left' ) ) ).toEqual( [
			'44%',
			'56%',
		] );
		expect( widths( apply( section, 'image-above' ) ) ).toEqual( [
			undefined,
		] );
	} );

	it( 'puts the text over the image', () => {
		const section = theme( 'hero-split' );
		const [ image ] = section.innerBlocks[ 0 ].innerBlocks[ 1 ].innerBlocks;
		const result = apply( section, 'text-over-image' );
		const [ cover ] = result.innerBlocks;

		expect( result.attributes ).toEqual( section.attributes );
		expect( cover.name ).toBe( 'core/cover' );
		expect( cover.attributes ).toMatchObject( {
			url: image.attributes.url,
			alt: image.attributes.alt,
			dimRatio: 40,
		} );
		expect( cover.innerBlocks.map( ( inner ) => inner.name ) ).toEqual( [
			'core/heading',
			'core/paragraph',
			'core/buttons',
		] );
	} );

	it( 'takes the picture out of a cover', () => {
		const section = theme( 'hero-cover' );
		const [ cover ] = section.innerBlocks;
		const [ columns ] = apply( section, 'image-left' ).innerBlocks;
		const [ mediaColumn, textColumn ] = columns.innerBlocks;

		expect( columns.attributes.align ).toBe( cover.attributes.align );
		expect( mediaColumn.innerBlocks[ 0 ].name ).toBe( 'core/image' );
		expect( mediaColumn.innerBlocks[ 0 ].attributes ).toMatchObject( {
			url: cover.attributes.url,
			alt: cover.attributes.alt,
		} );
		expect( textColumn.innerBlocks[ 0 ].name ).toBe( 'core/group' );
	} );

	it( 'keeps the section itself when it is a cover or columns', () => {
		const cover = layout( 'cta-image' );
		const columns = apply( cover, 'image-left' );

		expect( columns.name ).toBe( 'core/columns' );
		expect( columns.attributes.metadata ).toEqual(
			cover.attributes.metadata
		);
		expect( columns.attributes.className ).toBe( 'cnl-layout' );
		expect( apply( columns, 'text-over-image' ).name ).toBe( 'core/cover' );
	} );

	it( 'keeps a group around an image and text', () => {
		const section = layout( 'hero-image' );
		const result = apply( section, 'image-left' );

		expect( result.name ).toBe( 'core/group' );
		expect( result.attributes ).toEqual( section.attributes );
		expect( result.innerBlocks.map( ( inner ) => inner.name ) ).toEqual( [
			'core/columns',
		] );
	} );

	it( 'turns a row of columns into a grid only for another count', () => {
		const section = layout( 'three-columns' );
		const grid = apply( section, 'per-row-2' );

		expect( strip( apply( section, 'per-row-3' ) ) ).toEqual(
			strip( section )
		);
		expect( grid.name ).toBe( 'core/group' );
		expect( grid.attributes.layout ).toEqual( {
			type: 'grid',
			columnCount: 2,
			minimumColumnWidth: '12rem',
		} );
		expect( grid.attributes.className ).toBe(
			section.attributes.className
		);
		grid.innerBlocks.forEach( ( item ) => {
			expect( item.name ).toBe( 'core/group' );
			expect( item.attributes ).not.toHaveProperty( 'width' );
		} );
	} );

	it( 'keeps a column’s style when it becomes a grid item', () => {
		const grid = apply( theme( 'pricing-tiers' ), 'per-row-2' )
			.innerBlocks[ 1 ];

		expect( grid.innerBlocks[ 1 ].attributes.className ).toBe(
			'is-style-section-brand'
		);
	} );

	it( 'marks nothing current for a count it does not offer', () => {
		const arrangements = getSectionArrangements( layout( 'logo-strip' ) );

		expect( arrangements.current ).toBeNull();
		expect( names( layout( 'logo-strip' ) ) ).toEqual( [
			'per-row-2',
			'per-row-3',
			'per-row-4',
		] );
	} );

	it( 'sets how many pictures a gallery shows in a row', () => {
		const section = apply( theme( 'gallery-grid' ), 'per-row-4' );

		expect( section.innerBlocks[ 1 ].attributes.columns ).toBe( 4 );
	} );

	describe.each( [
		...Object.entries( LAYOUTS_SHIPPED ).map( ( [ slug, current ] ) => [
			'layout',
			slug,
			current,
		] ),
		...Object.entries( THEME_SHIPPED ).map( ( [ slug, current ] ) => [
			'theme',
			slug,
			current,
		] ),
	] )( 'the %s %s', ( source, slug, current ) => {
		const section = loadSection( source, slug );
		const arrangements = getSectionArrangements( section );

		it( 'is recognised as it ships', () => {
			expect( arrangements.current ).toBe( current );
			expect( arrangements.options.length ).toBeGreaterThan( 1 );
			expect( arrangements.options.length ).toBeLessThanOrEqual( 6 );
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

		it( 'offers the same arrangements whichever is picked', () => {
			arrangements.options.forEach( ( option ) => {
				expect( names( option.block ) ).toEqual( names( section ) );
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

		it( 'keeps the content through every arrangement', () => {
			let block = section;

			arrangements.options.forEach( ( option ) => {
				block = apply( block, option.name );
				expect( getContent( block ) ).toEqual( getContent( section ) );
			} );
		} );

		it.runIf( COME_BACK_EXACTLY.includes( slug ) )(
			'comes back as it was after trying every arrangement',
			() => {
				let block = section;

				arrangements.options.forEach( ( option ) => {
					block = apply( block, option.name );
				} );

				block = apply( block, arrangements.current );

				expect( strip( block ) ).toEqual( strip( section ) );
			}
		);
	} );
} );
