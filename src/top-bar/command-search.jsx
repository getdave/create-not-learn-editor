/**
 * Command search: a search field look-alike that opens the command palette.
 *
 * Gutenberg mounts the palette on every admin page, so it is already here
 * behind Cmd+K, but nothing on screen says so. This gives it a place.
 */

/**
 * WordPress dependencies
 */
import { store as commandsStore } from '@wordpress/commands';
import { useDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { search } from '@wordpress/icons';
import { displayShortcut, rawShortcut } from '@wordpress/keycodes';
import { Icon } from '@wordpress/ui';

export function CommandSearch() {
	const { open } = useDispatch( commandsStore );

	return (
		<button
			type="button"
			className="cnl-command-search"
			onClick={ open }
			aria-haspopup="dialog"
			aria-keyshortcuts={ rawShortcut.primary( 'k' ) }
		>
			<Icon icon={ search } size={ 20 } />
			<span className="cnl-command-search__label">
				{ __( 'Search or jump to…' ) }
			</span>
			<kbd className="cnl-command-search__shortcut" aria-hidden>
				{ displayShortcut.primary( 'k' ) }
			</kbd>
		</button>
	);
}
