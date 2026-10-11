/**
 * The site canvas's editor is for quick changes: text, images and links.
 *
 * Core's content-only lock gives exactly that. Blocks can't be added, moved,
 * removed or styled from the canvas, and only what a block marks as content
 * can be changed. Sections are still added, moved and removed from the stage,
 * which edits the page's blocks directly and so isn't held back by the lock.
 * Anything more is for the full-screen editor, which gets its own settings
 * back once the canvas closes.
 *
 * The lock is forced through the editor layer's settings guard, which waits
 * for a page to finish swapping in for its template before writing it.
 */

/**
 * Internal dependencies
 */
import { useForcedBlockEditorSettings } from '../editor-layer/settings-guard';
import {
	blockEditorStore,
	useEffect,
	useRegistry,
} from '../wordpress-packages';
import { QUICK_EDIT_SETTING } from './constants';

const QUICK_EDIT_SETTINGS = {
	templateLock: 'contentOnly',
	[ QUICK_EDIT_SETTING ]: true,
};

/**
 * Drop block list settings meant for blocks that are gone.
 *
 * Inner block lists report their settings a microtask late, so when a page's
 * blocks are swapped out, by discarding its changes or a section moved from
 * the stage, settings still arrive for blocks that went with them. Under the
 * content-only lock, core's reducer takes each of those for a newly locked
 * block, looks it up, finds nothing and throws, and keeps throwing on every
 * update after. Settings for a block that no longer exists have nothing to
 * apply to, so they are dropped before they reach the store.
 *
 * @param {boolean} isActive Whether to filter.
 */
function useStaleBlockListSettingsFilter( isActive ) {
	const registry = useRegistry();

	useEffect( () => {
		if ( ! isActive ) {
			return;
		}

		// The store's own actions object, which every dispatch hands out.
		const actions = registry.dispatch( blockEditorStore );
		const original = actions.updateBlockListSettings;
		const exists = ( clientId ) =>
			clientId === '' ||
			!! registry.select( blockEditorStore ).getBlockName( clientId );

		actions.updateBlockListSettings = ( clientId, settings ) => {
			if ( typeof clientId === 'string' ) {
				return exists( clientId )
					? original( clientId, settings )
					: undefined;
			}

			const updates = Object.fromEntries(
				Object.entries( clientId ).filter( ( [ id ] ) => exists( id ) )
			);

			return Object.keys( updates ).length
				? original( updates, settings )
				: undefined;
		};

		return () => {
			actions.updateBlockListSettings = original;
		};
	}, [ isActive, registry ] );
}

/**
 * Lock the editor to quick changes while it is open.
 *
 * @param {boolean} isOpen Whether the editor has a page open.
 */
export function useQuickEdit( isOpen ) {
	useStaleBlockListSettingsFilter( isOpen );
	useForcedBlockEditorSettings( isOpen ? QUICK_EDIT_SETTINGS : null );
}
