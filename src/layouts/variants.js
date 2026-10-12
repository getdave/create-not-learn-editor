/**
 * Layout arrangements: other ways to lay out the same section.
 *
 * A section built from one of our layouts can often be rearranged without
 * losing anything: its image moved to the other side, its text centred, its
 * picture put above the words instead of beside them. Each arrangement here
 * only reorders blocks, regroups them or changes their alignment, so people
 * can cycle through them freely and always get back to where they started.
 *
 * The arrangement a section is in is worked out from its blocks rather than
 * stored, so a section rearranged by hand is still recognised.
 *
 * Pure functions only: no React, no stores.
 */

/**
 * WordPress dependencies
 */
import { cloneBlock } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';

/**
 * Every layout pattern's name is this prefix and its slug. See
 * `cnl_editor_register_layout_patterns()` in `includes/layouts.php`.
 */
const LAYOUT_PATTERN_PREFIX = 'create-not-learn-editor/layout-';

const MEDIA_BLOCKS = [ 'core/image', 'core/cover', 'core/video' ];
const TEXT_BLOCKS = [ 'core/heading', 'core/paragraph' ];

/**
 * The layout a section was inserted from, read from the pattern name core
 * and the section picker stamp on it.
 *
 * @param {Object} block Section block.
 * @return {?string} Layout slug, such as `image-text`, or null.
 */
export function getLayoutSlug( block ) {
	const patternName = block?.attributes?.metadata?.patternName;

	if (
		typeof patternName !== 'string' ||
		! patternName.startsWith( LAYOUT_PATTERN_PREFIX )
	) {
		return null;
	}

	return patternName.slice( LAYOUT_PATTERN_PREFIX.length ) || null;
}

/**
 * A copy of a block with the given attributes and inner blocks in place of
 * its own. Built on `cloneBlock`, so it gets a fresh client ID and keeps
 * everything else, including `metadata.patternName`.
 *
 * @param {Object}   block       Block to copy.
 * @param {Object}   attributes  Its new attributes, in full.
 * @param {Object[]} innerBlocks Its new inner blocks, already copied.
 * @return {Object} The copy.
 */
function rebuild( block, attributes, innerBlocks ) {
	return { ...cloneBlock( block, {}, innerBlocks ), attributes };
}

/**
 * Fresh copies of blocks, so nothing in an arrangement shares a client ID
 * with the section it replaces.
 *
 * @param {Object[]} blocks Blocks.
 * @return {Object[]} Copies.
 */
function cloneAll( blocks ) {
	return blocks.map( ( block ) => cloneBlock( block ) );
}

/**
 * Set a value deep in an object, or remove it when `value` is undefined.
 * Objects left empty by a removal are removed too, so a section aligned back
 * to its default ends up with the same attributes it started with.
 *
 * @param {?Object}  object Object to start from. Not changed.
 * @param {string[]} path   Keys leading to the value.
 * @param {*}        value  New value, or undefined to remove it.
 * @return {?Object} The updated copy, or undefined when nothing is left.
 */
function setIn( object, [ key, ...rest ], value ) {
	const next = { ...object };
	const nested = rest.length ? setIn( next[ key ], rest, value ) : value;

	if ( nested === undefined ) {
		delete next[ key ];
	} else {
		next[ key ] = nested;
	}

	return Object.keys( next ).length ? next : undefined;
}

function isMediaBlock( block ) {
	return MEDIA_BLOCKS.includes( block?.name );
}

function isMediaColumn( column ) {
	return (
		column?.innerBlocks?.length === 1 &&
		isMediaBlock( column.innerBlocks[ 0 ] )
	);
}

/**
 * Whether two columns would look the same apart from what is in them, so
 * one can stand in for the other without losing a width or an alignment.
 *
 * @param {Object} a Column block.
 * @param {Object} b Column block.
 * @return {boolean} Whether their attributes match.
 */
function haveSameAttributes( a, b ) {
	return JSON.stringify( a.attributes ) === JSON.stringify( b.attributes );
}

/*
 * Image beside text.
 *
 * A row of two columns, one holding a single image and the other holding
 * everything else. The image swaps sides by swapping the columns, so each
 * column keeps its own width. When both columns are alike, the two can also
 * be merged into one column with the image on top, and split back again.
 */

/**
 * Read an image-beside-text row.
 *
 * @param {Object} block A `core/columns` block.
 * @return {?Object} The image side (`left`, `right` or `above`), the media
 *                   and the text, or null when it is not such a row.
 */
