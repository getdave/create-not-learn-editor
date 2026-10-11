/**
 * A site canvas: a toolbar, and the editor with the preview laid over it.
 *
 * Both surfaces stay mounted. Turning Preview on or off fades it in or out,
 * as Big Sky's Easy Mode does, so neither reloads, and the preview keeps its
 * page, scroll position and history while the editor is on show.
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
	EditButton,
	PreviewHistory,
	PreviewToggle,
} from './toolbar';
import { UnsavedChangesDialog } from './unsaved-changes-dialog';
import { useQuickEdit } from './use-quick-edit';

/**
 * @param {Object}  props
 * @param {Object}  props.canvas         Result of `useSiteCanvas`.
 * @param {string}  props.className      Extra class for the canvas.
 * @param {Element} props.document       What is on show, for the toolbar.
 * @param {Element} props.editorChildren Shown over the editor while it is
 *                                       on show.
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
	const { device, editorEntity, frame, isPreviewing } = canvas;

	useQuickEdit( Boolean( editorEntity ) );

	// Published for the stylesheet, which hides core chrome by block.
	const selectedBlockName = useSelect(
		( select ) => {
			const { getBlockName, getSelectedBlockClientId } =
				select( blockEditorStore );

			return isPreviewing
				? null
				: getBlockName( getSelectedBlockClientId() );
		},
		[ isPreviewing ]
	);

	return el(
		'section',
		{
			className: `cnl-site-canvas cnl-editor-canvas cnl-editor-preview-canvas ${
				isPreviewing ? 'is-previewing ' : ''
			}${ className }`,
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
				el( EditButton, {
					canEdit: Boolean( canvas.editRoute ),
					onEdit: () => navigate( canvas.editRoute ),
				} ),
				isPreviewing &&
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
				el( PreviewToggle, {
					isPreviewing,
					onToggle: canvas.togglePreview,
				} ),
				el( DeviceSwitcher, {
					device,
					onChange: canvas.setDevice,
				} ),
				el( CanvasMoreMenu, { liveUrl: canvas.liveUrl } )
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
				! isPreviewing && editorChildren
			),
			/*
			 * `aria-hidden` rather than `hidden`: `hidden` is `display: none`,
			 * which would cut the fade short.
			 */
			el(
				'div',
				{
					'aria-hidden': ! isPreviewing,
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
