/**
 * What the options menu does to a block, where core keeps the doing inside
 * its own menu's components.
 */

/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import { getBlockType, parse, serialize } from '@wordpress/blocks';
import { __, sprintf } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';

/**
 * The attributes "Paste styles" carries from one block to another. Core's own
 * list is private; these are the ones its block supports write.
 */
const STYLE_ATTRIBUTES = [
	'style',
	'backgroundColor',
	'textColor',
	'gradient',
	'borderColor',
	'fontSize',
	'fontFamily',
];

/**
 * Say something happened, as core's snackbar does.
 *
 * @param {Object} registry Data registry.
 * @param {string} message  What happened.
 */
function notify( registry, message ) {
	registry.dispatch( noticesStore ).createSuccessNotice( message, {
		type: 'snackbar',
	} );
}

/**
 * The blocks' markup on the clipboard, as core's Copy puts it there.
 *
 * @param {Object}   registry  Data registry.
 * @param {string[]} clientIds Blocks to copy.
 * @return {Promise<boolean>} Whether it was copied.
 */
async function writeBlocks( registry, clientIds ) {
	const blocks = registry
		.select( blockEditorStore )
		.getBlocksByClientId( clientIds );

	try {
		await window.navigator.clipboard.writeText( serialize( blocks ) );
		return true;
	} catch {
		return false;
	}
}

/**
 * The name a notice uses for the blocks.
 *
 * @param {Object}   registry  Data registry.
 * @param {string[]} clientIds Blocks.
 * @return {string} Their name.
 */
function describe( registry, clientIds ) {
	if ( clientIds.length > 1 ) {
		return sprintf(
			/* translators: %d: number of blocks. */
			__( '%d blocks' ),
			clientIds.length
		);
	}

	const name = registry
		.select( blockEditorStore )
		.getBlockName( clientIds[ 0 ] );
	return getBlockType( name )?.title ?? __( 'Block' );
}

export async function copyBlocks( registry, clientIds ) {
	if ( await writeBlocks( registry, clientIds ) ) {
		notify(
			registry,
			sprintf(
				/* translators: %s: block name, or a number of blocks. */
				__( 'Copied %s to clipboard.' ),
				describe( registry, clientIds )
			)
		);
	}
}

export async function cutBlocks( registry, clientIds ) {
	const label = describe( registry, clientIds );

	if ( await writeBlocks( registry, clientIds ) ) {
		registry.dispatch( blockEditorStore ).removeBlocks( clientIds );
		notify(
			registry,
			sprintf(
				/* translators: %s: block name, or a number of blocks. */
				__( 'Moved %s to clipboard.' ),
				label
			)
		);
	}
}

export async function copyStyles( registry, clientIds ) {
	if ( await writeBlocks( registry, clientIds ) ) {
		notify( registry, __( 'Copied styles.' ) );
	}
}

/**
 * Put the styles of the block on the clipboard onto the blocks, keeping to
 * the attributes each block has.
 *
 * @param {Object}   registry  Data registry.
 * @param {string[]} clientIds Blocks to style.
 */
export async function pasteStyles( registry, clientIds ) {
	let source;

	try {
		source = parse( await window.navigator.clipboard.readText() )[ 0 ];
	} catch {
		source = undefined;
	}

	if ( ! source ) {
		registry
			.dispatch( noticesStore )
			.createErrorNotice( __( 'There are no styles to paste.' ), {
				type: 'snackbar',
			} );
		return;
	}

	const { getBlockName } = registry.select( blockEditorStore );
	const { updateBlockAttributes } = registry.dispatch( blockEditorStore );

	clientIds.forEach( ( clientId ) => {
		const attributes = getBlockType( getBlockName( clientId ) )?.attributes;
		const styles = Object.fromEntries(
			STYLE_ATTRIBUTES.filter( ( key ) => attributes?.[ key ] ).map(
				( key ) => [ key, source.attributes[ key ] ]
			)
		);

		updateBlockAttributes( clientId, styles );
	} );

	notify( registry, __( 'Pasted styles.' ) );
}
