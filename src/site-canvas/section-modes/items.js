/**
 * The items of a section: the things in it that can be removed one at a
 * time, added to, and put back. A heading, a paragraph, a row of buttons, an
 * image, or a card made of an image and its words.
 *
 * Items are found in the section's block tree, and changes are made by
 * rewriting the blocks around them, never by core's insert and remove
 * actions: a section is content-only in Edit, and core turns those down
 * inside one.
 *
 * Pure functions only: no React, no stores.
 */

/**
 * WordPress dependencies
 */
import { createBlock } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';

// Blocks with blocks inside that are still one thing on the page.
const WHOLE_BLOCKS = [
	'core/buttons',
	'core/details',
	'core/gallery',
	'core/list',
	'core/navigation',
	'core/pullquote',
	'core/quote',
	'core/social-links',
	'core/table',
];

// Blocks that take up room but show nothing to remove.
const SPACING_BLOCKS = [ 'core/spacer' ];

const MEDIA_BLOCKS = [ 'core/image', 'core/video', 'core/cover' ];
const TEXT_BLOCKS = [ 'core/heading', 'core/paragraph' ];
const CARD_BLOCKS = [ 'core/column', 'core/group' ];

function isLeaf( block ) {
	return WHOLE_BLOCKS.includes( block.name ) || ! block.innerBlocks.length;
}

/**
 * Whether a block is a card: a column or group of plain items, with a
 * picture and words, that sits beside others like it.
 *
 * @param {Object}   block    The block.
 * @param {Object[]} siblings The blocks beside it, itself included.
 * @return {boolean} Whether it is a card.
 */
function isCard( block, siblings ) {
	const isOwnCard = ( item ) =>
		CARD_BLOCKS.includes( item.name ) &&
		item.innerBlocks.length > 1 &&
		item.innerBlocks.every( isLeaf ) &&
		item.innerBlocks.some( ( inner ) =>
			MEDIA_BLOCKS.includes( inner.name )
		) &&
		item.innerBlocks.some( ( inner ) =>
			TEXT_BLOCKS.includes( inner.name )
		);

	return (
		isOwnCard( block ) &&
		siblings.filter( ( sibling ) => isOwnCard( sibling ) ).length > 1
	);
}

/**
 * Every item in a section, top to bottom.
 *
 * @param {Object} section The section's block, with its inner blocks.
 * @return {Object[]} `{ block, clientId, isImage }` for each item.
 */
export function getItems( section ) {
	const items = [];

	const walk = ( blocks ) =>
		blocks.forEach( ( block ) => {
			if ( SPACING_BLOCKS.includes( block.name ) ) {
				return;
			}

			if ( isLeaf( block ) || isCard( block, blocks ) ) {
				items.push( {
					block,
					clientId: block.clientId,
					isImage: block.name === 'core/image',
				} );
				return;
			}

			walk( block.innerBlocks );
		} );

	walk( section?.innerBlocks || [] );

	return items;
}

/**
 * Where a block is under a section: the path of indexes to its parent, and
 * its index there.
 *
 * @param {Object} section  The section's block.
 * @param {string} clientId The block.
 * @return {?Object} `{ parentId, path, index }`, or null if it isn't in it.
 */
export function findPlace( section, clientId ) {
	const search = ( parent, path ) => {
		const index = parent.innerBlocks.findIndex(
			( block ) => block.clientId === clientId
		);

		if ( index !== -1 ) {
			return { index, parentId: parent.clientId, path };
		}

		for ( let i = 0; i < parent.innerBlocks.length; i++ ) {
			const found = search( parent.innerBlocks[ i ], [ ...path, i ] );

			if ( found ) {
				return found;
			}
		}

		return null;
	};

	return section ? search( section, [] ) : null;
}

/**
 * What goes when an item is removed: the item, or the blocks around it that
 * it would leave empty, such as the column holding only it, up to the
 * section.
 *
 * @param {Object} section  The section's block.
 * @param {string} clientId The item.
 * @return {string} The client ID of the block to remove.
 */
