/**
 * The chat's bigger pickers, from the chat-extras module, loaded the first
 * time one is shown. See `packages/chat-extras`.
 */

/**
 * WordPress dependencies
 */
import { useEffect, useState } from '@wordpress/element';

/*
 * Held in a variable so the build leaves the import for the browser to
 * resolve through the import map, where PHP registers the module.
 */
const EXTRAS_MODULE = '@create-not-learn-editor/chat-extras';

let loaded = null;
let loading = null;

function loadExtras() {
	if ( ! loading ) {
		loading = import( /* webpackIgnore: true */ EXTRAS_MODULE ).then(
			( module ) => {
				loaded = module;
				return module;
			}
		);
	}

	return loading;
}

/**
 * @return {?Object} The chat-extras module, or `null` until it has loaded.
 */
export function useChatExtras() {
	const [ extras, setExtras ] = useState( () => loaded );

	useEffect( () => {
		if ( extras ) {
			return undefined;
		}

		let isCurrent = true;

		loadExtras().then( ( module ) => {
			if ( isCurrent ) {
				setExtras( module );
			}
		} );

		return () => {
			isCurrent = false;
		};
	}, [ extras ] );

	return extras;
}
