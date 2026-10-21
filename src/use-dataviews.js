/**
 * DataViews, from the dataviews module, loaded the first time a list is
 * shown. See `packages/dataviews`.
 */

/**
 * WordPress dependencies
 */
import { useEffect, useState } from '@wordpress/element';

/*
 * Held in a variable so the build leaves the import for the browser to
 * resolve through the import map, where PHP registers the module.
 */
const DATAVIEWS_MODULE = '@create-not-learn-editor/dataviews';

let loaded = null;
let loading = null;

function loadDataViews() {
	if ( ! loading ) {
		loading = import( /* webpackIgnore: true */ DATAVIEWS_MODULE ).then(
			( module ) => {
				loaded = module;
				return module;
			}
		);
	}

	return loading;
}

/**
 * @param {boolean} [shouldLoad=true] Whether the caller shows a list now.
 *                                    Pass `false` to wait until it does.
 * @return {?Object} The dataviews module, with `DataViews`,
 *                   `DataViewsPicker` and `filterSortAndPaginate`, or
 *                   `null` until it has loaded.
 */
export function useDataViews( shouldLoad = true ) {
	const [ dataViews, setDataViews ] = useState( () => loaded );

	useEffect( () => {
		if ( dataViews || ! shouldLoad ) {
			return undefined;
		}

		let isCurrent = true;

		loadDataViews().then( ( module ) => {
			if ( isCurrent ) {
				setDataViews( module );
			}
		} );

		return () => {
			isCurrent = false;
		};
	}, [ dataViews, shouldLoad ] );

	return dataViews;
}
