import { notFound } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getPostType } from '../../settings';
import { __ } from '../../wp-globals';

export const route = {
	beforeLoad: ( { params } ) => {
		if ( ! getPostType( params.type ) ) {
			throw notFound();
		}
	},
	title: ( { params } ) => {
		const type = getPostType( params.type );
		return type?.menuName || type?.label || __( 'Content' );
	},
	async canvas() {
		return null;
	},
};
