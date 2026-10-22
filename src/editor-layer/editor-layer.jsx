/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import { dispatch, useSelect } from '@wordpress/data';
import { useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';

/**
 * Internal dependencies
 */
import { useDeferred } from '../app-init-deferred';
import { MODE_BROWSE, useCanvasMode } from '../site-canvas/mode';
import { useIsEditCanvas } from './canvas-mode';
import { useDistractionFreeEntry } from './distraction-free';
import {
	closeSectionPicker,
	useSectionPickerRequest,
} from './section-picker-request';
import { useSectionWording } from './section-wording';
import { EDITOR_STORE, useForcedBlockEditorSettings } from './settings-guard';

/**
 * Block editor settings forced while the edit canvas is on screen, such as
 * `{ templateLock: 'contentOnly' }`. Empty forces nothing and costs nothing.
 */
const FORCED_BLOCK_EDITOR_SETTINGS = {};

const NOT_EDITING = {};

/*
 * The section picker comes from the app-init-deferred module, which has
 * normally loaded by the time anyone asks for it. Should it not load, the
 * request is dropped, so asking again tries again.
 */
function DeferredSectionPicker() {
	const { deferred, error } = useDeferred();

	useEffect( () => {
		if ( error ) {
			closeSectionPicker();
			dispatch( noticesStore ).createErrorNotice(
				__( 'The sections didn’t load. Try again.' ),
				{ id: 'cnl-editor-section-picker-error', type: 'snackbar' }
			);
		}
	}, [ error ] );

	return deferred ? <deferred.EditorSectionPicker /> : null;
}

/**
 * The section picker, while something has asked for it.
 *
 * @return {?Element} The picker.
 */
function SectionPickerWhenAsked() {
	const isAsked = !! useSectionPickerRequest();

	return isAsked ? <DeferredSectionPicker /> : null;
}

/**
 * The editor layer's composition root.
 *
 * Mounted once, outside boot's tree. The only UI it renders itself is the
 * section picker, opened from a section's options menu, or from Compose on the
 * site canvas, whose editor is open in Edit and Compose too. Otherwise, what it
 * owns is the editor state the layer's stylesheet keys off, published
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
	useDistractionFreeEntry( isEditCanvas );
	useSectionWording( postType === 'page' );

	const canvasMode = useCanvasMode();
	const canPickSections = isEditCanvas || canvasMode !== MODE_BROWSE;

	// A picker asked for in one editor doesn't outlive it.
	useEffect( () => {
		if ( ! canPickSections ) {
			closeSectionPicker();
		}
	}, [ canPickSections ] );

	return (
		<>
			<div
				className="cnl-editor-layer"
				data-post-type={ postType || undefined }
				data-selected-block={ selectedBlockName || undefined }
			/>
			{ canPickSections && <SectionPickerWhenAsked /> }
		</>
	);
}
