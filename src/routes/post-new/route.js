import { notFound, redirect } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getPostType, namespace } from '../../settings';
import { cnlEditorStore } from '../../records';
import { __, dispatch, sprintf } from '../../wordpress-packages';

export const route = {
	beforeLoad: async ( { params } ) => {
		const type = getPostType( params.type );

		if ( ! type || ! type.blockEditor || ! type.canCreate ) {
			throw notFound();
		}

		const post = await dispatch( cnlEditorStore ).createAutoDraft(
			type.name,
			namespace
		);

		if ( ! post?.id ) {
			throw notFound();
		}

		throw redirect( {
			throw: true,
			to: `/types/${ type.name }/edit/${ post.id }`,
		} );
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
		return undefined;
	},
};
