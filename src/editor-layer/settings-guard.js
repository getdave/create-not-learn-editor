/**
 * Force block editor settings while the layer asks for them, and hand the
 * editor's own values back when it stops.
 *
 * A setting written once does not stay written. `EditorProvider` pushes its
 * resolved settings into `core/block-editor` whenever they change, which
 * includes every post load, so the forced values are re-asserted on every
 * block editor change instead.
 *
 * Only the block editor's copy is written. The editor's own settings keep the
 * untouched values, which is where the values handed back are read from, so
 * they are recomputed at the time rather than snapshotted when forcing began.
 *
 * Nothing is written to preferences. Those persist to user meta and follow the
 * user into every other editor.
 */

/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import { useRegistry } from '@wordpress/data';
import { useEffect, useRef } from '@wordpress/element';

/*
 * Named rather than imported as a store descriptor. Importing
 * `@wordpress/editor` here would make the whole editor a static dependency of
 * page boot, which app init loads before the editor is ever needed.
 */
export const EDITOR_STORE = 'core/editor';

/**
 * The block a page's content is rendered through when it is shown inside its
 * template, and so the block editor's own answer to whether it has swapped the
 * page for the template around it yet.
 */
const POST_CONTENT_BLOCK = 'core/post-content';

/**
 * Post types that are the document rather than something a template wraps.
 */
const TEMPLATE_POST_TYPES = [
	'wp_template',
	'wp_template_part',
	'wp_navigation',
	'wp_block',
];

/**
 * Whether any settings are asked for.
 *
 * @param {?Object} settings Settings to force.
 * @return {boolean} Whether there is anything to force.
 */
function hasSettings( settings ) {
	return !! settings && Object.keys( settings ).length > 0;
}

/**
 * Build a guard over the given settings accessors.
 *
 * @param {Object}   io                Settings accessors, injected so the policy is testable without a WordPress runtime.
 * @param {Function} io.getSettings    Reads the current settings.
 * @param {Function} io.updateSettings Merges the given settings in.
 * @param {Function} io.getUserSetting Reads what one setting would be without the guard.
 * @param {Function} io.isSettled      Whether it is safe to write settings right now.
 * @param {Function} io.subscribe      Subscribes to settings changes. Returns an unsubscribe function.
 * @return {{set: Function, destroy: Function}} The guard.
 */
export function createSettingsGuard( io ) {
	let forced = null;
	let unsubscribe = null;
	const enforcedKeys = new Set();

	/**
	 * Merge in whichever keys differ from their current value.
	 *
	 * @param {Array<[string, *]>} entries Keys and the values they should hold.
	 * @return {string[]} The keys that were written.
	 */
	const write = ( entries ) => {
		const current = io.getSettings() || {};
		const changes = Object.fromEntries(
			entries.filter( ( [ key, value ] ) => current[ key ] !== value )
		);
		const keys = Object.keys( changes );

		if ( keys.length ) {
			io.updateSettings( changes );
		}

		return keys;
	};

	const enforce = () => {
		if ( ! forced || ! io.isSettled() ) {
			return;
		}

		write( Object.entries( forced ) ).forEach( ( key ) =>
			enforcedKeys.add( key )
		);
	};

	/**
	 * Hand keys back to the editor. Only those actually written are touched,
	 * so a guard that never got to enforce leaves the editor as it found it.
	 *
	 * @param {string[]} keys Keys no longer forced.
	 */
	const restore = ( keys ) => {
		const released = keys.filter( ( key ) => enforcedKeys.has( key ) );

		released.forEach( ( key ) => enforcedKeys.delete( key ) );
		write( released.map( ( key ) => [ key, io.getUserSetting( key ) ] ) );
	};

	return {
		/**
		 * Replace the forced settings. Pass null or `{}` to force nothing.
		 *
		 * @param {?Object} settings Settings to force.
		 */
		set( settings ) {
			const next = hasSettings( settings ) ? settings : null;
			const released = Object.keys( forced || {} ).filter(
				( key ) => ! next || ! Object.hasOwn( next, key )
			);

			/*
			 * Replaced before restoring. Handing a value back is a store
			 * change, which runs `enforce` synchronously, and with the old
			 * settings still in place it would force the value straight back.
			 */
			forced = next;
			restore( released );

			/*
			 * Subscribed only while something is forced. The block editor
			 * notifies on every selection and keystroke, which is not worth
			 * listening to with nothing to enforce.
			 */
			if ( forced && ! unsubscribe ) {
				unsubscribe = io.subscribe( enforce );
			} else if ( ! forced && unsubscribe ) {
				unsubscribe();
				unsubscribe = null;
			}

			enforce();
		},

		/**
		 * Stop enforcing and release the subscription. Does not restore.
		 */
		destroy() {
			unsubscribe?.();
			unsubscribe = null;
			forced = null;
		},
	};
}

