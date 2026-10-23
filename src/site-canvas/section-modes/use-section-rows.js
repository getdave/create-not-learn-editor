/**
 * A section's rows of items, and adding to or taking from them.
 *
 * Each change rewrites the row with core's `replaceInnerBlocks`, which a
 * content-only section doesn't turn down, so it is undone like any other
 * edit.
 */

/**
 * Internal dependencies
 */
import {
	blockEditorStore,
	useCallback,
	useMemo,
	useRegistry,
	useSelect,
} from '../../wordpress-packages';
import { getRows, withItemAdded, withItemRemoved, withPerRow } from './rows';

const EMPTY_ARRAY = [];

/**
 * @param {?string} sectionId The section, if any.
 * @return {Object[]} Its rows, as `getRows()` gives them.
 */
export function useSectionRows( sectionId ) {
	const innerBlocks = useSelect(
		( select ) =>
			sectionId
				? select( blockEditorStore ).getBlocks( sectionId )
				: EMPTY_ARRAY,
		[ sectionId ]
	);

	return useMemo(
		() =>
			sectionId ? getRows( { clientId: sectionId, innerBlocks } ) : [],
		[ innerBlocks, sectionId ]
	);
}

/**
 * @return {Object} `{ addItem, removeItem, setPerRow }`. `addItem( rowId,
 *                  index, { grow } )` copies an item in after itself, the
 *                  last when no index is given, one more sitting side by
 *                  side when `grow` is set, and returns `{ addedId, rowId }`:
 *                  the copy's client ID and the row's, new when a grid grew.
 *                  `removeItem( rowId, index )` takes one out, the last when
 *                  no index is given. `setPerRow( rowId, count )` sets
 *                  how many sit side by side, and returns the row's new
 *                  client ID, as a row of columns becomes a grid.
 */
export function useRowActions() {
	const registry = useRegistry();

	const getRow = useCallback(
		( rowId ) => {
			const store = registry.select( blockEditorStore );
			const block = store.getBlock( rowId );

			return block && { ...block, innerBlocks: store.getBlocks( rowId ) };
		},
		[ registry ]
	);

	const addItem = useCallback(
		( rowId, index, { grow = false } = {} ) => {
			const row = getRow( rowId );

			if ( ! row ) {
				return null;
			}

			if ( ! grow || row.name === 'core/columns' ) {
				const { addedId, blocks } = withItemAdded( row, index );

				registry
					.dispatch( blockEditorStore )
					.replaceInnerBlocks( rowId, blocks, false );

				return { addedId, rowId };
			}

			// A grid grows by one side by side first. The row is swapped
			// through its parent's blocks, as a content-only section turns
			// down replacing a block inside it.
			const grid = withPerRow(
				row,
				( row.attributes.layout?.columnCount ??
					row.innerBlocks.length ) + 1
			);
			const { addedId, blocks } = withItemAdded( grid, index );
			const store = registry.select( blockEditorStore );
			const parentId = store.getBlockRootClientId( rowId );

			registry.dispatch( blockEditorStore ).replaceInnerBlocks(
				parentId,
				store
					.getBlocks( parentId )
					.map( ( block ) =>
						block.clientId === rowId
							? { ...grid, innerBlocks: blocks }
							: block
					),
				false
			);

			return { addedId, rowId: grid.clientId };
		},
		[ getRow, registry ]
	);

	const removeItem = useCallback(
		( rowId, index ) => {
			const row = getRow( rowId );

			if ( row ) {
				registry
					.dispatch( blockEditorStore )
					.replaceInnerBlocks(
						rowId,
						withItemRemoved( row, index ),
						false
					);
			}
		},
		[ getRow, registry ]
	);

	// The row is swapped through its parent's blocks, as a content-only
	// section turns down replacing a block inside it.
	const setPerRow = useCallback(
		( rowId, count ) => {
			const row = getRow( rowId );

			if ( ! row ) {
				return null;
			}

			const store = registry.select( blockEditorStore );
			const parentId = store.getBlockRootClientId( rowId );
			const next = withPerRow( row, count );

			registry.dispatch( blockEditorStore ).replaceInnerBlocks(
				parentId,
				store
					.getBlocks( parentId )
					.map( ( block ) =>
						block.clientId === rowId ? next : block
					),
				false
			);

			return next.clientId;
		},
		[ getRow, registry ]
	);

	return { addItem, removeItem, setPerRow };
}
