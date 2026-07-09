/**
 * Internal dependencies
 */
import { getPostType } from './settings';
import { __, addQueryArgs, apiFetch } from './wp-globals';

let didConfigureApiFetch = false;

export function configureApiFetch() {
	const settings = window.createNotLearnEditor || {};

	if ( didConfigureApiFetch || ! apiFetch ) {
		return;
	}

	if ( settings.nonce && apiFetch.createNonceMiddleware ) {
		apiFetch.use( apiFetch.createNonceMiddleware( settings.nonce ) );
	}

	didConfigureApiFetch = true;
}

export function getTitleText( title ) {
	const rendered = title?.rendered || title?.raw || '';
	const element = document.createElement( 'textarea' );
	element.innerHTML = rendered.replace( /<[^>]+>/g, '' ).trim();
	return element.value || 'Untitled';
}

export async function fetchPosts( typeName, search = '' ) {
	const type = getPostType( typeName );

	if ( ! type ) {
		return [];
	}

	configureApiFetch();

	return apiFetch( {
		path: addQueryArgs( `/wp/v2/${ type.restBase }`, {
			per_page: 20,
			search: search || undefined,
			_fields: 'id,link,title,status,type,date_gmt,modified_gmt',
			status: 'publish,draft,pending,private,future',
		} ),
	} );
}

export async function fetchPreviewContext( url, namespace ) {
	configureApiFetch();

	return apiFetch( {
		path: addQueryArgs( `/${ namespace }/preview-context`, { url } ),
	} );
}

export async function setupDefaults( namespace ) {
	configureApiFetch();

	return apiFetch( {
		path: `/${ namespace }/setup-defaults`,
		method: 'POST',
	} );
}

export function getErrorMessage( error ) {
	return error?.message || __( 'Request failed.' );
}
