/**
 * The site's pages as a tree, the way visitors meet them: parents first, their
 * sub-pages tucked underneath.
 */

function compareSiblings( a, b, frontPageId ) {
	const order =
		( Number( a.menu_order ) || 0 ) - ( Number( b.menu_order ) || 0 );

	if ( order ) {
		return order;
	}

	// Among pages nobody has put in order, the homepage leads.
	if ( frontPageId && Number( a.id ) === frontPageId ) {
		return -1;
	}

	if ( frontPageId && Number( b.id ) === frontPageId ) {
		return 1;
	}

	return String(
		a.title?.raw ?? a.title?.rendered ?? a.title ?? ''
	).localeCompare(
		String( b.title?.raw ?? b.title?.rendered ?? b.title ?? '' )
	);
}

/**
 * Nest pages under their parents.
 *
 * A page whose parent is not in the list (trashed, or filtered out by the
 * query) is shown at the top level rather than dropped. Pages follow their
 * menu order, and among pages with the same order the homepage leads.
 *
 * @param {Object[]} pages                 Page records.
 * @param {Object}   [options]
 * @param {number}   [options.frontPageId] ID of the page set as the homepage.
 * @return {Object[]} Tree nodes, `{ page, children }`.
 */
export function buildPageTree( pages, { frontPageId = 0 } = {} ) {
	const ids = new Set( ( pages || [] ).map( ( page ) => Number( page.id ) ) );
	const childrenByParent = new Map();

	( pages || [] ).forEach( ( page ) => {
		const parent = Number( page.parent ) || 0;
		const key =
			ids.has( parent ) && parent !== Number( page.id ) ? parent : 0;

		if ( ! childrenByParent.has( key ) ) {
			childrenByParent.set( key, [] );
		}

		childrenByParent.get( key ).push( page );
	} );

	const visit = ( parentId, seen ) =>
		( childrenByParent.get( parentId ) || [] )
			.slice()
			.sort( ( a, b ) => compareSiblings( a, b, frontPageId ) )
			.filter( ( page ) => ! seen.has( Number( page.id ) ) )
			.map( ( page ) => {
				const nextSeen = new Set( seen ).add( Number( page.id ) );

				return {
					children: visit( Number( page.id ), nextSeen ),
					page,
				};
			} );

	return visit( 0, new Set() );
}

/**
 * Keep the pages matching a search, along with the parents that lead to them.
 *
 * @param {Object[]} tree     Tree from `buildPageTree`.
 * @param {string}   search   Search text.
 * @param {Function} getTitle Returns a page's plain title.
 * @return {Object[]} The filtered tree.
 */
export function filterPageTree( tree, search, getTitle ) {
	const needle = String( search || '' )
		.trim()
		.toLowerCase();

	if ( ! needle ) {
		return tree;
	}

	return tree.reduce( ( result, node ) => {
		const children = filterPageTree( node.children, needle, getTitle );
		const isMatch = String( getTitle( node.page ) )
			.toLowerCase()
			.includes( needle );

		if ( isMatch || children.length ) {
			result.push( { ...node, children } );
		}

		return result;
	}, [] );
}

/**
 * Count every page in a tree, sub-pages included.
 *
 * @param {Object[]} tree Tree from `buildPageTree`.
 * @return {number} Number of pages.
 */
export function countPageTree( tree ) {
	return tree.reduce(
		( total, node ) => total + 1 + countPageTree( node.children ),
		0
	);
}

/**
 * The titles of a page's ancestors, nearest last.
 *
 * @param {Object[]} pages    Page records.
 * @param {number}   pageId   Page ID.
 * @param {Function} getTitle Returns a page's plain title.
 * @return {string[]} Ancestor titles.
 */
export function getPageAncestorTitles( pages, pageId, getTitle ) {
	const byId = new Map(
		( pages || [] ).map( ( page ) => [ Number( page.id ), page ] )
	);
	const titles = [];
	const seen = new Set( [ Number( pageId ) ] );
	let parent = Number( byId.get( Number( pageId ) )?.parent ) || 0;

	while ( parent && byId.has( parent ) && ! seen.has( parent ) ) {
		seen.add( parent );
		titles.unshift( getTitle( byId.get( parent ) ) );
		parent = Number( byId.get( parent ).parent ) || 0;
	}

	return titles;
}

function findNode( tree, pageId, parentId = 0 ) {
	for ( let index = 0; index < tree.length; index++ ) {
		const node = tree[ index ];

		if ( Number( node.page.id ) === pageId ) {
			return { index, node, parentId, siblings: tree };
		}

		const found = findNode( node.children, pageId, Number( node.page.id ) );

		if ( found ) {
			return found;
		}
	}

	return null;
}

