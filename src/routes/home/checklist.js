/**
 * The "Create your site" checklist on the "Your site" screen.
 *
 * Each step is worked out from the site itself rather than from a stored
 * "done" flag, so the list stays honest when changes are made elsewhere in
 * WordPress and never needs to write anything when the editor loads.
 */

/**
 * Internal dependencies
 */
import {
	COLOR_PROPERTIES,
	TYPOGRAPHY_PROPERTIES,
	filterByProperties,
} from '../static/style-variations';

export const CREATION_STEP_IDS = [
	'identity',
	'colors',
	'fonts',
	'homepage',
	'pages',
];

/*
 * A fresh install ships with a Home page and the Sample Page, so a site needs
 * at least one more published page before it counts as "has its pages".
 */
export const MIN_PUBLISHED_PAGES = 3;

// Saving a new page stamps `modified` a moment after `date`.
const EDITED_THRESHOLD_MS = 60 * 1000;

function hasKeys( value ) {
	return (
		!! value &&
		typeof value === 'object' &&
		Object.keys( value ).some( ( key ) => {
			const child = value[ key ];

			if ( child && typeof child === 'object' ) {
				return hasKeys( child );
			}

			return child !== undefined && child !== null && child !== '';
		} )
	);
}

/**
 * Whether the user has changed the theme's colors, fonts, or spacing.
 *
 * @param {Object} globalStyles The user's global styles record.
 * @return {boolean} Whether any user styles or settings are stored.
 */
export function hasCustomGlobalStyles( globalStyles ) {
	return hasKeys( globalStyles?.styles ) || hasKeys( globalStyles?.settings );
}

/**
 * Whether the user has changed part of the theme's styles.
 *
 * The Colors and Fonts screens each own one group of properties, so a step is
 * done once anything in its group is stored. Picking a whole-site look stores
 * both groups at once and finishes both steps.
 *
 * @param {Object}   globalStyles The user's global styles record.
 * @param {string[]} properties   Properties the screen controls.
 * @return {boolean} Whether any of those properties are stored.
 */
function hasCustomStyleProperties( globalStyles, properties ) {
	return hasCustomGlobalStyles( {
		settings: filterByProperties( globalStyles?.settings, properties ),
		styles: filterByProperties( globalStyles?.styles, properties ),
	} );
}

/**
 * Whether the user has changed the theme's colors.
 *
 * @param {Object} globalStyles The user's global styles record.
 * @return {boolean} Whether any user colors are stored.
 */
export function hasCustomColors( globalStyles ) {
	return hasCustomStyleProperties( globalStyles, COLOR_PROPERTIES );
}

/**
 * Whether the user has changed the theme's fonts.
 *
 * @param {Object} globalStyles The user's global styles record.
 * @return {boolean} Whether any user typography or spacing is stored.
 */
export function hasCustomFonts( globalStyles ) {
	return hasCustomStyleProperties( globalStyles, TYPOGRAPHY_PROPERTIES );
}

/**
 * Whether a page has been saved again after it was first created.
 *
 * @param {Object} page Page record with `date_gmt` and `modified_gmt`.
 * @return {boolean} Whether the page was edited.
 */
export function hasBeenEdited( page ) {
	const created = Date.parse( page?.date_gmt || page?.date || '' );
	const modified = Date.parse( page?.modified_gmt || page?.modified || '' );

	if ( Number.isNaN( created ) || Number.isNaN( modified ) ) {
		return false;
	}

	return modified - created > EDITED_THRESHOLD_MS;
}

/**
 * Work out which creation steps are complete.
 *
 * @param {Object} data                    Site data.
 * @param {Object} data.site               Site settings record.
 * @param {Object} data.globalStyles       User global styles record.
 * @param {Object} data.frontPage          Page shown on the front of the site.
 * @param {number} data.publishedPageCount Number of published pages.
 * @return {Object<string, boolean>} Completion keyed by step ID.
 */
export function getCreationStepStatus( {
	frontPage,
	globalStyles,
	publishedPageCount = 0,
	site,
} = {} ) {
	return {
		identity: Boolean( site?.description?.trim() || site?.site_logo ),
		colors: hasCustomColors( globalStyles ),
		fonts: hasCustomFonts( globalStyles ),
		homepage:
			site?.show_on_front === 'page' &&
			Boolean( frontPage ) &&
			hasBeenEdited( frontPage ),
		pages: publishedPageCount >= MIN_PUBLISHED_PAGES,
	};
}

/**
 * Count completed steps.
 *
 * @param {Object<string, boolean>} status Completion keyed by step ID.
 * @return {{ done: number, total: number, percent: number }} Progress.
 */
export function getCreationProgress( status = {} ) {
	const total = CREATION_STEP_IDS.length;
	const done = CREATION_STEP_IDS.filter( ( id ) => status[ id ] ).length;

	return {
		done,
		percent: Math.round( ( done / total ) * 100 ),
		total,
	};
}
