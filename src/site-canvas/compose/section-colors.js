/**
 * The colours a section, header or footer can take, and putting one on.
 *
 * They are the theme's section styles or, for a theme without any, sets
 * made from its palette (see `palette-colors.js`). Each is an option that
 * knows whether a block has it on, how to put it on and how to take it off,
 * so the rest of Edit design treats both the same.
 *
 * Colours set on a block itself win over a section style, as core has it,
 * and colours someone set are never taken away. So a section with colours
 * set on its own block is offered no colours: `getSectionColor` gives
 * undefined for it. Colours that are only the page's own, like a header
 * given the page's background, count as the theme's, as replacing them
 * changes nothing that shows. Text colours set inside a section stay, so it
 * is only offered the colours they can still be read on
 * (`getReadableOptions`). A block inside with a background of its own, like
 * a button, a band in another colour or a photo, doesn't count, as its
 * colours go with that background.
 *
 * People can also make their own: a background, a text colour and a button
 * colour, and nothing more (`withCustomColors`). They are saved on the
 * section's own block with core's colour settings, headings and links
 * taking the text colour and the button's words whichever of the other two
 * reads on it. Colours set on a block that fit those three, however they
 * got there, are the section's custom colours (`getCustomColors`), so they
 * can be changed, or swapped for another option, from Edit design.
 *
 * Pure functions only: no React, no stores.
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { resolveColor } from '../../pickers/resolve-color';
import {
	getContrast,
	getPaletteColorSets,
	getPresetSlug,
	MIN_TEXT_CONTRAST,
	parseColor,
} from './palette-colors';
import {
	getSectionStyleColors,
	getSectionStyles,
	withSectionStyle,
} from './section-styles';

const STYLE_CLASS = /^is-style-/;

// Colour classes in a block's own class names, like `has-black-background-color`.
const COLOR_CLASS = /^has-[a-z0-9-]*(?:color|background)$/;

// The elements whose colours a block's text takes.
const TEXT_ELEMENTS = [
	'link',
	'heading',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'caption',
];

// The elements a palette set colours.
const SET_ELEMENTS = [ 'link', 'heading', 'button' ];

const EMPTY_ARRAY = [];

// The section's own colours, as the current option when it has them.
export const CUSTOM_COLOR = 'custom';

function getClasses( className ) {
	return ( className || '' ).split( /\s+/ ).filter( Boolean );
}

function hasOwnBackground( attributes ) {
	const color = attributes.style?.color || {};

	return Boolean(
		attributes.backgroundColor ||
		attributes.customBackgroundColor ||
		attributes.gradient ||
		color.background ||
		color.gradient
	);
}

function hasElementColors( attributes, names ) {
	return Object.entries( attributes.style?.elements || {} ).some(
		( [ name, element ] ) =>
			( ! names || names.includes( name ) ) &&
			( element?.color || element?.[ ':hover' ]?.color )
	);
}

function hasTextColors( attributes, elementNames ) {
	return Boolean(
		attributes.textColor ||
		attributes.customTextColor ||
		attributes.style?.color?.text ||
		hasElementColors( attributes, elementNames )
	);
}

function toPreset( slug ) {
	return `var:preset|color|${ slug }`;
}

/**
 * A colour as custom colours save it: a preset by name, or as CSS.
 *
 * @param {?string} value Either way a theme writes a preset, or CSS.
 * @return {?string} The colour, or null.
 */
function toValue( value ) {
	const slug = getPresetSlug( value );

	if ( slug ) {
		return toPreset( slug );
	}

	return typeof value === 'string' && value ? value : null;
}

/**
 * An option's background, text and button colours, to start custom
 * colours from.
 *
 * @param {?Object} styles Styles with the colours, theme.json's way.
 * @return {Object} `{ background, text, button }`, each a colour or null.
 */
function getStyleValues( styles ) {
	return {
		background: toValue( styles?.color?.background ),
		button: toValue( styles?.elements?.button?.color?.background ),
		text: toValue( styles?.color?.text ),
	};
}

