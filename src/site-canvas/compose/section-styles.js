/**
 * A section's colours, from the theme's section styles.
 *
 * Section styles are block style variations a theme gives colours to, for
 * a whole section at once, such as a dark band or one in the accent colour.
 * They are applied the way every block style is, as an `is-style-*` class on
 * the section's block. Only the theme's own are offered here; for a theme
 * without any, `palette-colors.js` makes some from its palette.
 */

const STYLE_CLASS = /^is-style-/;

/**
 * Whether a style variation's styles colour the block.
 *
 * @param {?Object} styles The variation's styles, from the theme.
 * @return {boolean} Whether it sets a colour.
 */
function hasColors( styles ) {
	if ( ! styles ) {
		return false;
	}

	const color = styles.color || {};

	return Boolean(
		color.background ||
		color.text ||
		color.gradient ||
		Object.values( styles.elements || {} ).some(
			( element ) => element?.color
		)
	);
}

/**
 * The section styles a block can take.
 *
 * @param {Object[]} blockStyles Block styles registered for the block's type,
 *                               `{ name, label }`.
 * @param {?Object}  variations  The theme's style variations for the block's
 *                               type, keyed by name, from its global styles.
 * @return {Object[]} `{ name, label }` for each style that sets colours.
 */
export function getSectionStyles( blockStyles, variations ) {
	return ( blockStyles || [] ).filter(
		( style ) =>
			! style.isDefault && hasColors( variations?.[ style.name ] )
	);
}

/**
 * The section style a block has on, if any.
 *
 * @param {?string}  className The block's class names.
 * @param {Object[]} styles    Result of `getSectionStyles`.
 * @return {?string} The style's name.
 */
export function getActiveSectionStyle( className, styles ) {
	const classes = ( className || '' ).split( /\s+/ );

	return (
		styles.find( ( style ) =>
			classes.includes( `is-style-${ style.name }` )
		)?.name || null
	);
}

/**
 * A block's class names with another section style on, or none.
 *
 * Any other block style goes with it: a block has only one style at a time.
 *
 * @param {?string} className The block's class names.
 * @param {?string} name      The style to put on, or nothing for none.
 * @return {?string} The new class names, or `undefined` when none are left.
 */
export function withSectionStyle( className, name ) {
	const classes = ( className || '' )
		.split( /\s+/ )
		.filter( ( item ) => item && ! STYLE_CLASS.test( item ) );

	if ( name ) {
		classes.push( `is-style-${ name }` );
	}

	return classes.length ? classes.join( ' ' ) : undefined;
}

/**
 * The blocks that carry a header's or footer's colours: its outermost
 * blocks of the same type as the first. Most parts have just one, a group
 * around the rest.
 *
 * @param {Object[]} blocks The part's blocks.
 * @return {Object[]} The blocks.
 */
export function getPartColorBlocks( blocks ) {
	const name = blocks?.[ 0 ]?.name;

	return name ? blocks.filter( ( block ) => block.name === name ) : [];
}
