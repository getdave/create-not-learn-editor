/**
 * Section colours made from the theme's palette, for themes without
 * section styles of their own.
 *
 * Each set is a background and text colour from the palette that read
 * well together: a soft tint of the page, the page's colours swapped, and
 * the palette's strongest colours with whichever of the page's colours
 * reads on them. They are saved with core's own colour settings, by preset,
 * so they follow the palette when it changes.
 *
 * Pure functions only: no React, no stores.
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

// How readable text must be on a set's background (WCAG AA).
export const MIN_TEXT_CONTRAST = 4.5;

// Below this against a background, a button would be lost in it.
const MIN_BUTTON_CONTRAST = 3;

// How different from the page a soft background must be to show at all.
const MIN_SOFT_CONTRAST = 1.05;

// The most colourful a soft background can be, and the least an accent can.
const MAX_SOFT_CHROMA = 40;
const MIN_ACCENT_CHROMA = 60;

const MAX_ACCENTS = 2;

/**
 * A colour's preset slug, from either way a theme writes one.
 *
 * @param {?string} value Like `var:preset|color|base` or
 *                        `var(--wp--preset--color--base)`.
 * @return {?string} The slug.
 */
export function getPresetSlug( value ) {
	if ( typeof value !== 'string' ) {
		return null;
	}

	return (
		value.match( /^var:preset\|color\|(.+)$/ )?.[ 1 ] ||
		value.match( /^var\(--wp--preset--color--([^)]+)\)$/ )?.[ 1 ] ||
		null
	);
}

/**
 * A CSS colour's red, green and blue, for hex and `rgb()` colours.
 *
 * @param {?string} value The colour.
 * @return {?number[]} `[ r, g, b ]` from 0 to 255, or null.
 */
export function parseColor( value ) {
	const text = String( value || '' ).trim();
	const hex = text.match( /^#([0-9a-f]{3,8})$/i )?.[ 1 ];

	if ( hex ) {
		const digits =
			hex.length < 6
				? hex
						.slice( 0, 3 )
						.split( '' )
						.map( ( digit ) => digit + digit )
				: hex.slice( 0, 6 ).match( /../g );

		return digits.map( ( pair ) => parseInt( pair, 16 ) );
	}

	const rgb = text.match(
		/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+[\d.]+%?)?\s*\)$/i
	);

	return rgb ? rgb.slice( 1, 4 ).map( Number ) : null;
}

function getLuminance( rgb ) {
	const [ r, g, b ] = rgb.map( ( channel ) => {
		const value = channel / 255;

		return value <= 0.03928
			? value / 12.92
			: Math.pow( ( value + 0.055 ) / 1.055, 2.4 );
	} );

	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * How well two colours stand apart, as WCAG measures it.
 *
 * @param {number[]} a `[ r, g, b ]`.
 * @param {number[]} b `[ r, g, b ]`.
 * @return {number} From 1 to 21.
 */
export function getContrast( a, b ) {
	const [ light, dark ] = [ getLuminance( a ), getLuminance( b ) ].sort(
		( x, y ) => y - x
	);

	return ( light + 0.05 ) / ( dark + 0.05 );
}

function getChroma( rgb ) {
	return Math.max( ...rgb ) - Math.min( ...rgb );
}

/**
 * The colour sets a theme's palette makes.
 *
 * @param {Object}   options
 * @param {Object[]} options.palette    `{ slug, name, color }` for each of
 *                                      the theme's colours.
 * @param {?string}  options.background The page's background, by slug.
 * @param {?string}  options.text       The page's text colour, by slug.
 * @param {?string}  options.button     The theme's button background, as
 *                                      CSS, if it has one.
 * @return {Object[]} `{ name, label, background, text, invertButton,
 *                    swatch }` for each set. `background` and `text` are
 *                    slugs; `invertButton` is whether buttons swap to the
 *                    set's colours so they still show.
 */
export function getPaletteColorSets( { palette, background, text, button } ) {
	const colors = ( palette || [] )
		.map( ( item ) => ( { ...item, rgb: parseColor( item.color ) } ) )
		.filter( ( item ) => item.rgb );
	const page = colors.find( ( item ) => item.slug === background );
	const words = colors.find( ( item ) => item.slug === text );

	if ( ! page || ! words || page.slug === words.slug ) {
		return [];
	}

	const buttonRgb = parseColor( button );
	const others = colors.filter(
		( item ) => item.slug !== page.slug && item.slug !== words.slug
	);
	const makeSet = ( name, label, back, front, canInvert = true ) => {
		const invertButton =
			canInvert &&
			!! buttonRgb &&
			getContrast( buttonRgb, back.rgb ) < MIN_BUTTON_CONTRAST;

		return {
			background: back.slug,
			invertButton,
			label,
			name,
			swatch: [
				back.color,
				front.color,
				invertButton || ! button ? front.color : button,
			],
			text: front.slug,
		};
	};
	const sets = [];

	const soft = others
		.filter(
			( item ) =>
				getChroma( item.rgb ) <= MAX_SOFT_CHROMA &&
				getContrast( item.rgb, page.rgb ) >= MIN_SOFT_CONTRAST &&
				getContrast( item.rgb, words.rgb ) >= MIN_TEXT_CONTRAST
		)
		.sort(
			( a, b ) =>
				getContrast( a.rgb, page.rgb ) - getContrast( b.rgb, page.rgb )
		)[ 0 ];

	if ( soft ) {
		// Close to the page, so buttons stay as they are on it.
		sets.push(
			makeSet( 'palette-soft', __( 'Soft' ), soft, words, false )
		);
	}

	sets.push(
		makeSet(
			'palette-inverse',
			getLuminance( page.rgb ) > getLuminance( words.rgb )
				? __( 'Dark' )
				: __( 'Light' ),
			words,
			page
		)
	);

	others
		.filter(
			( item ) =>
				item !== soft && getChroma( item.rgb ) >= MIN_ACCENT_CHROMA
		)
		.sort( ( a, b ) => getChroma( b.rgb ) - getChroma( a.rgb ) )
		.map( ( item ) => {
			const front =
				getContrast( item.rgb, words.rgb ) >=
				getContrast( item.rgb, page.rgb )
					? words
					: page;

			return getContrast( item.rgb, front.rgb ) >= MIN_TEXT_CONTRAST
				? makeSet(
						`palette-accent-${ item.slug }`,
						item.name || item.slug,
						item,
						front
					)
				: null;
		} )
		.filter( Boolean )
		.slice( 0, MAX_ACCENTS )
		.forEach( ( set ) => sets.push( set ) );

	return sets;
}
