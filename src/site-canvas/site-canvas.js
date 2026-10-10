/**
 * A site canvas: a toolbar, and the editor with the preview laid over it.
 *
 * Both surfaces stay mounted. Switching fades the preview in or out, as Big
 * Sky's Easy Mode does, so neither reloads, and the preview keeps its page,
 * scroll position and history while Edit is on show.
 */

/**
 * WordPress dependencies
 */
import { Editor as LazyEditor } from '@wordpress/lazy-editor';
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getErrorMessage } from '../records';
import {
	__,
	blockEditorStore,
	el,
	Notice,
	Spinner,
	useSelect,
} from '../wordpress-packages';
import { EDITOR_DEVICES } from './constants';
import {
	CanvasMoreMenu,
	DeviceSwitcher,
	PreviewHistory,
	StageToggle,
	SurfaceToggle,
} from './toolbar';
import { UnsavedChangesDialog } from './unsaved-changes-dialog';

/*
 * Unlike Easy Mode, the editor isn't locked to `templateLock: 'contentOnly'`.
 * With that lock on, swapping a page's blocks out (discarding its changes, for
 * one) throws in core's block editing modes, and every block list settings
 * update after it replays the throw, so editing breaks for the rest of the
 * session. That happens however the lock is applied, so it is left off until
 * core copes.
 */

/**
 * @param {Object}  props
 * @param {Object}  props.canvas         Result of `useSiteCanvas`.
 * @param {string}  props.className      Extra class for the canvas.
 * @param {Element} props.document       What is on show, for the toolbar.
 * @param {Element} props.editorChildren Shown over the editor in Edit.
 * @param {Object}  props.editorRef      Ref to the editor's container.
 * @param {Element} props.emptyPreview   Shown when there is nothing to
 *                                       preview.
 * @return {Element} The canvas.
 */
export function SiteCanvas( {
	canvas,
	className = '',
	document,
	editorChildren,
	editorRef,
	emptyPreview = null,
} ) {
	const navigate = useNavigate();
	const { device, editorEntity, frame } = canvas;

	// Published for the stylesheet, which hides core chrome by block.
	const selectedBlockName = useSelect(
		( select ) => {
			const { getBlockName, getSelectedBlockClientId } =
				select( blockEditorStore );

			return canvas.isEditing
				? getBlockName( getSelectedBlockClientId() )
				: null;
		},
		[ canvas.isEditing ]
	);

	return el(
		'section',
		{
			className: `cnl-site-canvas cnl-editor-canvas cnl-editor-preview-canvas ${
				canvas.isEditing ? 'is-editing ' : ''
			}${ canvas.isTakingOver ? 'is-taking-over ' : '' }${ className }`,
		},
		el(
			'header',
			{
				className:
					'cnl-editor-canvas__toolbar cnl-editor-homepage-toolbar',
			},
			el(
				'div',
				{ className: 'cnl-editor-homepage-toolbar__left' },
				canvas.isEditing &&
					el( StageToggle, {
						isShown: ! canvas.isTakingOver,
						onToggle: canvas.toggleStage,
					} ),
				el( SurfaceToggle, {
					canEdit: canvas.canEdit,
					onChange: canvas.requestSurface,
					surface: canvas.surface,
				} ),
				! canvas.isEditing &&
					el( PreviewHistory, {
						history: frame.history,
						onMove: frame.move,
					} ),
				canvas.isAwaitingPreview &&
					el(
						'span',
						{
							className: 'cnl-site-canvas__awaiting',
							role: 'status',
						},
						el( Spinner ),
						el(
							'span',
							{ className: 'screen-reader-text' },
							__( 'Loading the preview' )
						)
					)
			),
			el(
				'div',
				{ className: 'cnl-editor-homepage-toolbar__center' },
				document
			),
			el(
				'div',
				{ className: 'cnl-editor-homepage-toolbar__right' },
				el( DeviceSwitcher, {
					device,
					onChange: canvas.setDevice,
				} ),
				el( CanvasMoreMenu, {
					editRoute: canvas.editRoute,
					liveUrl: canvas.liveUrl,
					onOpenFullEditor: () => navigate( canvas.editRoute ),
				} )
			)
		),
		el(
			'div',
			{ className: 'cnl-site-canvas__body' },
			el(
				'div',
				{
					className: 'cnl-site-canvas__editor cnl-inline-editor',
					'data-selected-block': selectedBlockName || undefined,
					ref: editorRef,
				},
				editorEntity &&
					el( LazyEditor, {
						initialViewport: EDITOR_DEVICES[ device ],
						key: `${ editorEntity.postType }:${ editorEntity.postId }`,
						postId: editorEntity.postId,
						postType: editorEntity.postType,
					} ),
				canvas.isEditing && editorChildren
			),
			/*
			 * `aria-hidden` rather than `hidden`: `hidden` is `display: none`,
			 * which would cut the fade short.
			 */
			el(
				'div',
				{
					'aria-hidden': canvas.isEditing,
					className: `cnl-site-canvas__preview is-${ device }`,
				},
				canvas.previewContextError &&
					el(
						Notice,
						{
							className: 'cnl-editor-preview-canvas__notice',
							isDismissible: false,
							status: 'error',
						},
						getErrorMessage( canvas.previewContextError )
					),
				frame.isLoading &&
					el(
						'div',
						{ className: 'cnl-editor-preview-canvas__spinner' },
						el( Spinner )
					),
				frame.frameProps.src
					? el( 'iframe', {
							...frame.frameProps,
							className: 'cnl-site-canvas__frame',
							title: __( 'Site preview' ),
						} )
					: emptyPreview
			)
		),
		canvas.dialog.isOpen && el( UnsavedChangesDialog, canvas.dialog )
	);
}
