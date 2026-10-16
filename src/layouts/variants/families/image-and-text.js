/**
 * An image and some text.
 *
 * However a section shows one image and its text, it can show them any of
 * these ways: the image beside the text on either side, above it, below it,
 * or behind it, with the text over the picture.
 *
 * Three shapes are read as an image and text:
 * - a row of columns: two, one of them a lone image, or one with the image
 *   at its top or bottom;
 * - a group with the image as its first or last block;
 * - a cover holding only text, its picture the image.
 *
 * Each arrangement is built from the image and the text, keeping the shape
 * the section had where it can: a group stays a group, with the columns or
 * the cover inside it. Columns keep their widths while the image only swaps
 * sides. Things only one shape has, like a cover's height or the columns'
 * widths, are left behind when the section changes shape.
 */

/**
 * WordPress dependencies
 */
import { cloneBlock, createBlock } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { cloneAll, isMediaBlock, isText, rebuild } from '../blocks';

// What a cover over a picture starts with: enough shade to read the words.
const COVER_DIM_RATIO = 40;

const SIDE_NAMES = {
	left: 'image-left',
	right: 'image-right',
	above: 'image-above',
	below: 'image-below',
	cover: 'text-over-image',
};

/**
 * The attributes that say where a block sits and what it is called, kept
 * when a section becomes another kind of block. Block styles are left
 * behind, as they belong to one kind of block.
 *
 * @param {Object} attributes Attributes.
 * @return {Object} Those worth keeping.
 */
function carry( attributes ) {
	const { metadata, align, anchor, className } = attributes;
	const classes = ( className || '' )
		.split( /\s+/ )
		.filter( ( name ) => name && ! name.startsWith( 'is-style-' ) )
		.join( ' ' );

	return Object.fromEntries(
		Object.entries( {
			metadata,
			align,
			anchor,
			className: classes || undefined,
		} ).filter( ( [ , value ] ) => value !== undefined )
	);
}

function pick( attributes, keys ) {
	return Object.fromEntries(
		keys
			.filter( ( key ) => attributes[ key ] !== undefined )
			.map( ( key ) => [ key, attributes[ key ] ] )
	);
}

/**
 * Read a row of columns holding an image and text.
 *
 * @param {Object} block A `core/columns` block.
 * @return {?Object} `{ side, media, text, columns }`, or null.
 */
export function readImageRow( block ) {
	if ( block?.name !== 'core/columns' ) {
		return null;
	}

	const columns = block.innerBlocks;

	if ( columns.length === 1 ) {
		const [ column ] = columns;
		const inner = column.innerBlocks;
		const media = inner.filter( isMediaBlock );

		if ( media.length !== 1 || inner.length < 2 ) {
			return null;
		}

		let side = null;

		if ( inner[ 0 ] === media[ 0 ] ) {
			side = 'above';
		} else if ( inner[ inner.length - 1 ] === media[ 0 ] ) {
			side = 'below';
		}

		return (
			side && {
				from: 'columns',
				side,
				media: media[ 0 ],
				text: inner.filter( ( other ) => other !== media[ 0 ] ),
				columns: { single: column },
			}
		);
	}

	if ( columns.length !== 2 ) {
		return null;
	}

	const isMediaColumn = ( column ) =>
		column.innerBlocks.length === 1 &&
		isMediaBlock( column.innerBlocks[ 0 ] );
	const mediaIndex = columns.findIndex( isMediaColumn );

	// The other column must not be a lone image too, or there is no telling
	// which side the image is on.
	if ( mediaIndex === -1 || isMediaColumn( columns[ 1 - mediaIndex ] ) ) {
		return null;
	}

	return {
		from: 'columns',
		side: mediaIndex === 0 ? 'left' : 'right',
		media: columns[ mediaIndex ].innerBlocks[ 0 ],
		text: columns[ 1 - mediaIndex ].innerBlocks,
		columns: {
			media: columns[ mediaIndex ],
			text: columns[ 1 - mediaIndex ],
		},
	};
}

/**
 * Read a group with an image at either end.
 *
 * @param {Object} block A `core/group` block.
 * @return {?Object} `{ side, media, text }`, or null.
 */
function readStack( block ) {
	const inner = block.innerBlocks;
	const media = inner.filter( isMediaBlock );

	if ( media.length !== 1 || inner.length < 2 ) {
		return null;
	}

	let side = null;

	if ( inner[ 0 ] === media[ 0 ] ) {
		side = 'above';
	} else if ( inner[ inner.length - 1 ] === media[ 0 ] ) {
		side = 'below';
	}

	return (
		side && {
			from: 'group',
			side,
			media: media[ 0 ],
			text: inner.filter( ( other ) => other !== media[ 0 ] ),
		}
	);
}

/**
 * Read a cover holding only text, over a picture rather than a video.
 *
 * @param {Object} block A `core/cover` block.
 * @return {?Object} `{ side, media, text }`, or null.
 */
