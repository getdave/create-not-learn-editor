export const settings = window.createNotLearnEditor || {};

export const namespace = settings.restNamespace || 'create-not-learn-editor/v1';

export function getPostTypes() {
	return settings.postTypes || [];
}

export function getEditablePostTypes() {
	return settings.editablePostTypes || getPostTypes();
}

export function getPostType( name ) {
	return getPostTypes().find( ( type ) => type.name === name );
}

export function getEditablePostType( name ) {
	return getEditablePostTypes().find( ( type ) => type.name === name );
}

export function getFirstPostType() {
	return getPostTypes()[ 0 ];
}

export function getNavigationRestBase() {
	return settings.navigationRestBase || 'navigation';
}

export function addPreviewArgs( url ) {
	if ( ! url ) {
		return '';
	}

	const previewUrl = new URL( url, window.location.origin );
	previewUrl.searchParams.set( 'cnl-editor-preview', '1' );

	return previewUrl.href;
}
