/**
 * Internal dependencies
 */
import { getTemplateDisplayTitle } from '../../records';
import {
	__,
	layoutIcon,
	postFeaturedImageIcon,
	postListIcon,
} from '../../wordpress-packages';

export const DEFAULT_CONTENT_VIEW = {
	fields: [ 'author', 'status', 'comments', 'date' ],
	filters: [],
	layout: {},
	page: 1,
	perPage: 20,
	search: '',
	sort: {
		direction: 'desc',
		field: 'date',
	},
	titleField: 'title',
	type: 'table',
};

export function getActiveTab( searchParams ) {
	return searchParams.content === 'templates' ? 'templates' : 'content';
}

export function getStatusLabel( status ) {
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
			return status || __( 'Unknown' );
	}
}

export function getTemplateTitle( template ) {
	return getTemplateDisplayTitle( template ) || __( 'Untitled template' );
}

export function getTemplateIcon( template ) {
	if ( template?.slug === 'home' ) {
		return postListIcon;
	}

	if ( template?.slug === 'single' ) {
		return postFeaturedImageIcon;
	}

	return layoutIcon;
}