function readCover( block ) {
	const { attributes } = block;

	if (
		attributes.backgroundType === 'video' ||
		attributes.useFeaturedImage ||
		! isText( block.innerBlocks )
	) {
		return null;
	}

	return {
		from: 'cover',
		side: 'cover',
		media: createBlock(
			'core/image',
			pick( attributes, [ 'url', 'id', 'alt', 'sizeSlug' ] )
		),
		text: block.innerBlocks,
	};
}

/**
 * The columns showing an image and text with the image on the given side.
 * Columns the section had are reused, keeping their widths when they stay
 * side by side.
 *
 * @param {Object} state The image and text, as read.
 * @param {string} side  `left`, `right`, `above` or `below`.
 * @return {Object[]} Column blocks.
 */
function makeColumns( state, side ) {
	const { media, text, columns = {} } = state;
	const column = ( base, blocks, keepWidth ) =>
		base
			? cloneBlock( base, keepWidth ? {} : { width: undefined }, blocks )
			: createBlock( 'core/column', {}, blocks );

	if ( side === 'above' || side === 'below' ) {
		return [
			column(
				columns.single ?? columns.text,
				cloneAll(
					side === 'above' ? [ media, ...text ] : [ ...text, media ]
				),
				false
			),
		];
	}

	const split = ! columns.single;
	const mediaColumn = column(
		columns.media ?? columns.single,
		cloneAll( [ media ] ),
		split
	);
	const textColumn = column(
		columns.text ?? columns.single,
		cloneAll( text ),
		split
	);

	return side === 'left'
		? [ mediaColumn, textColumn ]
		: [ textColumn, mediaColumn ];
}

/**
 * A cover with the image as its picture and the text over it.
 *
 * @param {Object}   attributes Attributes to start from.
 * @param {Object}   media      An image block.
 * @param {Object[]} text       Text blocks.
 * @return {Object} The cover.
 */
function makeCover( attributes, media, text ) {
	return createBlock(
		'core/cover',
		{
			...attributes,
			...pick( media.attributes, [ 'url', 'id', 'alt', 'sizeSlug' ] ),
			dimRatio: COVER_DIM_RATIO,
			layout: { type: 'constrained' },
		},
		cloneAll( text )
	);
}

/**
 * Lay out a row of columns with its image on the given side, keeping the
 * row's own attributes.
 *
 * @param {Object} block Row block.
 * @param {Object} row   The row, as read by `readImageRow()`.
 * @param {string} side  `left`, `right`, `above` or `below`.
 * @return {Object} The rearranged row.
 */
export function arrangeImageRow( block, row, side ) {
	return rebuild( block, block.attributes, makeColumns( row, side ) );
}

export const IMAGE_AND_TEXT = {
	read: ( block ) => {
		switch ( block?.name ) {
			case 'core/columns':
				return readImageRow( block );
			case 'core/group':
				return readStack( block );
			case 'core/cover':
				return readCover( block );
			default:
				return null;
		}
	},
	getOptions: ( { media, text } ) => {
		// Stacked with images only, there would be no telling which was the
		// image and which the text.
		const canStack = text.some( ( block ) => ! isMediaBlock( block ) );
		const canCover = media.name === 'core/image' && isText( text );

		return [
			{ side: 'left', label: __( 'Image on the left' ) },
			{ side: 'right', label: __( 'Image on the right' ) },
			canStack && { side: 'above', label: __( 'Image above' ) },
			canStack && { side: 'below', label: __( 'Image below' ) },
			canCover && { side: 'cover', label: __( 'Text over image' ) },
		]
			.filter( Boolean )
			.map( ( option ) => ( {
				...option,
				name: SIDE_NAMES[ option.side ],
			} ) );
	},
	getCurrent: ( state, options ) =>
		options.find( ( option ) => option.side === state.side )?.name ?? null,
	arrange: ( block, state, { side } ) => {
		if ( side === state.side ) {
			return cloneBlock( block );
		}

		if ( state.from === 'cover' ) {
			return createBlock(
				'core/columns',
				carry( block.attributes ),
				makeColumns( state, side )
			);
		}

		if ( state.from === 'columns' ) {
			return side === 'cover'
				? makeCover(
						carry( block.attributes ),
						state.media,
						state.text
					)
				: arrangeImageRow( block, state, side );
		}

		// A group stays, holding the image and text however they are shown.
		let inner;

		if ( side === 'cover' ) {
			inner = [ makeCover( { align: 'wide' }, state.media, state.text ) ];
		} else if ( side === 'left' || side === 'right' ) {
			inner = [
				createBlock(
					'core/columns',
					{ align: 'wide' },
					makeColumns( state, side )
				),
			];
		} else {
			inner = cloneAll(
				side === 'above'
					? [ state.media, ...state.text ]
					: [ ...state.text, state.media ]
			);
		}

		return rebuild( block, block.attributes, inner );
	},
};