/**
 * The text colours set on a block inside a section and on the blocks in
 * it. A block with a background of its own, or a style of its own around
 * other blocks, is left out with what is inside it.
 *
 * @param {Object}   block  The block.
 * @param {string[]} colors Colours found so far, added to.
 */
function collectTextColors( block, colors ) {
	const { attributes } = block;
	const innerBlocks = block.innerBlocks || EMPTY_ARRAY;

	if (
		block.name === 'core/cover' ||
		hasOwnBackground( attributes ) ||
		( innerBlocks.length &&
			getClasses( attributes.className ).some( ( item ) =>
				STYLE_CLASS.test( item )
			) )
	) {
		return;
	}

	const elements = attributes.style?.elements || {};

	[
		attributes.textColor && toPreset( attributes.textColor ),
		attributes.customTextColor,
		attributes.style?.color?.text,
		...TEXT_ELEMENTS.flatMap( ( name ) => [
			elements[ name ]?.color?.text,
			elements[ name ]?.[ ':hover' ]?.color?.text,
		] ),
	]
		.filter( Boolean )
		.forEach( ( color ) => colors.push( color ) );

	innerBlocks.forEach( ( inner ) => collectTextColors( inner, colors ) );
}

/**
 * The text colours set inside a section, which a new background must still
 * let people read.
 *
 * @param {Object} block The section's block, with its inner blocks.
 * @return {string[]} The colours, as set.
 */
export function getInnerTextColors( block ) {
	const colors = [];

	( block.innerBlocks || EMPTY_ARRAY ).forEach( ( inner ) =>
		collectTextColors( inner, colors )
	);

	return [ ...new Set( colors ) ];
}

/**
 * Whether a section has colours set on its own block, which a picked
 * colour couldn't win over.
 *
 * @param {Object} block The section's block.
 * @return {boolean} Whether it does.
 */
export function hasOwnColors( block ) {
	const { attributes } = block;

	return (
		hasOwnBackground( attributes ) ||
		hasTextColors( attributes, null ) ||
		getClasses( attributes.className ).some( ( item ) =>
			COLOR_CLASS.test( item )
		)
	);
}

function withClassName( attributes, className ) {
	const { className: previous, ...rest } = attributes;

	return className ? { ...rest, className } : rest;
}

function withStyle( attributes, style ) {
	const { style: previous, ...rest } = attributes;

	return style && Object.keys( style ).length ? { ...rest, style } : rest;
}

/**
 * A section style's background, words and accent, for its swatch.
 *
 * @param {?Object}  styles The style's styles, from the theme.
 * @param {Object[]} colors The colours to resolve presets against.
 * @return {string[]} Up to three colours.
 */
function getStyleSwatch( styles, colors ) {
	const elements = styles?.elements || {};

	return [
		styles?.color?.background || styles?.color?.gradient,
		styles?.color?.text,
		elements.button?.color?.background ||
			elements.link?.color?.text ||
			elements.heading?.color?.text,
	]
		.map( ( value ) => resolveColor( value, colors ) )
		.filter( Boolean );
}

function makeStyleOption( style, styles, colors ) {
	const className = `is-style-${ style.name }`;

	return {
		apply: ( attributes ) =>
			withClassName(
				attributes,
				withSectionStyle( attributes.className, style.name )
			),
		background: resolveColor( styles?.color?.background, colors ),
		colors: getSectionStyleColors( styles, colors ),
		label: style.label,
		matches: ( attributes ) =>
			getClasses( attributes.className ).includes( className ),
		name: style.name,
		remove: ( attributes ) =>
			withClassName(
				attributes,
				withSectionStyle( attributes.className, null )
			),
		swatch: getStyleSwatch( styles, colors ),
		values: getStyleValues( styles ),
	};
}

/**
 * Attributes without the link, heading and button colours made only of
 * the given colours, or the same object when there are none.
 *
 * @param {Object}   attributes The block's attributes.
 * @param {string[]} values     Colours, as presets.
 * @return {Object} The attributes.
 */
