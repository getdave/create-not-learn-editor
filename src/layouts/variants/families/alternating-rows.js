/**
 * Alternating rows.
 *
 * A group of image-beside-text rows. The images can zigzag, starting on
 * either side, or all line up on one side.
 */

/**
 * WordPress dependencies
 */
import { cloneBlock } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { rebuild } from '../blocks';
import { arrangeImageRow, readImageRow } from './image-and-text';

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
		const isBeside = row?.side === 'left' || row?.side === 'right';

		return { block: inner, row: isBeside ? row : null };
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

export const ALTERNATING_ROWS = {
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
