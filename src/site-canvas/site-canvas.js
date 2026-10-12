/**
 * A site canvas: a toolbar, and the editor with the preview laid over it.
 *
 * Both surfaces stay mounted. Moving to or from Browse fades the preview in or
 * out, so neither reloads, and the preview keeps its page, scroll position
 * and history while the editor is on show. Compose zooms the editor out and
 * lays its own layer over it.
 */

/**
 * WordPress dependencies
 */
import { Editor as LazyEditor } from '@wordpress/lazy-editor';
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { unlock } from '../lock-unlock';
import { getErrorMessage } from '../records';
import {
	__,
	blockEditorStore,
	el,
	Notice,
	Spinner,
	useRef,
	useSelect,
} from '../wordpress-packages';
import { ComposeLayer, scrollCanvasTo } from './compose/compose-layer';
import { afterZoomIn, useComposeZoom } from './compose/use-compose-zoom';
import { EDITOR_DEVICES } from './constants';
import { MODE_EDIT } from './mode';
import {
	CanvasMoreMenu,
	DeviceSwitcher,
	FullEditorButton,
	ModeMenu,
	PreviewHistory,
} from './toolbar';
import { UnsavedChangesDialog } from './unsaved-changes-dialog';

// Long enough for the editor to zoom back in before scrolling it.
const ZOOM_IN_SETTLE_MS = 450;

/**
 * @param {Object}   props
 * @param {Object}   props.canvas         Result of `useSiteCanvas`.
 * @param {string}   props.className      Extra class for the canvas.
 * @param {Element}  props.document       What is on show, for the toolbar.
 * @param {Element}  props.editorChildren Shown over the editor while it is
 *                                        on show.
 * @param {Object}   props.editorRef      Ref to the editor's container, if
 *                                        the caller needs one.
 * @param {Element}  props.emptyPreview   Shown when there is nothing to
 *                                        preview.
 * @param {Function} props.useComposeSync A hook linking Compose to a list of
 *                                        the same sections elsewhere. See
 *                                        `ComposeLayer`.
 * @return {Element} The canvas.
 */
export function SiteCanvas( {
	canvas,
	className = '',
	document,
	editorChildren,
	editorRef: givenEditorRef,
	emptyPreview = null,
	useComposeSync,
} ) {
	const navigate = useNavigate();
	const ownEditorRef = useRef();
	const editorRef = givenEditorRef || ownEditorRef;
	const { device, editorDevice, editorEntity, frame, isComposing, mode } =
		canvas;
	const isPreviewing = canvas.isPreviewing;
	const isEditing = mode === MODE_EDIT;

	useComposeZoom( isComposing && Boolean( editorEntity ), editorRef );

	// Open what was picked in Compose in Edit, selected and in view.
	const editFromCompose = ( clientId, isSitePart ) => {
		afterZoomIn( ( registry ) => {
			const actions = unlock( registry.dispatch( blockEditorStore ) );

			actions.selectBlock( clientId );

			if ( isSitePart ) {
				actions.editContentOnlySection( clientId );
			}

			window.setTimeout(
				() => scrollCanvasTo( editorRef, clientId ),
				ZOOM_IN_SETTLE_MS
			);
		} );
		canvas.requestMode( MODE_EDIT );
	};

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
			className: `cnl-site-canvas cnl-editor-canvas cnl-editor-preview-canvas is-${ mode } ${
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
				el( ModeMenu, {
					canEdit: canvas.canEdit,
					mode,
					onChange: canvas.requestMode,
				} ),
				isEditing &&
					canvas.editRoute &&
					el( FullEditorButton, {
						onOpen: () => navigate( canvas.editRoute ),
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
				! isComposing &&
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
						initialViewport: EDITOR_DEVICES[ editorDevice ],
						key: `${ editorEntity.postType }:${ editorEntity.postId }`,
						postId: editorEntity.postId,
						postType: editorEntity.postType,
					} ),
				isEditing && editorChildren
			),
			isComposing &&
				editorEntity &&
				el( ComposeLayer, {
					editorRef,
					onEdit: editFromCompose,
					useSync: useComposeSync,
				} ),
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
