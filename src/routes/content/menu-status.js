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
 * Read a menu's blocks for the pages they link to.
 *
 * A Page List block links every published page, so a menu that contains one
 * is reported as listing all pages rather than by ID.
 *
 * @param {Object[]} blocks Parsed or editor blocks.
 * @return {{ listsAllPages: boolean, pageIds: Set<number> }} Menu pages.
 */
export function getMenuPagesFromBlocks( blocks ) {
	const pageIds = new Set();
	let listsAllPages = false;

	const visit = ( items ) => {
		( items || [] ).forEach( ( block ) => {
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

	visit( blocks );

	return { listsAllPages, pageIds };
}

/**
 * Read a menu's content for the pages it links to.
 *
 * @param {string} content Serialized navigation menu content.
 * @return {{ listsAllPages: boolean, pageIds: Set<number> }} Menu pages.
 */
export function getMenuPages( content ) {
	return getMenuPagesFromBlocks( getParsedBlocks( content ) );
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

	// Page List shows published pages, with sub-pages in submenus.
	return menuPages.listsAllPages && page.status === 'publish';
}
