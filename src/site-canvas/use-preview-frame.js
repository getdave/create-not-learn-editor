/**
 * The preview: the saved site in a same-origin iframe, and what it is doing.
 *
 * Mirrors Big Sky's Easy Mode preview overlay. The frame is loaded once and
 * then moved by setting its `src`, never by re-rendering it, so it keeps its
 * page, scroll position and history while the canvas shows Edit.
 */

/**
 * Internal dependencies
 */
import {
	useCallback,
	useEffect,
	useRef,
	useState,
} from '../wordpress-packages';
import { PREVIEW_WAIT_TIMEOUT_MS } from './constants';
import { getPreviewFrameUrl, isPreviewFrameUrl } from './urls';

const INITIAL_HISTORY = {
	currentUrl: '',
	maxPosition: 0,
	pendingDirection: null,
	position: 0,
};

function getFrameUrl( frameWindow ) {
	try {
		return frameWindow?.location?.href || '';
	} catch {
		// The preview left the site, so its address can't be read.
		return '';
	}
}

/**
 * @param {Object}   options
 * @param {string}   options.initialUrl Page to show first.
 * @param {Function} options.getVersion Returns the saved site's version.
 * @return {Object} Props for the iframe, what it shows, and ways to move it.
 */
export function usePreviewFrame( { initialUrl, getVersion } ) {
	const iframeRef = useRef();
	const historyRef = useRef( { ...INITIAL_HISTORY } );
	const waitersRef = useRef( new Set() );
	/*
	 * Held in state rather than derived from `initialUrl`. Deriving it would
	 * hand the iframe a new `src` whenever the page it was opened on changed,
	 * loading every page twice. Set again only to open the frame, when there
	 * was nothing to show at first.
	 */
	const [ src, setSrc ] = useState( () => getPreviewFrameUrl( initialUrl ) );
	const [ location, setLocation ] = useState( '' );
	// The page on show, once it has loaded, for listening to it.
	const [ frameDocument, setFrameDocument ] = useState( null );
	const [ isLoading, setIsLoadingState ] = useState( Boolean( src ) );
	// The same, as soon as it changes, for work put off until it has loaded.
	const isLoadingRef = useRef( isLoading );
	const [ loadedVersion, setLoadedVersion ] = useState( 0 );
	const [ history, setHistory ] = useState( {
		canGoBack: false,
		canGoForward: false,
	} );

	const setIsLoading = useCallback( ( value ) => {
		isLoadingRef.current = value;
		setIsLoadingState( value );
	}, [] );

	useEffect(
		() => () => {
			waitersRef.current.forEach( ( resolve ) => resolve( false ) );
			waitersRef.current.clear();
		},
		[]
	);

	const syncHistory = ( url ) => {
		const state = historyRef.current;

		if ( ! state.currentUrl ) {
			state.currentUrl = url;
		} else if ( url && url !== state.currentUrl ) {
			if ( state.pendingDirection === 'back' ) {
				state.position = Math.max( 0, state.position - 1 );
			} else if ( state.pendingDirection === 'forward' ) {
				state.position = Math.min(
					state.maxPosition,
					state.position + 1
				);
			} else {
				state.position += 1;
				state.maxPosition = state.position;
			}

			state.currentUrl = url;
		}

		state.pendingDirection = null;
		setHistory( {
			canGoBack: state.position > 0,
			canGoForward: state.position < state.maxPosition,
		} );
	};

	const onLoad = ( event ) => {
		const iframe = event.currentTarget;
		const frameWindow = iframe.contentWindow;
		const url = getFrameUrl( frameWindow );

		// Something on the page got past the preview's own links. Bring it
		// back as a preview, so the admin chrome stays hidden.
		if ( url && ! isPreviewFrameUrl( url ) ) {
			const previewUrl = getPreviewFrameUrl( url );

			if ( previewUrl ) {
				iframe.src = previewUrl;
				return;
			}
		}

		try {
			// The window is replaced with each page, so this is re-attached
			// on every load.
			frameWindow.addEventListener( 'pagehide', () => {
				setIsLoading( true );
				setFrameDocument( null );
			} );
			setFrameDocument( frameWindow.document );
		} catch {
			// Not the site's own page, so it can't be listened to.
			setFrameDocument( null );
		}

		setIsLoading( false );
		setLoadedVersion( getVersion() );
		syncHistory( url );
		setLocation( url );
		waitersRef.current.forEach( ( resolve ) => resolve( true ) );
		waitersRef.current.clear();
	};

	/**
	 * Show a page.
	 *
	 * @param {string} url Page URL.
	 * @return {boolean} Whether the preview can show it.
	 */
	const navigate = useCallback(
		( url ) => {
			const previewUrl = getPreviewFrameUrl( url );

			if ( ! previewUrl ) {
				return false;
			}

			setIsLoading( true );

			if ( iframeRef.current ) {
				iframeRef.current.src = previewUrl;
			} else {
				setSrc( previewUrl );
			}

			return true;
		},
		[ setIsLoading ]
	);

	/**
	 * Load the page on show again, to pick up what has been saved since.
	 *
	 * @return {boolean} Whether a reload started.
	 */
	const reload = useCallback( () => {
		const iframe = iframeRef.current;

		if ( ! iframe ) {
			return false;
		}

		setIsLoading( true );

		try {
			iframe.contentWindow.location.reload();
		} catch {
			// Not the site's own page any more, so start it over.

			iframe.src = iframe.src;
		}

		return true;
	}, [ setIsLoading ] );

	/**
	 * Show a page, or reload the one on show, and wait for it.
	 *
	 * @param {string} [url] Page URL. Reloads the page on show without one.
	 * @return {Promise<boolean>} Whether it loaded in time.
	 */
	const reloadAndWait = useCallback(
		( url ) =>
			new Promise( ( resolve ) => {
				const finish = ( hasLoaded ) => {
					waitersRef.current.delete( done );
					resolve( hasLoaded );
				};
				const timeout = window.setTimeout(
					() => finish( false ),
					PREVIEW_WAIT_TIMEOUT_MS
				);
				const done = ( hasLoaded ) => {
					window.clearTimeout( timeout );
					finish( hasLoaded );
				};

				// Listening before anything starts, so a fast load isn't missed.
				waitersRef.current.add( done );

				if ( ! ( url ? navigate( url ) : reload() ) ) {
					done( false );
				}
			} ),
		[ navigate, reload ]
	);

	const move = ( direction ) => {
		const frameWindow = iframeRef.current?.contentWindow;
		const canMove =
			direction === 'back' ? history.canGoBack : history.canGoForward;

		if ( ! frameWindow || ! canMove ) {
			return;
		}

		try {
			historyRef.current.pendingDirection = direction;

			if ( direction === 'back' ) {
				frameWindow.history.back();
			} else {
				frameWindow.history.forward();
			}
		} catch {
			historyRef.current.pendingDirection = null;
		}
	};

	return {
		frameDocument,
		frameProps: { onLoad, ref: iframeRef, src: src || undefined },
		history,
		isLoading,
		isLoadingNow: () => isLoadingRef.current,
		loadedVersion,
		location,
		move,
		navigate,
		reload,
		reloadAndWait,
	};
}
