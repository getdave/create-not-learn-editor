/**
 * WordPress dependencies
 */

import { useSelect } from '@wordpress/data';

/**
 * Internal dependencies
 */
import { store as blockEditorStore } from './compat/block-editor-store';
import { unlock } from './compat/lock-unlock';

export default function useListViewClientIds( { blocks, rootClientId } ) {
	return useSelect(
		( select ) => {
			const {
				getDraggedBlockClientIds,
				getSelectedBlockClientIds,
				getEnabledClientIdsTree,
			} = unlock( select( blockEditorStore ) );

			return {
				selectedClientIds: getSelectedBlockClientIds(),
				draggedClientIds: getDraggedBlockClientIds(),
				clientIdsTree:
					blocks ?? getEnabledClientIdsTree( rootClientId ),
			};
		},
		[ blocks, rootClientId ]
	);
}
