/**
 * Force distraction-free mode for one visit to the edit canvas, then hand the
 * `core`/`distractionFree` preference back to whatever it held before.
 *
 * The request is kept on `window` rather than in a module-level variable.
 * Each build entry (every route, plus app init, which mounts the editor
 * layer) is its own standalone bundle with its own copy of this module, so a
 * closure variable set by the route that requests entry would not be visible
 * from the editor layer's copy. `window` is the one thing both share.
 */

/**
 * WordPress dependencies
 */
import { useRegistry } from '@wordpress/data';
import { useEffect, useRef } from '@wordpress/element';
import { store as preferencesStore } from '@wordpress/preferences';

const PREFERENCE_SCOPE = 'core';
const PREFERENCE_NAME = 'distractionFree';

const REQUEST_FLAG = '__cnlEditorDistractionFreeRequested';

/**
 * Ask the next edit canvas to open in distraction-free mode.
 *
 * Call this right before navigating into the canvas. The request is consumed
 * the first time the canvas appears, so it never leaks into a later visit
 * that didn't ask for it.
 */
export function requestDistractionFreeEntry() {
	window[ REQUEST_FLAG ] = true;
}

/**
 * Force distraction-free mode on for one visit to the edit canvas when asked,
 * restoring whatever the preference held before as soon as the canvas closes.
 *
 * @param {boolean} isEditCanvas Whether the full-screen edit canvas is on screen.
 */
export function useDistractionFreeEntry( isEditCanvas ) {
	const registry = useRegistry();
	const restoreRef = useRef( null );

	useEffect( () => {
		if ( isEditCanvas && window[ REQUEST_FLAG ] ) {
			delete window[ REQUEST_FLAG ];
			restoreRef.current = registry
				.select( preferencesStore )
				.get( PREFERENCE_SCOPE, PREFERENCE_NAME );
			registry
				.dispatch( preferencesStore )
				.set( PREFERENCE_SCOPE, PREFERENCE_NAME, true );
			return;
		}

		if ( ! isEditCanvas && restoreRef.current !== null ) {
			registry
				.dispatch( preferencesStore )
				.set( PREFERENCE_SCOPE, PREFERENCE_NAME, restoreRef.current );
			restoreRef.current = null;
		}
	}, [ isEditCanvas, registry ] );
}
