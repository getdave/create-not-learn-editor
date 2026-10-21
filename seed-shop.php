<?php
/**
 * Stock the Fernhouse demo site's shop with products for trying the editor's
 * Shop screens against.
 *
 * WooCommerce isn't part of the demo environment, so this doesn't run on
 * start. Add WooCommerce through `.wp-env.override.json`, activate it, then
 * run:
 *
 *     npm run wp-env run cli -- --env-cwd=wp-content/plugins/<this folder> \
 *         wp eval-file scripts/demo-site/seed-shop.php
 *
 * The products cover the cases a shop screen has to cope with, not only the
 * easy ones: on sale, stock counted, sold out, on backorder, with options, a
 * link to another shop, a draft, no photo or price, and a description with
 * formatting in it. Products already there, by name, are left alone.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

if ( ! class_exists( 'WooCommerce' ) ) {
	WP_CLI::warning( 'WooCommerce is not active, so the shop was not stocked.' );
	return;
}

require_once ABSPATH . 'wp-admin/includes/image.php';

/**
 * Copy one of the theme's bundled images into the media library, or find the
 * copy made before.
 *
 * @param string $name Image name, without the extension.
 * @return int Attachment ID, or 0 on failure.
 */
function cnl_demo_shop_photo( $name ) {
	$existing = get_posts(
		array(
			'fields'      => 'ids',
			'name'        => 'fernhouse-' . $name,
			'numberposts' => 1,
			'post_status' => 'inherit',
			'post_type'   => 'attachment',
		)
	);

	if ( $existing ) {
		return (int) $existing[0];
	}

	$source = get_theme_file_path( 'assets/images/' . $name . '.webp' );

	if ( ! file_exists( $source ) ) {
		return 0;
	}

	// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local theme file.
	$upload = wp_upload_bits( 'fernhouse-' . $name . '.webp', null, file_get_contents( $source ) );

	if ( ! empty( $upload['error'] ) ) {
		return 0;
	}

	$attachment_id = wp_insert_attachment(
		array(
			'post_mime_type' => 'image/webp',
			'post_name'      => 'fernhouse-' . $name,
			'post_status'    => 'inherit',
			'post_title'     => ucfirst( str_replace( '-', ' ', $name ) ),
		),
		$upload['file']
	);

	if ( is_wp_error( $attachment_id ) || ! $attachment_id ) {
		return 0;
	}

	wp_update_attachment_metadata( $attachment_id, wp_generate_attachment_metadata( $attachment_id, $upload['file'] ) );

	return (int) $attachment_id;
}

/**
 * Whether a product with this name exists, in any status.
 *
 * @param string $name Product name.
 * @return bool Whether it exists.
 */
function cnl_demo_shop_has_product( $name ) {
	return (bool) get_posts(
		array(
			'fields'      => 'ids',
			'numberposts' => 1,
			'post_status' => 'any',
			'post_type'   => 'product',
			'title'       => $name,
		)
	);
}

/**
 * Fill in the details every product has, then save it.
 *
 * @param WC_Product $product Product.
 * @param array      $args    `name`, and optionally `description`, `photo`
 *                            and `status`.
 * @return int Product ID.
 */
function cnl_demo_shop_save( $product, $args ) {
	$product->set_name( $args['name'] );
	$product->set_short_description( $args['description'] ?? '' );
	$product->set_status( $args['status'] ?? 'publish' );

	if ( ! empty( $args['photo'] ) ) {
		$product->set_image_id( cnl_demo_shop_photo( $args['photo'] ) );
	}

	return $product->save();
}

