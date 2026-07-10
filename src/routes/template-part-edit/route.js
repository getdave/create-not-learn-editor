/**
 * WordPress dependencies
 */
import { notFound } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getEditablePostType } from '../../settings';
import { __ } from '../../wordpress-packages';

export const route = {
	beforeLoad: ( { search } ) => {
		if ( ! search.postId || ! getEditablePostType( 'wp_template_part' ) ) {
			throw notFound();
		}
	},
	title: () => __( 'Edit Template Part' ),
	async canvas( { search } ) {
		return {
			postId: search.postId,
			postType: 'wp_template_part',
		};
	},
};