function withoutElementColors( attributes, values ) {
	const elements = { ...attributes.style?.elements };
	let changed = false;

	SET_ELEMENTS.forEach( ( name ) => {
		const color = elements[ name ]?.color;

		if (
			color &&
			Object.values( color ).every( ( value ) =>
				values.includes( value )
			)
		) {
			const { color: previous, ...other } = elements[ name ];

			changed = true;

			if ( Object.keys( other ).length ) {
				elements[ name ] = other;
			} else {
				delete elements[ name ];
			}
		}
	} );

	if ( ! changed ) {
		return attributes;
	}

	const { elements: previous, ...style } = attributes.style;

	return withStyle(
		attributes,
		Object.keys( elements ).length ? { ...style, elements } : style
	);
}

/**
 * The theme's colours, as an option: a block with none, or with only the
 * page's own colours set on it, which a picked colour can replace without
 * anything showing a difference.
 *
 * @param {Object}   page   `{ background, text }`: the page's colours, by
 *                          slug.
 * @param {Object[]} colors The colours presets can name.
 * @param {?Object}  styles The site's styles.
 * @return {Object} The option.
 */
function makeThemeOption( page, colors, styles ) {
	const remove = ( attributes ) => {
		let next = attributes;

		if ( page.background && next.backgroundColor === page.background ) {
			const { backgroundColor, ...rest } = next;
			next = rest;
		}

		if ( page.text && next.textColor === page.text ) {
			const { textColor, ...rest } = next;
			next = rest;
		}

		return page.text
			? withoutElementColors( next, [ toPreset( page.text ) ] )
			: next;
	};

	return {
		apply: ( attributes ) => attributes,
		background: page.background
			? resolveColor( toPreset( page.background ), colors )
			: null,
		colors: getSectionStyleColors( styles, colors ),
		label: __( 'Default' ),
		matches: ( attributes ) => remove( attributes ) !== attributes,
		name: null,
		remove,
		swatch: getStyleSwatch( styles, colors ),
		values: getStyleValues( styles ),
	};
}

function makePaletteOption( set, supports, page ) {
	const presets = [ toPreset( set.background ), toPreset( set.text ) ];
	const elementColors = {
		link: supports.link && { text: presets[ 1 ] },
		heading: supports.heading && { text: presets[ 1 ] },
		button: supports.button &&
			set.invertButton && {
				background: presets[ 1 ],
				text: presets[ 0 ],
			},
	};

	return {
		apply: ( attributes ) => {
			const style = { ...attributes.style };

			SET_ELEMENTS.forEach( ( name ) => {
				if ( elementColors[ name ] ) {
					style.elements = {
						...style.elements,
						[ name ]: {
							...style.elements?.[ name ],
							color: elementColors[ name ],
						},
					};
				}
			} );

			return withStyle(
				{
					...attributes,
					backgroundColor: set.background,
					textColor: set.text,
				},
				style
			);
		},
		background: set.swatch[ 0 ],
		colors: {
			background: set.swatch[ 0 ],
			heading: set.swatch[ 1 ],
			text: set.swatch[ 1 ],
		},
		label: set.label,
		// A block given only the set's background, keeping the page's text
		// colour, has it too: themes' own patterns often do that.
		matches: ( attributes ) =>
			attributes.backgroundColor === set.background &&
			( attributes.textColor === set.text ||
				( ! attributes.textColor && set.text === page.text ) ),
		name: set.name,
		// Takes away only what a set puts on: element colours made of its
		// own two colours.
		remove: ( attributes ) => {
			const { backgroundColor, textColor, ...rest } = attributes;

			return withoutElementColors( rest, presets );
		},
		swatch: set.swatch,
		values: {
			background: presets[ 0 ],
			button: set.invertButton ? presets[ 1 ] : page.button,
			text: presets[ 1 ],
		},
	};
}

