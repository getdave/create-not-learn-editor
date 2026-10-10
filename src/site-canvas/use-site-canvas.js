/**
 * A site canvas's state: which surface is on show, what the preview shows,
 * what the editor underneath it has open, and the rules for moving between
 * them.
 *
 * The model is Big Sky's Easy Mode. Preview is the saved site in an iframe,
 * laid over the editor; Edit is the editor. Both stay mounted, and the editor
 * quietly follows the page the preview is on, so going to Edit is instant.
 * Because the preview only shows what is saved:
 *
 * - Going back to Preview with unsaved changes asks to save or discard them.
 * - Going back to Preview after saving, or from a page the preview isn't on,
 *   holds Edit until the preview has loaded the page, so it never shows an
 *   out-of-date page.
 * - Changes made while previewing, from the sidebar, switch to Edit, the
 *   surface that can show them.
 */

/**
 * Internal dependencies
 */
import { cnlEditorStore } from '../records';
import { namespace, settings } from '../settings';
import { useChanges } from '../top-bar/use-changes';
import {
	blockEditorStore,
	coreDataStore,
	dispatch,
	flushSync,
	select,
	useCallback,
	useEffect,
	useRef,
	useSelect,
	useState,
} from '../wordpress-packages';
import {
	DEFAULT_DEVICE,
	EDITOR_DEVICES,
	SURFACE_EDIT,
	SURFACE_PREVIEW,
} from './constants';
import { getEditRoute, getLiveUrl, isSameLocation } from './urls';
import { usePreviewFrame } from './use-preview-frame';

const EMPTY_OBJECT = {};

// Where Edit takes over the stage, and the switch can be animated.
const ANIMATED_SURFACES_QUERY =
	'(min-width: 782px) and (prefers-reduced-motion: no-preference)';

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
 * @param {Object}  options
 * @param {string}  options.url          Page the preview should show. The
 *                                       preview goes there when it changes.
 * @param {?Object} options.pinnedEntity `{ postType, postId }` to keep the
 *                                       editor on, rather than following the
 *                                       preview. Its page is `url`.
 * @return {Object} The canvas's state and actions.
 */
