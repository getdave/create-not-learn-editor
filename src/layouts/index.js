/**
 * Layouts: plain section shapes, drawn as wireframes in previews.
 *
 * Ported from the core set of Layout Primitives
 * (https://github.com/getdave/editor-layout-primitives). The patterns are
 * registered in `includes/layouts.php` and offered by the section picker's
 * Layouts mode. Here, an empty heading, paragraph, button, image or cover in
 * a layout is swapped for a wireframe whenever it renders in a preview, so the
 * picker's thumbnails show the shape rather than blank space.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * for the same reason as `src/editor-extensions/template-part-editing.js`:
 * this is registered from app init.
 */

/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';
import { createElement as el } from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';

/**
 * Internal dependencies
 */
import { isEmptyBlock, shouldWireframe } from './should-wireframe';
import { WIREFRAMES } from './wireframes';

/**
 * Swap blocks that have a wireframe for it, when they should show one.
 *
 * @param {Function} BlockEdit The block's edit component.
 * @return {Function} Wrapped edit component.
 */
function withLayoutWireframe( BlockEdit ) {
	function MaybeWireframe( props ) {
		const { attributes, clientId, name } = props;
		const show = useSelect(
			( select ) => {
				const { getBlockAttributes, getBlockParents, getSettings } =
					select( blockEditorStore );

				// Cheap checks first: real editors never get past this line.
				if (
					! getSettings().isPreviewMode ||
					! isEmptyBlock( name, attributes )
				) {
					return false;
				}

				return shouldWireframe( {
					ancestorClassNames: getBlockParents( clientId ).map(
						( id ) => getBlockAttributes( id )?.className
					),
					attributes,
					isPreviewMode: true,
					name,
				} );
			},
			[ attributes, clientId, name ]
		);

		return el( show ? WIREFRAMES[ name ] : BlockEdit, props );
	}

	// A mounted BlockEdit's name never changes, so branching here is stable,
	// and blocks without a wireframe skip the store subscription entirely.
	return function LayoutWireframeBlockEdit( props ) {
		return el(
			WIREFRAMES[ props.name ] ? MaybeWireframe : BlockEdit,
			props
		);
	};
}

/**
 * Register the layout wireframes with the editor.
 */
export function registerLayoutWireframes() {
	addFilter(
		'editor.BlockEdit',
		'create-not-learn-editor/layout-wireframes',
		withLayoutWireframe
	);
}