/**
 * The colours a type of block can take.
 *
 * @param {Object}   options
 * @param {Object[]} options.blockStyles Block styles registered for the
 *                                       block's type.
 * @param {?Object}  options.variations  The theme's style variations for the
 *                                       block's type, keyed by name.
 * @param {Object[]} options.palette     The theme's own colours, `{ slug,
 *                                       name, color }`.
 * @param {Object[]} options.colors      Every colour presets can name, to
 *                                       draw swatches with.
 * @param {?Object}  options.styles      The site's styles: its page and
 *                                       button colours.
 * @param {Object}   options.supports    Which of `background`, `text`,
 *                                       `link`, `heading` and `button`
 *                                       colours the block type takes.
 * @return {Object[]} `{ name, label, swatch, colors, values, background,
 *                    matches, apply, remove }` for each, the theme's first,
 *                    with a null name; none when there are no colours but
 *                    the theme's. `swatch` is up to three colours, for Edit
 *                    design; `colors` is `{ background, heading, text }`,
 *                    for the chat; `values` is `{ background, text, button
 *                    }`, as saved, to start custom colours from.
 */
export function getColorOptions( {
	blockStyles,
	variations,
	palette,
	colors,
	styles,
	supports,
} ) {
	const page = {
		background: getPresetSlug( styles?.color?.background ),
		button: toValue( styles?.elements?.button?.color?.background ),
		text: getPresetSlug( styles?.color?.text ),
	};
	const sectionStyles = getSectionStyles( blockStyles, variations );
	let options = EMPTY_ARRAY;

	if ( sectionStyles.length ) {
		options = sectionStyles.map( ( style ) =>
			makeStyleOption( style, variations[ style.name ], colors )
		);
	} else if ( supports.background && supports.text ) {
		options = getPaletteColorSets( {
			...page,
			button: resolveColor(
				styles?.elements?.button?.color?.background,
				colors
			),
			palette,
		} ).map( ( set ) => makePaletteOption( set, supports, page ) );
	}

	return options.length
		? [ makeThemeOption( page, colors, styles ), ...options ]
		: EMPTY_ARRAY;
}

/**
 * The options in the order to look for one on a block: the theme's last,
 * as a block can have both the page's colours and another option's.
 *
 * @param {Object[]} options Result of `getColorOptions`.
 * @return {Object[]} The options.
 */
function byPrecedence( options ) {
	return [
		...options.filter( ( option ) => option.name ),
		...options.filter( ( option ) => ! option.name ),
	];
}

/**
 * The colour a section has: one of the options (its name), the theme's
 * (null), or undefined when it has colours of its own that a picked colour
 * couldn't win over.
 *
 * @param {Object}   block   The section's block, with its inner blocks.
 * @param {Object[]} options Result of `getColorOptions`.
 * @return {?string|undefined} The colour.
 */
export function getSectionColor( block, options ) {
	const match = byPrecedence( options ).find( ( option ) =>
		option.matches( block.attributes )
	);
	const rest = match
		? { ...block, attributes: match.remove( block.attributes ) }
		: block;

	if ( hasOwnColors( rest ) ) {
		return undefined;
	}

	return match ? match.name : null;
}

/**
 * The options a section can take and still be read: the one it has, and
 * those whose background its own text colours read on, the theme's
 * included.
 *
 * @param {Object}   block   The section's block, with its inner blocks.
 * @param {Object[]} options Result of `getColorOptions`.
 * @param {Object[]} colors  The colours presets can name.
 * @return {Object[]} The options.
 */
export function getReadableOptions( block, options, colors ) {
	const texts = getInnerTextColors( block ).map( ( value ) =>
		parseColor( resolveColor( value, colors ) )
	);

	if ( ! texts.length ) {
		return options;
	}

	const current = getSectionColor( block, options );

	return options.filter( ( option ) => {
		const background = parseColor( option.background );

		return (
			option.name === current ||
			( background &&
				texts.every(
					( text ) =>
						text &&
						getContrast( text, background ) >= MIN_TEXT_CONTRAST
				) )
		);
	} );
}

/**
 * A section's attributes with another colour on, or the theme's. Custom
 * colours it had are taken off.
 *
 * @param {Object}   attributes The section block's attributes.
 * @param {Object[]} options    Result of `getColorOptions`.
 * @param {?string}  name       The colour to put on, or nothing for the
 *                              theme's.
 * @return {Object} The attributes.
 */
