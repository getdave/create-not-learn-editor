/**
 * WooCommerce's products, as a core-data entity, so they are edited like the
 * rest of the site: changes wait as unsaved edits, show in the list of
 * changes, are undone with undo and saved with the editor's Save.
 *
 * Read through WooCommerce's own REST API, `wc/v3/products`, which has a
 * product's price and stock. `wp/v2/product` has neither.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * as the editor's product blocks load it from app init.
 */

/**
 * WordPress dependencies
 */
import { store as coreDataStore } from '@wordpress/core-data';
import { dispatch, resolveSelect, select, subscribe } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { getShop } from './shop';

export const PRODUCT_KIND = 'root';
export const PRODUCT_NAME = 'wcProduct';

// The most WooCommerce returns at once.
export const PRODUCTS_PER_PAGE = 100;

function getPostTitle( id ) {
	const title = id
		? select( coreDataStore ).getEditedEntityRecord(
				'postType',
				'product',
				id
			)?.title
		: '';

	return typeof title === 'string' ? title : title?.raw;
}

/**
 * Add the entity, once.
 */
export function registerProductEntity() {
	if (
		select( coreDataStore ).getEntityConfig( PRODUCT_KIND, PRODUCT_NAME )
	) {
		return;
	}

	followProductPosts();

	dispatch( coreDataStore ).addEntities( [
		{
			baseURL: '/wc/v3/products',
			baseURLParams: { context: 'edit' },
			// Named as its post is, which holds the name as it is being
			// changed, so a product's two records read as one in the list
			// of changes.
			getTitle: ( record ) =>
				getPostTitle( record?.id ) ||
				record?.name ||
				__( 'Untitled product' ),
			key: 'id',
			kind: PRODUCT_KIND,
			// Its post is listed as a product, so this says what this
			// record adds to it.
			label: __( 'Price, stock and photo' ),
			name: PRODUCT_NAME,
			plural: 'wcProducts',
		},
	] );
}

/**
 * Load WooCommerce's copy of a product again once its post is saved.
 *
 * A product's name and description are saved on its post, through
 * `wp/v2/product`, which WooCommerce's copy knows nothing about. Products
 * whose post had unsaved edits are watched, and once it has none, whether
 * saved or discarded, WooCommerce's copy is loaded again. Lists of products
 * show it as soon as it is back.
 */
function followProductPosts() {
	let changed = new Set();

	subscribe( () => {
		const store = select( coreDataStore );
		const now = new Set(
			store
				.__experimentalGetDirtyEntityRecords()
				.filter(
					( { kind, name } ) =>
						kind === 'postType' && name === 'product'
				)
				.map( ( { key } ) => Number( key ) )
		);
		const settled = [ ...changed ].filter(
			( id ) =>
				! now.has( id ) &&
				! store.isSavingEntityRecord( 'postType', 'product', id )
		);

		changed = new Set( [
			...now,
			...[ ...changed ].filter( ( id ) => ! settled.includes( id ) ),
		] );

		settled.forEach( ( id ) => {
			dispatch( coreDataStore ).invalidateResolution( 'getEntityRecord', [
				PRODUCT_KIND,
				PRODUCT_NAME,
				id,
			] );
			resolveSelect( coreDataStore ).getEntityRecord(
				PRODUCT_KIND,
				PRODUCT_NAME,
				id
			);
		} );
	}, coreDataStore );
}

/**
 * A price as the shop shows it, in its own currency and number format.
 *
 * @param {string} price The price, as WooCommerce stores it.
 * @return {string} The price, or an empty string when there isn't one.
 */
export function formatPrice( price ) {
	const amount = Number.parseFloat( price );

	if ( Number.isNaN( amount ) ) {
		return '';
	}

	const { price: format = {}, currencySymbol } = getShop();
	const decimals = format.decimals ?? 2;
	const [ whole, fraction ] = amount.toFixed( decimals ).split( '.' );
	const number =
		whole.replace(
			/\B(?=(\d{3})+(?!\d))/g,
			format.thousandSeparator ?? ','
		) + ( fraction ? ( format.decimalSeparator ?? '.' ) + fraction : '' );

	switch ( format.currencyPosition ) {
		case 'right':
			return number + currencySymbol;
		case 'right_space':
			return `${ number } ${ currencySymbol }`;
		case 'left_space':
			return `${ currencySymbol } ${ number }`;
		default:
			return currencySymbol + number;
	}
}

/**
 * A price as typed, as WooCommerce stores it.
 *
 * WooCommerce turns what it can't read into no price, and reads "12,50" as
 * 1250, without saying so. So only plain numbers are passed on, with a comma
 * or a point before the pennies, and no more decimals than the shop uses, so
 * "1,250" isn't mistaken for 1.25.
 *
 * @param {string} text     The price as typed.
 * @param {number} decimals The shop's decimal places.
 * @return {?string} The price, an empty string for none, or null when it
 *                   isn't a price.
 */
export function parsePrice( text, decimals = getShop().price?.decimals ?? 2 ) {
	const price = String( text ?? '' ).trim();

	if ( price === '' ) {
		return '';
	}

	const match = price.match( /^(\d+)(?:[.,](\d+))?$/ );

	if ( ! match || ( match[ 2 ] && match[ 2 ].length > decimals ) ) {
		return null;
	}

	return match[ 2 ] ? `${ match[ 1 ] }.${ match[ 2 ] }` : match[ 1 ];
}
