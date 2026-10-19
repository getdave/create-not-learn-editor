/**
 * Layout arrangements: other ways to lay out the same section.
 *
 * A section can often be shown another way without losing any of its words
 * or pictures: its image on the other side, above the text or behind it,
 * its cards three to a row instead of four. People can cycle through the
 * arrangements freely; what one shape has and another hasn't, like a
 * cover's height, may not come back, but Reset in Edit design does that.
 *
 * Arrangements are worked out from the shape of a section's blocks, not from
 * the pattern it came from, so they work for any theme's patterns and for
 * sections rearranged by hand. A section's shape is often wrapped in a group
 * or two, perhaps with a heading above it; those are looked through.
 *
 * Every arrangement should look clearly different from the others, so each
 * moves things around: an image to another side or behind the text, more
 * or fewer items in a row.
 *
 * Pure functions only: no React, no stores.
 */

/**
 * Internal dependencies
 */
import { cloneAll, isPlainGroup, isText, rebuild } from './blocks';
import { ALTERNATING_ROWS } from './families/alternating-rows';
import { GALLERY, GRID } from './families/grid';
import { IMAGE_AND_TEXT } from './families/image-and-text';

// Layout families, tried in this order.
const LAYOUTS = [ IMAGE_AND_TEXT, ALTERNATING_ROWS, GRID, GALLERY ];

// How many wrapping groups to look through.
const MAX_DEPTH = 3;

const INTRO_BLOCKS = [ 'core/heading', 'core/paragraph', 'core/buttons' ];

/**
 * Split a group's blocks into the heading and text above its layout, if
 * there are any, and the rest. The heading and text are a run of headings,
 * paragraphs and buttons, or a plain group holding only text.
 *
 * @param {Object[]} blocks A group's inner blocks.
 * @return {Object} `{ intro, rest }`.
 */
function splitIntro( blocks ) {
	const [ first ] = blocks;

	if (
		blocks.length > 1 &&
		isPlainGroup( first ) &&
		isText( first.innerBlocks )
	) {
		return { intro: [ first ], rest: blocks.slice( 1 ) };
	}

	let length = 0;

	while (
		length < blocks.length &&
		INTRO_BLOCKS.includes( blocks[ length ].name )
	) {
		length++;
	}

	return { intro: blocks.slice( 0, length ), rest: blocks.slice( length ) };
}

/**
 * The blocks in a section that could hold its layout, outermost first.
 *
 * Each is `{ target, intro, wrap }`. `intro` is the heading and text above
 * the target, if any. `wrap( target, intro )` puts copies of both back in
 * copies of the groups around them, giving the whole section.
 *
 * @param {Object} block Section, or a block in it.
 * @param {number} depth How many groups have been looked through.
 * @return {Object[]} Candidates.
 */
function getCandidates( block, depth = 0 ) {
	const candidates = [ { target: block, intro: [], wrap: ( t ) => t } ];

	if ( depth >= MAX_DEPTH || block.name !== 'core/group' ) {
		return candidates;
	}

	const { intro, rest } = splitIntro( block.innerBlocks );

	if ( rest.length !== 1 ) {
		return candidates;
	}

	if ( intro.length ) {
		candidates.push( {
			target: rest[ 0 ],
			intro,
			wrap: ( target, newIntro ) =>
				rebuild( block, block.attributes, [ ...newIntro, target ] ),
		} );

		return candidates;
	}

	getCandidates( rest[ 0 ], depth + 1 ).forEach( ( inner ) =>
		candidates.push( {
			...inner,
			wrap: ( target, newIntro ) =>
				rebuild( block, block.attributes, [
					inner.wrap( target, newIntro ),
				] ),
		} )
	);

	return candidates;
}

/**
 * A layout's arrangements.
 *
 * Alignment isn't offered alongside a layout: text lined up another way
 * beside the same picture looks too much like the arrangement it came from.
 *
 * @param {Object} family    Layout family.
 * @param {Object} state     The layout, as the family read it.
 * @param {Object} candidate Where the layout is.
 * @return {?Object} `{ current, options }`, or null.
 */
function arrange( family, state, candidate ) {
	const { target, intro, wrap } = candidate;
	const options = family.getOptions( state, target );

	if ( options.length < 2 ) {
		return null;
	}

	return {
		current: family.getCurrent( state, options ),
		options: options.map( ( option ) => {
			const block = wrap(
				family.arrange( target, state, option ),
				cloneAll( intro )
			);

			return {
				name: option.name,
				label: option.label,
				block: family.fit ? family.fit( block, state, option ) : block,
			};
		} ),
	};
}

/**
 * The arrangements for one place a layout could be.
 *
 * @param {Object} candidate Where.
 * @return {?Object} `{ current, options }`, or null.
 */
function getArrangements( candidate ) {
	for ( const family of LAYOUTS ) {
		const state = family.read( candidate.target );
		const arrangements = state && arrange( family, state, candidate );

		if ( arrangements ) {
			return arrangements;
		}
	}

	return null;
}

/**
 * The other ways a section can be laid out without losing any of its
 * content, and which of them it is laid out in now.
 *
 * @param {Object} block A section block (from the block editor, with
 *                       clientId, name, attributes, innerBlocks).
 * @return {?Object} null when the section has no arrangements, else
 *   `{ current, options }`. Each option is `{ name, label, block }`, where
 *   `block` is the section rearranged that way, ready for `replaceBlock`.
 *   `current` is the name of the option the section matches now, or null.
 */
export function getSectionArrangements( block ) {
	if ( ! Array.isArray( block?.innerBlocks ) ) {
		return null;
	}

	for ( const candidate of getCandidates( block ) ) {
		const arrangements = getArrangements( candidate );

		if ( arrangements ) {
			return arrangements;
		}
	}

	return null;
}
