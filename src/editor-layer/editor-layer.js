/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';
import { createElement as el } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { useIsEditCanvas } from './canvas-mode';
import { useSectionWording } from './section-wording';
import { EDITOR_STORE, useForcedBlockEditorSettings } from './settings-guard';

/**
 * Block editor settings forced while the edit canvas is on screen, such as
 * `{ templateLock: 'contentOnly' }`. Empty forces nothing and costs nothing.
 */
const FORCED_BLOCK_EDITOR_SETTINGS = {};

const NOT_EDITING = {};

/**
 * The editor layer's composition root.
 *
 * Mounted once, outside boot's tree. It renders no chrome of its own yet.
 * What it owns is the editor state the layer's stylesheet keys off, published
 * as data attributes on its own element, the settings it forces, and the
 * section wording core's pattern strings take while a page is open. Custom
 * chrome is portalled from here into the editor's regions with
 * `usePortalHost`. Mount it only while `isEditCanvas` is true, so its hosts
 * are not watching for regions the rest of the time.
 *
 * @return {Element} The layer.
 */
export function EditorLayer() {
	const isEditCanvas = useIsEditCanvas();

	const { postType, selectedBlockName } = useSelect(
		( select ) => {
			if ( ! isEditCanvas ) {
				return NOT_EDITING;
			}

			const { getBlockName, getSelectedBlockClientId } =
				select( blockEditorStore );

			return {
				postType: select( EDITOR_STORE )?.getCurrentPostType(),
				selectedBlockName: getBlockName( getSelectedBlockClientId() ),
			};
		},
		[ isEditCanvas ]
	);

	useForcedBlockEditorSettings(
		isEditCanvas ? FORCED_BLOCK_EDITOR_SETTINGS : null
	);
	useSectionWording( postType === 'page' );

	return el( 'div', {
		className: 'cnl-editor-layer',
		'data-post-type': postType || undefined,
		'data-selected-block': selectedBlockName || undefined,
	} );
}
