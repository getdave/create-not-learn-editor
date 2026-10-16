/**
 * Lazy-editor's design preview, loaded the first time the chat shows one.
 *
 * The chat is mounted from app init, so importing the preview directly would
 * make the editor a static dependency of page boot. Importing it when needed
 * keeps the editor loading lazily, as it does everywhere else.
 */

/**
 * WordPress dependencies
 */
import { useEffect, useState } from '@wordpress/element';

let loadedPreview = null;
let loading = null;

function loadPreview() {
	if ( ! loading ) {
		loading = import( '@wordpress/lazy-editor' ).then( ( module ) => {
			loadedPreview = module.Preview;
			return loadedPreview;
		} );
	}

	return loading;
}

// Stands in until the preview has loaded, with whatever placeholder the
// caller gives the real one.
function PreviewPlaceholder( { placeholder = null } ) {
	return placeholder;
}

/**
 * @return {Function} The preview component, or a placeholder until it loads.
 */
export function useLazyPreview() {
	const [ Preview, setPreview ] = useState( () => loadedPreview );

	useEffect( () => {
		if ( Preview ) {
			return undefined;
		}

		let isCurrent = true;

		loadPreview().then( ( component ) => {
			if ( isCurrent ) {
				setPreview( () => component );
			}
		} );

		return () => {
			isCurrent = false;
		};
	}, [ Preview ] );

	return Preview || PreviewPlaceholder;
}
