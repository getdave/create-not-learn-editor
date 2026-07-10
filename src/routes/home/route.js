/**
 * Internal dependencies
 */
import { __ } from '../../wordpress-packages';

export const route = {
	title: () => __( 'Homepage' ),
	async canvas() {
		return null;
	},
};
