/**
 * A block's styles, like a button's Fill and Outline, for its options menu:
 * which are offered, which is in use and the class name a choice writes, as
 * core's block styles menu works them out. Kept apart from the menu
 * (`src/block-toolbar/`) so it can be tested without the block editor.
 */

/**
 * WordPress dependencies
 */
import { _x } from '@wordpress/i18n';

const PREFIX = 'is-style-';

/**
 * The styles to offer: the block's own, with Default first when none of
 * them is the default.
 *
 * @param {?Object[]} styles The block's styles, `{ name, label, isDefault }`.
 * @return {Object[]} The styles to offer, none when the block has none.
 */
export function getStyleChoices( styles ) {
	if ( ! styles?.length ) {
		return [];
	}

	return styles.some( ( style ) => style.isDefault )
		? styles
		: [
				{
					name: 'default',
					label: _x( 'Default', 'block style' ),
					isDefault: true,
				},
				...styles,
			];
}

/**
 * The style in use, from the block's class name, or else the default.
 *
 * @param {Object[]} choices   The styles offered.
 * @param {?string}  className The block's class name.
 * @return {?Object} The style.
 */
export function getActiveStyle( choices, className ) {
	const names = String( className ?? '' )
		.split( /\s+/ )
		.filter( ( name ) => name.startsWith( PREFIX ) )
		.map( ( name ) => name.slice( PREFIX.length ) );

	return (
		choices.find( ( style ) => names.includes( style.name ) ) ??
		choices.find( ( style ) => style.isDefault ) ??
		null
	);
}

/**
 * The class name with one style swapped for another, as core's block
 * styles menu writes it, keeping every other class.
 *
 * @param {?string} className The block's class name.
 * @param {?Object} active    The style in use.
 * @param {Object}  next      The style picked.
 * @return {string} The class name.
 */
export function getStyleClassName( className, active, next ) {
	const classes = String( className ?? '' )
		.split( /\s+/ )
		.filter( Boolean )
		.filter( ( name ) => ! active || name !== PREFIX + active.name );

	if ( ! classes.includes( PREFIX + next.name ) ) {
		classes.push( PREFIX + next.name );
	}

	return classes.join( ' ' );
}
