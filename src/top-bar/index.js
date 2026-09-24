/**
 * Top bar: the strip of boot's dark frame above the stage and canvas.
 *
 * It holds the command search in the middle and the save controls on the
 * right. The full-screen editor has a header of its own, so the bar is
 * hidden there, and on narrow screens, where the stage fills the viewport
 * and boot's sidebar save button is kept.
 */

/**
 * WordPress dependencies
 */
import { createElement as el, createRoot } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { CommandSearch } from './command-search';
import { SaveControls } from './save-controls';

function TopBar() {
	return el(
		'div',
		{ className: 'cnl-top-bar' },
		el( 'div', { className: 'cnl-top-bar__center' }, el( CommandSearch ) ),
		el( 'div', { className: 'cnl-top-bar__end' }, el( SaveControls ) )
	);
}

/**
 * Add the top bar to boot's layout.
 *
 * Boot has no slot above its surfaces, so the bar is appended to boot's
 * layout element, which covers the whole screen, and positioned in the margin
 * `style.scss` opens above the surfaces. Spanning the screen rather than the
 * surfaces is what lets the search sit in the middle of the screen. The
 * layout can remount, so the bar is put back whenever it goes missing.
 */
export function mountTopBar() {
	const container = document.createElement( 'div' );
	container.className = 'cnl-top-bar-host';
	createRoot( container ).render( el( TopBar ) );

	let isScheduled = false;
	const place = () => {
		isScheduled = false;

		const layout = document.querySelector(
			'#create-not-learn-editor-app [class*="__layout"]:has(> [class*="__surfaces"])'
		);

		if ( layout && container.parentElement !== layout ) {
			layout.append( container );
		}
	};

	new window.MutationObserver( () => {
		if ( ! isScheduled ) {
			isScheduled = true;
			window.requestAnimationFrame( place );
		}
	} ).observe( document.body, { childList: true, subtree: true } );

	place();
}
