/**
 * Internal dependencies
 */
import { useEffect, useState } from '../../wordpress-packages';

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
