/**
 * A site canvas: a toolbar, and the editor with the preview laid over it.
 *
 * Both surfaces stay mounted. Moving to or from Browse fades the preview in or
 * out, so neither reloads, and the preview keeps its page, scroll position
 * and history while the editor is on show. Edit and Compose share one layer
 * over the editor, Compose zooming the editor out under it.
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
	Notice,
	Spinner,
	useEffect,
	useRef,
	useSelect,
} from '../wordpress-packages';
import { BrowseHints } from './browse-hints';
import { useComposeZoom } from './compose/use-compose-zoom';
import { EDITOR_DEVICES } from './constants';
import { useEditSectionControls } from './edit-section-controls';
import { MODE_COMPOSE, MODE_EDIT } from './mode';
import { SectionModesLayer } from './section-modes/section-modes-layer';
import {
	CanvasMoreMenu,
	DeviceSwitcher,
	ComposeButton,
	EditHistory,
	ModeToggle,
	PreviewHistory,
} from './toolbar';
import { UnsavedChangesDialog } from './unsaved-changes-dialog';
import { useSectionLock } from './use-section-lock';
import { useZoomGestures, ZoomControls } from './zoom-controls';

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
 * @param {?string}  props.focusId        The one section, header or footer a
 *                                        canvas about it works on, in the
 *                                        editor's client IDs. Edit's section
 *                                        layer offers nothing else on the
 *                                        page. See `SectionModesLayer`.
 * @param {boolean}  props.canCompose     Whether Compose is offered. A canvas
 *                                        about one part of the site, not a
 *                                        page's sections, does without.
 * @param {Function} props.useComposeSync A hook linking Compose to a list of
 *                                        the same sections elsewhere, while
 *                                        composing. See `SectionModesLayer`.
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
	focusId = null,
	useComposeSync,
} ) {
	const navigate = useNavigate();
	const ownEditorRef = useRef();
	const bodyRef = useRef();
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

	// Zooming out is Compose, offered wherever the toolbar offers it.
	const canZoom = ! isPreviewing && canCompose && Boolean( editorEntity );
	const zoomIn = () => isComposing && canvas.requestMode( MODE_EDIT );
	const zoomOut = () => ! isComposing && canvas.requestMode( MODE_COMPOSE );

	useZoomGestures( {
		areaRef: bodyRef,
		editorRef,
		enabled: canZoom,
		onZoomIn: zoomIn,
		onZoomOut: zoomOut,
	} );
	/*
	 * A layout's sections are mostly the post's title, image and content,
	 * filled in from each post. Locked to their content, they would leave
	 * nothing to change.
	 */
	useSectionLock(
		isEditing &&
			Boolean( editorEntity ) &&
			editorEntity.postType !== 'wp_template'
	);
	useEditSectionControls( isEditing && Boolean( editorEntity ) );

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

	return (
		<section
			className={ `cnl-site-canvas cnl-editor-canvas cnl-editor-preview-canvas is-${ mode } ${
				isPreviewing ? 'is-previewing ' : ''
			}${ className }` }
		>
			<header className="cnl-editor-canvas__toolbar cnl-editor-homepage-toolbar">
				<div className="cnl-editor-homepage-toolbar__left">
					<ModeToggle
						canEdit={ canvas.canEdit }
						mode={ mode }
						onChange={ canvas.requestMode }
					/>
					{ ! isPreviewing && canCompose && (
						<ComposeButton
							isComposing={ isComposing }
							onToggle={ () =>
								canvas.requestMode(
									isComposing ? MODE_EDIT : MODE_COMPOSE
								)
							}
						/>
					) }
					{ ! isPreviewing && <EditHistory /> }
					{ isPreviewing && (
						<PreviewHistory
							history={ frame.history }
							onMove={ frame.move }
						/>
					) }
					{ canvas.isAwaitingPreview && (
						<span
							className="cnl-site-canvas__awaiting"
							role="status"
						>
							<Spinner />
							<span className="screen-reader-text">
								{ __( 'Loading the preview' ) }
							</span>
						</span>
					) }
				</div>
				<div className="cnl-editor-homepage-toolbar__center">
					{ document }
				</div>
				<div className="cnl-editor-homepage-toolbar__right">
					{ ! isComposing && (
						<DeviceSwitcher
							device={ device }
							onChange={ canvas.setDevice }
						/>
					) }
					<CanvasMoreMenu
						liveUrl={ canvas.liveUrl }
						onOpenEditor={
							canvas.editRoute
								? () => navigate( canvas.editRoute )
								: null
						}
					/>
				</div>
			</header>
			<div className="cnl-site-canvas__body" ref={ bodyRef }>
				<div
					className="cnl-site-canvas__editor cnl-inline-editor"
					data-selected-block={ selectedBlockName || undefined }
					ref={ editorRef }
				>
					{ editorEntity && (
						<LazyEditor
							initialViewport={ EDITOR_DEVICES[ editorDevice ] }
							key={ `${ editorEntity.postType }:${ editorEntity.postId }` }
							postId={ editorEntity.postId }
							postType={ editorEntity.postType }
						/>
					) }
					{ isEditing && editorChildren }
				</div>
				{ /* One layer for Edit and Compose, kept as the canvas moves
				between them, so what is picked carries over. */ }
				{ ( isEditing || isComposing ) && editorEntity && (
					<SectionModesLayer
						editorRef={ editorRef }
						focusId={ focusId }
						isComposing={ isComposing }
						onExitCompose={ () => canvas.requestMode( MODE_EDIT ) }
						useSync={ useComposeSync }
					/>
				) }
				{ canZoom && (
					<ZoomControls
						isComposing={ isComposing }
						onZoomIn={ zoomIn }
						onZoomOut={ zoomOut }
					/>
				) }
				{ /*
				 * `aria-hidden` rather than `hidden`: `hidden` is `display: none`,
				 * which would cut the fade short.
				 */ }
				<div
					aria-hidden={ ! isPreviewing }
					className={ `cnl-site-canvas__preview is-${ device }` }
				>
					{ canvas.previewContextError && (
						<Notice
							className="cnl-editor-preview-canvas__notice"
							isDismissible={ false }
							status="error"
						>
							{ getErrorMessage( canvas.previewContextError ) }
						</Notice>
					) }
					{ frame.isLoading && (
						<div className="cnl-editor-preview-canvas__spinner">
							<Spinner />
						</div>
					) }
					{ frame.frameProps.src ? (
						<iframe
							{ ...frame.frameProps }
							className="cnl-site-canvas__frame"
							title={ __( 'Site preview' ) }
						/>
					) : (
						emptyPreview
					) }
					{ /* Only in Browse: out of it the hints draw nothing, and
					mounted they would follow every edit. */ }
					{ isPreviewing && frame.frameProps.src && editorEntity && (
						<BrowseHints canvas={ canvas } />
					) }
				</div>
			</div>
			{ canvas.dialog.isOpen && (
				<UnsavedChangesDialog { ...canvas.dialog } />
			) }
		</section>
	);
}
