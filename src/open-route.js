/**
 * Open a screen from outside boot's router, the way the workspace switcher
 * does: boot's router follows `pushState`. The route's search params go
 * inside `p`, after its path, as boot's own links put them.
 *
 * @param {string} path   Route path.
 * @param {Object} search Route search params.
 */
export function openRoute( path, search = {} ) {
	const url = new URL( window.location.href );
	const query = new URLSearchParams(
		Object.entries( search ).map( ( [ key, value ] ) => [
			key,
			String( value ),
		] )
	).toString();

	url.searchParams.set( 'p', query ? `${ path }?${ query }` : path );
	window.history.pushState( null, '', url );
}
