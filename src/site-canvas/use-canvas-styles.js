/**
 * Internal dependencies
 */
import { useEffect } from '../wordpress-packages';
import { getCanvasFrame } from './compose/use-block-rects';

/**
 * Keep styles in the editor's canvas while they are wanted. The editor swaps
 * its iframe out now and then, so they are checked for and put back.
 *
 * @param {boolean} isActive  Whether to keep the styles in.
 * @param {Object}  editorRef Ref to the editor's container.
 * @param {string}  id        The style element's ID, one per caller.
 * @param {string}  css       The styles.
 */
export function useCanvasStyles( isActive, editorRef, id, css ) {
	useEffect( () => {
		if ( ! isActive ) {
			return undefined;
		}

		let current = null;
		const apply = () => {
			const doc = getCanvasFrame( editorRef.current )?.contentDocument;

			if ( ! doc?.head ) {
				return;
			}

			let style = doc.getElementById( id );

			if ( ! style ) {
				style = doc.createElement( 'style' );
				style.id = id;
				doc.head.appendChild( style );
			}

			if ( style.textContent !== css ) {
				style.textContent = css;
			}

			current = style;
		};
		const interval = window.setInterval( apply, 300 );

		apply();

		return () => {
			window.clearInterval( interval );
			current?.remove();
		};
	}, [ css, editorRef, id, isActive ] );
}
