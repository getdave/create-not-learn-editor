export const DEFAULT_HOMEPAGE_DEVICE = 'desktop';

export const HOMEPAGE_DEVICES = [ 'desktop', 'tablet', 'mobile' ];

export const HOMEPAGE_DOCUMENT_ICON_STATUSES = [
	'home-static',
	'home-latest-posts',
	'posts-page',
];
const HOMEPAGE_PREVIEW_PARAM = 'cnl-editor-preview';

export function getHomepagePreviewUrl( homeUrl, refreshKey = '' ) {
	if ( ! homeUrl ) {
		return '';
	}

	const previewUrl = new URL( homeUrl, window.location.origin );
	previewUrl.searchParams.set( HOMEPAGE_PREVIEW_PARAM, '1' );

	if ( refreshKey ) {
		previewUrl.searchParams.set( 'cnl-editor-preview-refresh', refreshKey );
	}

	return previewUrl.href;
}

export function getHomepagePreviewContextUrl( url, fallbackUrl = '' ) {
	const contextUrl = url || fallbackUrl;

	if ( ! contextUrl ) {
		return '';
	}

	const normalizedUrl = new URL( contextUrl, window.location.origin );
	normalizedUrl.searchParams.delete( 'cnl-editor-preview' );
	normalizedUrl.searchParams.delete( 'cnl-editor-preview-refresh' );
	normalizedUrl.hash = '';

	return normalizedUrl.href;
}

export function getHomepagePreviewNavigationUrl( url, baseUrl = '' ) {
	if ( ! url ) {
		return '';
	}

	let navigationUrl;
	try {
		navigationUrl = new URL( url, baseUrl || window.location.href );
	} catch {
		return url;
	}

	if (
		navigationUrl.origin !== window.location.origin ||
		! [ 'http:', 'https:' ].includes( navigationUrl.protocol )
	) {
		return url;
	}

	navigationUrl.searchParams.set( HOMEPAGE_PREVIEW_PARAM, '1' );

	return navigationUrl.href;
}

export function isHomepagePreviewNavigationUrl( url, baseUrl = '' ) {
	try {
		const navigationUrl = new URL( url, baseUrl || window.location.href );

		return navigationUrl.searchParams.get( HOMEPAGE_PREVIEW_PARAM ) === '1';
	} catch {
		return false;
	}
}

export function getHomepageDevice( value ) {
	return HOMEPAGE_DEVICES.includes( value ) ? value : DEFAULT_HOMEPAGE_DEVICE;
}

export function getHomepageDocumentIconStatus( status ) {
	return HOMEPAGE_DOCUMENT_ICON_STATUSES.includes( status ) ? status : '';
}

export function getPreviewHistoryState( position = 0, maxPosition = 0 ) {
	return {
		canGoBack: position > 0,
		canGoForward: position < maxPosition,
	};
}
