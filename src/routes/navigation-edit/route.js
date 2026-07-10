import { notFound } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { __ } from '../../wordpress-packages';

export const route = {
	beforeLoad: ( { params } ) => {
		if ( Number.isNaN( Number( params.id ) ) ) {
			throw notFound();
		}
	},
	title: () => __( 'Edit Navigation Menu' ),
	async canvas() {
		return null;
	},
};
