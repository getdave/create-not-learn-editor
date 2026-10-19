/**
 * The products, as a list beside the canvas: DataViews' list, laid out for
 * the narrow panel with only a search above it and paging below. Sorting,
 * filters, columns and changing many at once are in the table of every
 * product, a step further in.
 *
 * Picking a product opens it, as picking a page does in Pages.
 */

/**
 * WordPress dependencies
 */
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { useShopSearch } from './heading';
import {
	EMPTY_ARRAY,
	getProductFields,
	useProductsPage,
} from './products-data';
import { PRODUCTS_PATH } from './shop';
import { DataViews, __, useMemo, useState } from '../../wordpress-packages';

const DEFAULT_VIEW = {
	descriptionField: 'summary',
	fields: [ 'badges' ],
	filters: [],
	mediaField: 'image',
	page: 1,
	perPage: 20,
	search: '',
	sort: { direction: 'desc', field: 'date' },
	titleField: 'name',
	type: 'list',
};

const DEFAULT_LAYOUTS = { list: {} };

function ProductsListLayout() {
	return (
		<div className="cnl-shop-list">
			<DataViews.Search label={ __( 'Search products' ) } />
			<DataViews.Layout />
			<DataViews.Pagination />
		</div>
	);
}

/**
 * @param {Object}  props            Component props.
 * @param {?number} props.selectedId The product open, if any.
 * @param {Element} props.empty      What to show when nothing matches.
 * @return {Element} The list.
 */
export default function ProductsList( { empty, selectedId } ) {
	const navigate = useNavigate();
	const search = useShopSearch();
	const [ view, setView ] = useState( DEFAULT_VIEW );
	const fields = useMemo( () => getProductFields(), [] );
	const { data, isLoading, totalItems, totalPages } = useProductsPage( view );
	const openProduct = ( id ) =>
		navigate( { search: { ...search, product: id }, to: PRODUCTS_PATH } );
	const selection = useMemo(
		() => ( selectedId ? [ String( selectedId ) ] : EMPTY_ARRAY ),
		[ selectedId ]
	);

	return (
		<DataViews
			data={ data }
			defaultLayouts={ DEFAULT_LAYOUTS }
			empty={ empty }
			fields={ fields }
			getItemId={ ( item ) => String( item.id ) }
			isLoading={ isLoading && ! data.length }
			onChangeSelection={ ( [ id ] ) =>
				id && openProduct( Number( id ) )
			}
			onChangeView={ setView }
			onClickItem={ ( item ) => openProduct( item.id ) }
			paginationInfo={ { totalItems, totalPages } }
			selection={ selection }
			view={ view }
		>
			<ProductsListLayout />
		</DataViews>
	);
}
