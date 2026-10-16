/**
 * Core's own section controls, as Edit shows them:
 *
 * - Core's button for unlocking a section, said as "Edit" and "Done", since
 *   every section is content-only in Edit (see `use-section-lock.js`), and
 *   Freeform unlocks it with core's own unlock.
 * - None of core's "Shuffle styles", which cycles through the same colours
 *   Edit layout shows.
 *
 * A section's layouts and colours are in Edit layout's panel. See
 * `section-modes/`.
 */

/**
 * WordPress dependencies
 */
import { addFilter, removeFilter } from '@wordpress/hooks';

/**
 * Internal dependencies
 */
import { __, useEffect } from '../wordpress-packages';

const NAMESPACE = 'create-not-learn-editor/edit-section-controls';

const STYLE_ID = 'cnl-edit-section-controls';

/**
 * Core's words for unlocking a section, and what Edit says instead.
 *
 * @return {Object} Replacements, keyed by core's string.
 */
function getWording() {
	return {
		'Edit pattern': __( 'Edit' ),
		'Exit pattern': __( 'Done' ),
	};
}

/**
 * Say core's section strings as Edit does while it is on.
 *
 * @param {boolean} isActive Whether Edit is on.
 */
function useSectionWording( isActive ) {
	useEffect( () => {
		if ( ! isActive ) {
			return undefined;
		}

		const wording = getWording();

		addFilter( 'i18n.gettext', NAMESPACE, ( translation, text, domain ) =>
			( domain === 'default' || ! domain ) &&
			Object.hasOwn( wording, text )
				? wording[ text ]
				: translation
		);

		return () => removeFilter( 'i18n.gettext', NAMESPACE );
	}, [ isActive ] );
}

/**
 * Hide core's "Shuffle styles" from a section's toolbar while Edit is on.
 *
 * The button has no class of its own, only its label, so the rule is written
 * with the label in the site's language.
 *
 * @param {boolean} isActive Whether Edit is on.
 */
function useHiddenShuffle( isActive ) {
	useEffect( () => {
		if ( ! isActive ) {
			return undefined;
		}

		const label = __( 'Shuffle styles' ).replace( /["\\]/g, '\\$&' );
		const style = document.createElement( 'style' );

		style.id = STYLE_ID;
		style.textContent = `.cnl-inline-editor .block-editor-block-toolbar .components-toolbar-group:has(> .components-button[aria-label="${ label }"]) { display: none; }`;
		document.head.appendChild( style );

		return () => style.remove();
	}, [ isActive ] );
}

/**
 * @param {boolean} isActive Whether the canvas is in Edit.
 */
export function useEditSectionControls( isActive ) {
	useSectionWording( isActive );
	useHiddenShuffle( isActive );
}
