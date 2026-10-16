/**
 * Removing, putting back and adding a section's items.
 *
 * Each change rewrites the blocks around the item with core's
 * `replaceInnerBlocks`, which a content-only section doesn't turn down, so it
 * is undone like any other edit. What was removed is kept until it is put
 * back, with where it was, so Restore can return it to the same place.
 */

/**
 * Internal dependencies
 */
import {
	blockEditorStore,
	cloneBlock,
	useCallback,
	useRegistry,
	useState,
} from '../../wordpress-packages';
import {
	canHoldItems,
	createItem,
	findPlace,
	followPath,
	getAppendPlace,
	getEditableId,
	getRemovalTarget,
} from './items';

const EMPTY_ARRAY = [];

/**
 * A section's block with its blocks inside. A header's or footer's blocks
 * belong to its template part, and core keeps them apart from the block
 * that shows it, so they are read from the block's own list.
 *
 * @param {Object} store    `blockEditorStore` selectors.
 * @param {string} clientId The section, header or footer.
 * @return {?Object} The block, with its inner blocks.
 */
export function getOwnerBlock( store, clientId ) {
	const block = store.getBlock( clientId );

	return block && { ...block, innerBlocks: store.getBlocks( clientId ) };
}

/**
 * @return {Object} `{ removed, remove, restore, add, forget, rename }`.
 *                  `removed` lists what was taken out, `{ ownerId, path,
 *                  index, block }`, oldest first.
 */
export function useSectionItems() {
	const registry = useRegistry();
	const [ removed, setRemoved ] = useState( EMPTY_ARRAY );

	const remove = useCallback(
		( ownerId, clientId ) => {
			const store = registry.select( blockEditorStore );
			const owner = getOwnerBlock( store, ownerId );

			if ( ! owner ) {
				return;
			}

			// An empty column or group would be left behind otherwise.
			const targetId = getRemovalTarget( owner, clientId );
			const place = findPlace( owner, targetId );

			if ( ! place ) {
				return;
			}

			const parent = getOwnerBlock( store, place.parentId );

			registry.dispatch( blockEditorStore ).replaceInnerBlocks(
				place.parentId,
				parent.innerBlocks.filter(
					( block ) => block.clientId !== targetId
				)
			);
			setRemoved( ( list ) => [
				...list,
				{
					block: parent.innerBlocks[ place.index ],
					index: place.index,
					ownerId,
					path: place.path,
				},
			] );
		},
		[ registry ]
	);

	// Put back everything taken from a section, the latest first, so each
	// goes back to the place it left.
	const restore = useCallback(
		( ownerId ) => {
			const store = registry.select( blockEditorStore );
			const { replaceInnerBlocks } =
				registry.dispatch( blockEditorStore );
			const entries = removed.filter(
				( entry ) => entry.ownerId === ownerId
			);

			registry.batch( () => {
				[ ...entries ].reverse().forEach( ( entry ) => {
					const owner = getOwnerBlock( store, ownerId );

					if ( ! owner ) {
						return;
					}

					const parent = followPath( owner, entry.path );
					const blocks = [ ...parent.innerBlocks ];

					blocks.splice(
						Math.min( entry.index, blocks.length ),
						0,
						cloneBlock( entry.block )
					);
					replaceInnerBlocks( parent.clientId, blocks );
				} );
			} );
			setRemoved( ( list ) =>
				list.filter( ( entry ) => entry.ownerId !== ownerId )
			);
		},
		[ registry, removed ]
	);

	/**
	 * Add an item of a type to the end of a section, or, for a section that
	 * is a single block, straight after it, as a section of its own.
	 *
	 * @param {string}  ownerId The section.
	 * @param {string}  type    `heading`, `paragraph`, `button` or `image`.
	 * @param {?Object} media   The image chosen, for an image.
	 * @return {?Object} `{ blockId, sectionId, editableId }`: the new block,
	 *                   the section it is in, and the block to type in.
	 */
	const add = useCallback(
		( ownerId, type, media ) => {
			const store = registry.select( blockEditorStore );
			const owner = getOwnerBlock( store, ownerId );

			if ( ! owner ) {
				return null;
			}

			const actions = registry.dispatch( blockEditorStore );
			const block = createItem( type, media );
			const result = {
				blockId: block.clientId,
				editableId: getEditableId( block ),
				sectionId: ownerId,
			};

			if ( ! canHoldItems( owner ) ) {
				actions.insertBlocks(
					[ block ],
					store.getBlockIndex( ownerId ) + 1,
					store.getBlockRootClientId( ownerId ),
					false
				);

				return { ...result, sectionId: block.clientId };
			}

			const place = getAppendPlace( owner );
			const parent = getOwnerBlock( store, place.parentId );

			actions.replaceInnerBlocks( place.parentId, [
				...parent.innerBlocks,
				block,
			] );

			return result;
		},
		[ registry ]
	);

	// Forget what was removed from a section since a point, as Reset puts
	// the section back as it was then, with them in it.
	const forget = useCallback( ( ownerId, since ) => {
		setRemoved( ( list ) =>
			list.filter(
				( entry, index ) => entry.ownerId !== ownerId || index < since
			)
		);
	}, [] );

	// A section's client ID changes when its layout is swapped.
	const rename = useCallback( ( fromId, toId ) => {
		setRemoved( ( list ) =>
			list.some( ( entry ) => entry.ownerId === fromId )
				? list.map( ( entry ) =>
						entry.ownerId === fromId
							? { ...entry, ownerId: toId }
							: entry
					)
				: list
		);
	}, [] );

	return { add, forget, removed, remove, rename, restore };
}
