/**
 * Finding, in the editor under Browse, the block a spot in the preview shows.
 *
 * The preview is the front end, which doesn't know the editor's blocks.
 * Previews name each block on its outermost element, as `data-cnl-block` (see
 * `cnl_editor_name_preview_block()`), so a spot on the page has a path of
 * named blocks above it: each one's name, and how many blocks of that name
 * come before it beside it. The editor has the same blocks in the same order,
 * so following the path down its tree finds the block.
 *
 * The two can part ways: a list of posts repeats its blocks once a post on
 * the page, and a block can show nothing at all. Following stops where they
 * do, at the last block both have, which is enough to find a section.
 */

export const PREVIEW_BLOCK_ATTRIBUTE = 'data-cnl-block';

const PREVIEW_BLOCK_SELECTOR = `[${ PREVIEW_BLOCK_ATTRIBUTE }]`;

/*
 * Blocks with no element of their own on the page, whose blocks stand in
 * their place there. A synced pattern is drawn as its blocks.
 */
const UNWRAPPED_BLOCKS = new Set( [ 'core/block', 'core/pattern' ] );

/*
 * Blocks that do something when clicked, so a click on one is for using the
 * page, not for changing it.
 */
const INTERACTIVE_SELECTOR = [
	'a[href]',
	'audio',
	'button',
	'details',
	'iframe',
	'input',
	'label',
	'select',
	'summary',
	'textarea',
	'video',
	'[contenteditable]',
	'[role="button"]',
	'[role="link"]',
	'[role="menuitem"]',
	'[role="tab"]',
	'[tabindex]:not([tabindex="-1"])',
].join( ',' );

/**
 * The named block an element nearest belongs to, itself included.
 *
 * @param {?Element} element An element on the preview's page.
 * @return {?Element} The block's outermost element.
 */
export function getPreviewBlock( element ) {
	return element?.closest?.( PREVIEW_BLOCK_SELECTOR ) || null;
}

/**
 * The named block around another, or nothing for one at the top.
 *
 * @param {Element} element A block's outermost element.
 * @return {?Element} The block around it.
 */
function getParentBlock( element ) {
	return getPreviewBlock( element.parentElement );
}

/**
 * The path of named blocks from the top of the page down to an element.
 *
 * @param {?Element} element An element on the preview's page.
 * @return {Object[]} `{ element, name, index }` for each block, outermost
 *                    first, `index` counting the blocks of the same name
 *                    before it beside it.
 */
export function getPreviewPath( element ) {
	const path = [];
	let block = getPreviewBlock( element );

	while ( block ) {
		const parent = getParentBlock( block );
		const name = block.getAttribute( PREVIEW_BLOCK_ATTRIBUTE );
		const siblings = Array.from(
			( parent || block.ownerDocument ).querySelectorAll(
				`[${ PREVIEW_BLOCK_ATTRIBUTE }="${ name }"]`
			)
		).filter( ( node ) => getParentBlock( node ) === parent );

		path.unshift( {
			element: block,
			index: siblings.indexOf( block ),
			name,
		} );
		block = parent;
	}

	return path;
}

/**
 * A block's blocks, as the page draws them: a synced pattern's in its place.
 *
 * @param {Object} store    `blockEditorStore` selectors.
 * @param {string} clientId The block, or an empty string for the top.
 * @return {string[]} Client IDs.
 */
function getDrawnChildren( store, clientId ) {
	return store
		.getBlockOrder( clientId )
		.flatMap( ( childId ) =>
			UNWRAPPED_BLOCKS.has( store.getBlockName( childId ) )
				? getDrawnChildren( store, childId )
				: [ childId ]
		);
}

/**
 * Follow a path down the editor's blocks from one of them.
 *
 * @param {Object}   store  `blockEditorStore` selectors.
 * @param {Object[]} path   From `getPreviewPath`.
 * @param {string}   rootId Where to start, an empty string for the top.
 * @return {string[]} The client IDs found, one for each step followed.
 */
function followPath( store, path, rootId ) {
	const found = [];
	let parentId = rootId;

	for ( const step of path ) {
		const clientId = getDrawnChildren( store, parentId ).filter(
			( childId ) => store.getBlockName( childId ) === step.name
		)[ step.index ];

		if ( ! clientId ) {
			break;
		}

		found.push( clientId );
		parentId = clientId;
	}

	return found;
}

/**
 * The editor's blocks along a path in the preview.
 *
 * The editor shows a page in its layout, so the path usually starts at the
 * top of both. An editor showing only the page's own blocks starts inside
 * the page's content instead. Both are tried, as the layout's blocks can
 * look like the page's, and whichever follows the path further wins.
 *
 * @param {Object}   store `blockEditorStore` selectors.
 * @param {Object[]} path  From `getPreviewPath`.
 * @return {Array<?string>} A client ID for each step of the path, or null for
 *                          the steps the editor doesn't have.
 */
export function matchPreviewPath( store, path ) {
	let offset = 0;
	let found = followPath( store, path, '' );
	const contentAt = path.findIndex(
		( step ) => step.name === 'core/post-content'
	);

	if ( contentAt !== -1 ) {
		const inside = followPath( store, path.slice( contentAt + 1 ), '' );

		if ( inside.length && contentAt + 1 + inside.length > found.length ) {
			offset = contentAt + 1;
			found = inside;
		}
	}

	return path.map( ( step, index ) =>
		index < offset ? null : ( found[ index - offset ] ?? null )
	);
}

/**
 * The section, header or footer a spot in the preview is in.
 *
 * @param {Object}      store   `blockEditorStore` selectors.
 * @param {?Element}    element An element on the preview's page.
 * @param {Set<string>} targets Client IDs of what Edit can pick.
 * @return {?Object} `{ clientId, element }`, its client ID in the editor
 *                   and its outermost element in the preview.
 */
export function findPreviewSection( store, element, targets ) {
	const path = getPreviewPath( element );
	const matched = matchPreviewPath( store, path );
	const index = matched.findIndex(
		( clientId ) => clientId && targets.has( clientId )
	);

	return index === -1
		? null
		: { clientId: matched[ index ], element: path[ index ].element };
}

/**
 * Whether a click on an element is for using the page, like following a
 * link, rather than for changing it.
 *
 * @param {?Element} element The element clicked.
 * @return {boolean} Whether it does something when clicked.
 */
export function isInteractive( element ) {
	return Boolean( element?.closest?.( INTERACTIVE_SELECTOR ) );
}
