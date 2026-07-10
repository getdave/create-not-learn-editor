import { notFound } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getEditablePostType } from '../../settings';
import { __, sprintf } from '../../wordpress-packages';

export const route = {
	beforeLoad: ( { params } ) => {
		if ( ! getEditablePostType( params.type ) || ! params.id ) {
			throw notFound();
		}
	},
	title: ( { params } ) => {
		const type = getEditablePostType( params.type );
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