$cnl_demo_simple_products = array(
	array(
		'description' => 'Arching striped leaves that cope with almost any windowsill.',
		'name'        => 'Spider plant',
		'photo'       => 'spider-plant',
		'price'       => '14',
		'sale_price'  => '11',
	),
	array(
		'description' => 'Three small succulents, ready for a sunny shelf.',
		'name'        => 'Succulent trio',
		'photo'       => 'succulents',
		'price'       => '24',
		'stock'       => 3,
	),
	array(
		'description'  => 'A tight blue-green rosette that barely needs water.',
		'name'         => 'Echeveria',
		'photo'        => 'succulent-rosette',
		'price'        => '9',
		'stock_status' => 'outofstock',
	),
	array(
		'description'  => 'Big, glossy leaves. Back in stock next month; order now and we’ll send it then.',
		'name'         => 'Fiddle leaf fig',
		'photo'        => 'greenhouse-palms',
		'price'        => '45',
		'stock_status' => 'onbackorder',
	),
	array(
		'description' => 'Three ceramic planters that hang on any wall.',
		'name'        => 'Wall planter set',
		'photo'       => 'wall-planters',
		'price'       => '35',
		'status'      => 'draft',
	),
	array(
		'description' => '<p>Everything a new plant needs:</p><ul><li>A <strong>stainless</strong> trowel</li><li>5 litres of peat-free potting mix</li><li>Our <a href="https://example.com/care">care guide</a></li></ul>',
		'name'        => 'Potting kit',
		'photo'       => 'trowel-and-soil',
		'price'       => '15',
	),
	array(
		'name' => 'Boston fern',
	),
);

foreach ( $cnl_demo_simple_products as $cnl_demo_args ) {
	if ( cnl_demo_shop_has_product( $cnl_demo_args['name'] ) ) {
		continue;
	}

	$cnl_demo_product = new WC_Product_Simple();

	if ( isset( $cnl_demo_args['price'] ) ) {
		$cnl_demo_product->set_regular_price( $cnl_demo_args['price'] );
	}
	if ( isset( $cnl_demo_args['sale_price'] ) ) {
		$cnl_demo_product->set_sale_price( $cnl_demo_args['sale_price'] );
	}
	if ( isset( $cnl_demo_args['stock'] ) ) {
		$cnl_demo_product->set_manage_stock( true );
		$cnl_demo_product->set_stock_quantity( $cnl_demo_args['stock'] );
	}
	if ( isset( $cnl_demo_args['stock_status'] ) ) {
		$cnl_demo_product->set_stock_status( $cnl_demo_args['stock_status'] );
	}

	cnl_demo_shop_save( $cnl_demo_product, $cnl_demo_args );
}

// Options: a pot in three sizes, each with its own price.
if ( ! cnl_demo_shop_has_product( 'Glazed pot' ) ) {
	$cnl_demo_size = new WC_Product_Attribute();
	$cnl_demo_size->set_name( 'Size' );
	$cnl_demo_size->set_options( array( 'Small', 'Medium', 'Large' ) );
	$cnl_demo_size->set_visible( true );
	$cnl_demo_size->set_variation( true );

	$cnl_demo_pot = new WC_Product_Variable();
	$cnl_demo_pot->set_attributes( array( $cnl_demo_size ) );
	$cnl_demo_pot_id = cnl_demo_shop_save(
		$cnl_demo_pot,
		array(
			'description' => 'A hand-glazed pot, made down the road.',
			'name'        => 'Glazed pot',
			'photo'       => 'ceramics-shelf',
		)
	);

	foreach ( array( 'Small' => '8', 'Medium' => '12', 'Large' => '18' ) as $cnl_demo_option => $cnl_demo_price ) {
		$cnl_demo_variation = new WC_Product_Variation();
		$cnl_demo_variation->set_parent_id( $cnl_demo_pot_id );
		$cnl_demo_variation->set_attributes( array( 'size' => $cnl_demo_option ) );
		$cnl_demo_variation->set_regular_price( $cnl_demo_price );
		$cnl_demo_variation->save();
	}

	WC_Product_Variable::sync( $cnl_demo_pot_id );
}

// Sold somewhere else: the button takes visitors to another shop.
if ( ! cnl_demo_shop_has_product( 'The Houseplant Handbook' ) ) {
	$cnl_demo_book = new WC_Product_External();
	$cnl_demo_book->set_regular_price( '20' );
	$cnl_demo_book->set_product_url( 'https://example.com/houseplant-handbook' );
	$cnl_demo_book->set_button_text( 'Buy from our local bookshop' );
	cnl_demo_shop_save(
		$cnl_demo_book,
		array(
			'description' => 'Our favourite guide to keeping plants happy indoors.',
			'name'        => 'The Houseplant Handbook',
			'photo'       => 'shelf-with-print',
		)
	);
}

WP_CLI::success( 'Stocked the Fernhouse shop.' );
