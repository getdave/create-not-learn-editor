/**
 * Which pages visitors can reach from the site's main menu.
 */

/**
 * Internal dependencies
 */
import {
	getBlockAttributes,
	getBlockName,
	getParsedBlocks,
} from '../navigation-edit/navigation-blocks';

const LINK_BLOCKS = [ 'core/navigation-link', 'core/navigation-submenu' ];

/**
 * Read a menu's content for the pages it links to.
 *
 * A Page List block links every published page, so a menu that contains one
 * is reported as listing all pages rather than by ID.
 *
 * @param {string} content Serialized navigation menu content.
 * @return {{ listsAllPages: boolean, pageIds: Set<number> }} Menu pages.
 */
export function getMenuPages( content ) {
	const pageIds = new Set();
	let listsAllPages = false;

	const visit = ( blocks ) => {
		( blocks || [] ).forEach( ( block ) => {
			const name = getBlockName( block );
			const attributes = getBlockAttributes( block );

			if ( name === 'core/page-list' ) {
				listsAllPages = true;
			}

			if (
				LINK_BLOCKS.includes( name ) &&
				attributes.kind === 'post-type' &&
				( ! attributes.type || attributes.type === 'page' ) &&
				Number( attributes.id )
			) {
				pageIds.add( Number( attributes.id ) );
			}

			visit( block.innerBlocks );
		} );
	};

	visit( getParsedBlocks( content ) );

	return { listsAllPages, pageIds };
}

/**
 * Whether a page shows up in the main menu.
 *
 * @param {Object} page      Page record.
 * @param {Object} menuPages Result of `getMenuPages`.
 * @return {boolean} Whether the page is in the menu.
 */
export function isPageInMenu( page, menuPages ) {
	if ( ! page || ! menuPages ) {
		return false;
	}

	if ( menuPages.pageIds.has( Number( page.id ) ) ) {
		return true;
	}

	// Page List only shows published, top-level pages.
	return (
		menuPages.listsAllPages &&
		page.status === 'publish' &&
		! Number( page.parent )
	);
}
