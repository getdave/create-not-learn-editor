/**
 * Which blocks offer font sizes in their toolbar, and the attributes a choice
 * writes. Kept apart from `font-size-toolbar.js` so it can be tested without
 * the block editor.
 */

/**
 * The blocks whose toolbar offers font sizes: those made of text.
 *
 * Named rather than found by their support for font sizes, which containers
 * such as Group, and blocks such as Navigation and Calendar, share.
 */
export const TEXT_BLOCKS = new Set( [
	'core/button',
	'core/code',
	'core/details',
	'core/heading',
	'core/list',
	'core/list-item',
	'core/paragraph',
	'core/post-excerpt',
	'core/post-title',
	'core/preformatted',
	'core/pullquote',
	'core/quote',
	'core/site-tagline',
	'core/site-title',
	'core/verse',
] );

const PRESET_PREFIX = 'var:preset|font-size|';

/**
 * The preset size a block is set to, if any.
 *
 * A preset is usually stored as a slug in `fontSize`, but can also arrive as a
 * preset reference or a matching value in `style.typography.fontSize`.
 *
 * @param {Array}  fontSizes  The preset font sizes.
 * @param {Object} attributes Block attributes.
 * @return {?string} The preset's slug, or null for the default or a custom size.
 */
export function getActiveFontSizeSlug( fontSizes, attributes ) {
	if ( attributes?.fontSize ) {
		return attributes.fontSize;
	}

	const value = attributes?.style?.typography?.fontSize;

	if ( typeof value === 'string' && value.startsWith( PRESET_PREFIX ) ) {
		return value.slice( PRESET_PREFIX.length );
	}

	if ( ! value ) {
		return null;
	}

	return fontSizes?.find( ( { size } ) => size === value )?.slug ?? null;
}

/**
 * The attributes that set a block to a preset size, or back to its default.
 *
 * Any custom size is cleared along the way, as core's own control does.
 *
 * @param {Object}  attributes Block attributes.
 * @param {?string} slug       The preset's slug, or null for the default.
 * @return {Object} Attributes to set.
 */
export function getFontSizeAttributes( attributes, slug ) {
	const { fontSize: customSize, ...typographyStyle } =
		attributes?.style?.typography ?? {};
	const style = { ...attributes?.style, typography: typographyStyle };

	if ( ! Object.keys( typographyStyle ).length ) {
		delete style.typography;
	}

	return {
		fontSize: slug ?? undefined,
		style: Object.keys( style ).length ? style : undefined,
	};
}

const SIMPLE_CSS_VALUE = /^[\d.]+[a-z%]*$/i;

/**
 * The size shown beside a preset's name, as core's own font size picker shows
 * it: the theme's hint, or else the size itself when it is a plain value.
 * Sizes such as CSS variables and `clamp()` show nothing.
 *
 * @param {Object} fontSize A preset font size.
 * @return {?string} The size to show.
 */
export function getFontSizeHint( fontSize ) {
	if ( fontSize?.hint ) {
		return fontSize.hint;
	}

	const size = String( fontSize?.size ?? '' );

	return SIMPLE_CSS_VALUE.test( size ) ? size : null;
}