export function withSectionColor( attributes, options, name ) {
	let next = attributes;

	if ( isCustom( attributes, options ) ) {
		next = withoutCustomColors( attributes );
	} else {
		byPrecedence( options ).forEach( ( option ) => {
			if ( option.matches( next ) ) {
				next = option.remove( next );
			}
		} );
	}

	const chosen = name && options.find( ( option ) => option.name === name );

	return chosen ? chosen.apply( next ) : next;
}

/**
 * A header's or footer's blocks with a colour on its outermost blocks, as
 * `withSectionColor` does for a section, or custom colours, as
 * `withCustomColors` does. Blocks with colours of their own, or text that
 * wouldn't read on a colour, are left as they are.
 *
 * @param {Object[]} blocks    The part's blocks.
 * @param {string}   blockName The type of block that takes the colour.
 * @param {Object[]} options   Result of `getColorOptions` for that
 *                             type.
 * @param {Object[]} colors    The colours presets can name.
 * @param {?string}  name      The colour, `CUSTOM_COLOR`, or nothing
 *                             for the theme's.
 * @param {?Object}  custom    For custom colours, `{ values, supports
 *                             }`, as `withCustomColors` takes them.
 * @return {Object[]} The blocks.
 */
export function withPartColor(
	blocks,
	blockName,
	options,
	colors,
	name,
	custom
) {
	const isCustomColor = name === CUSTOM_COLOR && !! custom;

	return blocks.map( ( block ) => {
		if ( block.name !== blockName ) {
			return block;
		}

		if ( isCustomColor ) {
			return getSectionColor( block, options ) !== undefined ||
				isCustom( block.attributes, options )
				? {
						...block,
						attributes: withCustomColors(
							block.attributes,
							options,
							custom.values,
							{ colors, supports: custom.supports }
						),
					}
				: block;
		}

		return getSectionColor( block, options ) !== undefined &&
			getReadableOptions( block, options, colors ).some(
				( option ) => option.name === name
			)
			? {
					...block,
					attributes: withSectionColor(
						block.attributes,
						options,
						name
					),
				}
			: block;
	} );
}

/**
 * What to give `updateBlockAttributes` to turn one set of attributes into
 * another: the new ones, with any taken away as undefined.
 *
 * @param {Object} before The attributes now.
 * @param {Object} after  The attributes wanted.
 * @return {Object} The update.
 */
export function getAttributeUpdate( before, after ) {
	return Object.fromEntries(
		[
			...new Set( [ ...Object.keys( before ), ...Object.keys( after ) ] ),
		].map( ( key ) => [ key, after[ key ] ] )
	);
}

/**
 * A section's custom colours: colours set on its own block that are no more
 * than custom colours set, a background, maybe a text colour, headings and
 * links in that text colour, and a button colour.
 *
 * @param {Object} attributes The section block's attributes.
 * @return {?Object} `{ background, text, button }`, as saved, text and
 *                   button null when not set; or null when the block has
 *                   no background of its own, or colours of other kinds.
 */
export function getCustomColors( attributes ) {
	const style = attributes.style || {};
	const background = attributes.backgroundColor
		? toPreset( attributes.backgroundColor )
		: style.color?.background;

	if (
		! background ||
		attributes.customBackgroundColor ||
		attributes.customTextColor ||
		attributes.gradient ||
		style.color?.gradient ||
		getClasses( attributes.className ).some( ( item ) =>
			COLOR_CLASS.test( item )
		)
	) {
		return null;
	}

	const text = attributes.textColor
		? toPreset( attributes.textColor )
		: style.color?.text || null;
	const elements = style.elements || {};
	const isMore = Object.entries( elements ).some( ( [ name, element ] ) => {
		if ( ! element?.color && ! element?.[ ':hover' ]?.color ) {
			return false;
		}

		if ( ! SET_ELEMENTS.includes( name ) || element[ ':hover' ]?.color ) {
			return true;
		}

		return (
			name !== 'button' &&
			Object.entries( element.color ).some(
				( [ key, value ] ) => key !== 'text' || value !== text
			)
		);
	} );

	return isMore
		? null
		: {
				background,
				button: elements.button?.color?.background || null,
				text,
			};
}

/**
 * Whether a section has custom colours, rather than one of the options.
 *
 * @param {Object}   attributes The section block's attributes.
 * @param {Object[]} options    Result of `getColorOptions`.
 * @return {boolean} Whether it does.
 */
