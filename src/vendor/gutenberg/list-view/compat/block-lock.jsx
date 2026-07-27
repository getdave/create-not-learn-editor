import { useSelect } from '@wordpress/data';

import { store as blockEditorStore } from './block-editor-store';
import { unlock } from './lock-unlock';

export function useBlockLock( clientId ) {
	return useSelect(
		( select ) => {
			const {
				canLockBlockType,
				getBlockName,
				isEditLockedBlock,
				isMoveLockedBlock,
				isRemoveLockedBlock,
				isLockedBlock,
			} = unlock( select( blockEditorStore ) );

			return {
				isEditLocked: isEditLockedBlock( clientId ),
				isMoveLocked: isMoveLockedBlock( clientId ),
				isRemoveLocked: isRemoveLockedBlock( clientId ),
				canLock: canLockBlockType( getBlockName( clientId ) ),
				isLocked: isLockedBlock( clientId ),
			};
		},
		[ clientId ]
	);
}
