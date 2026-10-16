/**
 * Block helpers shared by the arrangement families. Pure functions only.
 */

/**
 * WordPress dependencies
 */
import { cloneBlock } from '@wordpress/blocks';

export const MEDIA_BLOCKS = [ 'core/image', 'core/cover', 'core/video' ];
export const TEXT_BLOCKS = [ 'core/heading', 'core/paragraph' ];

// Blocks that can sit among text without making it more than text.
const TEXT_PARTS = [
	...TEXT_BLOCKS,
	'core/buttons',
	'core/button',
	'core/social-links',
	'core/social-link',
	'core/spacer',
	'core/separator',
];

/**
 * A copy of a block with the given attributes and inner blocks in place of
 * its own. Built on `cloneBlock`, so it gets a fresh client ID and keeps
 * everything else, including `metadata.patternName`.
 *
 * @param {Object}   block       Block to copy.
 * @param {Object}   attributes  Its new attributes, in full.
 * @param {Object[]} innerBlocks Its new inner blocks, already copied.
 * @return {Object} The copy.
 */
export function rebuild( block, attributes, innerBlocks ) {
	return { ...cloneBlock( block, {}, innerBlocks ), attributes };
}

/**
 * Fresh copies of blocks, so nothing in an arrangement shares a client ID
 * with the section it replaces.
 *
 * @param {Object[]} blocks Blocks.
 * @return {Object[]} Copies.
 */
export function cloneAll( blocks ) {
	return blocks.map( ( block ) => cloneBlock( block ) );
}

/**
 * Set a value deep in an object, or remove it when `value` is undefined.
 * Objects left empty by a removal are removed too, so a section aligned back
 * to its default ends up with the same attributes it started with.
 *
 * @param {?Object}  object Object to start from. Not changed.
 * @param {string[]} path   Keys leading to the value.
 * @param {*}        value  New value, or undefined to remove it.
 * @return {?Object} The updated copy, or undefined when nothing is left.
 */
export function setIn( object, [ key, ...rest ], value ) {
	const next = { ...object };
	const nested = rest.length ? setIn( next[ key ], rest, value ) : value;

	if ( nested === undefined ) {
		delete next[ key ];
	} else {
		next[ key ] = nested;
	}

	return Object.keys( next ).length ? next : undefined;
}

/**
 * Walk blocks and their descendants, calling `visit` on each.
 *
 * @param {Object[]} blocks Blocks.
 * @param {Function} visit  Called with each block.
 */
export function walk( blocks, visit ) {
	blocks.forEach( ( block ) => {
		visit( block );
		walk( block.innerBlocks ?? [], visit );
	} );
}

export function isMediaBlock( block ) {
	return MEDIA_BLOCKS.includes( block?.name );
}

/**
 * Whether a group stacks or holds its blocks rather than laying them out in
 * a row or a grid.
 *
 * @param {Object} block Block.
 * @return {boolean} Whether it is such a group.
 */
export function isPlainGroup( block ) {
	const type = block?.attributes?.layout?.type;

	return (
		block?.name === 'core/group' &&
		( ! type || type === 'default' || type === 'constrained' )
	);
}

/**
 * Whether blocks are only text: headings and paragraphs, perhaps with
 * buttons, icons and plain groups around them.
 *
 * @param {Object[]} blocks Blocks.
 * @return {boolean} Whether they are, with at least one heading or paragraph.
 */
export function isText( blocks ) {
	let only = true;
	let words = false;

	walk( blocks, ( block ) => {
		words = words || TEXT_BLOCKS.includes( block.name );
		only =
			only &&
			( TEXT_PARTS.includes( block.name ) || isPlainGroup( block ) );
	} );

	return only && words;
}
