/**
 * The workspace presets, and which one is active.
 *
 * Kept apart from `index.js`, which applies them to boot's sidebar, so that
 * screens and the chat can read the active workspace without bringing boot's
 * store along.
 *
 * A workspace is organised around what someone came to do, not how much they
 * know. Each one is a set of presentation settings. Surfaces read the setting
 * they care about from `getActiveWorkspace()`, never the workspace's id, so a
 * new workspace is a new entry here rather than a new branch in every
 * surface. Anything a workspace leaves out takes its value from `DEFAULTS`,
 * which is the page-building editor everyone gets to begin with.
 */

/**
 * WordPress dependencies
 */
import { select } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { layout, pencil, tool } from '@wordpress/icons';
import { store as preferencesStore } from '@wordpress/preferences';

export const PREFERENCES_SCOPE = 'create-not-learn-editor';
export const PREFERENCE_NAME = 'workspace';

/**
 * A parent no menu item has, so an item moved under it is never listed.
 * Boot has no way to remove a menu item once registered.
 */
export const HIDDEN_PARENT = 'cnl-workspace-hidden';

/**
 * What every workspace starts from.
 *
 * - `menuItems`: changes to boot's registered sidebar items, keyed by item id.
 *   Anything not listed keeps its registered definition.
 * - `pinLastMenuItem`: pins the last top-level sidebar item to the bottom of
 *   the panel, for workspaces that end on a gateway like Advanced.
 * - `home.places`: the places to start on "Home", and in the chat, by id
 *   (see `src/start-places.js`), with `home.copy` rewording any of them.
 * - `home.hint`: the tip under them.
 * - `home.viewLabel`: the link to the live site, under Home's title.
 * - `home.preview`: what Home's canvas opens on. `home` is the homepage;
 *   `posts` is wherever the blog's posts are listed.
 * - `posts`: what the Posts screen says it is for, and its add button.
 * - `writeInFocus`: whether writing a post opens the editor with everything
 *   but the writing out of the way.
 * - `writingAids`: whether a post open in the editor gets a writer's prompt
 *   and its length (`src/editor-layer/writing-aids.jsx`).
 * - `postKinds`: whether writing a post starts by picking what kind it is,
 *   like a note, a photo or a quote (`src/pickers/post-kinds.jsx`). Each
 *   person can still opt out from the picker.
 * - `publishStep`: whether Publish asks "Are you ready to publish?" first,
 *   with the category, tags and when to publish to hand. Only a default:
 *   the person's own choice, from the checkbox on that step, wins.
 */
const DEFAULTS = {
	menuItems: {},
	pinLastMenuItem: false,
	home: {
		places: [ 'home', 'pages', 'identity', 'style', 'siteParts' ],
		copy: {},
		hint: __(
			'Tip: follow links on the page to visit the rest of your site. Switch to Edit to change what is on it, then zoom out to add and arrange its sections.'
		),
		preview: 'home',
		viewLabel: __( 'View site' ),
	},
	posts: {
		addLabel: null,
		description: __( 'Your blog posts, newest first.' ),
	},
	writeInFocus: false,
	writingAids: false,
	publishStep: false,
	postKinds: true,
};

/**
 * Workspace presets. The first is the default.
 *
 * `aliases` are ids the workspace was saved under before it was renamed, so
 * a saved preference still finds it.
 */
const PRESETS = [
	{
		id: 'simple',
		label: __( 'Default' ),
		icon: layout,
		pinLastMenuItem: true,
	},
	{
		id: 'writing',
		aliases: [ 'blogging' ],
		label: __( 'Writing' ),
		icon: pencil,
		// Writing first: Posts at the top level, the look of the blog under
		// Design, and the page-building screens out of the way.
		menuItems: {
			pages: { parent: HIDDEN_PARENT },
			'content-post': { parent: undefined },
			navigation: { parent: HIDDEN_PARENT },
			advanced: { parent: HIDDEN_PARENT },
			'site-overview': { parent: HIDDEN_PARENT },
		},
		home: {
			// The homepage is the same place, and the same screen, as in
			// every other workspace.
			places: [ 'write', 'posts', 'home', 'identity', 'style' ],
			copy: {
				identity: {
					description: __( 'Name your blog and add a logo.' ),
				},
				style: { description: __( 'Pick the look of your blog.' ) },
			},
			hint: __(
				'Tip: follow links on your blog to read it here as visitors do. Open a post to change it.'
			),
			preview: 'posts',
			viewLabel: __( 'View blog' ),
		},
		posts: {
			addLabel: __( 'Write a post' ),
			description: __(
				'Everything you’ve written. Pick up a draft, or change something you’ve published.'
			),
		},
		writeInFocus: true,
		writingAids: true,
		publishStep: true,
	},
	{
		id: 'builder',
		label: __( 'Builder' ),
		icon: tool,
		// Lift the site-building destinations out of Advanced to the top
		// level. Posts comes with it so hiding Advanced doesn't also bury it.
		menuItems: {
			advanced: { parent: HIDDEN_PARENT },
			'content-post': { parent: undefined },
			patterns: { parent: undefined },
			templateParts: { parent: undefined },
			templates: { parent: undefined },
		},
	},
];

export const WORKSPACES = PRESETS.map( ( preset ) => ( {
	...DEFAULTS,
	...preset,
	home: { ...DEFAULTS.home, ...preset.home },
	posts: { ...DEFAULTS.posts, ...preset.posts },
} ) );

export const DEFAULT_WORKSPACE = WORKSPACES[ 0 ];

/**
 * Get a workspace by id, falling back to the default.
 *
 * @param {string} id Workspace id, or one it was saved under before.
 * @return {Object} Workspace preset.
 */
export function getWorkspace( id ) {
	return (
		WORKSPACES.find(
			( workspace ) =>
				workspace.id === id || workspace.aliases?.includes( id )
		) || DEFAULT_WORKSPACE
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