export function getRemovalTarget( section, clientId ) {
	let target = clientId;

	for (;;) {
		const place = findPlace( section, target );

		if ( ! place || place.parentId === section.clientId ) {
			return target;
		}

		const parent = findBlock( section, place.parentId );

		if ( parent.innerBlocks.length > 1 ) {
			return target;
		}

		target = place.parentId;
	}
}

function findBlock( parent, clientId ) {
	for ( const block of parent.innerBlocks ) {
		if ( block.clientId === clientId ) {
			return block;
		}

		const found = findBlock( block, clientId );

		if ( found ) {
			return found;
		}
	}

	return null;
}

/**
 * The block at a path of indexes under a section, or the section itself
 * when the path no longer leads anywhere, as after its layout changes.
 *
 * @param {Object}   section The section's block.
 * @param {number[]} path    Indexes from the section down.
 * @return {Object} The block.
 */
export function followPath( section, path ) {
	let block = section;

	for ( const index of path ) {
		const next = block.innerBlocks[ index ];

		if ( ! next || isLeaf( next ) ) {
			return section;
		}

		block = next;
	}

	return block;
}

/**
 * The things the Add menu offers.
 *
 * @return {Object[]} `{ type, label }` for each.
 */
export function getAddableTypes() {
	return [
		{ label: __( 'Heading' ), type: 'heading' },
		{ label: __( 'Paragraph' ), type: 'paragraph' },
		{ label: __( 'Button' ), type: 'button' },
		{ label: __( 'Image' ), type: 'image' },
	];
}

/**
 * A new, empty button, for a row of buttons.
 *
 * @return {Object} The block.
 */
function createButton() {
	return createBlock( 'core/button' );
}

/**
 * A new item's block, empty, to be typed into straight away.
 *
 * @param {string}  type  `heading`, `paragraph`, `button` or `image`.
 * @param {?Object} media The image chosen, for an image.
 * @return {Object} The block.
 */
export function createItem( type, media = null ) {
	switch ( type ) {
		case 'heading':
			return createBlock( 'core/heading', { level: 2 } );
		case 'paragraph':
			return createBlock( 'core/paragraph' );
		case 'button':
			return createBlock( 'core/buttons', {}, [ createButton() ] );
		default:
			return createBlock( 'core/image', {
				alt: media?.alt || '',
				id: media?.id,
				url: media?.url,
			} );
	}
}

// Blocks that only wrap a section's content, like its inner, narrower group.
const WRAPPER_BLOCKS = [ 'core/group' ];

/**
 * Where a new item goes in a section: last, inside the groups that only
 * wrap its content, so it takes the content's width.
 *
 * @param {Object} section The section's block, with its inner blocks.
 * @return {Object} `{ parentId, index }`.
 */
export function getAppendPlace( section ) {
	let node = section;

	while (
		node.innerBlocks.length === 1 &&
		WRAPPER_BLOCKS.includes( node.innerBlocks[ 0 ].name )
	) {
		node = node.innerBlocks[ 0 ];
	}

	return { index: node.innerBlocks.length, parentId: node.clientId };
}

/**
 * Whether a section holds other blocks, so a new item can go in it.
 *
 * @param {Object} section The section's block, with its inner blocks.
 * @return {boolean} Whether it does.
 */
export function canHoldItems( section ) {
	return (
		section.innerBlocks.length > 0 ||
		WRAPPER_BLOCKS.includes( section.name )
	);
}

/**
 * The block in a new item that takes the caret: the button in a row of
 * buttons, or the item itself.
 *
 * @param {Object} item The new item's block.
 * @return {string} Its client ID.
 */
export function getEditableId( item ) {
	return item.name === 'core/buttons'
		? item.innerBlocks[ 0 ].clientId
		: item.clientId;
}
