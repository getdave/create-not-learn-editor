import { store as blocksStore } from '@wordpress/blocks';
import { Draggable } from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { useEffect, useRef } from '@wordpress/element';

import { store as blockEditorStore } from './block-editor-store';
import BlockIcon from './block-icon';

function BlockDraggableChip( { count, icon } ) {
	return (
		<div className="block-editor-list-view-draggable-chip">
			<BlockIcon icon={ icon } showColors context="list-view" />
			{ count > 1 && (
				<span className="block-editor-list-view-draggable-chip__count">
					{ count }
				</span>
			) }
		</div>
	);
}

export default function BlockDraggable( {
	appendToOwnerDocument,
	children,
	clientIds,
	cloneClassname,
	elementId,
	onDragStart,
	onDragEnd,
	dragComponent,
} ) {
	const { srcRootClientId, isDraggable, icon } = useSelect(
		( select ) => {
			const {
				canMoveBlocks,
				getBlockRootClientId,
				getBlockName,
				getBlockAttributes,
			} = select( blockEditorStore );
			const { getBlockType, getActiveBlockVariation } = select( blocksStore );
			const firstClientId = clientIds[ 0 ];
			const blockName = getBlockName( firstClientId );
			const variation = getActiveBlockVariation(
				blockName,
				getBlockAttributes( firstClientId )
			);

			return {
				srcRootClientId: getBlockRootClientId( firstClientId ),
				isDraggable: canMoveBlocks( clientIds ),
				icon: variation?.icon || getBlockType( blockName )?.icon,
			};
		},
		[ clientIds ]
	);
	const { startDraggingBlocks, stopDraggingBlocks } =
		useDispatch( blockEditorStore );
	const isDraggingRef = useRef( false );

	// As upstream: a row can unmount mid-drag, such as when it is dropped
	// under another item, and then never hears the drag end.
	useEffect( () => {
		return () => {
			if ( isDraggingRef.current ) {
				stopDraggingBlocks();
			}
		};
	}, [] );

	if ( ! isDraggable ) {
		return children( { draggable: false } );
	}

	return (
		<Draggable
			appendToOwnerDocument={ appendToOwnerDocument }
			cloneClassname={ cloneClassname }
			__experimentalTransferDataType="wp-blocks"
			transferData={ {
				type: 'block',
				srcClientIds: clientIds,
				srcRootClientId,
			} }
			onDragStart={ () => {
				window.requestAnimationFrame( () => {
					startDraggingBlocks( clientIds );
					isDraggingRef.current = true;
					onDragStart?.();
				} );
			} }
			onDragEnd={ () => {
				stopDraggingBlocks();
				isDraggingRef.current = false;
				onDragEnd?.();
			} }
			__experimentalDragComponent={
				dragComponent !== undefined ? (
					dragComponent
				) : (
					<BlockDraggableChip count={ clientIds.length } icon={ icon } />
				)
			}
			elementId={ elementId }
		>
			{ ( { onDraggableStart, onDraggableEnd } ) =>
				children( {
					draggable: true,
					onDragStart: onDraggableStart,
					onDragEnd: onDraggableEnd,
				} ) }
		</Draggable>
	);
}
