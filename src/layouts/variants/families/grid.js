/**
 * Items in a grid, and pictures in a gallery: how many sit in each row.
 *
 * A grid is a group laid out as a grid, or a row of three or more columns
 * alike. Columns can't wrap, so a row of columns given another count becomes
 * a grid group, each column a group holding what it held. Nothing is lost,
 * though it stays a grid when it goes back to its first count.
 */

/**
 * WordPress dependencies
 */
import { cloneBlock, createBlock } from '@wordpress/blocks';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { cloneAll, rebuild, setIn } from '../blocks';

const COUNTS = [ 2, 3, 4 ];

// How narrow an item in a grid made from columns can get before the grid
// puts fewer in a row, so it still fits on a phone.
const MINIMUM_COLUMN_WIDTH = '12rem';

// Attributes only columns have, left behind when they become groups.
const COLUMNS_ONLY = [ 'verticalAlignment', 'isStackedOnMobile', 'width' ];

/**
 * The counts offered for some items: two, three and four in a row, any of
 * them that are not more than there are items. Other counts aren't offered,
 * even when it is the count now, so picking one never changes the choice.
 *
 * @param {number} items How many items there are.
 * @return {Object[]} `{ name, label, count }` for each.
 */
function getCountOptions( items ) {
	return COUNTS.filter( ( count ) => count <= items ).map( ( count ) => ( {
		name: `per-row-${ count }`,
		/* translators: %d: How many items sit side by side. */
		label: sprintf( __( '%d per row' ), count ),
		count,
	} ) );
}

function getCurrentCount( state, options ) {
	return (
		options.find( ( option ) => option.count === state.count )?.name ?? null
	);
}

function without( attributes, keys ) {
	const next = { ...attributes };

	keys.forEach( ( key ) => delete next[ key ] );

	return next;
}

/**
 * Read a grid group or a row of columns alike.
 *
 * @param {Object} block Block.
 * @return {?Object} Where the items are, how many sit in a row and how many
 *                   there are, or null when it is not a grid.
 */
function readGrid( block ) {
	const items = block?.innerBlocks?.length ?? 0;

	if (
		block?.name === 'core/group' &&
		block.attributes.layout?.type === 'grid' &&
		items >= 2
	) {
		return { from: 'grid', count: block.attributes.layout.columnCount };
	}

	// Columns given widths are laid out on purpose, not just in a row.
	if (
		block?.name === 'core/columns' &&
		items >= 3 &&
		block.innerBlocks.every(
			( column ) =>
				column.name === 'core/column' && ! column.attributes.width
		)
	) {
		return { from: 'columns', count: items };
	}

	return null;
}

/**
 * A row of columns as a grid group, each column a group.
 *
 * @param {Object} block A `core/columns` block.
 * @param {number} count How many to put in each row.
 * @return {Object} The grid group.
 */
function toGrid( block, count ) {
	return createBlock(
		'core/group',
		{
			...without( block.attributes, COLUMNS_ONLY ),
			layout: {
				type: 'grid',
				columnCount: count,
				minimumColumnWidth: MINIMUM_COLUMN_WIDTH,
			},
		},
		block.innerBlocks.map( ( column ) =>
			createBlock(
				'core/group',
				without( column.attributes, COLUMNS_ONLY ),
				cloneAll( column.innerBlocks )
			)
		)
	);
}

export const GRID = {
	read: readGrid,
	getOptions: ( grid, block ) => getCountOptions( block.innerBlocks.length ),
	getCurrent: getCurrentCount,
	arrange: ( block, grid, option ) => {
		if ( grid.from === 'columns' ) {
			return option.count === grid.count
				? cloneBlock( block )
				: toGrid( block, option.count );
		}

		return rebuild(
			block,
			setIn(
				block.attributes,
				[ 'layout', 'columnCount' ],
				option.count
			),
			cloneAll( block.innerBlocks )
		);
	},
};

export const GALLERY = {
	read: ( block ) =>
		block?.name === 'core/gallery' && block.innerBlocks.length >= 2
			? {
					// A gallery left to itself shows up to three in a row.
					count:
						block.attributes.columns ??
						Math.min( 3, block.innerBlocks.length ),
				}
			: null,
	getOptions: ( gallery, block ) =>
		getCountOptions( block.innerBlocks.length ),
	getCurrent: getCurrentCount,
	arrange: ( block, gallery, option ) =>
		rebuild(
			block,
			{ ...block.attributes, columns: option.count },
			cloneAll( block.innerBlocks )
		),
};
