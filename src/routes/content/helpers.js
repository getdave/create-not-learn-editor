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

function normalizeTemplateText( value ) {
	const rendered = value?.rendered || value?.raw || value || '';
	const element = document.createElement( 'textarea' );
	element.innerHTML = String( rendered )
		.replace( /<[^>]+>/g, '' )
		.trim();
	return element.value;
}

/**
 * Whether a layout is among a content type's, in its Layouts tab.
 *
 * @param {Object} template Template record, or `{ slug, title, description }`.
 * @param {string} typeName Post type name.
 * @return {boolean} Whether the layout belongs to the type.
 */
export function templateMatchesPostType( template, typeName ) {
	if ( ! template || ! typeName ) {
		return false;
	}

	const slug = template.slug || '';

	if ( typeName === 'page' ) {
		return (
			slug === 'front-page' ||
			slug === 'page' ||
			slug.startsWith( 'page-' )
		);
	}

	if ( typeName === 'post' ) {
		return [ 'home', 'single', 'single-post' ].includes( slug );
	}

	const text = [
		slug,
		normalizeTemplateText( template.title ),
		template.description,
	]
		.join( ' ' )
		.toLowerCase();

	return (
		slug === `single-${ typeName }` ||
		slug === `archive-${ typeName }` ||
		text.includes( typeName.toLowerCase() )
	);
}

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
