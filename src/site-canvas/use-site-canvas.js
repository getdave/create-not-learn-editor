/**
 * A site canvas's state: which mode it is in, what the preview shows, what
 * the editor underneath it has open, and the rules for moving between them.
 *
 * Browse, the default, lays the saved site in an iframe over the editor, and
 * is where the site can be browsed. Edit and Compose show the editor, zoomed
 * out in Compose. Both surfaces stay mounted, and the editor quietly follows
 * the page the preview is on, so leaving Browse is instant. The mode is shared
 * by every canvas, see `mode.js`. Because the preview only shows what is
 * saved:
 *
 * - Moving to Browse with unsaved changes asks to save or discard them.
 *   A change the caller shows in the preview anyway, such as a page's
 *   layout passed along in its URL, doesn't count.
 * - Moving to Browse after saving, or from a page the preview isn't on,
 *   holds the editor until the preview has loaded the page, so it never shows
 *   an out-of-date page.
 * - Changes made while browsing, from the sidebar, switch to Edit, unless
 *   the preview shows them too.
 * - A layout the editor tidies as it opens it underneath Browse isn't
 *   changed: see `useIgnoreLayoutTidying`.
 */

/**
 * Internal dependencies
 */
import { unlock } from '../lock-unlock';
import { cnlEditorStore } from '../records';
import { namespace, settings } from '../settings';
import { useChanges } from '../top-bar/use-changes';
import {
	blockEditorStore,
	coreDataStore,
	dispatch,
	select,
	subscribe,
	useCallback,
	useEffect,
	useRef,
	useSelect,
	useState,
} from '../wordpress-packages';
import { DEFAULT_DEVICE, EDITOR_DEVICES } from './constants';
import {
	getCanvasMode,
	MODE_BROWSE,
	MODE_COMPOSE,
	MODE_EDIT,
	setCanvasMode,
	useCanvasMode,
} from './mode';
import { getEditRoute, getLiveUrl, isSameLocation } from './urls';
import { usePreviewFrame } from './use-preview-frame';

const EMPTY_OBJECT = {};

const NOTHING_SHOWN = () => false;

function getContextUrl( url ) {
	const live = getLiveUrl( url );

	return live ? live.split( '#' )[ 0 ] : '';
}

/**
 * What the site says about the page the preview is on.
 *
 * @param {string} url Preview URL.
 * @return {Object} `{ isLoadingContext, previewContext, previewContextError }`.
 */
function usePreviewContext( url ) {
	const contextUrl = getContextUrl( url );

	return useSelect(
		( selectStore ) => {
			const store = selectStore( cnlEditorStore );

			return {
				isLoadingContext:
					store.isFetchingPreviewContext( contextUrl ) ||
					( Boolean( contextUrl ) &&
						! store.hasFinishedResolution( 'getPreviewContext', [
							contextUrl,
							namespace,
						] ) ),
				previewContext:
					store.getPreviewContext( contextUrl, namespace ) ||
					EMPTY_OBJECT,
				previewContextError: store.getPreviewContextError( contextUrl ),
			};
		},
		[ contextUrl ]
	);
}

function getContextEntity( context ) {
	return context?.editPostType && context?.editPostId
		? { postId: context.editPostId, postType: context.editPostType }
		: null;
}

function isSameEntity( a, b ) {
	return (
		a?.postType === b?.postType &&
		String( a?.postId ) === String( b?.postId )
	);
}

/**
 * Keep a layout the editor has open underneath Browse as it was saved.
 *
 * Opening a theme's layout, the editor brings some blocks up to date, like
 * an old text alignment, or the number of posts a list shows. That isn't a
 * change anyone made, but it would count as one: the canvas would leave
 * Browse to show it, and Review changes would list the layout. While
 * browsing, the editor is hidden and the sidebar never changes a layout's
 * content, so any change to a layout that had none is the editor's own, and
 * is undone as it is made.
 *
 * @param {?Object} editorEntity `{ postType, postId }` the editor has open.
 * @param {boolean} isPreviewing Whether the canvas is in Browse.
 */
function useIgnoreLayoutTidying( editorEntity, isPreviewing ) {
	const postId =
		editorEntity?.postType === 'wp_template' ? editorEntity.postId : null;

	useEffect( () => {
		if ( ! postId || ! isPreviewing ) {
			return undefined;
		}

		const isEdited = () =>
			select( coreDataStore ).hasEditsForEntityRecord(
				'postType',
				'wp_template',
				postId
			);

		// Changed before Browse, by someone: kept.
		if ( isEdited() ) {
			return undefined;
		}

		/*
		 * What was saved is put back, rather than every edit cleared: the
		 * editor keeps the blocks it has, which clearing would make it parse
		 * and tidy again.
		 */
		return subscribe( () => {
			if ( ! isEdited() ) {
				return;
			}

			const store = select( coreDataStore );
			const saved =
				store.getRawEntityRecord( 'postType', 'wp_template', postId ) ||
				{};
			const edits = store.getEntityRecordNonTransientEdits(
				'postType',
				'wp_template',
				postId
			);

			dispatch( coreDataStore ).editEntityRecord(
				'postType',
				'wp_template',
				postId,
				Object.fromEntries(
					Object.keys( edits ).map( ( key ) => [ key, saved[ key ] ] )
				),
				{ undoIgnore: true }
			);
		}, coreDataStore );
	}, [ isPreviewing, postId ] );
}