function readImageRow( block ) {
	if ( block?.name !== 'core/columns' ) {
		return null;
	}

	const columns = block.innerBlocks;

	if ( columns.length === 1 ) {
		const [ column ] = columns;
		const [ media, ...text ] = column.innerBlocks;

		if ( ! isMediaBlock( media ) || ! text.length ) {
			return null;
		}

		// Kept whole, so splitting it gives both columns its attributes.
		return { side: 'above', column, media, text, canStack: true };
	}

	if ( columns.length !== 2 ) {
		return null;
	}

	const mediaIndex = columns.findIndex( isMediaColumn );

	// The other column must not be a lone image too, or there is no telling
	// which side the image is on.
	if ( mediaIndex === -1 || isMediaColumn( columns[ 1 - mediaIndex ] ) ) {
		return null;
	}

	const mediaColumn = columns[ mediaIndex ];
	const textColumn = columns[ 1 - mediaIndex ];

	return {
		side: mediaIndex === 0 ? 'left' : 'right',
		mediaColumn,
		textColumn,
		media: mediaColumn.innerBlocks[ 0 ],
		text: textColumn.innerBlocks,
		canStack: haveSameAttributes( mediaColumn, textColumn ),
	};
}

/**
 * Lay out an image-beside-text row with its image on the given side.
 *
 * @param {Object} block Row block.
 * @param {Object} row   The row, as read by `readImageRow()`.
 * @param {string} side  `left`, `right` or `above`.
 * @return {Object} The rearranged row.
 */
function arrangeImageRow( block, row, side ) {
	if ( side === 'above' ) {
		const column = row.column ?? row.mediaColumn;

		return rebuild( block, block.attributes, [
			cloneBlock( column, {}, cloneAll( [ row.media, ...row.text ] ) ),
		] );
	}

	// Split a stacked row into two columns alike, or reuse the two it has.
	const mediaColumn = cloneBlock(
		row.mediaColumn ?? row.column,
		{},
		cloneAll( [ row.media ] )
	);
	const textColumn = cloneBlock(
		row.textColumn ?? row.column,
		{},
		cloneAll( row.text )
	);

	return rebuild(
		block,
		block.attributes,
		side === 'left'
			? [ mediaColumn, textColumn ]
			: [ textColumn, mediaColumn ]
	);
}

/**
 * Arrangements for a section that is one image-beside-text row.
 *
 * @param {Object} labels       Option labels.
 * @param {string} labels.left  Image on the left.
 * @param {string} labels.right Image on the right.
 * @param {string} labels.above Image above, offered when the row can stack.
 * @return {Object} Arrangement family.
 */
function imageBesideText( labels ) {
	return {
		read: readImageRow,
		getOptions: ( row ) =>
			[
				{ name: 'image-left', label: labels.left, side: 'left' },
				{ name: 'image-right', label: labels.right, side: 'right' },
				row.canStack &&
					labels.above && {
						name: 'image-above',
						label: labels.above,
						side: 'above',
					},
			].filter( Boolean ),
		getCurrent: ( row ) => `image-${ row.side }`,
		arrange: ( block, row, option ) =>
			arrangeImageRow( block, row, option.side ),
	};
}

/*
 * Alternating rows.
 *
 * A group of image-beside-text rows. The images can zigzag, starting on
 * either side, or all line up on one side.
 */

/**
 * Read a group of image-beside-text rows. Anything else in the group stays
 * where it is.
 *
 * @param {Object} block A `core/group` block.
 * @return {?Object} Each inner block with its row, if it is one, or null
 *                   when the group has fewer than two side-by-side rows.
 */
function readRows( block ) {
	if ( block?.name !== 'core/group' ) {
		return null;
	}

	const items = block.innerBlocks.map( ( inner ) => {
		const row = readImageRow( inner );

		return { block: inner, row: row?.side === 'above' ? null : row };
	} );

	return items.filter( ( item ) => item.row ).length >= 2 ? items : null;
}

/**
 * The image side each row should have in an arrangement.
 *
 * @param {string} name  Arrangement name.
 * @param {number} index The row's position among the rows.
 * @return {string} `left` or `right`.
 */
function getRowSide( name, index ) {
	switch ( name ) {
		case 'images-left':
			return 'left';
		case 'images-right':
			return 'right';
		case 'alternate-right':
			return index % 2 ? 'left' : 'right';
		default:
			return index % 2 ? 'right' : 'left';
	}
}

