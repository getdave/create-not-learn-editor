/**
 * Products as DataViews sees them: the fields, the WooCommerce query behind a
 * view, and what can be done to a product. Shared by the list in Products and
 * the table of every product, so the two always agree.
 *
 * WooCommerce does the searching, filtering, sorting and paging, so a shop of
 * any size works.
 */

/**
 * WordPress dependencies
 */
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { useShopSearch } from './heading';
import { PRODUCT_KIND, PRODUCT_NAME, formatPrice } from './product-entity';
import {
	HAS_OPTIONS,
	STATUS_LABELS,
	STOCK_LABELS,
	getPriceLabel,
	getProductEditUrl,
} from './product-labels';
import { PRODUCTS_PATH } from './shop';
import {
	Badge,
	Stack,
	__,
	coreDataStore,
	decodeEntities,
	sprintf,
	useDispatch,
	useMemo,
	useSelect,
} from '../../wordpress-packages';

export const EMPTY_ARRAY = [];

const STATUS_OPTIONS = [
	{ label: __( 'In the shop' ), value: 'publish' },
	{ label: __( 'Draft' ), value: 'draft' },
	{ label: __( 'Waiting for review' ), value: 'pending' },
	{ label: __( 'Private' ), value: 'private' },
	{ label: __( 'Scheduled' ), value: 'future' },
];

const STOCK_OPTIONS = [
	{ label: __( 'In stock' ), value: 'instock' },
	{ label: __( 'Sold out' ), value: 'outofstock' },
	{ label: __( 'Taking orders' ), value: 'onbackorder' },
];

const TYPE_OPTIONS = [
	{ label: __( 'Simple' ), value: 'simple' },
	{ label: __( 'With options' ), value: 'variable' },
	{ label: __( 'Group' ), value: 'grouped' },
	{ label: __( 'Sold elsewhere' ), value: 'external' },
];

// The fields WooCommerce can sort by, and what it calls them.
const ORDER_BY = {
	date: 'date',
	name: 'title',
	price: 'price',
	total_sales: 'popularity',
};

function getLabel( options, value ) {
	return options.find( ( option ) => option.value === value )?.label;
}

/**
 * The table's view, as a WooCommerce products query.
 *
 * @param {Object} view DataViews view.
 * @return {Object} Query for `wc/v3/products`.
 */
/**
 * @param {Object} product Product record.
 * @return {string[]} Its status, sale and stock, where they need saying.
 */
function getProductBadges( product ) {
	return [
		STATUS_LABELS[ product.status ],
		! HAS_OPTIONS.includes( product.type ) &&
			product.sale_price &&
			__( 'On sale' ),
		product.type !== 'external' && STOCK_LABELS[ product.stock_status ],
	].filter( Boolean );
}

export function getQuery( view ) {
	const query = {
		order: view.sort?.direction || 'desc',
		orderby: ORDER_BY[ view.sort?.field ] || 'date',
		page: view.page || 1,
		per_page: view.perPage || 20,
		status: 'any',
	};

	if ( view.search ) {
		query.search = view.search;
	}

	// WooCommerce filters by one of each, so each filter is "is".
	( view.filters || [] ).forEach( ( { field, value } ) => {
		if ( value && [ 'status', 'stock_status', 'type' ].includes( field ) ) {
			query[ field ] = value;
		}
	} );

	return query;
}

