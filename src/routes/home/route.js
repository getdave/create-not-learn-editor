/**
 * Internal dependencies
 */
import { __ } from '../../wordpress-packages';

export const route = {
	title: () => __( 'Your site' ),
	async canvas() {
		return null;
	},
};
