import { redirect } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { cnlEditorStore } from '../../records';
import { coreDataStore, resolveSelect, __ } from '../../wordpress-packages';
import { getMainMenu } from './navigation-locations';

// Matches the Menus screen's query so both share one cached request.
const TEMPLATE_PARTS_QUERY = {
	context: 'edit',
	per_page: 100,
	_fields: 'id,slug,title,area,status,content',
};

async function getMainMenuId() {
	try {
		const [ menus, templateParts ] = await Promise.all( [
			resolveSelect( cnlEditorStore ).getNavigationMenus(),
			resolveSelect( coreDataStore ).getEntityRecords(
				'postType',
				'wp_template_part',
				TEMPLATE_PARTS_QUERY
			),
		] );

		// The header can point at a menu that has since been deleted.
		return ( getMainMenu( menus, templateParts ) || menus?.[ 0 ] )?.id;
	} catch {
		// Let the list show the error.
		return undefined;
	}
}

export const route = {
	// Most sites have one menu, shown in the header, so go straight to it.
	// The list only shows when there is no menu yet, to offer making one.
	beforeLoad: async () => {
		const menuId = await getMainMenuId();

		if ( menuId ) {
			throw redirect( {
				throw: true,
				to: `/navigation/edit/${ menuId }`,
			} );
		}
	},
	title: () => __( 'Navigation Menus' ),
	async canvas() {
		return null;
	},
};
