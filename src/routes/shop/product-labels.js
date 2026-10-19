/**
 * How a product is described in the shop's screens, shared by the Products
 * list and the table of every product.
 */

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { formatPrice } from './product-entity';
import { getShop } from './shop';

export const STATUS_LABELS = {
	draft: __( 'Draft' ),
	future: __( 'Scheduled' ),
	pending: __( 'Waiting for review' ),
	private: __( 'Private' ),
};

export const STOCK_LABELS = {
	onbackorder: __( 'Taking orders' ),
	outofstock: __( 'Sold out' ),
};

// Products whose price and stock belong to something else.
export const HAS_OPTIONS = [ 'variable', 'grouped' ];

/**
 * @param {number} id Product ID.
 * @return {string} WooCommerce's editor for the product, in WP Admin.
 */
export function getProductEditUrl( id ) {
	const { adminUrls } = getShop();

	return adminUrls.product ? adminUrls.product + id : '';
}

/**
 * @param {Object} product Product record.
 * @return {string} What it costs, as the shop shows it.
 */
export function getPriceLabel( product ) {
	if ( HAS_OPTIONS.includes( product.type ) ) {
		return product.price
			? /* translators: %s: The lowest price. */
				sprintf( __( 'From %s' ), formatPrice( product.price ) )
			: __( 'Priced by option' );
	}

	return (
		formatPrice( product.sale_price || product.regular_price ) ||
		__( 'No price yet' )
	);
}
