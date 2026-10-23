/**
 * The site's own colours: its background, its text and its buttons, as
 * Design's Colors screen lets people change them after picking a palette.
 *
 * Each changes the palette colour behind it, so everything the theme built
 * on that colour follows: headings, section styles, the lot. A colour that
 * isn't one of the palette's, or a button that shares its colour with the
 * background or text, is set on its own instead, so changing one never
 * changes another. Button words keep to a colour that reads on the button.
 *
 * Pure functions only: no React, no stores.
 */

/**
 * Internal dependencies
 */
import {
	getValueAtPath,
	getVariationPalette,
	setValueAtPath,
} from '../routes/static/style-variations';
import {
	getContrast,
	getPresetSlug,
	MIN_TEXT_CONTRAST,
	parseColor,
} from '../site-canvas/compose/palette-colors';
import { getButtonTextValue } from '../site-canvas/compose/section-colors';
import { resolveColor } from './resolve-color';

export const SITE_COLOR_KEYS = [ 'background', 'text', 'button' ];

const PATHS = {
	background: [ 'styles', 'color', 'background' ],
	button: [ 'styles', 'elements', 'button', 'color', 'background' ],
	text: [ 'styles', 'color', 'text' ],
};

const BUTTON_TEXT_PATH = [ 'styles', 'elements', 'button', 'color', 'text' ];

const PALETTE_PATH = [ 'settings', 'color', 'palette', 'theme' ];

function getValue( user, base, path ) {
	return getValueAtPath( user, path ) ?? getValueAtPath( base, path );
}

function toValue( value ) {
	const slug = getPresetSlug( value );

	return slug ? `var:preset|color|${ slug }` : value || null;
}

/**
 * The palette the site uses: the user's, from a palette they picked or
 * changed, or the theme's.
 *
 * @param {?Object} user The user's global styles.
 * @param {?Object} base The theme's.
 * @return {Object[]} `{ slug, name, color }` for each colour.
 */
export function getSitePalette( user, base ) {
	const own = getVariationPalette( user );

	return own.length ? own : getVariationPalette( base );
}

/**
 * The site's background, text and button colours.
 *
 * @param {?Object} user The user's global styles.
 * @param {?Object} base The theme's.
 * @return {Object} `{ background, text, button }`, each a preset
 *                  (`var:preset|color|slug`), CSS, or null.
 */
export function getSiteColors( user, base ) {
	return Object.fromEntries(
		SITE_COLOR_KEYS.map( ( key ) => [
			key,
			toValue( getValue( user, base, PATHS[ key ] ) ),
		] )
	);
}

function reads( a, b, palette ) {
	const first = parseColor( resolveColor( a, palette ) );
	const second = parseColor( resolveColor( b, palette ) );

	return (
		! first || ! second || getContrast( first, second ) >= MIN_TEXT_CONTRAST
	);
}

/**
 * The user's global styles with one of the site's colours changed.
 *
 * @param {?Object} user  The user's global styles.
 * @param {?Object} base  The theme's.
 * @param {string}  key   `background`, `text` or `button`.
 * @param {string}  color The colour, as CSS.
 * @return {Object} `{ settings, styles }`.
 */
export function withSiteColor( user, base, key, color ) {
	const palette = getSitePalette( user, base );
	const current = getSiteColors( user, base );
	const slug = getPresetSlug( current[ key ] );
	const sharing = SITE_COLOR_KEYS.filter(
		( other ) =>
			other !== key && slug && getPresetSlug( current[ other ] ) === slug
	);
	const inPalette = palette.some( ( item ) => item.slug === slug );
	let next;

	if ( inPalette && ( key !== 'button' || ! sharing.length ) ) {
		next = setValueAtPath(
			user,
			PALETTE_PATH,
			palette.map( ( item ) =>
				item.slug === slug ? { ...item, color } : item
			)
		);

		// The others on the same colour keep it.
		const before = resolveColor( current[ key ], palette );

		sharing.forEach( ( other ) => {
			next = setValueAtPath( next, PATHS[ other ], before );
		} );
	} else {
		next = setValueAtPath( user, PATHS[ key ], color );
	}

	const values = getSiteColors( next, base );
	const nextPalette = getSitePalette( next, base );

	if (
		values.button &&
		! reads(
			getValue( next, base, BUTTON_TEXT_PATH ),
			values.button,
			nextPalette
		)
	) {
		next = setValueAtPath(
			next,
			BUTTON_TEXT_PATH,
			getButtonTextValue( values, nextPalette )
		);
	}

	return next;
}
