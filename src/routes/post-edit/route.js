import { notFound } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getPostType } from '../../settings';
import { __, sprintf } from '../../wp-globals';

export const route = {
	beforeLoad: ( { params } ) => {
		if ( ! getPostType( params.type ) || ! params.id ) {
			throw notFound();
		}
	},
	title: ( { params } ) => {
		const type = getPostType( params.type );
		return sprintf(
			/* translators: %s: post type singular label. */
			__( 'Edit %s' ),
			type?.singular || params.type
		);
	},
	async canvas( { params } ) {
		return {
			postType: params.type,
			postId: params.id,
		};
	},
};
