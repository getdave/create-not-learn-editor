/**
 * Keyboard shortcuts as `@wordpress/ui`'s menu items take them.
 */

/**
 * WordPress dependencies
 */
import { useSelect } from '@wordpress/data';
import { useMemo } from '@wordpress/element';
import { store as keyboardShortcutsStore } from '@wordpress/keyboard-shortcuts';
import {
	ariaKeyShortcut,
	displayShortcut,
	shortcutAriaLabel,
} from '@wordpress/keycodes';

const SHORTCUT_NAMES = [
	'duplicate',
	'insert-before',
	'insert-after',
	'remove',
];

/**
 * A shortcut from a modifier and a character.
 *
 * @param {string} modifier  A `@wordpress/keycodes` modifier, like `primary`.
 * @param {string} character The key pressed with it.
 * @return {Object} The shortcut, for a menu item's `shortcut` prop.
 */
export function toShortcut( modifier, character ) {
	return {
		displayShortcut: displayShortcut[ modifier ]( character ),
		ariaKeyShortcut: ariaKeyShortcut[ modifier ]( character ),
		label: shortcutAriaLabel[ modifier ]( character ),
	};
}

/**
 * Core's block editor shortcuts, as registered, so they read the same as the
 * keys that work.
 *
 * @return {Object<string, ?Object>} Shortcuts by core's name, like `insert-before`.
 */
export function useBlockShortcuts() {
	const combinations = useSelect( ( select ) => {
		const { getShortcutKeyCombination } = select( keyboardShortcutsStore );

		return Object.fromEntries(
			SHORTCUT_NAMES.map( ( name ) => [
				name,
				getShortcutKeyCombination( `core/block-editor/${ name }` ),
			] )
		);
	}, [] );

	return useMemo(
		() =>
			Object.fromEntries(
				Object.entries( combinations ).map(
					( [ name, combination ] ) => [
						name,
						combination?.modifier
							? toShortcut(
									combination.modifier,
									combination.character
								)
							: undefined,
					]
				)
			),
		[ combinations ]
	);
}
