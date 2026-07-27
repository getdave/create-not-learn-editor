/**
 * Internal dependencies
 */
import { createBlock } from '../../wordpress-packages';

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

function createExistingPageNavigationLinkBlock() {
	return createBlock( 'core/navigation-link', {
		kind: 'post-type',
		type: 'page',
	} );
}

function createCustomNavigationLinkBlock() {
	return createBlock( 'core/navigation-link' );
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
	createPageNavigationSubmenuBlock,
	getBlockListRootClientId,
	getLabelOnlyNavigationSubmenuAttributes,
	insertBlockAtListAppenderPosition,
};
