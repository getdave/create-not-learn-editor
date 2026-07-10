export const DEFAULT_HOMEPAGE_DEVICE = 'desktop';

export const HOMEPAGE_DEVICES = [ 'desktop', 'tablet', 'mobile' ];

export function getHomepagePreviewUrl( homeUrl, refreshKey = '' ) {
	if ( ! homeUrl ) {
		return '';
	}

	const previewUrl = new URL( homeUrl, window.location.origin );
	previewUrl.searchParams.set( 'cnl-editor-preview', '1' );

	if ( refreshKey ) {
		previewUrl.searchParams.set( 'cnl-editor-preview-refresh', refreshKey );
	}

	return previewUrl.href;
}

export function getHomepageDevice( value ) {
	return HOMEPAGE_DEVICES.includes( value ) ? value : DEFAULT_HOMEPAGE_DEVICE;
}

export function getHomepageStatusTone( status ) {
	switch ( status ) {
		case 'homepage':
		case 'publish':
		case 'future':
			return 'success';
		case 'draft':
		case 'auto-draft':
		case 'pending':
			return 'warning';
		case 'private':
		case 'trash':
			return 'muted';
		default:
			return 'neutral';
	}
}

export function getPreviewHistoryState( position = 0, maxPosition = 0 ) {
	return {
		canGoBack: position > 0,
		canGoForward: position < maxPosition,
	};
}
