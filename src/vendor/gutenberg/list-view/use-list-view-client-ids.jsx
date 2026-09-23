import { useSelect } from '@wordpress/data';
import { store as blockEditorStore } from './compat/block-editor-store';
import { unlock } from './compat/lock-unlock';

export default function useListViewClientIds( { blocks, rootClientId } ) {
	return useSelect(
		( select ) => {
			const {
				getDraggedBlockClientIds,
				getSelectedBlockClientIds,
				getListViewClientIdsTree,
			} = unlock( select( blockEditorStore ) );

			return {
				selectedClientIds: getSelectedBlockClientIds(),
				draggedClientIds: getDraggedBlockClientIds(),
				clientIdsTree:
					blocks ?? getListViewClientIdsTree( rootClientId ),
			};
		},
		[ blocks, rootClientId ]
	);
}