export function getProductFields() {
	return [
		{
			enableHiding: false,
			enableSorting: false,
			filterBy: false,
			id: 'image',
			label: __( 'Photo' ),
			render: ( { item } ) =>
				item.images?.[ 0 ]?.src ? (
					<img
						alt=""
						className="cnl-shop-table__photo"
						src={ item.images[ 0 ].src }
					/>
				) : (
					<span
						aria-hidden
						className="cnl-shop-table__photo is-empty"
					/>
				),
			type: 'media',
		},
		{
			enableGlobalSearch: true,
			enableHiding: false,
			filterBy: false,
			getValue: ( { item } ) => decodeEntities( item.name || '' ),
			id: 'name',
			label: __( 'Name' ),
			render: ( { item } ) => (
				<Stack align="center" direction="row" gap="sm">
					{ decodeEntities( item.name || '' ) ||
						__( 'Untitled product' ) }
					{ item.isUnsaved && (
						<Badge intent="draft">{ __( 'Not saved' ) }</Badge>
					) }
				</Stack>
			),
			type: 'text',
		},
		{
			// Price and stock in one line, under the name in the list.
			enableHiding: false,
			enableSorting: false,
			filterBy: false,
			getValue: ( { item } ) =>
				[
					getPriceLabel( item ),
					item.manage_stock &&
						sprintf(
							/* translators: %d: How many are in stock. */
							__( '%d in stock' ),
							item.stock_quantity ?? 0
						),
				]
					.filter( Boolean )
					.join( ' · ' ),
			id: 'summary',
			label: __( 'Summary' ),
			type: 'text',
		},
		{
			// What is out of the ordinary about a product, at a glance.
			enableSorting: false,
			filterBy: false,
			getValue: ( { item } ) => getProductBadges( item ).join( ', ' ),
			id: 'badges',
			label: __( 'Notes' ),
			render: ( { item } ) => {
				const badges = getProductBadges( item );

				return badges.length ? (
					<Stack direction="row" gap="xs" wrap="wrap">
						{ badges.map( ( badge ) => (
							<Badge intent="draft" key={ badge }>
								{ badge }
							</Badge>
						) ) }
					</Stack>
				) : null;
			},
			type: 'text',
		},
		{
			filterBy: false,
			getValue: ( { item } ) => Number( item.price ) || 0,
			id: 'price',
			label: __( 'Price' ),
			render: ( { item } ) =>
				! HAS_OPTIONS.includes( item.type ) && item.sale_price
					? sprintf(
							/* translators: 1: Sale price, 2: Usual price. */
							__( '%1$s (was %2$s)' ),
							formatPrice( item.sale_price ),
							formatPrice( item.regular_price )
						)
					: getPriceLabel( item ),
			type: 'number',
		},
		{
			elements: STOCK_OPTIONS,
			enableSorting: false,
			filterBy: { operators: [ 'is' ] },
			getValue: ( { item } ) => item.stock_status,
			id: 'stock_status',
			label: __( 'Stock' ),
			render: ( { item } ) => {
				// Sold on another site, so it has no stock here.
				if ( item.type === 'external' ) {
					return '';
				}

				return item.manage_stock
					? sprintf(
							/* translators: %d: How many are in stock. */
							__( '%d in stock' ),
							item.stock_quantity ?? 0
						)
					: getLabel( STOCK_OPTIONS, item.stock_status );
			},
			type: 'text',
		},
		{
			elements: STATUS_OPTIONS,
			enableSorting: false,
			filterBy: { operators: [ 'is' ] },
			getValue: ( { item } ) => item.status,
			id: 'status',
			label: __( 'Shown' ),
			render: ( { item } ) =>
				item.status === 'publish' ? (
					getLabel( STATUS_OPTIONS, item.status )
				) : (
					<Badge intent="draft">
						{ STATUS_LABELS[ item.status ] || item.status }
					</Badge>
				),
			type: 'text',
		},
		{
			elements: TYPE_OPTIONS,
			enableSorting: false,
			filterBy: { operators: [ 'is' ] },
			getValue: ( { item } ) => item.type,
			id: 'type',
			label: __( 'Kind' ),
			render: ( { item } ) =>
				getLabel( TYPE_OPTIONS, item.type ) || item.type,
			type: 'text',
		},
		{
			enableSorting: false,
			filterBy: false,
			getValue: ( { item } ) =>
				( item.categories || [] )
					.map( ( { name } ) => decodeEntities( name ) )
					.join( ', ' ),
			id: 'categories',
			label: __( 'Categories' ),
			type: 'text',
		},
		{
			enableSorting: false,
			filterBy: false,
			getValue: ( { item } ) => item.sku || '',
			id: 'sku',
			label: __( 'SKU' ),
			type: 'text',
		},
		{
			filterBy: false,
			getValue: ( { item } ) => item.total_sales || 0,
			id: 'total_sales',
			label: __( 'Sold' ),
			type: 'integer',
		},
		{
			filterBy: false,
			getValue: ( { item } ) => item.date_created,
			id: 'date',
			label: __( 'Added' ),
			render: ( { item } ) =>
				item.date_created
					? new Date( item.date_created ).toLocaleDateString(
							undefined,
							{ day: 'numeric', month: 'short', year: 'numeric' }
						)
					: '',
			type: 'datetime',
		},
	];
}

