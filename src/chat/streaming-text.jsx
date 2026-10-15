/**
 * A reply appearing a few words at a time, as a model's would.
 */

/**
 * WordPress dependencies
 */
import { useEffect, useState } from '@wordpress/element';

// How often another word appears.
const WORD_MS = 28;

function prefersReducedMotion() {
	return !! window.matchMedia?.( '(prefers-reduced-motion: reduce)' )
		?.matches;
}

/**
 * @param {Object}   props             Component props.
 * @param {string}   props.text        The reply.
 * @param {boolean}  props.isStreaming Whether it is still appearing.
 * @param {Function} props.onDone      Called once it has all appeared.
 * @return {Element} The text so far.
 */
export function StreamingText( { text = '', isStreaming, onDone } ) {
	const words = text.split( /(\s+)/ );
	const [ shown, setShown ] = useState( isStreaming ? 0 : words.length );

	useEffect( () => {
		if ( ! isStreaming ) {
			return undefined;
		}

		if ( prefersReducedMotion() ) {
			onDone();
			return undefined;
		}

		/*
		 * Paced by the time since it started rather than by counting ticks,
		 * so a reply catches up when the browser slows timers down, as it
		 * does in a background tab.
		 */
		const start = Date.now();
		const timer = window.setInterval( () => {
			// Words and the spaces between them alternate.
			const count = Math.floor( ( Date.now() - start ) / WORD_MS ) * 2;
			setShown( count );

			if ( count >= words.length ) {
				window.clearInterval( timer );
				onDone();
			}
		}, WORD_MS );

		return () => window.clearInterval( timer );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ isStreaming, text ] );

	const isComplete = ! isStreaming || shown >= words.length;

	return (
		<span className="cnl-chat-message__text">
			{ isComplete ? text : words.slice( 0, shown ).join( '' ) }
			{ ! isComplete && (
				<span aria-hidden className="cnl-chat-message__cursor" />
			) }
		</span>
	);
}
