/**
 * Internal dependencies
 */
import { useEffect, useRef, useState } from '../../wordpress-packages';

export function prefersReducedMotion() {
	return Boolean(
		window.matchMedia?.( '(prefers-reduced-motion: reduce)' ).matches
	);
}

export function useElementSize( ref ) {
	const [ size, setSize ] = useState( { height: 0, width: 0 } );

	useEffect( () => {
		const element = ref.current;

		if ( ! element ) {
			return;
		}

		const update = () =>
			setSize( ( current ) =>
				current.width === element.clientWidth &&
				current.height === element.clientHeight
					? current
					: {
							height: element.clientHeight,
							width: element.clientWidth,
						}
			);

		update();

		if ( ! window.ResizeObserver ) {
			return;
		}

		const observer = new window.ResizeObserver( update );
		observer.observe( element );

		return () => observer.disconnect();
	}, [ ref ] );

	return size;
}

/**
 * Whether an element has come near the screen yet. Stays true once it has,
 * so a thumbnail is loaded once and kept.
 *
 * @param {Object} ref     Element.
 * @param {Object} rootRef Scrolling ancestor to watch within.
 * @return {boolean} Whether it has been near the screen.
 */
export function useHasBeenVisible( ref, rootRef ) {
	const [ hasBeenVisible, setHasBeenVisible ] = useState( false );

	useEffect( () => {
		if ( hasBeenVisible || ! ref.current ) {
			return;
		}

		if ( ! window.IntersectionObserver ) {
			setHasBeenVisible( true );
			return;
		}

		const observer = new window.IntersectionObserver(
			( entries ) => {
				if ( entries.some( ( entry ) => entry.isIntersecting ) ) {
					setHasBeenVisible( true );
				}
			},
			{ root: rootRef.current, rootMargin: '200px' }
		);
		observer.observe( ref.current );

		return () => observer.disconnect();
	}, [ hasBeenVisible, ref, rootRef ] );

	return hasBeenVisible;
}

/*
 * How many thumbnails load at once. Each is the whole front end of a page,
 * and the canvas opens fitted to the whole site, so without a limit every
 * page on it would load in the same moment.
 */
const MAX_LOADING_THUMBNAILS = 4;
// A thumbnail that never says it has loaded gives its turn up after this.
const THUMBNAIL_LOAD_TIMEOUT = 15000;
let loadingThumbnails = 0;
const waitingThumbnails = [];

function startNextThumbnail() {
	while (
		loadingThumbnails < MAX_LOADING_THUMBNAILS &&
		waitingThumbnails.length
	) {
		loadingThumbnails++;
		waitingThumbnails.shift()();
	}
}

function releaseThumbnailTurn( turn ) {
	window.clearTimeout( turn.timer );

	if ( turn.isGranted && ! turn.isReleased ) {
		turn.isReleased = true;
		loadingThumbnails--;
		startNextThumbnail();
	}
}

/**
 * Whether a thumbnail may start loading: thumbnails take turns, a few at a
 * time, in the order they ask. Once it may, it keeps its picture.
 *
 * @param {boolean} isWanted Whether the thumbnail wants to load.
 * @param {boolean} isLoaded Whether it has finished loading.
 * @return {boolean} Whether to load it.
 */
export function useThumbnailTurn( isWanted, isLoaded ) {
	const [ hasTurn, setHasTurn ] = useState( false );
	// Given up once loaded, gone, or taking too long, and only once.
	const turnRef = useRef( { isGranted: false, isReleased: false } );

	useEffect( () => {
		if ( ! isWanted || hasTurn ) {
			return undefined;
		}

		const turn = turnRef.current;
		const start = () => {
			turn.isGranted = true;
			turn.timer = window.setTimeout(
				() => releaseThumbnailTurn( turn ),
				THUMBNAIL_LOAD_TIMEOUT
			);
			setHasTurn( true );
		};

		waitingThumbnails.push( start );
		startNextThumbnail();

		return () => {
			const index = waitingThumbnails.indexOf( start );

			if ( index !== -1 ) {
				waitingThumbnails.splice( index, 1 );
			}
		};
	}, [ hasTurn, isWanted ] );

	useEffect( () => {
		if ( isLoaded ) {
			releaseThumbnailTurn( turnRef.current );
		}
	}, [ isLoaded ] );

	useEffect( () => () => releaseThumbnailTurn( turnRef.current ), [] );

	return hasTurn;
}