const ALTERNATING_ROWS = {
	read: readRows,
	getOptions: () => [
		{
			name: 'alternate-left',
			label: __( 'Alternating, starting on the left' ),
		},
		{
			name: 'alternate-right',
			label: __( 'Alternating, starting on the right' ),
		},
		{ name: 'images-left', label: __( 'All images on the left' ) },
		{ name: 'images-right', label: __( 'All images on the right' ) },
	],
	getCurrent: ( items, options ) => {
		const sides = items
			.filter( ( item ) => item.row )
			.map( ( item ) => item.row.side );

		return (
			options.find( ( { name } ) =>
				sides.every(
					( side, index ) => side === getRowSide( name, index )
				)
			)?.name ?? null
		);
	},
	arrange: ( block, items, option ) => {
		let index = 0;

		return rebuild(
			block,
			block.attributes,
			items.map( ( item ) =>
				item.row
					? arrangeImageRow(
							item.block,
							item.row,
							getRowSide( option.name, index++ )
						)
					: cloneBlock( item.block )
			)
		);
	},
};

/*
 * Image above or below text.
 *
 * A group holding one image and some text. The image moves to the top or
 * the bottom; the text keeps its order.
 */

/**
 * Read a group holding one image among text.
 *
 * @param {Object} block A `core/group` block.
 * @return {?Object} The image's position, the image and the rest, or null
 *                   when the group does not hold exactly one image.
 */
function readStack( block ) {
	if ( block?.name !== 'core/group' ) {
		return null;
	}

	const media = block.innerBlocks.filter( isMediaBlock );

	if ( media.length !== 1 || block.innerBlocks.length < 2 ) {
		return null;
	}

	const index = block.innerBlocks.indexOf( media[ 0 ] );
	let position = null;

	if ( index === 0 ) {
		position = 'above';
	} else if ( index === block.innerBlocks.length - 1 ) {
		position = 'below';
	}

	return {
		position,
		media: media[ 0 ],
		rest: block.innerBlocks.filter( ( inner ) => inner !== media[ 0 ] ),
	};
}

const IMAGE_ABOVE_OR_BELOW = {
	read: readStack,
	getOptions: () => [
		{ name: 'image-above', label: __( 'Image above' ) },
		{ name: 'image-below', label: __( 'Image below' ) },
	],
	getCurrent: ( stack ) =>
		stack.position ? `image-${ stack.position }` : null,
	arrange: ( block, stack, option ) =>
		rebuild(
			block,
			block.attributes,
			cloneAll(
				option.name === 'image-above'
					? [ stack.media, ...stack.rest ]
					: [ ...stack.rest, stack.media ]
			)
		),
};

/*
 * Text alignment.
 *
 * Headings, paragraphs and buttons lined up together on the left, in the
 * centre or, over an image, on the right. Over an image the text also moves
 * to that side of it, through the cover's content position.
 */

const TEXT_ALIGN_PATH = [ 'style', 'typography', 'textAlign' ];
const BUTTONS_ALIGN_PATH = [ 'layout', 'justifyContent' ];

/**
 * Walk a block's descendants, calling `visit` on each.
 *
 * @param {Object[]} blocks Blocks.
 * @param {Function} visit  Called with each block.
 */
function walk( blocks, visit ) {
	blocks.forEach( ( block ) => {
		visit( block );
		walk( block.innerBlocks ?? [], visit );
	} );
}

/**
 * How a heading, paragraph or buttons block is aligned. Unaligned text sits
 * on the left.
 *
 * @param {Object} block Block.
 * @return {?string} `left`, `center` or `right`, or null for other blocks.
 */
function getAlignment( block ) {
	let path = null;

	if ( TEXT_BLOCKS.includes( block.name ) ) {
		path = TEXT_ALIGN_PATH;
	} else if ( block.name === 'core/buttons' ) {
		path = BUTTONS_ALIGN_PATH;
	}

	if ( ! path ) {
		return null;
	}

	const value = path.reduce(
		( object, key ) => object?.[ key ],
		block.attributes
	);

	return value === 'center' || value === 'right' ? value : 'left';
}

/**
 * Align a block and everything in it. Left is the default, so aligning left
 * removes the alignment rather than setting it.
 *
 * @param {Object} block     Block.
 * @param {string} alignment `left`, `center` or `right`.
 * @return {Object} The aligned copy.
 */
function alignBlock( block, alignment ) {
	const value = alignment === 'left' ? undefined : alignment;
	let attributes = block.attributes;

	if ( TEXT_BLOCKS.includes( block.name ) ) {
		attributes = setIn( attributes, TEXT_ALIGN_PATH, value ) ?? {};
	} else if ( block.name === 'core/buttons' ) {
		attributes = setIn( attributes, BUTTONS_ALIGN_PATH, value ) ?? {};
	}

	return rebuild(
		block,
		attributes,
		block.innerBlocks.map( ( inner ) => alignBlock( inner, alignment ) )
	);
}

