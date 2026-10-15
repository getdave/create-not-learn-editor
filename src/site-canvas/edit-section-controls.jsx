/**
 * A section's controls on core's block toolbar in Edit, to match Compose:
 *
 * - Its layouts and colours, the same dropdowns Compose has.
 * - Core's button for unlocking a section, said as "Edit" and "Done", since
 *   every section is content-only in Edit (see `use-section-lock.js`).
 * - None of core's "Shuffle styles", which cycles through the same colours
 *   the Color dropdown shows.
 *
 * The controls are a fill of core's last toolbar slot, the one left for a
 * section's toolbar.
 */

/**
 * WordPress dependencies
 */
import {
	/* eslint-disable @wordpress/no-unsafe-wp-apis -- The slot core's own template part toolbar buttons use, and the one left on a section's toolbar. */
	__unstableBlockToolbarLastItem as BlockToolbarLastItem,
	/* eslint-enable @wordpress/no-unsafe-wp-apis */
} from '@wordpress/block-editor';
import { addFilter, removeFilter } from '@wordpress/hooks';

/**
 * Internal dependencies
 */
import { unlock } from '../lock-unlock';
import {
	__,
	blockEditorStore,
	useDispatch,
	useEffect,
	useSelect,
} from '../wordpress-packages';
import { SectionVariationsGroup } from './compose/section-toolbar';

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
 * @param {Object}  props
 * @param {boolean} props.isActive Whether the canvas is in Edit.
 * @return {?Element} The controls, while a section is selected.
 */
export function EditSectionControls( { isActive } ) {
	const { selectBlock } = useDispatch( blockEditorStore );
	const sectionId = useSelect(
		( select ) => {
			if ( ! isActive ) {
				return null;
			}

			const store = unlock( select( blockEditorStore ) );
			const selectedId = store.getSelectedBlockClientId();
			const root = store.getSectionRootClientId();

			return selectedId &&
				root &&
				store.getBlockRootClientId( selectedId ) === root
				? selectedId
				: null;
		},
		[ isActive ]
	);

	useSectionWording( isActive );
	useHiddenShuffle( isActive );

	if ( ! sectionId ) {
		return null;
	}

	return (
		<BlockToolbarLastItem>
			<SectionVariationsGroup
				clientId={ sectionId }
				// The new arrangement takes the section's place, picked as it was.
				onReplace={ ( block ) => selectBlock( block.clientId ) }
			/>
		</BlockToolbarLastItem>
	);
}
