export const HOMEPAGE_DOCUMENT_ICON_STATUSES = [
	'home-static',
	'home-latest-posts',
	'posts-page',
];

export function getHomepageDocumentIconStatus( status ) {
	return HOMEPAGE_DOCUMENT_ICON_STATUSES.includes( status ) ? status : '';
}