export function useSiteCanvas( { url, pinnedEntity = null } ) {
	/*
	 * `isTakingOver` is Edit taking over the stage as well as the canvas. Only
	 * asking for Edit does that: Edit brought on from the stage, to mark a
	 * section there, say, leaves the stage in place to carry on with.
	 */
	const [ layout, setLayout ] = useState( {
		isTakingOver: false,
		surface: SURFACE_PREVIEW,
	} );
	const layoutRef = useRef( layout );
	const { surface } = layout;
	const [ device, setDevice ] = useState( DEFAULT_DEVICE );
	const [ isDialogOpen, setIsDialogOpen ] = useState( false );
	const [ isAwaitingPreview, setIsAwaitingPreview ] = useState( false );
	const [ followedEntity, setFollowedEntity ] = useState( null );
	const [ savedVersion, setSavedVersion ] = useState( 0 );
	const savedVersionRef = useRef( 0 );
	const waitRef = useRef( 0 );
	const { changes, isSaving, save, discardAll } = useChanges();
	const isDirty = changes.length > 0;

	// Every save that finishes leaves the preview showing an older site.
	const wasSavingRef = useRef( isSaving );
	useEffect( () => {
		if ( wasSavingRef.current && ! isSaving ) {
			savedVersionRef.current += 1;
			setSavedVersion( savedVersionRef.current );
		}

		wasSavingRef.current = isSaving;
	}, [ isSaving ] );

	// Double-clicking the preview goes to Edit, as if asking to change it.
	const frame = usePreviewFrame( {
		getVersion: () => savedVersionRef.current,
		initialUrl: url,
		onDoubleClick: () => requestSurface( SURFACE_EDIT ),
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

	// The editor follows the page the preview is on, while it is on show.
	useEffect( () => {
		if (
			! pinnedEntity &&
			surface === SURFACE_PREVIEW &&
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
		previewEntity,
		surface,
	] );

	const editorEntity = pinnedEntity || followedEntity;
	// Nothing on show to edit: an archive, say, or a page still loading.
	const canEdit = pinnedEntity
		? true
		: surface === SURFACE_EDIT ||
			( ! isLoadingContext &&
				isSameEntity( previewEntity, followedEntity ) &&
				Boolean( previewEntity ) );

	useEffect( () => {
		dispatch( 'core/editor' )?.setDeviceType?.( EDITOR_DEVICES[ device ] );
	}, [ device, editorEntity?.postId ] );

	// Nothing stays selected under the preview, to pop a toolbar over it.
	useEffect( () => {
		if ( surface === SURFACE_PREVIEW ) {
			dispatch( blockEditorStore ).clearSelectedBlock();
		}
	}, [ surface ] );

	/*
	 * Taking over the stage runs as a view transition, so boot's own surface
	 * animations play: the stage zooms away as the canvas grows into its
	 * room, and back again.
	 */
	const changeSurface = useCallback( ( next, { takeOver = false } = {} ) => {
		const current = layoutRef.current;
		const nextLayout = {
			// Once taken over, the stage stays hidden until Preview.
			isTakingOver:
				next === SURFACE_EDIT && ( takeOver || current.isTakingOver ),
			surface: next,
		};

		if (
			nextLayout.surface === current.surface &&
			nextLayout.isTakingOver === current.isTakingOver
		) {
			return;
		}

		layoutRef.current = nextLayout;

		if (
			nextLayout.isTakingOver === current.isTakingOver ||
			! document.startViewTransition ||
			! window.matchMedia( ANIMATED_SURFACES_QUERY ).matches
		) {
			setLayout( nextLayout );
			return;
		}

		document.startViewTransition( () =>
			flushSync( () => setLayout( nextLayout ) )
		);
	}, [] );

	const cancelWait = useCallback( () => {
		waitRef.current += 1;
		setIsAwaitingPreview( false );
	}, [] );

	const showEdit = useCallback(
		( options ) => {
			cancelWait();
			changeSurface( SURFACE_EDIT, options );
		},
		[ cancelWait, changeSurface ]
	);

	// Changes made while previewing can only be seen in Edit.
	const changeCountRef = useRef( changes.length );
	useEffect( () => {
		if (
			changes.length > changeCountRef.current &&
			surface === SURFACE_PREVIEW &&
			editorEntity
		) {
			showEdit();
		}

		changeCountRef.current = changes.length;
		// Only a new change should switch, not the surface changing.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ changes.length ] );

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
	 * Hold Edit until the preview has loaded, then show it. A newer request,
	 * or going back to Edit, abandons the wait.
	 */
	const showPreviewWhenLoaded = ( destination ) => {
		const wait = ( waitRef.current += 1 );

		setIsAwaitingPreview( true );
		frame.reloadAndWait( destination || undefined ).then( () => {
			if ( waitRef.current !== wait ) {
				return;
			}

			setIsAwaitingPreview( false );
			changeSurface( SURFACE_PREVIEW );
		} );
	};

	const showPreview = () => {
		// Asked again while waiting: show it now.
		if ( isAwaitingPreview ) {
			cancelWait();
			changeSurface( SURFACE_PREVIEW );
			return;
		}

		const destination = getEditorDestination();

		if ( destination || isPreviewStale ) {
			showPreviewWhenLoaded( destination );
		} else {
			changeSurface( SURFACE_PREVIEW );
		}
	};

	const requestSurface = ( next ) => {
		if ( next === SURFACE_EDIT ) {
			if ( canEdit ) {
				showEdit( { takeOver: true } );
			}

			return;
		}

		if ( surface === SURFACE_PREVIEW ) {
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
		// place. Stay in Edit with them.
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

		changeSurface( SURFACE_PREVIEW );
	};

	const editRoute = getEditRoute( editorEntity );

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
		isAwaitingPreview,
		isEditing: surface === SURFACE_EDIT,
		isTakingOver: layout.isTakingOver,
		isLoadingContext,
		liveUrl: getLiveUrl( frame.location ) || url,
		previewContext,
		previewContextError,
		previewEntity,
		requestSurface,
		setDevice,
		showEdit,
		surface,
	};
}
