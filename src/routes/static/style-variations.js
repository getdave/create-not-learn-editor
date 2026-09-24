/**
 * Helpers for the "Colors & fonts" screen.
 *
 * Themes ship full style variations, color palettes, and font pairings from
 * one REST endpoint. These helpers sort them apart by the properties each one
 * touches, mirroring how Gutenberg's global styles UI does it, and apply
 * them to the user's global styles record.
 */

export const COLOR_PROPERTIES = [ 'color' ];
export const TYPOGRAPHY_PROPERTIES = [ 'typography', 'spacing' ];

function isPlainObject( value ) {
	return !! value && typeof value === 'object' && ! Array.isArray( value );
}

function sortKeys( value ) {
	if ( Array.isArray( value ) ) {
		return value.map( sortKeys );
	}

	if ( ! isPlainObject( value ) ) {
		return value;
	}

	return Object.keys( value )
		.sort()
		.reduce( ( result, key ) => {
			result[ key ] = sortKeys( value[ key ] );
			return result;
		}, {} );
}

/**
 * Remove empty objects so `{ color: {} }` compares equal to `{}`.
 *
 * @param {*} value Any value.
 * @return {*} The value without empty nested objects.
 */
export function pruneEmpty( value ) {
	if ( ! isPlainObject( value ) ) {
		return value;
	}

	return Object.entries( value ).reduce( ( result, [ key, child ] ) => {
		const pruned = pruneEmpty( child );

		if (
			pruned === undefined ||
			( isPlainObject( pruned ) && ! Object.keys( pruned ).length )
		) {
			return result;
		}

		result[ key ] = pruned;
		return result;
	}, {} );
}

/**
 * Get the parts of a global styles config that decide how the site looks.
 *
 * @param {Object} config Global styles config or variation.
 * @return {{ settings: Object, styles: Object }} Normalized config.
 */
export function getStyleConfig( config ) {
	return {
		settings: pruneEmpty( config?.settings || {} ),
		styles: pruneEmpty( config?.styles || {} ),
	};
}

/**
 * Compare two global styles configs, ignoring key order and empty objects.
 *
 * @param {Object} a First config.
 * @param {Object} b Second config.
 * @return {boolean} Whether both configs produce the same styles.
 */
export function areStyleConfigsEqual( a, b ) {
	return (
		JSON.stringify( sortKeys( getStyleConfig( a ) ) ) ===
		JSON.stringify( sortKeys( getStyleConfig( b ) ) )
	);
}

/**
 * Keep only the branches of an object that sit under the given keys.
 *
 * @param {Object}   value      Object to filter.
 * @param {string[]} properties Keys to keep, at any depth.
 * @return {Object} Filtered object.
 */
export function filterByProperties( value, properties ) {
	if ( ! isPlainObject( value ) ) {
		return value;
	}

	return pruneEmpty(
		Object.entries( value ).reduce( ( result, [ key, child ] ) => {
			if ( properties.includes( key ) ) {
				result[ key ] = child;
			} else if ( isPlainObject( child ) ) {
				result[ key ] = filterByProperties( child, properties );
			}

			return result;
		}, {} )
	);
}

/**
 * Remove the branches of an object that sit under the given keys.
 *
 * @param {Object}   value      Object to filter.
 * @param {string[]} properties Keys to remove, at any depth.
 * @return {Object} Filtered object.
 */
export function omitByProperties( value, properties ) {
	if ( ! isPlainObject( value ) ) {
		return value;
	}

	return pruneEmpty(
		Object.entries( value ).reduce( ( result, [ key, child ] ) => {
			if ( properties.includes( key ) ) {
				return result;
			}

			result[ key ] = isPlainObject( child )
				? omitByProperties( child, properties )
				: child;

			return result;
		}, {} )
	);
}

function mergeDeep( base, overrides ) {
	if ( ! isPlainObject( base ) || ! isPlainObject( overrides ) ) {
		return overrides === undefined ? base : overrides;
	}

	return Object.entries( overrides ).reduce(
		( result, [ key, value ] ) => {
			result[ key ] = mergeDeep( base[ key ], value );
			return result;
		},
		{ ...base }
	);
}

/**
 * Whether a variation only changes the given properties.
 *
 * @param {Object}   variation  Style variation.
 * @param {string[]} properties Property keys.
 * @return {boolean} Whether nothing outside `properties` is set.
 */
export function isVariationWithProperties( variation, properties ) {
	const config = getStyleConfig( variation );

	return areStyleConfigsEqual(
		{
			settings: filterByProperties( config.settings, properties ),
			styles: filterByProperties( config.styles, properties ),
		},
		config
	);
}

