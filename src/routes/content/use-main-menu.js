/**
 * Internal dependencies
 */
import { cnlEditorStore } from '../../records';
import {
	buildNavigationLocationsMap,
	getMainMenu,
} from '../navigation/navigation-locations';
import {
	MENU_PAGES_QUERY,
	showMenuSetByHandNotice,
} from '../navigation-edit/list-view';
import {
	appendNavigationBlocksToContent,
	createNavigationLinkBlockFromPage,
	expandPageListBlocks,
	getNavigationContentFromEditedRecord,
	getParsedBlocks,
	hasPageListBlock,
	serializeNavigationBlocks,
} from '../navigation-edit/navigation-blocks';
import { getMenuPages } from './menu-status';
import {
	coreDataStore,
	noticesStore,
	resolveSelect,
	select,
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
 * A menu's content as it stands, unsaved changes included.
 *
 * @param {number} menuId Menu ID.
 * @return {Promise<string>} Serialized menu content.
 */
export async function getEditedMenuContent( menuId ) {
	await resolveSelect( coreDataStore ).getEntityRecord(
		'postType',
		'wp_navigation',
		menuId
	);

	return getNavigationContentFromEditedRecord(
		select( coreDataStore ).getEditedEntityRecord(
			'postType',
			'wp_navigation',
			menuId
		)
	);
}

/**
 * The menu in the site header, and which pages it links to, counting changes
 * that haven't been saved yet. Also where on the site it shows, and where the
 * site's other menus show.
 *
 * @return {Object} Main menu details.
 */
export default function useMainMenu() {
	const { isLoading, menus, templateParts } = useSelect(
		( selectFromStore ) => {
			const menuStore = selectFromStore( cnlEditorStore );
			const store = selectFromStore( coreDataStore );
			const templatePartArgs = [
				'postType',
				'wp_template_part',
				TEMPLATE_PARTS_QUERY,
			];

			return {
				isLoading:
					! menuStore.hasFinishedResolution( 'getNavigationMenus' ) ||
					! store.hasFinishedResolution(
						'getEntityRecords',
						templatePartArgs
					),
				menus: menuStore.getNavigationMenus() || EMPTY_ARRAY,
				templateParts:
					store.getEntityRecords( ...templatePartArgs ) ||
					EMPTY_ARRAY,
			};
		},
		[]
	);
	const menu = useMemo(
		() => getMainMenu( menus, templateParts ),
		[ menus, templateParts ]
	);
	const menuId = menu?.id;
	// Where on the site each menu shows, to tell the main menu apart from
	// the others, which are managed on the Menus screen.
	const { menuArea, otherMenuAreas } = useMemo( () => {
		const locations = buildNavigationLocationsMap(
			templateParts,
			menus[ 0 ]?.id
		);
		const others = new Set();

		Object.entries( locations ).forEach( ( [ id, places ] ) => {
			if ( Number( id ) !== menuId ) {
				places.forEach( ( place ) => others.add( place.area ) );
			}
		} );

		return {
			menuArea: locations[ menuId ]?.[ 0 ]?.area || '',
			otherMenuAreas: [ ...others ],
		};
	}, [ menuId, menus, templateParts ] );
	const menuContent = useSelect(
		( selectFromStore ) => {
			if ( ! menuId ) {
				return null;
			}

			const store = selectFromStore( coreDataStore );

			if (
				! store.getEntityRecord( 'postType', 'wp_navigation', menuId )
			) {
				return menu.content?.raw ?? menu.content ?? '';
			}

			return getNavigationContentFromEditedRecord(
				store.getEditedEntityRecord(
					'postType',
					'wp_navigation',
					menuId
				)
			);
		},
		[ menu, menuId ]
	);
	const menuPages = useMemo(
		() =>
			typeof menuContent === 'string'
				? getMenuPages( menuContent )
				: null,
		[ menuContent ]
	);

	return {
		isLoading,
		menuArea,
		menuId,
		menuPages,
		menuTitle: getMenuTitleText( menu ),
		otherMenuAreas,
	};
}

/**
 * Add a link to a page at the end of a menu, as a change to review and save
 * with the rest. A menu that lists every page picks the page up by itself.
 *
 * @return {Function} Callback taking the menu ID and the page record.
 */
export function useAddPageToMenu() {
	const { editEntityRecord } = useDispatch( coreDataStore );

	return async ( menuId, page ) => {
		const content = await getEditedMenuContent( menuId );

		if ( getMenuPages( content ).listsAllPages ) {
			return;
		}

		editEntityRecord( 'postType', 'wp_navigation', menuId, {
			blocks: undefined,
			content: appendNavigationBlocksToContent( content, [
				createNavigationLinkBlockFromPage( page ),
			] ),
			selection: undefined,
		} );
	};
}

/**
 * Keep pages out of a menu that lists every page, by turning it into links to
 * the pages it lists now, as a change to review and save with the rest.
 *
 * @return {Function} Callback taking the menu ID and the page IDs to leave out.
 */
export function useKeepPagesOutOfMenu() {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const { createSuccessNotice } = useDispatch( noticesStore );

	return async ( menuId, pageIds ) => {
		const content = await getEditedMenuContent( menuId );
		const blocks = getParsedBlocks( content );

		if ( ! hasPageListBlock( blocks ) ) {
			return;
		}

		const leaveOut = new Set( pageIds.map( Number ) );
		const pages = (
			( await resolveSelect( coreDataStore ).getEntityRecords(
				'postType',
				'page',
				MENU_PAGES_QUERY
			) ) || EMPTY_ARRAY
		).filter( ( page ) => ! leaveOut.has( Number( page.id ) ) );

		editEntityRecord( 'postType', 'wp_navigation', menuId, {
			blocks: undefined,
			content: serializeNavigationBlocks(
				expandPageListBlocks( blocks, pages )
			),
			selection: undefined,
		} );
		showMenuSetByHandNotice( {
			createSuccessNotice,
			editEntityRecord,
			navigationId: menuId,
			previousContent: content,
		} );
	};
}
