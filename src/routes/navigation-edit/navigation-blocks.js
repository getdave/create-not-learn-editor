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

function comparePageListPages( a, b ) {
	const order =
		( Number( a.menu_order ) || 0 ) - ( Number( b.menu_order ) || 0 );

	return (
		order ||
		getNavigationPageTitle( a ).localeCompare( getNavigationPageTitle( b ) )
	);
}

/**
 * The menu items a Page List block shows: published pages, with sub-pages
 * nested under their parent as submenus, sorted the way Page List sorts them.
 *
 * @param {Object[]} pages        Published pages.
 * @param {number}   parentPageId Only list pages under this page.
 * @return {Object[]} Navigation link and submenu blocks.
 */
function getPageListNavigationBlocks( pages, parentPageId = 0 ) {
	const childrenByParent = new Map();

	( pages || EMPTY_ARRAY ).forEach( ( page ) => {
		const parent = Number( page.parent ) || 0;

		if ( ! childrenByParent.has( parent ) ) {
			childrenByParent.set( parent, [] );
		}

		childrenByParent.get( parent ).push( page );
	} );

	// Like Page List, a page whose parent isn't published isn't shown.
	const build = ( parent, visited ) =>
		( childrenByParent.get( parent ) || EMPTY_ARRAY )
			.slice()
			.sort( comparePageListPages )
			.map( ( page ) => {
				const id = Number( page.id );
				const children = visited.has( id )
					? EMPTY_ARRAY
					: build( id, new Set( [ ...visited, id ] ) );

				return children.length
					? createNavigationSubmenuBlockFromPage( page, children )
					: createNavigationLinkBlockFromPage( page );
			} );

	return build( Number( parentPageId ) || 0, new Set() );
}

function hasPageListBlock( blocks ) {
	return ( blocks || EMPTY_ARRAY ).some(
		( block ) =>
			getBlockName( block ) === 'core/page-list' ||
			hasPageListBlock( block.innerBlocks )
	);
}

/**
 * Swap every Page List block in a menu's editor blocks for the pages it shows,
 * as ordinary links, so a menu that lists all pages can be shown and edited
 * like any other.
 *
 * @param {Object[]} blocks Editor blocks.
 * @param {Object[]} pages  Published pages.
 * @return {Object[]} Editor blocks without Page List.
 */
function expandPageListBlocks( blocks, pages ) {
	return ( blocks || EMPTY_ARRAY ).flatMap( ( block ) => {
		if ( getBlockName( block ) === 'core/page-list' ) {
			return createEditorBlocksFromNavigationBlocks(
				getPageListNavigationBlocks(
					pages,
					getBlockAttributes( block ).parentPageID
				)
			);
		}

		if ( ! hasPageListBlock( block.innerBlocks ) ) {
			return [ block ];
		}

		return [
			{
				...block,
				innerBlocks: expandPageListBlocks( block.innerBlocks, pages ),
			},
		];
	} );
}

function countChildrenByClientId( blocks, counts = new Map() ) {
	( blocks || EMPTY_ARRAY ).forEach( ( block ) => {
		counts.set( block.clientId, block.innerBlocks?.length || 0 );
		countChildrenByClientId( block.innerBlocks, counts );
	} );

	return counts;
}

/**
 * Keep menu items the right kind after a change: a link with items under it
 * becomes a submenu, and a submenu whose last item has gone becomes a link.
 * Core's own blocks do the same, but only when rendered, so a menu that is
 * shown as a list would otherwise keep a link with items under it, and the
 * menu in the canvas would change it separately.
 *
 * Each item keeps its client ID, so the change is one edit to the menu rather
 * than a block swapped for another.
 *
 * @param {Object[]} blocks         Editor blocks after the change.
 * @param {Object[]} previousBlocks Editor blocks before it.
 * @return {Object[]} The blocks, the same array if nothing needed changing.
 */
function normalizeMenuItems( blocks, previousBlocks ) {
	const previousCounts = countChildrenByClientId( previousBlocks );
	const normalize = ( items ) => {
		let hasChanged = false;
		const nextItems = ( items || EMPTY_ARRAY ).map( ( block ) => {
			const children = block.innerBlocks || EMPTY_ARRAY;
			const innerBlocks = normalize( children );
			let name = block.name;

			if ( name === 'core/navigation-link' && innerBlocks.length ) {
				name = 'core/navigation-submenu';
			} else if (
				name === 'core/navigation-submenu' &&
				! innerBlocks.length &&
				previousCounts.get( block.clientId ) > 0
			) {
				name = 'core/navigation-link';
			}

			if ( name === block.name && innerBlocks === children ) {
				return block;
			}

			hasChanged = true;

			return { ...block, innerBlocks, name };
		} );

		return hasChanged ? nextItems : items;
	};

	return normalize( blocks );
}

function createManualNavigationContentFromPages( pages ) {
	return serializeNavigationBlocks( getPageListNavigationBlocks( pages ) );
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
	expandPageListBlocks,
	getBlockAttributes,
	getBlockName,
	getManualNavigationItems,
	getNavigationBlocksFromEditedRecord,
	getNavigationContentFromEditedRecord,
	getNavigationItemLabel,
	getNavigationPageTitle,
	getPageListNavigationBlocks,
	getParsedBlocks,
	hasPageListBlock,
	isAutoMenuContent,
	normalizeMenuItems,
	serializeNavigationBlocks,
};
