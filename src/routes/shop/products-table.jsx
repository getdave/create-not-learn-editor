/**
 * Every product as a table, for looking through and changing many at once.
 *
 * A step down from Products, reached from its options menu, like Pages'
 * "Manage pages". It takes the whole width, with no canvas. Picking a product
 * opens it in Products, beside its page. Changes made here, like showing
 * several products in the shop at once, are unsaved edits, saved with
 * everything else.
 */

/**
 * Internal dependencies
 */
import { ShopPage } from './heading';
import {
	EMPTY_ARRAY,
	getProductFields,
	useProductActions,
	useProductsPage,
} from './products-data';
import { PRODUCTS_PATH } from './shop';
import { DataViews, __, useMemo, useState } from '../../wordpress-packages';

const DEFAULT_VIEW = {
	fields: [ 'price', 'stock_status', 'status', 'categories' ],
	filters: [],
	mediaField: 'image',
	page: 1,
	perPage: 20,
	search: '',
	sort: { direction: 'desc', field: 'date' },
	titleField: 'name',
	type: 'table',
};

const DEFAULT_LAYOUTS = { list: {}, table: {} };

export default function ProductsTable() {
	const [ view, setView ] = useState( DEFAULT_VIEW );
	const [ selection, setSelection ] = useState( EMPTY_ARRAY );
	const fields = useMemo( () => getProductFields(), [] );
	const actions = useProductActions();
	const { data, isLoading, totalItems, totalPages } = useProductsPage( view );

	return (
		<ShopPage
			className="cnl-shop-table"
			crumbs={ [
				{ label: __( 'Products' ), to: PRODUCTS_PATH },
				{ label: __( 'All products' ) },
			] }
			description={ __(
				'Every product, to look through and change many at once. Changes wait for Save, like any other.'
			) }
			hasPadding={ false }
		>
			<DataViews
				actions={ actions }
				data={ data }
				defaultLayouts={ DEFAULT_LAYOUTS }
				fields={ fields }
				getItemId={ ( item ) => String( item.id ) }
				isLoading={ isLoading && ! data.length }
				onChangeSelection={ setSelection }
				onChangeView={ setView }
				paginationInfo={ { totalItems, totalPages } }
				selection={ selection }
				view={ view }
			/>
		</ShopPage>
	);
}
