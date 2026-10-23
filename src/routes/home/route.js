/**
 * Internal dependencies
 */
import { __ } from '../../wordpress-packages';

export const route = {
	title: () => __( 'My site' ),
	async canvas() {
		return null;
	},
};
