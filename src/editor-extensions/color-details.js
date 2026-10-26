/**
 * A block's text and background colours in its options menu: which choice
 * is in use, the attributes a choice writes, and whether text reads on its
 * background. Kept apart from the menu (`src/block-toolbar/`) so it can be
 * tested without the block editor.
 */

/**
 * Internal dependencies
 */
import {
	getContrast,
	MIN_TEXT_CONTRAST,
	parseColor,
} from '../site-canvas/compose/palette-colors';

/**
 * The choice that stands for a colour set by hand, which no swatch matches.
 */
export const CUSTOM = 'custom';

/**
 * Where each kind of colour is saved, as core's colour support saves it: a
 * palette colour's slug in its own attribute, any other colour in the style.
 */
const KINDS = {
	text: { attribute: 'textColor', style: 'text' },
	background: { attribute: 'backgroundColor', style: 'background' },
};

/**
 * A colour's preset slug, from either way a block writes one.
 *
 * @param {string} value The colour.
 * @return {?string} The slug.
 */
function getPresetSlug( value ) {
	return (
		value.match( /^var:preset\|color\|(.+)$/ )?.[ 1 ] ||
		value.match( /^var\(--wp--preset--color--([^)]+)\)$/ )?.[ 1 ] ||
		null
	);
}

/**
 * A block's colour as it is stored, a palette colour as a preset reference.
 *
 * @param {Object} attributes Block attributes.
 * @param {string} kind       `text` or `background`.
 * @return {?string} The colour.
 */
function getStoredColor( attributes, kind ) {
	const { attribute, style } = KINDS[ kind ];
	const value = attributes?.[ attribute ]
		? `var:preset|color|${ attributes[ attribute ] }`
		: attributes?.style?.color?.[ style ];

	return typeof value === 'string' && value ? value : null;
}

/**
 * The value a choice of colour has in the menu: `preset:<slug>` for a
 * palette colour, and the colour itself for one without a slug, like black.
 *
 * @param {Object} choice `{ slug, color }`.
 * @return {string} The value.
 */
export function getColorChoiceValue( choice ) {
	return choice.slug
		? `preset:${ choice.slug }`
		: String( choice.color ).toLowerCase();
}

/**
 * The choice a block's colour is, from the choices offered.
 *
 * A preset is usually stored as a slug in its own attribute, but can also
 * arrive as a preset reference in the style. A colour set by hand that a
 * choice has too counts as that choice.
 *
 * @param {Object[]} choices    `{ slug, color }` for each colour offered.
 * @param {Object}   attributes Block attributes.
 * @param {string}   kind       `text` or `background`.
 * @return {?string} The choice's value, `CUSTOM` for a colour none of them
 *                   has, or null for the default.
 */
export function getActiveColor( choices, attributes, kind ) {
	const value = getStoredColor( attributes, kind );

	if ( ! value ) {
		return null;
	}

	const slug = getPresetSlug( value );
	const rgb = ! slug && parseColor( value )?.join();
	const choice = choices.find( ( item ) =>
		slug
			? item.slug === slug
			: rgb && parseColor( item.color )?.join() === rgb
	);

	return choice ? getColorChoiceValue( choice ) : CUSTOM;
}

/**
 * The colour a block is set to, as CSS, for showing it.
 *
 * @param {Object[]} choices    `{ slug, color }` for each colour offered.
 * @param {Object}   attributes Block attributes.
 * @param {string}   kind       `text` or `background`.
 * @return {?string} The colour, or null for the default.
 */
export function getColor( choices, attributes, kind ) {
	const value = getStoredColor( attributes, kind );

	if ( ! value ) {
		return null;
	}

	const slug = getPresetSlug( value );

	return slug
		? ( choices.find( ( item ) => item.slug === slug )?.color ?? null )
		: value;
}

/**
 * The attributes that set a block's colour, or put it back to its default,
 * as core's own colour control writes them: a palette colour by its slug,
 * and any other in the style.
 *
 * @param {Object}  attributes Block attributes.
 * @param {string}  kind       `text` or `background`.
 * @param {?Object} choice     `{ slug, color }`, or null for the default.
 * @return {Object} Attributes to set.
 */
export function getColorAttributes( attributes, kind, choice ) {
	const { attribute, style: key } = KINDS[ kind ];
	const { [ key ]: current, ...colorStyle } = attributes?.style?.color ?? {};
	const style = { ...attributes?.style, color: colorStyle };

	if ( choice && ! choice.slug ) {
		style.color = { ...colorStyle, [ key ]: choice.color };
	} else if ( ! Object.keys( colorStyle ).length ) {
		delete style.color;
	}

	return {
		[ attribute ]: choice?.slug ?? undefined,
		style: Object.keys( style ).length ? style : undefined,
	};
}

/**
 * Whether text in a colour would be hard to read on a background.
 *
 * @param {?string} color      The text's colour, as CSS.
 * @param {?string} background The background, as CSS, or null when it
 *                             isn't known.
 * @return {boolean} Whether it falls short of WCAG's contrast for text.
 */
export function isHardToRead( color, background ) {
	const a = parseColor( color );
	const b = parseColor( background );

	return !! a && !! b && getContrast( a, b ) < MIN_TEXT_CONTRAST;
}

/**
 * The solid colour behind an element on the page, from the nearest of it
 * and its ancestors that has one.
 *
 * Null when what is behind it isn't a plain colour: an image, a gradient,
 * or a cover block, whose background is beside its text, not around it.
 *
 * @param {?Element} element The element.
 * @return {?string} The colour, as CSS.
 */
export function getBackdropColor( element ) {
	for ( let node = element; node?.nodeType === 1; node = node.parentNode ) {
		if ( node.classList.contains( 'wp-block-cover' ) ) {
			return null;
		}

		const style = node.ownerDocument.defaultView.getComputedStyle( node );

		if ( style.backgroundImage && style.backgroundImage !== 'none' ) {
			return null;
		}

		const background = style.backgroundColor;
		const alpha = background.match(
			/^rgba\(.*[\s,/]\s*([\d.]+)(%?)\s*\)$/
		);
		const isClear =
			! background ||
			background === 'transparent' ||
			( alpha && parseFloat( alpha[ 1 ] ) === 0 );

		if ( ! isClear ) {
			return background;
		}
	}

	return null;
}
