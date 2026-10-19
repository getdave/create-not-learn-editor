/**
 * A page with its top and bottom filled in, for the header and footer
 * together, drawn like core's Header and Footer icons. Core has none for
 * both.
 */
const sitePartsIcon = (
	<svg
		// Inline, as core's icons do, so styles filling icons leave it be.
		style={ { fill: 'none' } }
		stroke="currentColor"
		strokeWidth="1.5"
		viewBox="0 0 24 24"
		xmlns="http://www.w3.org/2000/svg"
	>
		<rect
			height="14.5"
			rx="1.25"
			vectorEffect="non-scaling-stroke"
			width="14.5"
			x="4.75"
			y="4.75"
		/>
		<rect
			style={ { fill: 'currentColor' } }
			height="3.75"
			rx="1.25"
			vectorEffect="non-scaling-stroke"
			width="14.5"
			x="4.75"
			y="4.75"
		/>
		<rect
			style={ { fill: 'currentColor' } }
			height="3.75"
			rx="1.25"
			vectorEffect="non-scaling-stroke"
			width="14.5"
			x="4.75"
			y="15.5"
		/>
	</svg>
);

export default sitePartsIcon;
