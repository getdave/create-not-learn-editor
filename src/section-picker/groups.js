/**
 * How section designs are grouped and searched in the section picker.
 *
 * Core's pattern categories are named after what a design is, like Banners or
 * Columns. The picker groups them by what it is for instead, like introducing
 * yourself or selling something. Categories outside the table, such as the
 * ones a theme registers, go into a catch-all group named after the theme.
 */

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import {
	getPatternDescription,
	getPatternTitle,
} from '../routes/content/page-layouts';

const EMPTY_ARRAY = [];

export const THEME_GROUP = 'theme';

/**
 * The purpose groups, in the order they are shown, and the core categories
 * each one takes in. A design lands in the first group that takes one of its
 * categories.
 *
 * @return {Object[]} `{ name, label, description, categories }` groups.
 */
export function getSectionGroups() {
	return [
		{
			name: 'introduce',
			label: __( 'Introduce' ),
			description: __( 'Say who you are' ),
			categories: [ 'banner', 'about', 'team' ],
		},
		{
			name: 'sell',
			label: __( 'Sell' ),
			description: __( 'Win people over' ),
			categories: [ 'call-to-action', 'services', 'testimonials' ],
		},
		{
			name: 'showcase',
			label: __( 'Showcase' ),
			description: __( 'Show off your work' ),
			categories: [ 'portfolio', 'gallery', 'media', 'videos', 'audio' ],
		},
		{
			name: 'write',
			label: __( 'Write' ),
			description: __( 'Words, quotes and lists' ),
			categories: [ 'text', 'columns', 'buttons' ],
		},
		{
			name: 'posts',
			label: __( 'Posts' ),
			description: __( 'Share your latest writing' ),
			categories: [ 'posts' ],
		},
		{
			name: 'contact',
			label: __( 'Get in touch' ),
			description: __( 'Help people reach you' ),
			categories: [ 'contact' ],
		},
	];
}

/**
 * Group section designs by purpose, each design once.
 *
 * @param {Object[]} patterns  Section patterns, in the order to show them.
 * @param {string}   themeName Active theme's name, for the catch-all group.
 * @return {Object[]} Non-empty `{ name, label, description, patterns }` groups.
 */
export function groupSectionDesigns( patterns, themeName ) {
	const groups = [
		...getSectionGroups(),
		{
			name: THEME_GROUP,
			label: themeName
				? sprintf(
						/* translators: %s: theme name. */
						__( 'From %s' ),
						themeName
					)
				: __( 'More designs' ),
			description: __( 'Designs from your theme' ),
			categories: EMPTY_ARRAY,
		},
	].map( ( group ) => ( { ...group, patterns: [] } ) );
	const catchAll = groups[ groups.length - 1 ];

	( patterns || EMPTY_ARRAY ).forEach( ( pattern ) => {
		const categories = pattern.categories || EMPTY_ARRAY;
		const group =
			groups.find( ( { categories: taken } ) =>
				taken.some( ( category ) => categories.includes( category ) )
			) || catchAll;

		group.patterns.push( pattern );
	} );

	return groups
		.filter( ( group ) => group.patterns.length )
		.map( ( { categories, ...group } ) => group );
}

function normalise( value ) {
	return String( value || '' )
		.normalize( 'NFD' )
		.replace( /[̀-ͯ]/g, '' )
		.toLowerCase();
}

/**
 * The section designs that match a search, in their original order.
 *
 * Every word searched for has to appear in the design's title, description or
 * keywords.
 *
 * @param {Object[]} patterns Section patterns.
 * @param {string}   search   What was typed.
 * @return {Object[]} Matching patterns.
 */
export function searchSectionDesigns( patterns, search ) {
	const words = normalise( search ).split( /\s+/ ).filter( Boolean );

	if ( ! words.length ) {
		return patterns || EMPTY_ARRAY;
	}

	return ( patterns || EMPTY_ARRAY ).filter( ( pattern ) => {
		const haystack = normalise(
			[
				getPatternTitle( pattern ),
				getPatternDescription( pattern ),
				...( pattern.keywords || EMPTY_ARRAY ),
			].join( ' ' )
		);

		return words.every( ( word ) => haystack.includes( word ) );
	} );
}
