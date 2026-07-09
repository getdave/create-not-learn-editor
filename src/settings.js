export const settings = window.createNotLearnEditor || {};

export const namespace = settings.restNamespace || 'create-not-learn-editor/v1';

export function getPostTypes() {
	return settings.postTypes || [];
}

export function getPostType( name ) {
	return getPostTypes().find( ( type ) => type.name === name );
}

export function getFirstPostType() {
	return getPostTypes()[ 0 ];
}

export function getAdminUrl( path, query = {} ) {
	const base = `${ settings.adminUrl || '/wp-admin/' }${ path }`;
	const url = new URL( base, window.location.origin );

	Object.entries( {
		...query,
		cnl_editor_admin_bridge: '1',
	} ).forEach( ( [ key, value ] ) => {
		if ( value !== undefined && value !== null && value !== '' ) {
			url.searchParams.set( key, value );
		}
	} );

	return url.href;
}

export function addPreviewArgs( url ) {
	if ( ! url ) {
		return '';
	}

	const previewUrl = new URL( url, window.location.origin );
	previewUrl.searchParams.set( 'cnl-editor-preview', '1' );

	return previewUrl.href;
}
