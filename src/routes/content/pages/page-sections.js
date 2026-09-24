/**
 * A page's sections: its top-level blocks, described in plain words.
 */

/**
 * WordPress dependencies
 */
import { decodeEntities } from '@wordpress/html-entities';
import { __, _n, sprintf } from '@wordpress/i18n';

const HEADING_BLOCKS = [ 'core/heading', 'core/post-title' ];
const IMAGE_BLOCKS = [ 'core/image', 'core/cover', 'core/media-text' ];
const TEXT_BLOCKS = [ 'core/paragraph', 'core/list', 'core/quote' ];

function getAttributes( block ) {
	return block?.attributes || {};
}

function getInnerBlocks( block ) {
	return block?.innerBlocks || [];
}

function toPlainText( value ) {
	if ( value === undefined || value === null ) {
		return '';
	}

	// Rich text attributes can be `RichTextData` objects rather than strings.
	return decodeEntities(
		String( value )
			.replace( /<br\s*\/?>/gi, ' ' )
			.replace( /<[^>]+>/g, '' )
			.replace( /\s+/g, ' ' )
			.trim()
	);
}

function truncateWords( text, length ) {
	if ( text.length <= length ) {
		return text;
	}

	const cut = text.slice( 0, length );
	const lastSpace = cut.lastIndexOf( ' ' );

	return `${ ( lastSpace > length / 2
		? cut.slice( 0, lastSpace )
		: cut
	).replace( /[\s,.;:!?-]+$/, '' ) }…`;
}

function walk( blocks, visit, depth = 0 ) {
	( blocks || [] ).forEach( ( block ) => {
		visit( block, depth );
		walk( getInnerBlocks( block ), visit, depth + 1 );
	} );
}

/**
 * Tally what a section holds, for describing and sketching it.
 *
 * @param {Object} block Top-level block.
 * @return {Object} Counts of headings, images, buttons, columns and text.
 */
export function getSectionContents( block ) {
	const contents = {
		buttons: 0,
		columns: 0,
		headingText: '',
		headings: 0,
		images: 0,
		paragraphText: '',
		texts: 0,
	};

	walk( [ block ], ( item ) => {
		const name = item.name;
		const attributes = getAttributes( item );

		if ( HEADING_BLOCKS.includes( name ) ) {
			contents.headings++;
			contents.headingText =
				contents.headingText || toPlainText( attributes.content );
		}

		if ( IMAGE_BLOCKS.includes( name ) ) {
			contents.images++;
		}

		if ( name === 'core/gallery' ) {
			contents.images += Math.max( 0, getInnerBlocks( item ).length - 1 );
		}

		if ( name === 'core/button' ) {
			contents.buttons++;
		}

		if ( name === 'core/columns' ) {
			contents.columns = Math.max(
				contents.columns,
				getInnerBlocks( item ).length
			);
		}

		if ( TEXT_BLOCKS.includes( name ) ) {
			contents.texts++;
			contents.paragraphText =
				contents.paragraphText ||
				toPlainText( attributes.content ?? attributes.value );
		}
	} );

	return contents;
}

/**
 * What kind of section this is, in a word or two a visitor would use.
 *
 * @param {Object} block      Top-level block.
 * @param {Object} [contents] Result of `getSectionContents`.
 * @return {string} Kind label.
 */
export function getSectionKind(
	block,
	contents = getSectionContents( block )
) {
	switch ( block?.name ) {
		case 'core/cover':
			return __( 'Banner' );
		case 'core/media-text':
			return __( 'Image and text' );
		case 'core/gallery':
			return __( 'Gallery' );
		case 'core/query':
			return __( 'Latest posts' );
		case 'core/image':
			return __( 'Image' );
		case 'core/heading':
			return __( 'Heading' );
		case 'core/paragraph':
		case 'core/list':
			return __( 'Text' );
		case 'core/buttons':
			return __( 'Buttons' );
		case 'core/separator':
			return __( 'Divider' );
		case 'core/spacer':
			return __( 'Space' );
		case 'core/quote':
		case 'core/pullquote':
			return __( 'Quote' );
	}

	if ( contents.columns > 1 ) {
		return sprintf(
			/* translators: %d: number of columns. */
			__( '%d columns' ),
			contents.columns
		);
	}

	if ( contents.images >= 3 ) {
		return __( 'Gallery' );
	}

	if ( contents.buttons && contents.headings ) {
		return __( 'Call to action' );
	}

	return __( 'Section' );
}

