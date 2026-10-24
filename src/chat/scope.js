/**
 * Which of the chat's pickers change the whole site, rather than one page.
 *
 * The chat often sits beside a page, so a change to the site's colors, or
 * to the header every page shares, can look like a change to that page.
 * These pickers are marked in purple with a globe, as the editor marks
 * anything shared, and the language model is told so it can say so too.
 * What changes one page isn't marked, as in the editor, but its picker
 * names the page.
 *
 * Kept free of React and WordPress packages so it can be tested on its own.
 */

const SITE_WIDE = new Set( [
	'colors',
	'fonts',
	'footer',
	'header',
	'logo',
	'look',
	'menu',
	'site-part',
	'site-title',
	'social-links',
] );

/**
 * @param {?string} skillId A skill.
 * @return {boolean} Whether its picker changes every page of the site.
 */
export function isSiteWide( skillId ) {
	return SITE_WIDE.has( skillId );
}
