/**
 * The parts of app init that nothing needs until someone opens them: the
 * chat's panel, and the editor's section picker. They come from the
 * app-init-deferred script module, so page boot doesn't wait for them. See
 * `packages/app-init-deferred`.
 *
 * App init asks for the module once the page has settled after boot, and the
 * ways in to the chat ask again on hover or focus, so it has normally loaded
 * before anyone opens either.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * because app init imports it. See `src/editor-layer/index.jsx`.
 */

/**
 * WordPress dependencies
 */
import { useCallback, useEffect, useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { createModuleLoader } from './module-loader';

/*
 * Held in a variable so the build leaves the import for the browser to
 * resolve through the import map, where PHP registers the module.
 */
const DEFERRED_MODULE = '@create-not-learn-editor/app-init-deferred';

const loader = createModuleLoader(
	() => import( /* webpackIgnore: true */ DEFERRED_MODULE )
);

/**
 * Start fetching the module, if it isn't already, without waiting for it.
 */
export const preloadDeferred = loader.preload;

/**
 * Fetch the module once the page has loaded and the browser is idle.
 */
export const preloadDeferredWhenIdle = loader.preloadWhenIdle;

/**
 * Load the module, if it hasn't loaded yet.
 *
 * @return {Object} `{ deferred, error, retry }`: the module, or `null` until
 *                  it has loaded; the error if it didn't load; and a function
 *                  to try again.
 */
export function useDeferred() {
	const [ state, setState ] = useState( () => ( {
		deferred: loader.getLoaded(),
		error: null,
	} ) );
	const [ attempt, setAttempt ] = useState( 0 );

	useEffect( () => {
		if ( state.deferred ) {
			return undefined;
		}

		let isCurrent = true;

		loader.load().then(
			( deferred ) => {
				if ( isCurrent ) {
					setState( { deferred, error: null } );
				}
			},
			( error ) => {
				if ( isCurrent ) {
					setState( { deferred: null, error } );
				}
			}
		);

		return () => {
			isCurrent = false;
		};
	}, [ state.deferred, attempt ] );

	const retry = useCallback( () => {
		setState( { deferred: null, error: null } );
		setAttempt( ( count ) => count + 1 );
	}, [] );

	return { ...state, retry };
}