export function getVariationTitle( variation, fallback = '' ) {
	const title = variation?.title;

	if ( typeof title === 'string' ) {
		return title;
	}

	return title?.rendered || title?.raw || variation?.name || fallback;
}

function uniqueByTitle( variations ) {
	const seen = new Set();

	return variations.filter( ( variation ) => {
		const title = getVariationTitle( variation );

		if ( seen.has( title ) ) {
			return false;
		}

		seen.add( title );
		return true;
	} );
}

/**
 * Sort theme variations into full looks, color palettes, and font pairings.
 *
 * @param {Object[]} variations Theme style variations.
 * @return {{ looks: Object[], colors: Object[], fonts: Object[] }} Groups.
 */
export function groupStyleVariations( variations = [] ) {
	const colors = [];
	const fonts = [];
	const looks = [];

	variations.forEach( ( variation ) => {
		if ( isVariationWithProperties( variation, COLOR_PROPERTIES ) ) {
			colors.push( variation );
		} else if (
			isVariationWithProperties( variation, TYPOGRAPHY_PROPERTIES )
		) {
			fonts.push( variation );
		} else {
			looks.push( variation );
		}
	} );

	return {
		colors: uniqueByTitle( colors ),
		fonts: uniqueByTitle( fonts ),
		looks: uniqueByTitle( looks ),
	};
}

/**
 * Replace one group of properties in the user's config with a preset's.
 *
 * Passing no preset resets those properties to the theme's defaults.
 *
 * @param {Object}   config     User global styles config.
 * @param {Object}   preset     Color or typography preset, or null.
 * @param {string[]} properties Properties the preset controls.
 * @return {{ settings: Object, styles: Object }} Updated config.
 */
export function applyPreset( config, preset, properties ) {
	const current = getStyleConfig( config );
	const base = {
		settings: omitByProperties( current.settings, properties ),
		styles: omitByProperties( current.styles, properties ),
	};

	if ( ! preset ) {
		return base;
	}

	const next = getStyleConfig( preset );

	return {
		settings: mergeDeep( base.settings, next.settings ),
		styles: mergeDeep( base.styles, next.styles ),
	};
}

/**
 * Find the preset that matches the user's current config.
 *
 * @param {Object}   config     User global styles config.
 * @param {Object[]} presets    Presets to compare against.
 * @param {string[]} properties Properties the presets control.
 * @return {Object|undefined} The matching preset.
 */
export function findActivePreset( config, presets, properties ) {
	const current = getStyleConfig( config );
	const currentPart = {
		settings: filterByProperties( current.settings, properties ),
		styles: filterByProperties( current.styles, properties ),
	};

	return presets.find( ( preset ) => {
		const presetConfig = getStyleConfig( preset );

		return areStyleConfigsEqual( currentPart, {
			settings: filterByProperties( presetConfig.settings, properties ),
			styles: filterByProperties( presetConfig.styles, properties ),
		} );
	} );
}

export function getValueAtPath( value, path ) {
	return path.reduce( ( current, key ) => current?.[ key ], value );
}

/**
 * Set or clear one value in a global styles config without mutating it.
 *
 * @param {Object}   config User global styles config.
 * @param {string[]} path   Path from the config root, e.g. [ 'styles', 'spacing', 'blockGap' ].
 * @param {*}        value  New value, or undefined to clear it.
 * @return {{ settings: Object, styles: Object }} Updated config.
 */
export function setValueAtPath( config, path, value ) {
	const setIn = ( target, [ key, ...rest ] ) => {
		const source = isPlainObject( target ) ? target : {};

		return {
			...source,
			[ key ]: rest.length ? setIn( source[ key ], rest ) : value,
		};
	};

	return getStyleConfig( setIn( getStyleConfig( config ), path ) );
}

/**
 * Get the colors a variation uses, for swatches.
 *
 * @param {Object} variation Style variation.
 * @return {Object[]} Palette entries.
 */
export function getVariationPalette( variation ) {
	return (
		variation?.settings?.color?.palette?.theme ||
		variation?.settings?.color?.palette?.default ||
		[]
	);
}

/**
 * Get the font families a variation uses, for swatches.
 *
 * @param {Object} variation Style variation.
 * @return {Object[]} Font family entries.
 */
export function getVariationFontFamilies( variation ) {
	return (
		variation?.settings?.typography?.fontFamilies?.theme ||
		variation?.settings?.typography?.fontFamilies?.default ||
		[]
	);
}
