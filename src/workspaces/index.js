/**
 * Workspaces: presentation presets for the kind of work being done.
 *
 * A workspace changes what the editor surfaces by default, never what the
 * user is allowed to do or what is stored. Roles answer "can this user do
 * this?"; workspaces answer "how should the editor present this work?".
 *
 * Surfaces read the active workspace's configuration rather than checking
 * its id, so a new workspace is a new entry in `WORKSPACES`, not a new
 * branch in every surface.
 *
 * The choice is a per-user editor preference, persisted to user meta by the
 * preferences store.
 */

/**
 * WordPress dependencies
 */
import { store as bootStore } from '@wordpress/boot';
import { dispatch, select, subscribe } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { pencil, postList, tool } from '@wordpress/icons';
import { store as preferencesStore } from '@wordpress/preferences';

export const PREFERENCES_SCOPE = 'create-not-learn-editor';
export const PREFERENCE_NAME = 'workspace';

/**
 * A parent no menu item has, so an item moved under it is never listed.
 * Boot has no way to remove a menu item once registered.
 */
const HIDDEN_PARENT = 'cnl-workspace-hidden';

/**
 * Workspace presets.
 *
 * `menuItems` holds changes to boot's registered sidebar items, keyed by
 * item id. Anything not listed keeps its registered definition.
 *
 * `pinLastMenuItem` pins the last top-level sidebar item to the bottom of the
 * panel, for workspaces that end on a gateway like Advanced.
 */
export const WORKSPACES = [
	{
		id: 'simple',
		label: __( 'Default' ),
		icon: pencil,
		pinLastMenuItem: true,
		menuItems: {},
	},
	{
		id: 'blogging',
		label: __( 'Blogging' ),
		icon: postList,
		// Writing first: Posts at the top level, the look of the site under
		// Design, and everything else out of the way.
		menuItems: {
			content: { parent: HIDDEN_PARENT },
			pages: { parent: HIDDEN_PARENT },
			'content-post': { parent: undefined },
			navigation: { parent: HIDDEN_PARENT },
			advanced: { parent: HIDDEN_PARENT },
		},
	},
	{
		id: 'builder',
		label: __( 'Builder' ),
		icon: tool,
		// Lift the site-building destinations out of Advanced to the top level.
		menuItems: {
			advanced: { parent: HIDDEN_PARENT },
			patterns: { parent: undefined },
			templateParts: { parent: undefined },
			templates: { parent: undefined },
		},
	},
];

export const DEFAULT_WORKSPACE = WORKSPACES[ 0 ];

/**
 * Get a workspace by id, falling back to the default.
 *
 * @param {string} id Workspace id.
 * @return {Object} Workspace preset.
 */
export function getWorkspace( id ) {
	return (
		WORKSPACES.find( ( workspace ) => workspace.id === id ) ||
		DEFAULT_WORKSPACE
	);
}

/**
 * Select the active workspace preset.
 *
 * @param {Function} selectFn `select` from `@wordpress/data` or a `useSelect` callback.
 * @return {Object} Workspace preset.
 */
export function getActiveWorkspace( selectFn = select ) {
	return getWorkspace(
		selectFn( preferencesStore ).get( PREFERENCES_SCOPE, PREFERENCE_NAME )
	);
}

/**
 * Switch the active workspace.
 *
 * @param {string} id Workspace id.
 */
export function setActiveWorkspace( id ) {
	dispatch( preferencesStore ).set(
		PREFERENCES_SCOPE,
		PREFERENCE_NAME,
		getWorkspace( id ).id
	);
}

/**
 * Reset the app to the home route.
 *
 * Boot has no public navigation API reachable from outside its own router
 * tree, but its router keeps itself in sync by patching the native
 * `window.history.pushState`/`replaceState`, so driving those directly is
 * how code outside the tree - like the workspace switcher - moves it.
 */
export function resetRouteToHome() {
	const url = new URL( window.location.href );
	url.searchParams.set( 'p', '/' );
	window.history.pushState( null, '', url );
}

/**
 * Apply the active workspace to boot's sidebar, now and whenever it changes.
 *
 * Every item any workspace touches is reset to its registered definition
 * before the active workspace's changes are layered on, so switching back
 * undoes them. Must run after boot has registered its menu items.
 */
export function mountWorkspaces() {
	dispatch( preferencesStore ).setDefaults( PREFERENCES_SCOPE, {
		[ PREFERENCE_NAME ]: DEFAULT_WORKSPACE.id,
	} );

	/*
	 * The registered value of every property any workspace changes, per item,
	 * including properties the item was registered without.
	 */
	const registered = select( bootStore ).getMenuItems();
	const originals = {};
	WORKSPACES.forEach( ( workspace ) => {
		Object.entries( workspace.menuItems ).forEach( ( [ id, changes ] ) => {
			const item = registered.find( ( { id: itemId } ) => itemId === id );

			if ( ! item ) {
				return;
			}

			originals[ id ] = originals[ id ] || {};
			Object.keys( changes ).forEach( ( key ) => {
				originals[ id ][ key ] = item[ key ];
			} );
		} );
	} );

	let appliedId;
	const apply = () => {
		const workspace = getActiveWorkspace();

		if ( workspace.id === appliedId ) {
			return;
		}
		appliedId = workspace.id;

		document.body.dataset.cnlWorkspace = workspace.id;
		document.body.classList.toggle(
			'cnl-pin-last-menu-item',
			!! workspace.pinLastMenuItem
		);
		Object.keys( originals ).forEach( ( id ) => {
			dispatch( bootStore ).updateMenuItem( id, {
				...originals[ id ],
				...workspace.menuItems[ id ],
			} );
		} );
	};

	apply();
	subscribe( apply, preferencesStore );
}
