import { notFound } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getEditablePostType } from '../../settings';
import { __ } from '../../wordpress-packages';

export const route = {
	beforeLoad: ( { search } ) => {
		if ( ! search.postId || ! getEditablePostType( 'wp_template' ) ) {
			throw notFound();
		}
	},
	title: () => __( 'Edit Template' ),
	async canvas( { search } ) {
		return {
			postId: search.postId,
			postType: 'wp_template',
		};
	},
};
