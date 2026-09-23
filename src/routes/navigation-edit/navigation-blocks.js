/**
 * WordPress dependencies
 */
import { parse } from '@wordpress/block-serialization-default-parser';
import { createBlock } from '@wordpress/blocks';
import { decodeEntities } from '@wordpress/html-entities';

const EMPTY_ARRAY = [];

function getBlockName( block ) {
	return block?.name || block?.blockName;
}

function getBlockAttributes( block ) {
	return block?.attributes || block?.attrs || {};
}

function getParsedBlocks( content ) {
	try {
		return parse( content || '' );
	} catch {
		return [];
	}
}

function getNavigationItemLabel( block ) {
	const attributes = getBlockAttributes( block );

	if ( attributes.label ) {
		return decodeEntities( attributes.label );
	}

	if ( attributes.title ) {
		return decodeEntities( attributes.title );
	}

	switch ( getBlockName( block ) ) {
		case 'core/home-link':
			return 'Home';
		case 'core/navigation-submenu':
			return 'Submenu';
		case 'core/navigation-link':
			return 'Link';
		default:
			return 'Menu item';
	}
}

function getManualNavigationItems( blocks, depth = 0 ) {
	return ( blocks || EMPTY_ARRAY ).flatMap( ( block ) => {
		const blockName = getBlockName( block );
		const item =
			blockName === 'core/navigation-link' ||
			blockName === 'core/navigation-submenu' ||
			blockName === 'core/home-link'
				? [
						{
							depth,
							id:
								block.clientId ||
								`${ blockName }-${ depth }-${ getNavigationItemLabel(
									block
								) }`,
							isSubmenu: blockName === 'core/navigation-submenu',
							label: getNavigationItemLabel( block ),
						},
					]
				: [];

		return [
			...item,
			...getManualNavigationItems( block.innerBlocks, depth + 1 ),
		];
	} );
}

function normalizeAttributes( attributes = {} ) {
	return Object.fromEntries(
		Object.entries( attributes ).filter(
			( [ , value ] ) => value !== undefined
		)
	);
}

function serializeBlockAttributes( attributes ) {
	const normalizedAttributes = normalizeAttributes( attributes );
	const serializedAttributes = JSON.stringify( normalizedAttributes )
		.replace( /--/g, '\\u002d\\u002d' )
		.replace( /</g, '\\u003c' )
		.replace( />/g, '\\u003e' )
		.replace( /&/g, '\\u0026' );

	return serializedAttributes === '{}' ? '' : ` ${ serializedAttributes }`;
}

function getSerializedBlockName( blockName ) {
	return blockName?.startsWith( 'core/' )
		? blockName.slice( 'core/'.length )
		: blockName;
}

function serializeNavigationBlock( block ) {
	const blockName = getBlockName( block );
	const serializedBlockName = getSerializedBlockName( blockName );

	if ( ! serializedBlockName ) {
		return '';
	}

	const attributes = serializeBlockAttributes( getBlockAttributes( block ) );
	const innerBlocks = block.innerBlocks || EMPTY_ARRAY;

	if ( ! innerBlocks.length ) {
		return `<!-- wp:${ serializedBlockName }${ attributes } /-->`;
	}

	return [
		`<!-- wp:${ serializedBlockName }${ attributes } -->`,
		serializeNavigationBlocks( innerBlocks ),
		`<!-- /wp:${ serializedBlockName } -->`,
	]
		.filter( Boolean )
		.join( '\n' );
}

function serializeNavigationBlocks( blocks ) {
	return ( blocks || EMPTY_ARRAY )
		.map( serializeNavigationBlock )
		.filter( Boolean )
		.join( '\n' );
}

function createNavigationLinkBlock( {
	id,
	kind = 'custom',
	label,
	type,
	url,
} ) {
	return {
		attributes: normalizeAttributes( {
			id,
			kind,
			label,
			type,
			url,
		} ),
		innerBlocks: [],
		name: 'core/navigation-link',
	};
}

