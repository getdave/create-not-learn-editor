/**
 * The site canvas's own icons, for a page made of sections and for zooming
 * out, which `@wordpress/icons` has nothing for. Drawn on the same 24px grid.
 */

/**
 * Internal dependencies
 */
const SVG_PROPS = {
	viewBox: '0 0 24 24',
	xmlns: 'http://www.w3.org/2000/svg',
};

// A page built from stacked sections, one of them picked.
export const sectionsIcon = (
	<svg { ...SVG_PROPS } fill="currentColor">
		<path
			clipRule="evenodd"
			d="M6 4h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2zm0 1.5a.5.5 0 00-.5.5v3h13V6a.5.5 0 00-.5-.5H6zm12.5 5h-13v3h13v-3zm0 4.5h-13v3a.5.5 0 00.5.5h12a.5.5 0 00.5-.5v-3z"
			fillRule="evenodd"
		/>
		<path d="M5.5 10.5h13v3h-13z" />
	</svg>
);

// Zoom out: core's search magnifier, drawn the same way, with a minus in it.
// No fill is set inline, as core's is, as buttons fill their icons.
export const zoomOutIcon = (
	<svg
		{ ...SVG_PROPS }
		stroke="currentColor"
		strokeWidth="1.5"
		style={ { fill: 'none' } }
	>
		<path
			d="M5 19L9.28769 14.7123M18.25 11C18.25 13.8995 15.8995 16.25 13 16.25C10.1005 16.25 7.75 13.8995 7.75 11C7.75 8.10051 10.1005 5.75 13 5.75C15.8995 5.75 18.25 8.10051 18.25 11Z"
			vectorEffect="non-scaling-stroke"
		/>
		<path d="M10.5 11h5" vectorEffect="non-scaling-stroke" />
	</svg>
);

// Zoom in: the same magnifier, with a plus in it instead of a minus.
export const zoomInIcon = (
	<svg
		{ ...SVG_PROPS }
		stroke="currentColor"
		strokeWidth="1.5"
		style={ { fill: 'none' } }
	>
		<path
			d="M5 19L9.28769 14.7123M18.25 11C18.25 13.8995 15.8995 16.25 13 16.25C10.1005 16.25 7.75 13.8995 7.75 11C7.75 8.10051 10.1005 5.75 13 5.75C15.8995 5.75 18.25 8.10051 18.25 11Z"
			vectorEffect="non-scaling-stroke"
		/>
		<path d="M10.5 11h5M13 8.5v5" vectorEffect="non-scaling-stroke" />
	</svg>
);
