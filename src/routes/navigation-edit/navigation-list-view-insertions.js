/**
 * Internal dependencies
 */
import { createBlock, getBlockVariations } from '../../wordpress-packages';

function getBlockListRootClientId( clientId ) {
	return clientId || '';
}

function insertBlockAtListAppenderPosition( blocks, block, blockCount ) {
	const nextBlocks = [ ...( blocks || [] ) ];
	const insertionIndex =
		Number.isInteger( blockCount ) && blockCount >= 0
			? blockCount
			: nextBlocks.length;

	nextBlocks.splice( insertionIndex, 0, block );
	return nextBlocks;
}

// Core's attributes for these variations, for before the block's variations
// are registered.
const NAVIGATION_LINK_VARIATION_FALLBACKS = {
	'custom-link': { kind: 'custom' },
	page: { kind: 'post-type', type: 'page' },
};

/**
 * A navigation link made from one of its variations, as core's inserter makes
 * it, so a new link is the kind of link it is meant to be from the start.
 *
 * @param {string} variationName Variation name, such as `custom-link`.
 * @param {Object} attributes    Attributes to add.
 * @return {Object} The block.
 */
function createNavigationLinkVariationBlock( variationName, attributes = {} ) {
	const variation = (
		getBlockVariations( 'core/navigation-link' ) || []
	).find( ( { name } ) => name === variationName );

	return createBlock( 'core/navigation-link', {
		...( variation?.attributes ||
			NAVIGATION_LINK_VARIATION_FALLBACKS[ variationName ] ),
		...attributes,
	} );
}

function createExistingPageNavigationLinkBlock() {
	return createNavigationLinkVariationBlock( 'page' );
}

function createCustomNavigationLinkBlock() {
	return createNavigationLinkVariationBlock( 'custom-link' );
}

function createPageNavigationSubmenuBlock() {
	return createBlock( 'core/navigation-submenu', {
		kind: 'post-type',
		type: 'page',
	} );
}

function createCustomNavigationSubmenuBlock() {
	return createBlock( 'core/navigation-submenu' );
}

function createLabelOnlyNavigationSubmenuBlock() {
	return createBlock( 'core/navigation-submenu' );
}

function getLabelOnlyNavigationSubmenuAttributes( label ) {
	return {
		label: label.trim(),
		url: '#',
	};
}

export {
	createCustomNavigationLinkBlock,
	createCustomNavigationSubmenuBlock,
	createExistingPageNavigationLinkBlock,
	createLabelOnlyNavigationSubmenuBlock,
	createNavigationLinkVariationBlock,
	createPageNavigationSubmenuBlock,
	getBlockListRootClientId,
	getLabelOnlyNavigationSubmenuAttributes,
	insertBlockAtListAppenderPosition,
};
