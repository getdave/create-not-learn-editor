/**
 * A section's colours, from the theme's section styles.
 *
 * Section styles are block style variations a theme gives colours to, for
 * a whole section at once, such as a dark band or one in the accent colour.
 * They are applied the way every block style is, as an `is-style-*` class on
 * the section's block. Only the theme's own are offered: with none, there is
 * nothing to pick from.
 */

/**
 * Internal dependencies
 */
import { resolveColor } from '../../pickers/resolve-color';

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
 * The colours a section style shows a section in, for a swatch.
 *
 * @param {?Object}  styles  The style's styles, from the theme.
 * @param {Object[]} palette The site's palette, to look presets up in.
 * @return {Object} `{ background, heading, text }`, each a CSS colour or
 *                  undefined when the style leaves it to the page.
 */
export function getSectionStyleColors( styles, palette ) {
	const text = resolveColor( styles?.color?.text, palette );

	return {
		background: resolveColor( styles?.color?.background, palette ),
		heading:
			resolveColor( styles?.elements?.heading?.color?.text, palette ) ||
			text,
		text,
	};
}
