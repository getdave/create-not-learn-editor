/**
 * Rows of items in a section: cards, columns or tiles alike, side by side,
 * that another can be added to, or one taken from, without copying blocks by
 * hand.
 *
 * A row is a row of columns, or a group laid out as a grid, holding two or
 * more items made of the same kinds of things: three cards each with a
 * picture, a heading and words, say. An image beside its text is two
 * columns, but not alike, so it isn't a row.
 *
 * A new item is a copy of the one beside it, words and picture too, so it
 * looks finished straight away and is changed by typing over it. A row of
 * columns grows wider, as does a grid of one line; a grid of more lines
 * keeps how many sit side by side, a new one wrapping onto the next.
 *
 * Pure functions only: no React, no stores.
 */

/**
 * WordPress dependencies
 */
import { cloneBlock } from '@wordpress/blocks';

/**
 * Internal dependencies
 */
import { GRID } from '../../layouts/variants/families/grid';

// Blocks with blocks inside that are still one thing on the page.
const WHOLE_BLOCKS = [
	'core/buttons',
	'core/gallery',
	'core/list',
	'core/navigation',
	'core/quote',
	'core/social-links',
	'core/table',
];

// Blocks that take up room but show nothing.
const SPACING_BLOCKS = [ 'core/spacer', 'core/separator' ];

// How many items a row can hold: fewer than two and it is no longer a row,
// and more than six side by side are too narrow to read.
const MIN_ITEMS = 2;
const MAX_SIDE_BY_SIDE = 6;
const MAX_GRID_ITEMS = 12;

// How many items can sit side by side, offered whatever the count, so a
// row can be given room for more before they are added.
const PER_ROW = [ 2, 3, 4 ];

// How many groups deep to look for rows.
const MAX_DEPTH = 4;

/**
 * The kinds of things an item shows, like `core/image` and `core/heading`.
 *
 * @param {Object} block The item.
 * @return {string} Their names, sorted and joined.
 */
function getKinds( block ) {
	const kinds = new Set();

	const visit = ( node ) => {
		if ( SPACING_BLOCKS.includes( node.name ) ) {
			return;
		}

		if ( WHOLE_BLOCKS.includes( node.name ) || ! node.innerBlocks.length ) {
			kinds.add( node.name );
			return;
		}

		node.innerBlocks.forEach( visit );
	};

	visit( block );

	return [ ...kinds ].sort().join();
}

function isAlike( items ) {
	const kinds = getKinds( items[ 0 ] );

	return (
		Boolean( kinds ) &&
		items.every( ( item ) => getKinds( item ) === kinds )
	);
}

/**
 * Whether a block is a row, and what sort.
 *
 * @param {Object} block The block.
 * @return {?string} `columns` or `grid`, or null when it isn't a row.
 */
function getRowKind( block ) {
	const items = block.innerBlocks;

	if ( items.length < MIN_ITEMS || ! isAlike( items ) ) {
		return null;
	}

	if (
		block.name === 'core/columns' &&
		items.every( ( item ) => item.name === 'core/column' )
	) {
		// Columns given different widths are laid out on purpose.
		const widths = new Set(
			items.map( ( item ) => item.attributes.width ?? '' )
		);

		return widths.size === 1 ? 'columns' : null;
	}

	if (
		block.name === 'core/group' &&
		block.attributes.layout?.type === 'grid'
	) {
		return 'grid';
	}

	return null;
}

/**
 * The rows in a section, outermost first.
 *
 * @param {Object} section The section's block, with its inner blocks.
 * @return {Object[]} `{ clientId, kind, itemIds, count, canAdd, canGrow,
 *                    canRemove, perRow, perRowOptions }` for each. `canGrow`
 *                    is whether one more can sit side by side. `perRow` is how many
 *                    sit side by side, or null when the grid fits as many
 *                    as it can.
 */
export function getRows( section ) {
	const rows = [];

	const visit = ( block, depth ) => {
		const kind = getRowKind( block );

		if ( kind ) {
			const count = block.innerBlocks.length;
			// A row of columns holds them all side by side.
			const perRow =
				kind === 'columns'
					? count
					: ( block.attributes.layout?.columnCount ?? null );

			rows.push( {
				perRow,
				perRowOptions: PER_ROW,
				canAdd:
					count <
					( kind === 'columns' ? MAX_SIDE_BY_SIDE : MAX_GRID_ITEMS ),
				canGrow: ( perRow ?? count ) < MAX_SIDE_BY_SIDE,
				canRemove: count > MIN_ITEMS,
				clientId: block.clientId,
				count,
				itemIds: block.innerBlocks.map( ( item ) => item.clientId ),
				kind,
			} );
			return;
		}

		if ( depth < MAX_DEPTH ) {
			block.innerBlocks.forEach( ( inner ) => visit( inner, depth + 1 ) );
		}
	};

	( section?.innerBlocks || [] ).forEach( ( block ) => visit( block, 0 ) );

	return rows;
}

/**
 * A row's items with a copy of one added straight after it.
 *
 * @param {Object} row   The row's block, with its inner blocks.
 * @param {number} index The item to copy; the last when left out.
 * @return {Object} `{ blocks, addedId }`: the row's new inner blocks, and
 *                  the new item's client ID.
 */
export function withItemAdded( row, index = row.innerBlocks.length - 1 ) {
	const copy = cloneBlock( row.innerBlocks[ index ] );
	const blocks = [ ...row.innerBlocks ];

	blocks.splice( index + 1, 0, copy );

	return { addedId: copy.clientId, blocks: withEvenWidths( row, blocks ) };
}

/**
 * A row's items without one.
 *
 * @param {Object} row   The row's block, with its inner blocks.
 * @param {number} index The item to take out; the last when left out.
 * @return {Object[]} The row's new inner blocks.
 */
export function withItemRemoved( row, index = row.innerBlocks.length - 1 ) {
	return withEvenWidths(
		row,
		row.innerBlocks.filter( ( _, at ) => at !== index )
	);
}

/**
 * Columns all given the same width share the row evenly however many there
 * are, so their widths are let go once the count changes.
 *
 * @param {Object}   row    The row's block.
 * @param {Object[]} blocks Its new inner blocks.
 * @return {Object[]} The blocks.
 */
function withEvenWidths( row, blocks ) {
	if (
		row.name !== 'core/columns' ||
		! blocks.some( ( block ) => block.attributes.width )
	) {
		return blocks;
	}

	return blocks.map( ( block ) => {
		const { width, ...attributes } = block.attributes;

		return { ...block, attributes };
	} );
}

/**
 * A row with a number of items side by side, the rest flowing onto the next
 * line. A row of columns can't wrap, so it becomes a grid, each column a
 * group holding what it held, as Layout's "per row" does.
 *
 * @param {Object} row   The row's block, with its inner blocks.
 * @param {number} count How many side by side.
 * @return {Object} The block to put in the row's place.
 */
export function withPerRow( row, count ) {
	const state =
		row.name === 'core/columns'
			? { count: row.innerBlocks.length, from: 'columns' }
			: { count: row.attributes.layout?.columnCount, from: 'grid' };

	return GRID.arrange( row, state, { count } );
}
