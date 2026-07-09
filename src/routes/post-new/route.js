import { notFound } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getPostType } from '../../settings';
import { __, sprintf } from '../../wp-globals';

export const route = {
	beforeLoad: ( { params } ) => {
		if ( ! getPostType( params.type ) ) {
			throw notFound();
		}
	},
	title: ( { params } ) => {
		const type = getPostType( params.type );
		return sprintf(
			/* translators: %s: post type singular label. */
			__( 'New %s' ),
			type?.singular || params.type
		);
	},
	async canvas() {
		return null;
	},
};
