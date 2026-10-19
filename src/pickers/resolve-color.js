/**
 * Turn a theme.json color reference into a CSS color for swatches.
 *
 * @param {string}   value   A color, `var:preset|color|slug`, or CSS variable.
 * @param {Object[]} palette Palette to look the slug up in.
 * @return {string|undefined} A CSS color.
 */
export function resolveColor( value, palette ) {
	if ( typeof value !== 'string' ) {
		return undefined;
	}

	const slug =
		value.match( /^var:preset\|color\|(.+)$/ )?.[ 1 ] ||
		value.match( /^var\(--wp--preset--color--([^)]+)\)$/ )?.[ 1 ];

	if ( ! slug ) {
		return value;
	}

	return palette.find( ( color ) => color.slug === slug )?.color;
}
