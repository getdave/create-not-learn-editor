/**
 * The shape of a layout: what its template puts around the page's own
 * sections, read from the template's markup.
 *
 * It is what the layout picker draws, instead of rendering every layout with
 * the page in it. A drawing costs nothing while the page is being changed, and
 * shows how layouts differ - a title or not, a header or not - more plainly at
 * thumbnail size. The canvas shows the real thing as soon as one is picked.
 */

/**
 * WordPress dependencies
 */
import { parse } from '@wordpress/block-serialization-default-parser';
import { __ } from '@wordpress/i18n';

const SITE_PART_AREAS = [ 'header', 'footer' ];

// Blocks that only add space, so leave nothing to draw.
const SPACING_BLOCKS = [ 'core/spacer', 'core/separator' ];

const COMMENTS_BLOCKS = [
	'core/comments',
	'core/post-comments',
	'core/post-comments-form',
];

function getSitePartArea( attributes ) {
	for ( const value of [ attributes.area, attributes.tagName ] ) {
		if ( SITE_PART_AREAS.includes( value ) ) {
			return value;
		}
	}

	return SITE_PART_AREAS.find( ( area ) =>
		String( attributes.slug || '' ).includes( area )
	);
}

function getBlocks( content ) {
	return parse( content || '' ).filter( ( block ) => block.blockName );
}

function getPathToContent( blocks ) {
	for ( let index = 0; index < blocks.length; index++ ) {
		const block = blocks[ index ];

		if ( block.blockName === 'core/post-content' ) {
			return [ index ];
		}

		const path = getPathToContent( block.innerBlocks );

		if ( path ) {
			return [ index, ...path ];
		}
	}

	return null;
}

function addItem( items, item ) {
	// Runs of things too small to tell apart read as one.
	if ( item.kind === 'other' && items.at( -1 )?.kind === 'other' ) {
		return;
	}

	items.push( item );
}

/*
 * Describe blocks of the template as the things a visitor sees: a header, a
 * title, an image. Containers are looked through, so a group holding a title
 * and an image gives both.
 */
function describeBlocks( blocks, items, context ) {
	blocks.forEach( ( block ) => {
		const name = block.blockName;
		const attributes = block.attrs || {};

		if ( ! name || SPACING_BLOCKS.includes( name ) ) {
			return;
		}

		if ( name === 'core/template-part' ) {
			addItem( items, { kind: getSitePartArea( attributes ) || 'part' } );
			return;
		}

		if ( name === 'core/post-title' ) {
			addItem( items, {
				align: attributes.textAlign === 'center' ? 'center' : 'left',
				kind: 'title',
			} );
			return;
		}

		if ( name === 'core/post-featured-image' ) {
			addItem( items, {
				kind: 'image',
				width: [ 'full', 'wide' ].includes( attributes.align )
					? attributes.align
					: 'content',
			} );
			return;
		}

		if ( COMMENTS_BLOCKS.includes( name ) ) {
			addItem( items, { kind: 'comments' } );
			return;
		}

		if ( name === 'core/query' ) {
			addItem( items, { kind: 'posts' } );
			return;
		}

		if ( name === 'core/pattern' ) {
			const slug = attributes.slug;
			const content =
				slug && ! context.patterns.has( slug )
					? context.resolvePattern?.( slug )
					: undefined;

			if ( content ) {
				context.patterns.add( slug );
				describeBlocks( getBlocks( content ), items, context );
				context.patterns.delete( slug );
			} else {
				addItem( items, { kind: 'other' } );
			}

			return;
		}

		if ( block.innerBlocks.length ) {
			describeBlocks( block.innerBlocks, items, context );
			return;
		}

		addItem( items, { kind: 'other' } );
	} );
}

/**
 * Read a layout's shape from its template's markup.
 *
 * Everything the template shows before the page's content is in `before`, and
 * everything after it in `after`, top to bottom. A column beside the content
 * is its sidebar, on the `start` or `end` side.
 *
 * @param {string}   content                  Template markup.
 * @param {Object}   [options]                Options.
 * @param {Function} [options.resolvePattern] Gets a pattern's markup from its
 *                                            slug, to look inside patterns the
 *                                            template uses.
 * @return {Object} `{ after, before, hasContent, sidebar }`.
 */
export function getLayoutOutline( content, { resolvePattern } = {} ) {
	const blocks = getBlocks( content );
	const context = { patterns: new Set(), resolvePattern };
	const path = getPathToContent( blocks );
	const outline = {
		after: [],
		before: [],
		hasContent: Boolean( path ),
		sidebar: null,
	};

	if ( ! path ) {
		describeBlocks( blocks, outline.before, context );
		return outline;
	}

	// Walk out from the content to the template's root, taking what is beside
	// it at each level: the closer to the content, the closer to it here.
	const levels = [];
	let siblings = blocks;

	path.forEach( ( index ) => {
		levels.push( { block: siblings[ index ], index, siblings } );
		siblings = siblings[ index ].innerBlocks;
	} );

	levels.reverse().forEach( ( { block, index, siblings: level }, depth ) => {
		const parent = levels[ depth + 1 ]?.block;
		const before = [];
		const after = [];

		if (
			block.blockName === 'core/column' &&
			parent?.blockName === 'core/columns' &&
			level.length > 1
		) {
			outline.sidebar = index > 0 ? 'start' : 'end';
			return;
		}

		describeBlocks( level.slice( 0, index ), before, context );
		describeBlocks( level.slice( index + 1 ), after, context );
		outline.before.unshift( ...before );
		outline.after.push( ...after );
	} );

	return outline;
}

function getItemLabel( item ) {
	switch ( item.kind ) {
		case 'header':
			return __( 'Header' );
		case 'footer':
			return __( 'Footer' );
		case 'title':
			return __( 'Title' );
		case 'image':
			return __( 'Featured image' );
		case 'comments':
			return __( 'Comments' );
		case 'posts':
			return __( 'Posts' );
	}

	return null;
}

/**
 * Say what a layout shows, top to bottom, for anyone who can't see the
 * drawing of it.
 *
 * @param {Object} outline Result of `getLayoutOutline`.
 * @return {string} Description.
 */
export function getLayoutDescription( outline ) {
	const labels = [
		...outline.before.map( getItemLabel ),
		outline.hasContent && __( 'The page’s sections' ),
		outline.hasContent && outline.sidebar && __( 'Sidebar' ),
		...outline.after.map( getItemLabel ),
	].filter( Boolean );
	const description = labels.join( ', ' );

	if ( outline.hasContent ) {
		return description;
	}

	const missing = __( 'Doesn’t show the page’s sections' );

	return description ? `${ description }. ${ missing }` : missing;
}
