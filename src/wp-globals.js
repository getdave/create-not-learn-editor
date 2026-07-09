const wp = window.wp || {};
const components = wp.components || {};
const element = wp.element || {};
const i18n = wp.i18n || {};
const url = wp.url || {};

export const Button = components.Button;
export const Notice = components.Notice;
export const Spinner = components.Spinner;
export const TextControl = components.TextControl;

export const el = element.createElement;
export const useEffect = element.useEffect;
export const useMemo = element.useMemo;
export const useState = element.useState;

export const __ = i18n.__ || ( ( text ) => text );
export const sprintf =
	i18n.sprintf ||
	( ( text, ...replacements ) => {
		let index = 0;
		return text.replace( /%s/g, () => replacements[ index++ ] ?? '' );
	} );

export const apiFetch = wp.apiFetch;

export function addQueryArgs( path, args = {} ) {
	if ( url.addQueryArgs ) {
		return url.addQueryArgs( path, args );
	}

	const [ base, existingQuery = '' ] = path.split( '?' );
	const params = new URLSearchParams( existingQuery );

	Object.entries( args ).forEach( ( [ key, value ] ) => {
		if ( value !== undefined && value !== null && value !== '' ) {
			params.set( key, value );
		}
	} );

	const query = params.toString();
	return query ? `${ base }?${ query }` : base;
}
