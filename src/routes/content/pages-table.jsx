/**
 * WordPress dependencies
 */
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { EMPTY_ARRAY } from './page-layouts';
import { usePages } from './pages/data';
import { DEFAULT_CONTENT_VIEW } from './helpers';
import {
	DEFAULT_CONTENT_LAYOUTS,
	PostListDataViewsLayout,
	getContentFields,
} from './content-fields';
import { useDataViews } from '../../use-dataviews';
import {
	Spinner,
	__,
	useCallback,
	useMemo,
	useState,
} from '../../wordpress-packages';

const NO_DATA = { data: EMPTY_ARRAY, paginationInfo: {} };

const PAGES_TABLE_VIEW = {
	...DEFAULT_CONTENT_VIEW,
	fields: [ 'on-site', 'date' ],
	sort: { direction: 'asc', field: 'title' },
	type: 'table',
};

/**
 * Every page as a table, the traditional way to look through them, reached
 * from Pages' options menu. It takes the whole width, so picking a page opens
 * it in Pages, beside its preview.
 *
 * @param {Object} props          Component props.
 * @param {Object} props.mainMenu Result of `useMainMenu`.
 * @param {string} props.listPath Path of the Pages screen.
 * @return {Element} The table.
 */
export default function PagesTable( { mainMenu, listPath } ) {
	const navigate = useNavigate();
	const dataViews = useDataViews();
	const { frontPageId, isLoading, pages, postsPageId } = usePages();
	const [ view, setView ] = useState( PAGES_TABLE_VIEW );
	const fields = useMemo(
		() =>
			getContentFields( {
				frontPageId,
				isPages: true,
				menuPages: mainMenu.menuPages,
				postsPageId,
			} )
				.filter(
					( field ) =>
						field.id !== 'author' && field.id !== 'comments'
				)
				// Filter on the status itself, as the data is filtered here.
				.map( ( field ) =>
					field.id === 'status'
						? { ...field, getValue: ( { item } ) => item.status }
						: field
				),
		[ frontPageId, mainMenu.menuPages, postsPageId ]
	);
	const openPage = useCallback(
		( item ) =>
			navigate( {
				search: { postId: item.id, previewId: item.id },
				to: listPath,
			} ),
		[ listPath, navigate ]
	);
	const actions = useMemo(
		() => [
			{
				callback: ( [ item ] ) => item && openPage( item ),
				id: 'edit',
				isPrimary: true,
				label: __( 'Edit' ),
				supportsBulk: false,
			},
			{
				callback: ( [ item ] ) =>
					item?.link &&
					window.open( item.link, '_blank', 'noopener,noreferrer' ),
				id: 'open-preview',
				isEligible: ( item ) => !! item.link,
				label: __( 'Open preview' ),
				supportsBulk: false,
			},
		],
		[ openPage ]
	);
	const { data, paginationInfo } = useMemo(
		() =>
			dataViews
				? dataViews.filterSortAndPaginate( pages, view, fields )
				: NO_DATA,
		[ dataViews, fields, pages, view ]
	);

	if ( ! dataViews ) {
		return (
			<div className="cnl-editor-spinner">
				<Spinner />
			</div>
		);
	}

	const { DataViews } = dataViews;

	return (
		<DataViews
			actions={ actions }
			data={ data }
			defaultLayouts={ DEFAULT_CONTENT_LAYOUTS }
			fields={ fields }
			getItemId={ ( item ) => String( item.id ) }
			isLoading={ isLoading && ! pages.length }
			onChangeSelection={ () => {} }
			onChangeView={ setView }
			onClickItem={ openPage }
			paginationInfo={ paginationInfo }
			selection={ EMPTY_ARRAY }
			view={ view }
		>
			<PostListDataViewsLayout />
		</DataViews>
	);
}