/**
 * @param {Object}   options
 * @param {string}   options.url              Page the preview should show. The
 *                                            preview goes there when it changes.
 * @param {?Object}  options.pinnedEntity     `{ postType, postId }` to keep
 *                                            the editor on, rather than
 *                                            following the preview. Its page
 *                                            is `url`.
 * @param {Function} options.isShownInPreview Called with an unsaved change,
 *                                            from `useChanges`, and the
 *                                            registry's `select`. Whether
 *                                            the preview shows it unsaved.
 * @return {Object} The canvas's state and actions.
 */
export function useSiteCanvas( {
	url,
	pinnedEntity = null,
	isShownInPreview = NOTHING_SHOWN,
} ) {
	const mode = useCanvasMode();
	const isPreviewing = mode === MODE_BROWSE;
	const [ device, setDevice ] = useState( DEFAULT_DEVICE );
	const [ isDialogOpen, setIsDialogOpen ] = useState( false );
	const [ isAwaitingPreview, setIsAwaitingPreview ] = useState( false );
	const [ followedEntity, setFollowedEntity ] = useState( null );
	const [ savedVersion, setSavedVersion ] = useState( 0 );
	const savedVersionRef = useRef( 0 );
	const waitRef = useRef( 0 );
	const { changes, isSaving, save, discardAll } = useChanges();
	/*
	 * Counted in a selector so that it follows a record's own edits: a page
	 * already changed is the same one change whatever else is edited on it.
	 */
	const unseenChangeCount = useSelect(
		( registrySelect ) =>
			changes.filter(
				( change ) => ! isShownInPreview( change, registrySelect )
			).length,
		[ changes, isShownInPreview ]
	);
	const isDirty = unseenChangeCount > 0;

	// Every save that finishes leaves the preview showing an older site.
	const wasSavingRef = useRef( isSaving );
	useEffect( () => {
		if ( wasSavingRef.current && ! isSaving ) {
			savedVersionRef.current += 1;
			setSavedVersion( savedVersionRef.current );
		}

		wasSavingRef.current = isSaving;
	}, [ isSaving ] );

	// Double-clicking the preview turns it off, as if asking to change it.
	const frame = usePreviewFrame( {
		getVersion: () => savedVersionRef.current,
		initialUrl: url,
		onDoubleClick: () => requestMode( MODE_EDIT ),
	} );
	const isPreviewStale = frame.loadedVersion !== savedVersion;
	const { isLoadingContext, previewContext, previewContextError } =
		usePreviewContext( frame.location || url );
	const previewEntity = getContextEntity( previewContext );

	// The preview goes wherever the canvas is pointed next.
	const lastUrlRef = useRef( url );
	useEffect( () => {
		if ( url === lastUrlRef.current ) {
			return;
		}

		lastUrlRef.current = url;

		if ( url && ! isSameLocation( url, frame.location ) ) {
			frame.navigate( url );
		}
	}, [ url, frame ] );

	/*
	 * The editor follows the page the preview is on, while it is on show.
	 * The preview loads out of sight all the same to begin with, and the
	 * editor opens its first page. A page with nothing to edit, an archive
	 * say, leaves the editor on the last page that had something.
	 */
	useEffect( () => {
		if (
			! pinnedEntity &&
			( isPreviewing || ! followedEntity ) &&
			! isLoadingContext &&
			previewEntity &&
			! isSameEntity( previewEntity, followedEntity )
		) {
			setFollowedEntity( previewEntity );
		}
	}, [
		followedEntity,
		isLoadingContext,
		pinnedEntity,
		isPreviewing,
		previewEntity,
	] );

	const editorEntity = pinnedEntity || followedEntity;

	useIgnoreLayoutTidying( editorEntity, isPreviewing );
	/*
	 * Whether the page on show can be opened in the full-screen editor.
	 * In Browse, nothing can be while the preview is on an archive, say, or
	 * a page still loading.
	 */
	const canEdit = pinnedEntity
		? true
		: ( ! isPreviewing && Boolean( editorEntity ) ) ||
			( ! isLoadingContext &&
				isSameEntity( previewEntity, followedEntity ) &&
				Boolean( previewEntity ) );

	// Compose works on the page as a whole, so it is always on a desktop.
	const editorDevice = mode === MODE_COMPOSE ? DEFAULT_DEVICE : device;

	useEffect( () => {
		dispatch( 'core/editor' )?.setDeviceType?.(
			EDITOR_DEVICES[ editorDevice ]
		);
	}, [ editorDevice, editorEntity?.postId ] );

	/*
	 * Nothing stays selected under the preview, to pop a toolbar over it, and
	 * nothing stays entered. A section being edited disables every block
	 * outside it, so left entered it would greet the editor next time with
	 * the rest of the page locked.
	 */
	useEffect( () => {
		if ( isPreviewing ) {
			dispatch( blockEditorStore ).clearSelectedBlock();
			unlock(
				dispatch( blockEditorStore )
			).stopEditingContentOnlySection();
		}
	}, [ isPreviewing ] );

	const cancelWait = useCallback( () => {
		waitRef.current += 1;
		setIsAwaitingPreview( false );
	}, [] );

	/*
	 * Show the editor, in the mode asked for, or Edit when leaving Browse
	 * without saying. Compose stays Compose unless asked otherwise.
	 */
	const showEditor = useCallback(
		( next ) => {
			cancelWait();
			setCanvasMode(
				next ||
					( getCanvasMode() === MODE_BROWSE
						? MODE_EDIT
						: getCanvasMode() )
			);
		},
		[ cancelWait ]
	);

	// Changes made while browsing that the preview can't show can only be
	// seen in the editor.
	const changeCountRef = useRef( unseenChangeCount );
	useEffect( () => {
		if (
			unseenChangeCount > changeCountRef.current &&
			isPreviewing &&
			editorEntity
		) {
			showEditor();
		}

		changeCountRef.current = unseenChangeCount;
		// Only a new change should switch, not the mode changing.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ unseenChangeCount ] );

	/**
	 * The page the editor has open, if the preview isn't already on it.
	 *
	 * @return {string} Its URL, or an empty string.
	 */
	const getEditorDestination = () => {
		let destination = '';

		if ( pinnedEntity ) {
			destination = url;
		} else if ( editorEntity?.postType === 'wp_template' ) {
			// The only template the canvas follows is the one showing the
			// latest posts on the homepage.
			destination = settings.homeUrl;
		} else if ( editorEntity ) {
			destination = select( coreDataStore ).getEditedEntityRecord(
				'postType',
				editorEntity.postType,
				editorEntity.postId
			)?.link;
		}

		return destination && ! isSameLocation( destination, frame.location )
			? destination
			: '';
	};

	/*
	 * Hold the editor until the preview has loaded, then show it. A newer
	 * request, or picking Edit or Compose again, abandons the wait.
	 */
	const showPreviewWhenLoaded = ( destination ) => {
		const wait = ( waitRef.current += 1 );

		setIsAwaitingPreview( true );
		frame.reloadAndWait( destination || undefined ).then( () => {
			if ( waitRef.current !== wait ) {
				return;
			}

			setIsAwaitingPreview( false );
			setCanvasMode( MODE_BROWSE );
		} );
	};

	const showPreview = () => {
		// Asked again while waiting: show it now.
		if ( isAwaitingPreview ) {
			cancelWait();
			setCanvasMode( MODE_BROWSE );
			return;
		}

		const destination = getEditorDestination();

		if ( destination || isPreviewStale ) {
			showPreviewWhenLoaded( destination );
		} else {
			setCanvasMode( MODE_BROWSE );
		}
	};

	/**
	 * Move to a mode, asking about unsaved changes first on the way to
	 * Browse.
	 *
	 * @param {string} next `MODE_BROWSE`, `MODE_EDIT` or `MODE_COMPOSE`.
	 */
	const requestMode = ( next ) => {
		if ( next !== MODE_BROWSE ) {
			if ( editorEntity ) {
				showEditor( next );
			}

			return;
		}

		if ( isPreviewing ) {
			return;
		}

		if ( isDirty ) {
			setIsDialogOpen( true );
			return;
		}

		showPreview();
	};

	const saveAndShowPreview = async () => {
		await save();

		// Core reports a failed save in a snackbar and leaves the changes in
		// place. Stay in the editor with them.
		if (
			select( coreDataStore ).__experimentalGetDirtyEntityRecords().length
		) {
			setIsDialogOpen( false );
			return;
		}

		setIsDialogOpen( false );
		showPreviewWhenLoaded( getEditorDestination() );
	};

	const discardAndShowPreview = () => {
		const destination = getEditorDestination();

		discardAll();
		setIsDialogOpen( false );
		cancelWait();

		if ( destination ) {
			frame.navigate( destination );
		} else if ( isPreviewStale ) {
			frame.reload();
		}

		setCanvasMode( MODE_BROWSE );
	};

	const editRoute = canEdit ? getEditRoute( editorEntity ) : null;

	return {
		canEdit,
		device,
		dialog: {
			isOpen: isDialogOpen,
			isSaving,
			onCancel: () => setIsDialogOpen( false ),
			onDiscard: discardAndShowPreview,
			onSave: saveAndShowPreview,
		},
		editorEntity,
		editRoute,
		frame,
		editorDevice,
		isAwaitingPreview,
		isComposing: mode === MODE_COMPOSE,
		isLoadingContext,
		isPreviewing,
		liveUrl: getLiveUrl( frame.location ) || url,
		mode,
		previewContext,
		previewContextError,
		previewEntity,
		requestMode,
		setDevice,
		showEditor,
	};
}