/**
 * The name a section goes by in the list.
 *
 * A name someone gave it wins, then its first heading, then its kind.
 *
 * @param {Object} block Top-level block.
 * @return {string} Section title.
 */
export function getSectionTitle( block ) {
	const name = toPlainText( getAttributes( block ).metadata?.name );

	if ( name ) {
		return name;
	}

	const contents = getSectionContents( block );

	return (
		contents.headingText ||
		truncateWords( contents.paragraphText, 48 ) ||
		getSectionKind( block, contents )
	);
}

/**
 * A short line on what is in a section, like "Banner · 2 buttons".
 *
 * @param {Object} block Top-level block.
 * @return {string} Section summary.
 */
export function getSectionSummary( block ) {
	const contents = getSectionContents( block );
	const kind = getSectionKind( block, contents );
	const title = getSectionTitle( block );
	const facts = [];

	if ( kind !== title ) {
		facts.push( kind );
	}

	if ( contents.images && block?.name !== 'core/image' ) {
		facts.push(
			sprintf(
				/* translators: %d: number of images. */
				_n( '%d image', '%d images', contents.images ),
				contents.images
			)
		);
	}

	if ( contents.buttons ) {
		facts.push(
			sprintf(
				/* translators: %d: number of buttons. */
				_n( '%d button', '%d buttons', contents.buttons ),
				contents.buttons
			)
		);
	}

	if (
		! facts.length &&
		contents.paragraphText &&
		title !== truncateWords( contents.paragraphText, 48 )
	) {
		facts.push( contents.paragraphText );
	}

	return facts.slice( 0, 3 ).join( ' · ' );
}

/**
 * A rough shape of a section, for drawing a thumbnail sketch of it.
 *
 * @param {Object} block Top-level block.
 * @return {Object} Sketch description.
 */
export function getSectionSketch( block ) {
	const contents = getSectionContents( block );
	const attributes = getAttributes( block );
	const hasBackground = Boolean(
		attributes.backgroundColor ||
		attributes.gradient ||
		attributes.style?.color?.background ||
		attributes.style?.color?.gradient
	);
	let media = null;

	if ( block?.name === 'core/cover' ) {
		media = 'cover';
	} else if ( block?.name === 'core/media-text' ) {
		media = 'side';
	} else if ( contents.columns < 2 && contents.images >= 3 ) {
		media = 'grid';
	} else if ( contents.columns < 2 && contents.images ) {
		media = 'block';
	}

	return {
		button: contents.buttons > 0,
		columns: Math.min( contents.columns, 4 ),
		columnImages: contents.columns > 1 && contents.images > 0,
		heading: contents.headings > 0,
		media,
		text: contents.texts > 0,
		tone: media === 'cover' || hasBackground ? 'filled' : 'plain',
	};
}

/**
 * Move an item to a new position.
 *
 * @param {Array}  list Items.
 * @param {number} from Index of the item to move.
 * @param {number} to   Index it should end up at.
 * @return {Array} A new array.
 */
export function moveItem( list, from, to ) {
	if (
		from === to ||
		from < 0 ||
		from >= list.length ||
		to < 0 ||
		to >= list.length
	) {
		return list;
	}

	const next = list.slice();
	const [ item ] = next.splice( from, 1 );
	next.splice( to, 0, item );

	return next;
}

/**
 * Insert items at a position.
 *
 * @param {Array}  list  Items.
 * @param {number} index Where to insert.
 * @param {Array}  items Items to insert.
 * @return {Array} A new array.
 */
export function insertItems( list, index, items ) {
	const at = Math.max( 0, Math.min( index, list.length ) );

	return [ ...list.slice( 0, at ), ...items, ...list.slice( at ) ];
}

/**
 * Remove the item at a position.
 *
 * @param {Array}  list  Items.
 * @param {number} index Index to remove.
 * @return {Array} A new array.
 */
export function removeItem( list, index ) {
	return list.filter( ( _, itemIndex ) => itemIndex !== index );
}

/**
 * Where a dragged item lands when dropped on one side of another.
 *
 * @param {number} from     Index of the dragged item.
 * @param {number} over     Index of the item it is dropped on.
 * @param {string} position `before` or `after`.
 * @return {number} The dragged item's new index.
 */
export function getDropIndex( from, over, position ) {
	const slot = over + ( position === 'after' ? 1 : 0 );

	return from < slot ? slot - 1 : slot;
}
