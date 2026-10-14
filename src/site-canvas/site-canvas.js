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
	useEffect,
	useRef,
	useSelect,
} from '../wordpress-packages';
import { ComposeLayer, scrollCanvasTo } from './compose/compose-layer';
import { afterZoomIn, useComposeZoom } from './compose/use-compose-zoom';
import { EDITOR_DEVICES } from './constants';
import { EditSectionControls } from './edit-section-controls';
import { MODE_COMPOSE, MODE_EDIT } from './mode';
import { SectionOutline } from './section-outline';
import {
	CanvasMoreMenu,
	DeviceSwitcher,
	ComposeButton,
	ModeToggle,
	PreviewHistory,
} from './toolbar';
import { UnsavedChangesDialog } from './unsaved-changes-dialog';
import { useSectionLock } from './use-section-lock';

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
 * @param {boolean}  props.canCompose     Whether Compose is offered. A canvas
 *                                        about one part of the site, not a
 *                                        page's sections, does without.
 * @param {Function} props.useComposeSync A hook linking Compose to a list of
 *                                        the same sections elsewhere. See
 *                                        `ComposeLayer`.
 * @return {Element} The canvas.
 */
export function SiteCanvas( {
	canCompose = true,
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
	const { device, editorDevice, editorEntity, frame, mode } = canvas;
	const isPreviewing = canvas.isPreviewing;
	const isEditing = mode === MODE_EDIT;
	const isComposing = canCompose && canvas.isComposing;

	// A canvas without Compose, reached while composing, edits instead.
	useEffect( () => {
		if ( ! canCompose && canvas.isComposing ) {
			canvas.requestMode( MODE_EDIT );
		}
		// Only arriving here composing should switch.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ canCompose, canvas.isComposing ] );

	useComposeZoom( isComposing && Boolean( editorEntity ), editorRef );
	useSectionLock( isEditing && Boolean( editorEntity ) );

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

	/*
	 * Open a block double-clicked in Compose in Edit, selected and in view.
	 * A block inside the header or footer opens it for editing first. Once
	 * the sections are locked again, a block that can't be selected on its
	 * own, like a section's columns, gives way to the nearest one that can.
	 */
	const openFromCompose = ( clientId ) => {
		afterZoomIn( ( registry ) => {
			if ( ! clientId ) {
				return;
			}

			const selectors = registry.select( blockEditorStore );
			const actions = unlock( registry.dispatch( blockEditorStore ) );
			const part = [ clientId, ...selectors.getBlockParents( clientId ) ]
				.reverse()
				.find(
					( id ) =>
						selectors.getBlockName( id ) === 'core/template-part'
				);

			if ( part ) {
				actions.editContentOnlySection( part );
			}

			// Wait for the section locks to settle before choosing.
			window.requestAnimationFrame( () =>
				window.requestAnimationFrame( () => {
					let target = clientId;

					while (
						target &&
						selectors.getBlockEditingMode( target ) === 'disabled'
					) {
						target = selectors.getBlockRootClientId( target );
					}

					if ( ! target ) {
						return;
					}

					actions.selectBlock( target );
					window.setTimeout(
						() => scrollCanvasTo( editorRef, target ),
						ZOOM_IN_SETTLE_MS
					);
				} )
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
				el( ModeToggle, {
					canEdit: canvas.canEdit,
					mode,
					onChange: canvas.requestMode,
				} ),
				! isPreviewing &&
					canCompose &&
					el( ComposeButton, {
						isComposing,
						onToggle: () =>
							canvas.requestMode(
								isComposing ? MODE_EDIT : MODE_COMPOSE
							),
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
				el( CanvasMoreMenu, {
					liveUrl: canvas.liveUrl,
					onOpenEditor: canvas.editRoute
						? () => navigate( canvas.editRoute )
						: null,
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
						initialViewport: EDITOR_DEVICES[ editorDevice ],
						key: `${ editorEntity.postType }:${ editorEntity.postId }`,
						postId: editorEntity.postId,
						postType: editorEntity.postType,
					} ),
				isEditing && editorChildren,
				el( EditSectionControls, {
					isActive: isEditing && Boolean( editorEntity ),
				} )
			),
			el( SectionOutline, {
				editorRef,
				isActive: isEditing && Boolean( editorEntity ),
			} ),
			isComposing &&
				editorEntity &&
				el( ComposeLayer, {
					editorRef,
					onEdit: editFromCompose,
					onExit: () => canvas.requestMode( MODE_EDIT ),
					onOpen: openFromCompose,
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