export function useProductsPage( view ) {
	const query = useMemo( () => getQuery( view ), [ view ] );

	return useSelect(
		( select ) => {
			const store = select( coreDataStore );
			const args = [ PRODUCT_KIND, PRODUCT_NAME, query ];
			const records = store.getEntityRecords( ...args );

			return {
				// What is shown includes unsaved changes, so a change made
				// here shows straight away. WooCommerce searches and filters
				// what is saved, so a changed product is marked as such, as
				// it may not match the filters until it is saved.
				data:
					records?.map( ( { id } ) => {
						const product = store.getEditedEntityRecord(
							PRODUCT_KIND,
							PRODUCT_NAME,
							id
						);
						// The name and description are changed on the
						// product's post, by the editor and the Products
						// screen alike.
						const hasPostEdits = store.hasEditsForEntityRecord(
							'postType',
							'product',
							id
						);
						const postEdits = hasPostEdits
							? store.getEntityRecordEdits(
									'postType',
									'product',
									id
								)
							: null;

						if (
							! hasPostEdits &&
							! store.hasEditsForEntityRecord(
								PRODUCT_KIND,
								PRODUCT_NAME,
								id
							)
						) {
							return product;
						}

						return {
							...product,
							isUnsaved: true,
							name: postEdits?.title ?? product.name,
							short_description:
								postEdits?.excerpt ?? product.short_description,
						};
					} ) || EMPTY_ARRAY,
				isLoading: ! store.hasFinishedResolution(
					'getEntityRecords',
					args
				),
				totalItems: store.getEntityRecordsTotalItems?.( ...args ) || 0,
				totalPages: store.getEntityRecordsTotalPages?.( ...args ) || 0,
			};
		},
		[ query ]
	);
}

export function useProductActions() {
	const navigate = useNavigate();
	const search = useShopSearch();
	const { editEntityRecord } = useDispatch( coreDataStore );
	const edit = ( items, edits ) =>
		items.forEach( ( item ) =>
			editEntityRecord( PRODUCT_KIND, PRODUCT_NAME, item.id, edits )
		);
	const isSimple = ( item ) =>
		! HAS_OPTIONS.includes( item.type ) &&
		item.type !== 'external' &&
		! item.manage_stock;

	return [
		{
			callback: ( [ item ] ) =>
				navigate( {
					search: { ...search, product: item.id },
					to: PRODUCTS_PATH,
				} ),
			id: 'edit',
			isPrimary: true,
			label: __( 'Edit' ),
		},
		{
			callback: ( items ) => edit( items, { status: 'publish' } ),
			id: 'show',
			isEligible: ( item ) => item.status !== 'publish',
			label: __( 'Show in your shop' ),
			supportsBulk: true,
		},
		{
			callback: ( items ) => edit( items, { status: 'draft' } ),
			id: 'hide',
			isEligible: ( item ) => item.status === 'publish',
			label: __( 'Hide from your shop' ),
			supportsBulk: true,
		},
		{
			callback: ( items ) => edit( items, { stock_status: 'instock' } ),
			id: 'in-stock',
			isEligible: ( item ) =>
				isSimple( item ) && item.stock_status !== 'instock',
			label: __( 'Mark as in stock' ),
			supportsBulk: true,
		},
		{
			callback: ( items ) =>
				edit( items, { stock_status: 'outofstock' } ),
			id: 'sold-out',
			isEligible: ( item ) =>
				isSimple( item ) && item.stock_status !== 'outofstock',
			label: __( 'Mark as sold out' ),
			supportsBulk: true,
		},
		{
			callback: ( [ item ] ) =>
				window.open( item.permalink, '_blank', 'noopener,noreferrer' ),
			id: 'view',
			isEligible: ( item ) => item.status === 'publish',
			label: __( 'View in your shop' ),
		},
		{
			callback: ( [ item ] ) =>
				window.open(
					getProductEditUrl( item.id ),
					'_blank',
					'noopener,noreferrer'
				),
			id: 'admin',
			label: __( 'Edit in WP Admin' ),
		},
	];
}
