/**
 * Core's "Choose a pattern" modal, kept to new pages in the full-screen editor.
 *
 * Core opens it whenever the page in the editor has no content and no edits,
 * however old the page is, and its own gate is a user preference saved for
 * every editor on the site. The site canvas keeps core's editor mounted under
 * Browse, so an empty page, like the Home the setup action makes, opened it on
 * every visit, before anything was clicked. The site canvas has its own empty
 * state for an empty page, with Add a section and Start blank, so the modal is
 * left to the full-screen editor, and there to pages just made.
 *
 * Turning the preference off would save it for wp-admin's editor too, so the
 * modal is closed instead: hidden by the layer's stylesheet until
 * `data-start-patterns` on `.cnl-editor-layer` allows it, so it never shows,
 * then closed with its own close button, which keeps the preference as it was.
 *
 * DRIFT CANARY. The modal is found by core's class for it and closed through
 * the only button in its header. The stylesheet repeats the class.
 */

/**
 * WordPress dependencies
 */
import { useSelect } from '@wordpress/data';
import { useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { EDITOR_STORE } from './settings-guard';

export const START_PATTERNS_MODAL = '.editor-start-page-options__modal';

/**
 * Close core's "Choose a pattern" modal, if it is open.
 *
 * @param {Element} root Tree to look in. Injectable for tests.
 * @return {boolean} Whether one was closed.
 */
export function closeStartPatterns( root = document.body ) {
	const close = root
		.querySelector( START_PATTERNS_MODAL )
		?.querySelector( '.components-modal__header button' );

	close?.click();

	return !! close;
}

/**
 * Close core's "Choose a pattern" modal whenever it opens.
 *
 * Modals are portalled straight into the body, so only its own children are
 * watched.
 *
 * @param {Element} root Tree to watch. Injectable for tests.
 * @return {Function} Stop watching.
 */
export function keepStartPatternsClosed( root = document.body ) {
	closeStartPatterns( root );

	const observer = new window.MutationObserver( ( records ) => {
		if ( records.some( ( record ) => record.addedNodes.length ) ) {
			closeStartPatterns( root );
		}
	} );

	observer.observe( root, { childList: true } );

	return () => observer.disconnect();
}

/**
 * Allow core's "Choose a pattern" modal only for a new page in the full-screen
 * editor, and close it anywhere else.
 *
 * @param {boolean} isEditCanvas Whether the full-screen editor is on screen.
 * @return {boolean} Whether the modal is allowed.
 */
export function useStartPatternsGate( isEditCanvas ) {
	const isAllowed = useSelect(
		( select ) =>
			isEditCanvas && !! select( EDITOR_STORE )?.isEditedPostNew?.(),
		[ isEditCanvas ]
	);

	useEffect( () => {
		if ( ! isAllowed ) {
			return keepStartPatternsClosed();
		}
	}, [ isAllowed ] );

	return isAllowed;
}
