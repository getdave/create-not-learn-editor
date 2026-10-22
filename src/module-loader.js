/**
 * Load a script module the first time it is asked for, and fetch it ahead of
 * time once the page has settled, so it is normally there before anyone asks.
 */

// The longest an idle preload waits for the page to go quiet.
const IDLE_TIMEOUT_MS = 3000;
// Where there's no `requestIdleCallback`, how long after load to preload.
const FALLBACK_DELAY_MS = 1000;

/**
 * Run a callback once the page has loaded and the browser is next idle.
 *
 * @param {() => void} callback Called once.
 */
export function whenIdle( callback ) {
	const schedule = () => {
		if ( typeof window.requestIdleCallback === 'function' ) {
			window.requestIdleCallback( callback, {
				timeout: IDLE_TIMEOUT_MS,
			} );
		} else {
			window.setTimeout( callback, FALLBACK_DELAY_MS );
		}
	};

	if ( document.readyState === 'complete' ) {
		schedule();
	} else {
		window.addEventListener( 'load', schedule, { once: true } );
	}
}

/**
 * @param {() => Promise<Object>} importModule Imports the module.
 * @return {Object} `{ getLoaded, load, preload, preloadWhenIdle }`.
 */
export function createModuleLoader( importModule ) {
	let loaded = null;
	let loading = null;
	let isPreloadScheduled = false;

	/**
	 * @return {Promise<Object>} The module, imported once however often it
	 *                           is asked for.
	 */
	function load() {
		if ( ! loading ) {
			loading = importModule().then(
				( module ) => {
					loaded = module;
					return module;
				},
				( error ) => {
					// Forget a failed import, so the next ask tries again.
					loading = null;
					throw error;
				}
			);
		}

		return loading;
	}

	/*
	 * Fetch the module without waiting for it. A failure is left for
	 * whatever asks for the module next, which tries again.
	 */
	function preload() {
		load().catch( () => {} );
	}

	function preloadWhenIdle() {
		if ( isPreloadScheduled || loaded ) {
			return;
		}

		isPreloadScheduled = true;
		whenIdle( preload );
	}

	return {
		/**
		 * @return {?Object} The module, or `null` until it has loaded.
		 */
		getLoaded: () => loaded,
		load,
		preload,
		preloadWhenIdle,
	};
}
