/**
 * Designs a language model writes: one of the theme's page or section
 * designs, with its words rewritten for what the user asked, like a page
 * about sock puppets.
 *
 * A written design is a pattern object like the theme's, so the chat's
 * pickers show it among the others, first, and picking and keeping it work
 * as they do for any design. See `model.js`.
 */

/**
 * WordPress dependencies
 */
import {
	createBlock,
	getBlockTypes,
	parse,
	serialize,
} from '@wordpress/blocks';
import { store as coreDataStore } from '@wordpress/core-data';
import { resolveSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import {
	getPatternContent,
	getPatternDescription,
	getPatternTitle,
	isPageLayoutPattern,
} from '../routes/content/page-layouts';
import { searchSectionDesigns } from '../section-picker/groups';
import {
	isLayoutPattern,
	isSectionPattern,
	isThemePattern,
} from '../section-picker/patterns';
import { carriesScript } from './model-tools';

// How many designs to list for the model to choose from.
const MAX_LISTED = 30;

// The designs written so far, by name, so the model can read one back.
const written = new Map();

/**
 * The designs the chat's pickers offer for a page or a section, the
 * theme's own first, as the pickers order them.
 *
 * @param {string} kind `page` or `section`.
 * @return {Promise<Object[]>} Patterns.
 */
async function getDesigns( kind ) {
	const [ patterns, theme ] = await Promise.all( [
		resolveSelect( coreDataStore ).getBlockPatterns(),
		resolveSelect( coreDataStore ).getCurrentTheme(),
	] );

	if ( kind === 'page' ) {
		return ( patterns || [] ).filter( isPageLayoutPattern );
	}

	const designs = ( patterns || [] ).filter(
		( pattern ) =>
			isSectionPattern( pattern ) && ! isLayoutPattern( pattern )
	);
	const isTheme = ( pattern ) =>
		isThemePattern( pattern, {
			stylesheet: theme?.stylesheet,
			template: theme?.template,
		} );

	return [
		...designs.filter( isTheme ),
		...designs.filter( ( pattern ) => ! isTheme( pattern ) ),
	];
}

/**
 * List the designs for a page or a section, those that suit a search first.
 *
 * @param {Object} args        What the model asked for.
 * @param {string} args.kind   `page` or `section`.
 * @param {string} args.search What the design is for, if it said.
 * @return {Promise<Object>} `{ designs }`, each `{ name, title, description }`.
 */
export async function listDesigns( { kind, search } ) {
	const designs = await getDesigns( kind === 'page' ? 'page' : 'section' );
	const matches = search ? searchSectionDesigns( designs, search ) : [];
	const ranked = [
		...matches,
		...designs.filter( ( pattern ) => ! matches.includes( pattern ) ),
	];

	return {
		designs: ranked.slice( 0, MAX_LISTED ).map( ( pattern ) => ( {
			name: pattern.name,
			title: getPatternTitle( pattern ),
			description: getPatternDescription( pattern ),
		} ) ),
	};
}

/**
 * Read a design's block markup, for the model to rewrite.
 *
 * @param {Object} args      What the model asked for.
 * @param {string} args.name The design's name.
 * @return {Promise<Object>} `{ name, title, content }`, or `{ error }`.
 */
export async function readDesign( { name } ) {
	const patterns = await resolveSelect( coreDataStore ).getBlockPatterns();
	const pattern =
		written.get( name ) ||
		( patterns || [] ).find( ( candidate ) => candidate.name === name );

	if ( ! pattern ) {
		return { error: `There is no design called "${ name }".` };
	}

	return {
		name: pattern.name,
		title: getPatternTitle( pattern ),
		content: getPatternContent( pattern ),
	};
}

/**
 * Rebuild a block that doesn't match what its block type saves, as the
 * editor's "Attempt recovery" does, from the attributes read from it.
 *
 * Rewriting a design's words often leaves a block's markup a little off,
 * which the editor would otherwise show as broken.
 *
 * @param {Object} block Parsed block.
 * @return {Object} The block, valid.
 */
function recoverBlock( block ) {
	const innerBlocks = block.innerBlocks.map( recoverBlock );

	if ( block.isValid === false ) {
		return createBlock( block.name, block.attributes, innerBlocks );
	}

	return { ...block, innerBlocks };
}

function findUnknownBlock( blocks ) {
	for ( const block of blocks ) {
		if ( block.name === 'core/missing' || block.name === 'core/freeform' ) {
			return block;
		}

		const inner = findUnknownBlock( block.innerBlocks );

		if ( inner ) {
			return inner;
		}
	}

	return null;
}

/**
 * Turn the markup a model wrote into a design the chat's pickers can show.
 *
 * @param {Object} args             What the model called a tool with.
 * @param {string} args.content     Block markup.
 * @param {string} args.based_on    The design it rewrote, if any.
 * @param {string} args.design_name A name for the design.
 * @return {Object} `{ pattern }`, or `{ error }` for the model to fix.
 */
export function writeDesign( {
	content,
	based_on: basedOn,
	design_name: designName,
} ) {
	if ( ! getBlockTypes().length ) {
		return { error: 'The editor is still loading. Try again.' };
	}

	const blocks = parse( String( content || '' ) ).filter(
		// Whitespace between blocks parses as an empty freeform block.
		( block ) =>
			block.name !== 'core/freeform' || block.originalContent.trim()
	);

	if ( ! blocks.length ) {
		return { error: 'The content has no blocks.' };
	}

	const unknown = findUnknownBlock( blocks );

	if ( unknown ) {
		return {
			error: `The content has markup that isn't a block it knows ("${ unknown.attributes?.originalName || 'HTML outside a block' }"). Write it with the blocks the design uses.`,
		};
	}

	if ( carriesScript( content ) ) {
		return {
			error: 'Not shown: this editor does not add raw HTML or scripts.',
		};
	}

	const pattern = {
		name: `create-not-learn-editor/written-${ written.size + 1 }`,
		title: designName || __( 'Written for you' ),
		description: __( 'Written for you' ),
		content: serialize( blocks.map( recoverBlock ) ),
		basedOn: basedOn || null,
	};

	written.set( pattern.name, pattern );

	return { pattern };
}