/**
 * Wire a guard to the block editor settings in a registry.
 *
 * @param {Object} registry Data registry.
 * @return {{set: Function, destroy: Function}} The guard.
 */
export function createBlockEditorSettingsGuard( registry ) {
	const editor = () => registry.select( EDITOR_STORE );
	const blockEditor = () => registry.select( blockEditorStore );

	return createSettingsGuard( {
		getSettings: () => blockEditor().getSettings(),
		updateSettings: ( settings ) =>
			registry.dispatch( blockEditorStore ).updateSettings( settings ),

		/*
		 * The editor passes most settings through to the block editor as they
		 * are. The template lock is the exception worth knowing about, forced
		 * to `insert` for navigation menus in `useBlockEditorSettings`. A key
		 * the editor derives some other way needs its own case here.
		 */
		getUserSetting: ( key ) => {
			if (
				key === 'templateLock' &&
				editor()?.getCurrentPostType() === 'wp_navigation'
			) {
				return 'insert';
			}

			return editor()?.getEditorSettings()?.[ key ];
		},

		/*
		 * Changing the rendering mode makes the block editor throw one document
		 * away and parse another. A template lock written while that is in
		 * flight is queued against blocks that are gone by the time the block
		 * editor applies it, which throws and keeps throwing for the rest of
		 * the page's life. So nothing is written until the loaded document
		 * matches the rendering mode: a page shown inside its template has its
		 * post content block in the tree.
		 */
		isSettled: () => {
			const postType = editor()?.getCurrentPostType();

			if ( ! postType ) {
				return false;
			}

			if (
				editor().getRenderingMode() !== 'template-locked' ||
				TEMPLATE_POST_TYPES.includes( postType )
			) {
				return true;
			}

			return (
				blockEditor().getBlocksByName( POST_CONTENT_BLOCK ).length > 0
			);
		},

		/*
		 * The block editor store alone. Every write that could undo a forced
		 * setting lands there, and so does the document swap `isSettled` waits
		 * for. Subscribing to the editor store by name is avoided on purpose:
		 * it is registered lazily, and `@wordpress/data` quietly falls back to
		 * a registry-wide listener for a store it does not know yet.
		 */
		subscribe: ( listener ) =>
			registry.subscribe( listener, blockEditorStore ),
	} );
}

/**
 * Force block editor settings for as long as they are passed.
 *
 * The guard is created on first use and told about changes rather than rebuilt,
 * so it always knows what it has written and can hand those back.
 *
 * @param {?Object} settings Settings to force, or null for none. Keep the
 *                           reference stable: a new object re-runs the guard.
 */
export function useForcedBlockEditorSettings( settings ) {
	const registry = useRegistry();
	const guardRef = useRef( null );

	useEffect( () => {
		if ( ! hasSettings( settings ) && ! guardRef.current ) {
			return;
		}

		guardRef.current ??= createBlockEditorSettingsGuard( registry );
		guardRef.current.set( settings );
	}, [ registry, settings ] );

	useEffect( () => () => guardRef.current?.destroy(), [] );
}
