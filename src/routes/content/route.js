import { notFound } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getEditablePostType, getPostType } from '../../settings';
import {
	__,
	coreDataStore,
	layoutIcon,
	resolveSelect,
} from '../../wordpress-packages';

function getSearchValue( value ) {
	if ( Array.isArray( value ) ) {
		return value[ 0 ];
	}

	return value;
}

function getPreviewStatusLabel( status ) {
	switch ( status ) {
		case 'publish':
			return __( 'Published' );
		case 'draft':
		case 'auto-draft':
			return __( 'Draft' );
		case 'future':
			return __( 'Scheduled' );
		case 'pending':
			return __( 'Pending review' );
		case 'private':
			return __( 'Private' );
		default:
			return __( 'Preview' );
	}
}

function getPlainTitle( title, fallback ) {
	const rendered =
		typeof title === 'string' ? title : title?.rendered || title?.raw || '';
	const text = document.createElement( 'textarea' );
	text.innerHTML = rendered.replace( /<[^>]+>/g, '' ).trim();

	return text.value || fallback;
}

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
	async canvas( { search } ) {
		if ( search.content === 'templates' ) {
			const templateId = getSearchValue( search.postIds );
			if ( ! templateId || ! getEditablePostType( 'wp_template' ) ) {
				return null;
			}

			let template;
			try {
				template =
					( await resolveSelect( coreDataStore ).getEntityRecord(
						'postType',
						'wp_template',
						templateId,
						{ context: 'edit' }
					) ) || {};
			} catch {
				template = {};
			}

			return {
				editLink: `/wp_template?postId=${ encodeURIComponent(
					templateId
				) }`,
				isPreview: true,
				postId: templateId,
				postType: 'wp_template',
				previewCanEdit: true,
				previewEditLabel: __( 'Edit' ),
				previewIcon: layoutIcon,
				previewLabel: getPlainTitle( template.title, __( 'Pages' ) ),
				previewStatus: template.status || 'publish',
				previewStatusLabel: getPreviewStatusLabel(
					template.status || 'publish'
				),
				previewTone: 'global',
			};
		}

		if ( search.postId || search.postIds ) {
			return null;
		}

		return undefined;
	},
};