function createNavigationLinkBlockFromPage( page ) {
	return createNavigationLinkBlock( {
		id: page.id,
		kind: 'post-type',
		label: getNavigationPageTitle( page ),
		type: page.type || 'page',
		url: page.link || '/',
	} );
}

function createNavigationSubmenuBlock( {
	id,
	innerBlocks = [],
	kind = 'custom',
	label,
	type,
	url,
} ) {
	return {
		attributes: normalizeAttributes( {
			id,
			kind,
			label,
			type,
			url,
		} ),
		innerBlocks,
		name: 'core/navigation-submenu',
	};
}

function createNavigationSubmenuBlockFromPage( page, innerBlocks = [] ) {
	return createNavigationSubmenuBlock( {
		id: page.id,
		innerBlocks,
		kind: 'post-type',
		label: getNavigationPageTitle( page ),
		type: page.type || 'page',
		url: page.link || '/',
	} );
}

function getNavigationPageTitle( page ) {
	const title = page?.title?.raw || page?.title?.rendered || page?.title;

	if ( typeof title === 'string' && title ) {
		return decodeEntities( title.replace( /<[^>]*>/g, '' ) ).trim();
	}

	return '(no title)';
}

function appendNavigationBlocksToContent( content, blocksToAppend ) {
	return serializeNavigationBlocks( [
		...getParsedBlocks( content ),
		...( blocksToAppend || EMPTY_ARRAY ),
	] );
}

function getNavigationContentFromEditedRecord( record ) {
	const content = record?.content;
	const blocks = Array.isArray( record?.blocks )
		? record.blocks
		: EMPTY_ARRAY;

	if ( typeof content === 'string' ) {
		return content;
	}

	if ( typeof content === 'function' ) {
		try {
			const serializedContent = content( { blocks } );

			if ( typeof serializedContent === 'string' ) {
				return serializedContent;
			}
		} catch {
			// Fall through to the other persisted shapes.
		}
	}

	if ( typeof content?.raw === 'string' ) {
		return content.raw;
	}

	if ( blocks.length ) {
		return serializeNavigationBlocks( blocks );
	}

	return '';
}

function getNavigationBlocksFromEditedRecord( record ) {
	if ( Array.isArray( record?.blocks ) ) {
		return record.blocks;
	}

	return getParsedBlocks( getNavigationContentFromEditedRecord( record ) );
}

function isAutoMenuContent( content ) {
	const meaningfulBlocks = getParsedBlocks( content ).filter(
		( block ) => getBlockName( block ) || block.innerHTML?.trim()
	);

	return (
		meaningfulBlocks.length === 1 &&
		getBlockName( meaningfulBlocks[ 0 ] ) === 'core/page-list'
	);
}

function createManualNavigationContentFromPages( pages ) {
	return serializeNavigationBlocks(
		( pages || EMPTY_ARRAY ).map( createNavigationLinkBlockFromPage )
	);
}

function createEditorBlockFromNavigationBlock( block ) {
	const blockName = getBlockName( block );

	if ( ! blockName ) {
		return null;
	}

	return createBlock(
		blockName,
		getBlockAttributes( block ),
		( block.innerBlocks || EMPTY_ARRAY )
			.map( createEditorBlockFromNavigationBlock )
			.filter( Boolean )
	);
}

function createEditorBlocksFromNavigationBlocks( blocks ) {
	return ( blocks || EMPTY_ARRAY )
		.map( createEditorBlockFromNavigationBlock )
		.filter( Boolean );
}

export {
	appendNavigationBlocksToContent,
	createEditorBlocksFromNavigationBlocks,
	createManualNavigationContentFromPages,
	createNavigationLinkBlock,
	createNavigationLinkBlockFromPage,
	createNavigationSubmenuBlock,
	createNavigationSubmenuBlockFromPage,
	getBlockAttributes,
	getBlockName,
	getManualNavigationItems,
	getNavigationBlocksFromEditedRecord,
	getNavigationContentFromEditedRecord,
	getNavigationItemLabel,
	getNavigationPageTitle,
	getParsedBlocks,
	isAutoMenuContent,
	serializeNavigationBlocks,
};
