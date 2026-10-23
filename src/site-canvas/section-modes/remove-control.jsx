/**
 * Remove, on core's block toolbar, for a block in a section in Edit content.
 * Core doesn't offer it there, as the section is locked to its content, so
 * it is added to the end of core's toolbar, in the slot core leaves for it.
 */

/**
 * WordPress dependencies
 */
import {
	/* eslint-disable @wordpress/no-unsafe-wp-apis -- The slot core's own template part toolbar buttons use, at the end of a block's toolbar. */
	__unstableBlockToolbarLastItem as BlockToolbarLastItem,
	/* eslint-enable @wordpress/no-unsafe-wp-apis */
} from '@wordpress/block-editor';
import { ToolbarButton, ToolbarGroup } from '@wordpress/components';
import { trash as trashIcon } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { __ } from '../../wordpress-packages';

/**
 * @param {Object}   props
 * @param {Function} props.onRemove Removes the selected block.
 * @return {Element} The button, filled into core's toolbar.
 */
export function RemoveControl( { onRemove } ) {
	return (
		<BlockToolbarLastItem>
			<ToolbarGroup>
				<ToolbarButton
					className="cnl-remove-control"
					icon={ trashIcon }
					label={ __( 'Remove' ) }
					onClick={ onRemove }
				/>
			</ToolbarGroup>
		</BlockToolbarLastItem>
	);
}
