/**
 * Internal dependencies
 */
import { useEffect, useState } from '../wordpress-packages';

/**
 * Find the editor's canvas document once it is ready, and again whenever the
 * editor swaps its iframe out, as it does when the device changes.
 *
 * @param {Object} containerRef Ref to the element the editor renders in.
 * @param {*}      resetKey     Changes when the editor is remounted.
 * @return {Document|null} The canvas document.
 */
export function useCanvasDocument( containerRef, resetKey ) {
	const [ canvasDocument, setCanvasDocument ] = useState( null );

	useEffect( () => {
		let current = null;
		const check = () => {
			const iframe = containerRef.current?.querySelector(
				'iframe[name="editor-canvas"]'
			);
			const doc = iframe?.contentDocument;
			const next =
				doc?.readyState === 'complete' &&
				doc.body?.querySelector( '.is-root-container' )
					? doc
					: null;

			if ( next !== current ) {
				current = next;
				setCanvasDocument( next );
			}
		};
		const interval = window.setInterval( check, 300 );

		check();

		return () => window.clearInterval( interval );
	}, [ containerRef, resetKey ] );

	return canvasDocument;
}
