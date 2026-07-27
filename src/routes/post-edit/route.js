import { notFound } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getEditablePostType } from '../../settings';
import {
	__,
	coreDataStore,
	dispatch,
	parseBlocks,
	resolveSelect,
	select,
	sprintf,
} from '../../wordpress-packages';

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
		const post = await resolveSelect( coreDataStore ).getEntityRecord(
			'postType',
			params.type,
			params.id,
			{ context: 'edit' }
		);
		const editedPost = select( coreDataStore ).getEditedEntityRecord(
			'postType',
			params.type,
			params.id
		);

		if (
			! editedPost?.blocks?.length &&
			typeof post?.content?.raw === 'string' &&
			post.content.raw.trim()
		) {
			await dispatch( coreDataStore ).editEntityRecord(
				'postType',
				params.type,
				params.id,
				{
					blocks: parseBlocks( post.content.raw ),
					content: post.content.raw,
				},
				{ undoIgnore: true }
			);
		}

		return {
			postType: params.type,
			postId: params.id,
		};
	},
};
