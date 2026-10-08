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
import { groupSectionDesigns } from './groups';

const EMPTY_ARRAY = [];

const HIDDEN_CATEGORIES = [ 'header', 'footer', 'navigation', 'query' ];

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
 * The patterns that can be added to a page as sections, and the same patterns
 * grouped by what they are for.
 *
 * @return {Object} `{ groups, isLoading, patterns }`.
 */
export function useSectionDesigns() {
	const { isLoading, patterns, themeName } = useSelect( ( select ) => {
		const store = select( coreDataStore );

		return {
			isLoading: ! store.hasFinishedResolution( 'getBlockPatterns' ),
			patterns: store.getBlockPatterns?.() || EMPTY_ARRAY,
			themeName: store.getCurrentTheme()?.name?.rendered,
		};
	}, [] );

	return useMemo( () => {
		const sectionPatterns = patterns.filter( isSectionPattern );

		return {
			groups: groupSectionDesigns(
				sectionPatterns,
				decodeEntities( themeName || '' )
			),
			isLoading,
			patterns: sectionPatterns,
		};
	}, [ isLoading, patterns, themeName ] );
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
