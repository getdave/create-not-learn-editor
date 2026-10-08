/**
 * Internal dependencies
 */
import { cnlEditorStore } from '../../records';
import { getMainMenu } from '../navigation/navigation-locations';
import {
	appendNavigationBlocksToContent,
	createNavigationLinkBlockFromPage,
	getNavigationContentFromEditedRecord,
} from '../navigation-edit/navigation-blocks';
import { getMenuPages } from './menu-status';
import {
	coreDataStore,
	resolveSelect,
	useDispatch,
	useMemo,
	useSelect,
} from '../../wordpress-packages';

const EMPTY_ARRAY = [];
// Matches the Menus screen's query so both share one cached request.
const TEMPLATE_PARTS_QUERY = {
	context: 'edit',
	per_page: 100,
	_fields: 'id,slug,title,area,status,content',
};

function getMenuTitleText( menu ) {
	return menu?.title?.raw || menu?.title?.rendered || '';
}

/**
 * The menu in the site header, and which pages it links to.
 *
 * @return {Object} Main menu details.
 */
export default function useMainMenu() {
	const { menus, templateParts } = useSelect( ( select ) => {
		return {
			menus: select( cnlEditorStore ).getNavigationMenus() || EMPTY_ARRAY,
			templateParts:
				select( coreDataStore ).getEntityRecords(
					'postType',
					'wp_template_part',
					TEMPLATE_PARTS_QUERY
				) || EMPTY_ARRAY,
		};
	}, [] );
	const menu = useMemo(
		() => getMainMenu( menus, templateParts ),
		[ menus, templateParts ]
	);
	const menuContent = menu
		? ( menu.content?.raw ?? menu.content ?? '' )
		: null;
	const menuPages = useMemo(
		() =>
			typeof menuContent === 'string'
				? getMenuPages( menuContent )
				: null,
		[ menuContent ]
	);

	return {
		menuId: menu?.id,
		menuPages,
		menuTitle: getMenuTitleText( menu ),
	};
}

/**
 * Add a link to a page at the end of a menu, and save the menu.
 *
 * @return {Function} Callback taking the menu ID and the page record.
 */
export function useAddPageToMenu() {
	const { saveEntityRecord } = useDispatch( coreDataStore );
	const { invalidateNavigationMenus } = useDispatch( cnlEditorStore );

	return async ( menuId, page ) => {
		const record = await resolveSelect( coreDataStore ).getEntityRecord(
			'postType',
			'wp_navigation',
			menuId
		);
		const content = appendNavigationBlocksToContent(
			getNavigationContentFromEditedRecord( record ),
			[ createNavigationLinkBlockFromPage( page ) ]
		);

		await saveEntityRecord(
			'postType',
			'wp_navigation',
			{ content, id: menuId },
			{ throwOnError: true }
		);
		invalidateNavigationMenus();
	};
}