/**
 * Arrangements for a section of aligned text, perhaps over an image.
 *
 * @param {Object}  options          Options.
 * @param {boolean} options.canRight Whether to offer the right too.
 * @return {Object} Arrangement family.
 */
function textAlignment( { canRight } ) {
	return {
		read: ( block ) => {
			const alignments = [];

			walk( block?.innerBlocks ?? [], ( inner ) => {
				const alignment = getAlignment( inner );

				if ( alignment ) {
					alignments.push( alignment );
				}
			} );

			if ( ! alignments.length ) {
				return null;
			}

			return {
				alignment: alignments.every(
					( alignment ) => alignment === alignments[ 0 ]
				)
					? alignments[ 0 ]
					: null,
			};
		},
		getOptions: () =>
			[
				{
					name: 'text-left',
					label: __( 'Text on the left' ),
					alignment: 'left',
				},
				{
					name: 'text-centre',
					label: __( 'Text in the centre' ),
					alignment: 'center',
				},
				canRight && {
					name: 'text-right',
					label: __( 'Text on the right' ),
					alignment: 'right',
				},
			].filter( Boolean ),
		getCurrent: ( text, options ) =>
			options.find( ( option ) => option.alignment === text.alignment )
				?.name ?? null,
		arrange: ( block, text, option ) => {
			let attributes = block.attributes;

			// A cover places its content with a "vertical horizontal" pair.
			// Keep the vertical half and move the horizontal one.
			if ( block.name === 'core/cover' ) {
				const [ vertical ] = (
					attributes.contentPosition || 'center center'
				).split( ' ' );
				const position =
					vertical === 'center' && option.alignment === 'center'
						? undefined
						: `${ vertical } ${ option.alignment }`;

				attributes =
					setIn( attributes, [ 'contentPosition' ], position ) ?? {};
			}

			return rebuild(
				block,
				attributes,
				block.innerBlocks.map( ( inner ) =>
					alignBlock( inner, option.alignment )
				)
			);
		},
	};
}

/**
 * The arrangements each layout offers, by layout slug. Mirrored layouts
 * share a family, so a section inserted from either gets the same options.
 *
 * Layouts left out have nothing to rearrange without changing what they
 * are: equal columns, grids, single images, or shapes whose name says how
 * they are laid out.
 *
 * Built on demand so the labels are translated in the current locale.
 *
 * @return {Object<string, Object>} Arrangement families, by layout slug.
 */
function getLayoutArrangements() {
	const imageText = imageBesideText( {
		left: __( 'Image on the left' ),
		right: __( 'Image on the right' ),
		above: __( 'Image above' ),
	} );
	const largeImage = imageBesideText( {
		left: __( 'Large image on the left' ),
		right: __( 'Large image on the right' ),
	} );
	const imageAboveOrBelow = IMAGE_ABOVE_OR_BELOW;
	const textOverImage = textAlignment( { canRight: true } );
	const text = textAlignment( { canRight: false } );

	return {
		'image-text': imageText,
		'text-image': imageText,
		profile: imageText,
		'large-two-small': largeImage,
		'alternating-image-text': ALTERNATING_ROWS,
		'image-above-text': imageAboveOrBelow,
		'hero-image': imageAboveOrBelow,
		'cta-image': textOverImage,
		'image-overlay': textOverImage,
		hero: text,
		'heading-text': text,
		'big-statement': text,
	};
}

/**
 * The other ways a section can be laid out without losing any of its
 * content, and which of them it is laid out in now.
 *
 * @param {Object} block A section block (from the block editor, with
 *                       clientId, name, attributes, innerBlocks).
 * @return {?Object} null when the section has no arrangements, else
 *   `{ current, options }`. Each option is `{ name, label, block }`, where
 *   `block` is the section rearranged that way, ready for `replaceBlock`.
 *   `current` is the name of the option the section matches now, or null.
 */
export function getSectionArrangements( block ) {
	const slug = getLayoutSlug( block );
	const family = slug && getLayoutArrangements()[ slug ];

	if ( ! family || ! Array.isArray( block.innerBlocks ) ) {
		return null;
	}

	const state = family.read( block );

	if ( ! state ) {
		return null;
	}

	const options = family.getOptions( state );

	if ( options.length < 2 ) {
		return null;
	}

	return {
		current: family.getCurrent( state, options ),
		options: options.map( ( option ) => ( {
			name: option.name,
			label: option.label,
			block: family.arrange( block, state, option ),
		} ) ),
	};
}
