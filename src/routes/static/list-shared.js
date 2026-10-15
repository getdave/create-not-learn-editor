export const EMPTY_ARRAY = [];
export const DEFAULT_TEMPLATE_LAYOUTS = {
	grid: {
		showMedia: true,
	},
	list: {
		showMedia: false,
	},
	table: {
		showMedia: false,
	},
};

export function getSearchParams() {
	const params = new URLSearchParams( window.location.search );
	const routePath = params.get( 'p' ) || '';
	const routeQueryIndex = routePath.indexOf( '?' );

	if ( routeQueryIndex !== -1 ) {
		const routeParams = new URLSearchParams(
			routePath.slice( routeQueryIndex + 1 )
		);

		routeParams.forEach( ( value, key ) => {
			if ( ! params.has( key ) ) {
				params.set( key, value );
			}
		} );
	}

	return params;
}

export function getSearchValue( value ) {
	if ( Array.isArray( value ) ) {
		return value[ 0 ];
	}

	return value;
}