function getSiblings( tree, parentId ) {
	if ( ! parentId ) {
		return tree;
	}

	return findNode( tree, parentId )?.node.children || [];
}

function containsPage( node, pageId ) {
	return node.children.some(
		( child ) =>
			Number( child.page.id ) === pageId || containsPage( child, pageId )
	);
}

/**
 * Where a dragged page lands when dropped on another.
 *
 * Dropped on the top or bottom edge of a page, it goes beside it; dropped on
 * the middle, it goes inside, as its last sub-page. Dropping just below a page
 * whose sub-pages are showing puts it first among them, which is where the
 * drop line appears.
 *
 * @param {Object[]} tree       Tree from `buildPageTree`.
 * @param {number}   draggedId  Page being dragged.
 * @param {number}   overId     Page it is dropped on.
 * @param {string}   position   `before`, `after` or `inside`.
 * @param {boolean}  isExpanded Whether the page dropped on shows its sub-pages.
 * @return {Object|null} `{ parent, index }`, or `null` where it can't go.
 */
export function getPageDropTarget(
	tree,
	draggedId,
	overId,
	position,
	isExpanded = true
) {
	const dragged = findNode( tree, draggedId );
	const over = findNode( tree, overId );

	// A page can't go inside itself or its own sub-pages.
	if (
		! dragged ||
		! over ||
		draggedId === overId ||
		containsPage( dragged.node, overId )
	) {
		return null;
	}

	if (
		position === 'inside' ||
		( position === 'after' && isExpanded && over.node.children.length )
	) {
		const children = over.node.children.filter(
			( child ) => Number( child.page.id ) !== draggedId
		);

		return {
			index: position === 'inside' ? children.length : 0,
			parent: overId,
		};
	}

	const siblings = over.siblings.filter(
		( node ) => Number( node.page.id ) !== draggedId
	);
	const overIndex = siblings.findIndex(
		( node ) => Number( node.page.id ) === overId
	);

	return {
		index: overIndex + ( position === 'after' ? 1 : 0 ),
		parent: over.parentId,
	};
}

/**
 * Where a page goes when moved with the keyboard.
 *
 * Up and down move it among the pages beside it, right tucks it under the page
 * above it, and left brings it out to sit after its parent.
 *
 * @param {Object[]} tree   Tree from `buildPageTree`.
 * @param {number}   pageId Page being moved.
 * @param {string}   key    `ArrowUp`, `ArrowDown`, `ArrowLeft` or `ArrowRight`.
 * @return {Object|null} `{ parent, index }`, or `null` where it can't go.
 */
export function getPageKeyboardTarget( tree, pageId, key ) {
	const found = findNode( tree, pageId );

	if ( ! found ) {
		return null;
	}

	const { index, parentId, siblings } = found;

	switch ( key ) {
		case 'ArrowUp':
			return index > 0 ? { index: index - 1, parent: parentId } : null;
		case 'ArrowDown':
			return index < siblings.length - 1
				? { index: index + 1, parent: parentId }
				: null;
		case 'ArrowRight': {
			const above = siblings[ index - 1 ];

			return above
				? {
						index: above.children.length,
						parent: Number( above.page.id ),
					}
				: null;
		}
		case 'ArrowLeft': {
			if ( ! parentId ) {
				return null;
			}

			const parent = findNode( tree, parentId );

			return { index: parent.index + 1, parent: parent.parentId };
		}
	}

	return null;
}

/**
 * The changes to make for a page to move: its new parent, and a menu order for
 * every page beside it there, numbered as they now appear.
 *
 * @param {Object[]} tree   Tree from `buildPageTree`.
 * @param {number}   pageId Page being moved.
 * @param {Object}   target `{ parent, index }`.
 * @return {Object[]} `{ id, parent, menu_order }` for each page that changes.
 */
export function getPageMoveChanges( tree, pageId, target ) {
	const moved = findNode( tree, pageId );

	if ( ! moved ) {
		return [];
	}

	const siblings = getSiblings( tree, target.parent )
		.map( ( node ) => node.page )
		.filter( ( page ) => Number( page.id ) !== pageId );

	siblings.splice(
		Math.max( 0, Math.min( target.index, siblings.length ) ),
		0,
		moved.node.page
	);

	return siblings
		.map( ( page, index ) => ( {
			id: Number( page.id ),
			menu_order: index,
			parent: target.parent,
		} ) )
		.filter( ( change ) => {
			const page = siblings.find(
				( item ) => Number( item.id ) === change.id
			);

			return (
				( Number( page.menu_order ) || 0 ) !== change.menu_order ||
				( Number( page.parent ) || 0 ) !== change.parent
			);
		} );
}
