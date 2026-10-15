/**
 * WordPress dependencies
 */
import { useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { cnlEditorStore, getErrorMessage } from '../../records';
import {
	coreDataStore,
	useDispatch,
	useEffect,
	useMemo,
	useSelect,
} from '../../wordpress-packages';
import {
	buildNavigationLocationsMap,
	createEditedTemplatePartsCache,
	getMainMenu,
} from './navigation-locations';
import {
	EMPTY_ARRAY,
	NAVIGATION_MENUS_CHANGED_EVENT,
	getNavigationMenuId,
} from './menu-helpers';

const TEMPLATE_PARTS_QUERY = {
	context: 'edit',
	per_page: 100,
	_fields: 'id,slug,title,area,status,content',
};

function useNavigationLocations( menus ) {
	const fallbackMenuId = menus[ 0 ]?.id;
	const mergeEdits = useMemo( () => createEditedTemplatePartsCache(), [] );
	const { error, isResolving, templateParts } = useSelect(
		( select ) => {
			const store = select( coreDataStore );
			const args = [
				'postType',
				'wp_template_part',
				TEMPLATE_PARTS_QUERY,
			];
			const rawTemplateParts =
				store.getEntityRecords( ...args ) || EMPTY_ARRAY;

			return {
				error: store.getResolutionError?.( 'getEntityRecords', args ),
				isResolving:
					store.isResolving( 'getEntityRecords', args ) ||
					! store.hasFinishedResolution( 'getEntityRecords', args ),
				templateParts: mergeEdits( rawTemplateParts, ( id ) =>
					store.getEditedEntityRecord(
						'postType',
						'wp_template_part',
						id
					)
				),
			};
		},
		[ mergeEdits ]
	);
	const locationsMap = useMemo(
		() => buildNavigationLocationsMap( templateParts, fallbackMenuId ),
		[ fallbackMenuId, templateParts ]
	);

	return {
		isResolvingLocations: isResolving,
		locationsError: error ? getErrorMessage( error ) : null,
		locationsMap,
		templateParts,
	};
}

export function useNavigationMenus() {
	const searchParams = useSearch( { strict: false } );
	const { invalidateNavigationMenus } = useDispatch( cnlEditorStore );
	const { error, isLoading, menus } = useSelect( ( select ) => {
		const store = select( cnlEditorStore );

		return {
			error: store.getNavigationMenusError(),
			isLoading:
				store.isFetchingNavigationMenus() ||
				! store.hasFinishedResolution( 'getNavigationMenus', [] ),
			menus: store.getNavigationMenus() || [],
		};
	}, [] );
	const {
		isResolvingLocations,
		locationsError,
		locationsMap,
		templateParts,
	} = useNavigationLocations( menus );

	useEffect( () => {
		const refreshMenus = () => invalidateNavigationMenus();

		window.addEventListener( NAVIGATION_MENUS_CHANGED_EVENT, refreshMenus );

		return () => {
			window.removeEventListener(
				NAVIGATION_MENUS_CHANGED_EVENT,
				refreshMenus
			);
		};
	}, [ invalidateNavigationMenus ] );

	const selectedId = getNavigationMenuId(
		searchParams.menuId || searchParams.menuIds?.[ 0 ] || menus[ 0 ]?.id
	);
	const selectedMenu = useMemo(
		() =>
			menus.find(
				( menu ) => getNavigationMenuId( menu ) === selectedId
			),
		[ menus, selectedId ]
	);

	return {
		error: error ? getErrorMessage( error ) : null,
		isLoading,
		isResolvingLocations,
		locationsError,
		mainMenuId: getMainMenu( menus, templateParts )?.id,
		locationsMap,
		menus,
		selectedId,
		selectedMenu,
		templateParts,
	};
}
