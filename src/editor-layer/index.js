/**
 * The editor layer: our customisations of the edit canvas, layered over the
 * editor rather than built into it. See README.md.
 *
 * Imported package by package rather than through `src/wordpress-packages`.
 * That barrel reaches `@wordpress/lazy-editor`, and this module is mounted from
 * app init, so going through it would make the editor a static dependency of
 * page boot and stop it loading lazily.
 */

/**
 * WordPress dependencies
 */
import { createElement as el, createRoot } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { EditorLayer } from './editor-layer';

const ROOT_ID = 'cnl-editor-layer';

/**
 * Mount the editor layer at document level. Safe to call more than once.
 *
 * It sits outside boot's tree on purpose. The layer lives as long as the page,
 * across every route, while boot mounts and unmounts the editor underneath it.
 * Both share the default data registry, so the layer reads and drives the same
 * editor stores the canvas does.
 */
export function mountEditorLayer() {
	if ( document.getElementById( ROOT_ID ) ) {
		return;
	}

	const container = document.createElement( 'div' );
	container.id = ROOT_ID;
	document.body.appendChild( container );

	createRoot( container ).render( el( EditorLayer ) );
}
