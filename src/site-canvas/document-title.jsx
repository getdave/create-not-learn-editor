/**
 * Internal dependencies
 */
import { Tooltip, useEffect, useRef, useState } from '../wordpress-packages';

/**
 * Whether an element's text is cut short by its ellipsis. Checked again
 * whenever the element changes size, as the toolbar narrows with the window.
 *
 * @param {Object} ref  Ref to the element.
 * @param {string} text The text it shows, to check again when it changes.
 * @return {boolean} Whether the text is clipped.
 */
function useIsClipped( ref, text ) {
	const [ isClipped, setIsClipped ] = useState( false );

	useEffect( () => {
		const element = ref.current;

		if ( ! element ) {
			return;
		}

		const check = () =>
			setIsClipped( element.scrollWidth > element.clientWidth );
		const observer = new window.ResizeObserver( check );

		check();
		observer.observe( element );

		return () => observer.disconnect();
	}, [ ref, text ] );

	return isClipped;
}

/**
 * The name of what the canvas shows, in the middle of its toolbar. A long
 * name ends in an ellipsis, and then shows in full in a tooltip on hover or
 * focus.
 *
 * @param {Object}  props       Component props.
 * @param {string}  props.title The name.
 * @param {?string} props.hint  More to show in the tooltip, like the page's
 *                              address, whether or not the name is clipped.
 * @return {Element} The title.
 */
export function DocumentTitle( { title, hint = '' } ) {
	const ref = useRef();
	const isClipped = useIsClipped( ref, title );
	const hasTooltip = isClipped || Boolean( hint );

	return (
		<Tooltip.Root disabled={ ! hasTooltip }>
			<Tooltip.Trigger
				className="cnl-editor-homepage-document__title"
				ref={ ref }
				render={ <h1 /> }
				// Focusable while there is more to read than shows.
				tabIndex={ hasTooltip ? 0 : undefined }
			>
				{ title }
			</Tooltip.Trigger>
			<Tooltip.Popup>
				{ isClipped && <span>{ title }</span> }
				{ isClipped && hint && <br /> }
				{ hint }
			</Tooltip.Popup>
		</Tooltip.Root>
	);
}