function isCustom( attributes, options ) {
	return (
		getSectionColor( { attributes }, options ) === undefined &&
		!! getCustomColors( attributes )
	);
}

/**
 * Attributes without the colours custom colours set.
 *
 * @param {Object} attributes The section block's attributes.
 * @return {Object} The attributes.
 */
function withoutCustomColors( attributes ) {
	const { backgroundColor, textColor, ...rest } = attributes;

	if ( ! rest.style ) {
		return rest;
	}

	const { color = {}, elements = {}, ...style } = rest.style;
	const { background, text, ...otherColor } = color;
	const otherElements = { ...elements };

	SET_ELEMENTS.forEach( ( name ) => {
		if ( otherElements[ name ]?.color ) {
			const { color: previous, ...other } = otherElements[ name ];

			if ( Object.keys( other ).length ) {
				otherElements[ name ] = other;
			} else {
				delete otherElements[ name ];
			}
		}
	} );

	return withStyle( rest, {
		...style,
		...( Object.keys( otherColor ).length && { color: otherColor } ),
		...( Object.keys( otherElements ).length && {
			elements: otherElements,
		} ),
	} );
}

/**
 * The colour a button's words take, to read on the button: whichever of
 * the section's background and text colours reads best on it, or, when
 * neither reads well enough, the palette colour that reads best.
 *
 * @param {Object}   values `{ background, text, button }`.
 * @param {Object[]} colors The colours presets can name: the palette.
 * @return {string} The colour, as saved.
 */
export function getButtonTextValue( values, colors ) {
	const button = parseColor( resolveColor( values.button, colors ) );

	if ( ! button ) {
		return values.background;
	}

	const getScore = ( value ) => {
		const color = parseColor( resolveColor( value, colors ) );

		return color ? getContrast( button, color ) : 0;
	};
	const [ best ] = [ values.background, values.text ]
		.filter( Boolean )
		.sort( ( a, b ) => getScore( b ) - getScore( a ) );

	if ( getScore( best ) >= MIN_TEXT_CONTRAST ) {
		return best;
	}

	return [ best, ...colors.map( ( item ) => toPreset( item.slug ) ) ].reduce(
		( winner, value ) =>
			getScore( value ) > getScore( winner ) ? value : winner
	);
}

/**
 * A section's attributes with custom colours on, in place of whatever
 * option or custom colours it had.
 *
 * @param {Object}   attributes       The section block's attributes.
 * @param {Object[]} options          Result of `getColorOptions`.
 * @param {Object}   values           `{ background, text, button }`, each
 *                                    a preset (`var:preset|color|slug`) or
 *                                    CSS.
 * @param {Object}   context
 * @param {Object[]} context.colors   The colours presets can name.
 * @param {Object}   context.supports As for `getColorOptions`.
 * @return {Object} The attributes.
 */
export function withCustomColors(
	attributes,
	options,
	values,
	{ colors, supports }
) {
	const next = { ...withSectionColor( attributes, options, null ) };
	const style = { ...next.style };
	const color = { ...style.color };
	const backgroundSlug = getPresetSlug( values.background );
	const textSlug = getPresetSlug( values.text );

	if ( backgroundSlug ) {
		next.backgroundColor = backgroundSlug;
	} else {
		color.background = values.background;
	}

	if ( textSlug ) {
		next.textColor = textSlug;
	} else if ( values.text ) {
		color.text = values.text;
	}

	if ( Object.keys( color ).length ) {
		style.color = color;
	}

	const elementColors = {
		link: supports.link && values.text && { text: values.text },
		heading: supports.heading && values.text && { text: values.text },
		button: supports.button &&
			values.button && {
				background: values.button,
				text: getButtonTextValue( values, colors ),
			},
	};

	SET_ELEMENTS.forEach( ( name ) => {
		if ( elementColors[ name ] ) {
			style.elements = {
				...style.elements,
				[ name ]: {
					...style.elements?.[ name ],
					color: elementColors[ name ],
				},
			};
		}
	} );

	return withStyle( next, style );
}
