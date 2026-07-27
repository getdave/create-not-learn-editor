import { useSelect } from '@wordpress/data';
import {
	__experimentalGetBlockLabel as getBlockLabel,
	store as blocksStore,
} from '@wordpress/blocks';

import { store as blockEditorStore } from './block-editor-store';

export default function useBlockDisplayTitle( {
	clientId,
	maximumLength,
	context,
} ) {
	const blockTitle = useSelect(
		( select ) => {
			if ( ! clientId ) {
				return null;
			}

			const { getBlockName, getBlockAttributes } =
				select( blockEditorStore );
			const { getBlockType, getActiveBlockVariation } =
				select( blocksStore );

			const blockName = getBlockName( clientId );
			const blockType = getBlockType( blockName );
			if ( ! blockType ) {
				return null;
			}

			const attributes = getBlockAttributes( clientId );
			const label = getBlockLabel( blockType, attributes, context );
			if ( label !== blockType.title ) {
				return label;
			}

			const match = getActiveBlockVariation( blockName, attributes );
			return match?.title || blockType.title;
		},
		[ clientId, context ]
	);

	if ( ! blockTitle ) {
		return null;
	}

	if (
		maximumLength &&
		maximumLength > 0 &&
		blockTitle.length > maximumLength
	) {
		const omission = '...';
		return (
			blockTitle.slice( 0, maximumLength - omission.length ) + omission
		);
	}

	return blockTitle;
}
