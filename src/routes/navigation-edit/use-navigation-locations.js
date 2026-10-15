/**
 * Internal dependencies
 */
import { coreDataStore, useMemo, useSelect } from '../../wordpress-packages';
import {
	buildNavigationLocationsMap,
	createEditedTemplatePartsCache,
} from '../navigation/navigation-locations';
import { EMPTY_ARRAY, NAVIGATION_POST_TYPE } from './shared';

const NAVIGATION_MENUS_QUERY = {
	context: 'edit',
	order: 'desc',
	orderby: 'date',
	per_page: 100,
	status: 'publish,draft',
	_fields: 'id,title,content,status',
};
const TEMPLATE_PARTS_QUERY = {
	context: 'edit',
	per_page: 100,
	_fields: 'id,slug,title,area,status,content',
};

export function useNavigationLocations( navigationId ) {
	const mergeEdits = useMemo( () => createEditedTemplatePartsCache(), [] );
	const { isResolvingTemplateParts, menu, menus, templateParts } = useSelect(
		( select ) => {
			const store = select( coreDataStore );
			const menuRecordArgs = [
				'postType',
				NAVIGATION_POST_TYPE,
				navigationId,
			];
			const menuArgs = [
				'postType',
				NAVIGATION_POST_TYPE,
				NAVIGATION_MENUS_QUERY,
			];
			const templatePartArgs = [
				'postType',
				'wp_template_part',
				TEMPLATE_PARTS_QUERY,
			];
			const rawTemplateParts =
				store.getEntityRecords( ...templatePartArgs ) || EMPTY_ARRAY;

			return {
				isResolvingTemplateParts:
					store.isResolving( 'getEntityRecords', templatePartArgs ) ||
					! store.hasFinishedResolution(
						'getEntityRecords',
						templatePartArgs
					),
				// With its unsaved edits, so the previews show what the tree
				// shows.
				menu:
					navigationId && store.getEntityRecord( ...menuRecordArgs )
						? store.getEditedEntityRecord( ...menuRecordArgs )
						: null,
				menus: store.getEntityRecords( ...menuArgs ) || EMPTY_ARRAY,
				templateParts: mergeEdits( rawTemplateParts, ( id ) =>
					store.getEditedEntityRecord(
						'postType',
						'wp_template_part',
						id
					)
				),
			};
		},
		[ mergeEdits, navigationId ]
	);
	const fallbackMenuId = menus[ 0 ]?.id;
	const locationsMap = useMemo(
		() => buildNavigationLocationsMap( templateParts, fallbackMenuId ),
		[ fallbackMenuId, templateParts ]
	);

	return {
		isResolvingTemplateParts,
		locations: locationsMap[ navigationId ] || EMPTY_ARRAY,
		menu,
		templateParts,
	};
}
