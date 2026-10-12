/**
 * The site canvas's own icons, for modes `@wordpress/icons` has nothing for.
 * Drawn on the same 24px grid.
 */

/**
 * Internal dependencies
 */
import { el } from '../wordpress-packages';

const SVG_PROPS = {
	viewBox: '0 0 24 24',
	xmlns: 'http://www.w3.org/2000/svg',
};

// Browse: a mouse pointer, for clicking around the site as visitors do.
// An outline: unfilled on the path itself, as buttons fill their icons.
export const browseIcon = el(
	'svg',
	SVG_PROPS,
	el( 'path', {
		d: 'M6.5 4.5v13.4l3.4-3.1 2.4 5.4 2-.9-2.4-5.3h4.6z',
		fill: 'none',
		stroke: 'currentColor',
		strokeLinejoin: 'round',
		strokeWidth: 1.5,
	} )
);

// Compose: a page built from stacked sections, one of them picked.
export const composeIcon = el(
	'svg',
	{ ...SVG_PROPS, fill: 'currentColor' },
	el( 'path', {
		clipRule: 'evenodd',
		d: 'M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2zm0 1.5a.5.5 0 00-.5.5v3h13V6a.5.5 0 00-.5-.5H6zm12.5 5h-13v3h13v-3zm0 4.5h-13v3a.5.5 0 00.5.5h12a.5.5 0 00.5-.5v-3z',
		fillRule: 'evenodd',
	} ),
	el( 'path', { d: 'M5.5 10.5h13v3h-13z' } )
);
