/**
 * The block patterns that can be added to a page as sections, and the blocks
 * they add.
 */

/**
 * WordPress dependencies
 */
import { createBlock, parse } from '@wordpress/blocks';
import { store as coreDataStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { useMemo } from '@wordpress/element';
import { decodeEntities } from '@wordpress/html-entities';

/**
 * Internal dependencies
 */
import {
	getPatternContent,
	getPatternTitle,
	isPageLayoutPattern,
} from '../routes/content/page-layouts';
import { groupLayouts, groupSectionDesigns } from './groups';

const EMPTY_ARRAY = [];

const HIDDEN_CATEGORIES = [ 'header', 'footer', 'navigation', 'query' ];

/**
 * The pattern category of layouts, registered in `includes/layouts.php`.
 */
export const LAYOUT_CATEGORY = 'cnl-layouts';

function isHiddenCategory( category ) {
	return (
		HIDDEN_CATEGORIES.includes( category ) ||
		category.endsWith( '_post-format' ) ||
		category.endsWith( '_page' )
	);
}

/**
 * Whether a pattern is a section of a page, rather than a whole page, a site
 * part, or something for a particular template.
 *
 * @param {Object} pattern Block pattern.
 * @return {boolean} Whether it can be added as a section.
 */
export function isSectionPattern( pattern ) {
	const categories = pattern?.categories || EMPTY_ARRAY;
	const blockTypes = pattern?.blockTypes || EMPTY_ARRAY;

	if (
		! pattern ||
		pattern.inserter === false ||
		pattern.templateTypes?.length ||
		isPageLayoutPattern( pattern )
	) {
		return false;
	}

	if (
		blockTypes.some(
			( blockType ) =>
				blockType.startsWith( 'core/template-part' ) ||
				blockType === 'core/post-content'
		)
	) {
		return false;
	}

	return categories.some( ( category ) => ! isHiddenCategory( category ) );
}

/**
 * Whether a pattern is one of the plain layouts, rather than a design.
 *
 * @param {Object} pattern Block pattern.
 * @return {boolean} Whether it is a layout.
 */
export function isLayoutPattern( pattern ) {
	return !! pattern?.categories?.includes( LAYOUT_CATEGORY );
}

/**
 * Whether a pattern comes from the active theme, rather than from core, the
 * pattern directory or a plugin.
 *
 * Core leaves `source` unset for the patterns in a theme's `patterns/`
 * folder, so they are told apart by their slug, which starts with the
 * theme's own, or its parent's.
 *
 * @param {Object} pattern Block pattern.
 * @param {Object} theme   Active theme, `{ stylesheet, template }`.
 * @return {boolean} Whether it is the theme's.
 */
export function isThemePattern( pattern, theme ) {
	if ( pattern?.source === 'theme' ) {
		return true;
	}

	return [ theme?.stylesheet, theme?.template ].some(
		( slug ) => slug && pattern?.name?.startsWith( `${ slug }/` )
	);
}

/**
 * The patterns that can be added to a page as sections, split into the plain
 * layouts and the designs. Designs are grouped by what they are for, and
 * layouts by their shape. The theme's own designs come first, so a page is
 * offered designs that match it before stock ones.
 *
 * @return {Object} `{ groups, isLoading, layoutGroups, layouts, patterns,
 *                  themePatterns }`, where `patterns` and `groups` hold the
 *                  designs, and `themePatterns` the theme's, which start
 *                  `patterns`.
 */
export function useSectionDesigns() {
	const { isLoading, patterns, stylesheet, template, themeName } = useSelect(
		( select ) => {
			const store = select( coreDataStore );
			const theme = store.getCurrentTheme();

			return {
				isLoading: ! store.hasFinishedResolution( 'getBlockPatterns' ),
				patterns: store.getBlockPatterns?.() || EMPTY_ARRAY,
				stylesheet: theme?.stylesheet,
				template: theme?.template,
				themeName: theme?.name?.rendered,
			};
		},
		[]
	);

	return useMemo( () => {
		const sectionPatterns = patterns.filter( isSectionPattern );
		const allDesigns = sectionPatterns.filter(
			( pattern ) => ! isLayoutPattern( pattern )
		);
		const theme = { stylesheet, template };
		const themePatterns = allDesigns.filter( ( pattern ) =>
			isThemePattern( pattern, theme )
		);
		const designs = [
			...themePatterns,
			...allDesigns.filter(
				( pattern ) => ! isThemePattern( pattern, theme )
			),
		];
		const layouts = sectionPatterns.filter( isLayoutPattern );

		return {
			groups: groupSectionDesigns(
				designs,
				decodeEntities( themeName || '' )
			),
			isLoading,
			layoutGroups: groupLayouts( layouts ),
			layouts,
			patterns: designs,
			themePatterns,
		};
	}, [ isLoading, patterns, stylesheet, template, themeName ] );
}

/**
 * The blocks a pattern adds, named after the pattern so the new section shows
 * up in the list under the name it was picked by.
 *
 * @param {Object} pattern Block pattern.
 * @return {Object[]} Blocks.
 */
export function getPatternSectionBlocks( pattern ) {
	const blocks = parse( getPatternContent( pattern ) );

	if ( blocks.length !== 1 ) {
		return blocks;
	}

	const [ block ] = blocks;

	return [
		{
			...block,
			attributes: {
				...block.attributes,
				metadata: {
					...block.attributes?.metadata,
					name:
						block.attributes?.metadata?.name ||
						getPatternTitle( pattern ),
					patternName: pattern.name,
				},
			},
		},
	];
}

/**
 * An empty section to build from scratch: a group holding a blank paragraph.
 *
 * It has no pattern behind it, so it is fully editable rather than
 * content-only.
 *
 * @return {Object} The group block. Its paragraph is `innerBlocks[ 0 ]`.
 */
export function createBlankSection() {
	return createBlock( 'core/group', { layout: { type: 'constrained' } }, [
		createBlock( 'core/paragraph' ),
	] );
}
