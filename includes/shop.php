<?php
/**
 * The shop: what the editor offers when WooCommerce runs the site's shop.
 *
 * What visitors see, the products and the shop's pages, is worked on in the
 * editor. What they don't, like orders and payments, stays in WP Admin, and
 * the editor links to it there.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Check whether the site has a shop the editor can offer.
 *
 * @return bool Whether WooCommerce is active.
 */
function cnl_editor_has_shop() {
	if ( ! class_exists( 'WooCommerce' ) ) {
		return false;
	}

	/**
	 * Filters whether the editor offers the shop, on a site running
	 * WooCommerce.
	 *
	 * @param bool $has_shop Whether to offer the shop. Default true.
	 */
	return (bool) apply_filters( CNL_EDITOR_SLUG . '_has_shop', true );
}

/**
 * Register the shop's hooks.
 */
function cnl_editor_register_shop_hooks() {
	add_action( 'init', 'cnl_editor_set_product_default_rendering_mode', 20 );
	add_filter( 'block_editor_settings_all', 'cnl_editor_add_product_canvas_style' );
}

/**
 * Style the canvas for editing a product: keep the excerpt block's empty
 * "read more" prompt out of it, and make a block changed from the Products
 * screen flash.
 *
 * A product's short description is edited in place, in the layout's excerpt
 * block, which then also offers a "read more" link no one asked for. The
 * prompt stays hidden until it is typed in.
 *
 * @param array $settings Editor settings.
 * @return array Filtered editor settings.
 */
function cnl_editor_add_product_canvas_style( $settings ) {
	if ( ! cnl_editor_has_shop() ) {
		return $settings;
	}

	$settings['styles']   = is_array( $settings['styles'] ?? null ) ? $settings['styles'] : array();
	$settings['styles'][] = array(
		'css' => '.wp-block-post-excerpt__more-text:has([data-rich-text-placeholder]):not(:focus-within){display:none}'
			// A block changed from the Products screen flashes, with a tint
			// on top of core's highlight outline, so it's seen.
			. '@keyframes cnl-block-flash{from{background:color-mix(in srgb,var(--wp-admin-theme-color) 22%,transparent)}to{background:transparent}}'
			. '.block-editor-block-list__layout .block-editor-block-list__block.is-highlighted::after{animation:cnl-block-flash 1.8s ease-out}',
	);

	return $settings;
}

/**
 * Open products in the block editor inside their layout, as Pages are, so
 * the layout's product blocks show the product being edited rather than
 * placeholders. Only the block editor reads this; WooCommerce's own product
 * editor in WP Admin is unaffected.
 */
function cnl_editor_set_product_default_rendering_mode() {
	if ( cnl_editor_has_shop() && post_type_exists( 'product' ) ) {
		add_post_type_support( 'product', 'editor', array( 'default-mode' => 'template-locked' ) );
	}
}

/**
 * Get the URL of a WooCommerce page, such as the shop or the cart.
 *
 * @param string $page WooCommerce page name.
 * @return string|null Permalink, or null when the page isn't set up.
 */
function cnl_editor_get_shop_page_url( $page ) {
	if ( ! function_exists( 'wc_get_page_id' ) || wc_get_page_id( $page ) <= 0 ) {
		return null;
	}

	return get_permalink( wc_get_page_id( $page ) );
}

/**
 * Get the URL of the newest published product, for previewing the product
 * page.
 *
 * @return string|null Permalink, or null when there are no products.
 */
function cnl_editor_get_sample_product_url() {
	$products = get_posts(
		array(
			'fields'         => 'ids',
			'post_status'    => 'publish',
			'post_type'      => 'product',
			'posts_per_page' => 1,
		)
	);

	return $products ? get_permalink( $products[0] ) : null;
}

/**
 * Get the WP Admin screen that lists orders, which moves when WooCommerce
 * stores orders in its own tables.
 *
 * @return string Admin URL.
 */
function cnl_editor_get_orders_admin_url() {
	if (
		class_exists( '\Automattic\WooCommerce\Utilities\OrderUtil' ) &&
		\Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled()
	) {
		return admin_url( 'admin.php?page=wc-orders' );
	}

	return admin_url( 'edit.php?post_type=shop_order' );
}

/**
 * Get the shop's settings for the editor app.
 *
 * @return array|null Shop settings, or null when there is no shop.
 */
function cnl_editor_get_shop_settings() {
	if ( ! cnl_editor_has_shop() ) {
		return null;
	}

	return array(
		'currencySymbol' => html_entity_decode( get_woocommerce_currency_symbol(), ENT_QUOTES, 'UTF-8' ),
		'price'          => array(
			'currencyPosition'  => get_option( 'woocommerce_currency_pos', 'left' ),
			'decimals'          => wc_get_price_decimals(),
			'decimalSeparator'  => wc_get_price_decimal_separator(),
			'thousandSeparator' => wc_get_price_thousand_separator(),
		),
		// What this user may do. Opening the editor takes
		// `edit_theme_options`, which WooCommerce's Shop manager role lacks,
		// so these are only ever checked for people who can.
		'can'            => array(
			'editProducts' => current_user_can( 'edit_products' ),
			'editOrders'   => current_user_can( 'edit_shop_orders' ),
			'manageShop'   => current_user_can( 'manage_woocommerce' ),
		),
		'pages'          => array(
			'shop'     => cnl_editor_get_shop_page_url( 'shop' ),
			'product'  => cnl_editor_get_sample_product_url(),
			'cart'     => cnl_editor_get_shop_page_url( 'cart' ),
			'checkout' => cnl_editor_get_shop_page_url( 'checkout' ),
		),
		'adminUrls'      => array(
			'orders'     => cnl_editor_get_orders_admin_url(),
			'payments'   => admin_url( 'admin.php?page=wc-settings&tab=checkout' ),
			'shipping'   => admin_url( 'admin.php?page=wc-settings&tab=shipping' ),
			'tax'        => admin_url( 'admin.php?page=wc-settings&tab=tax' ),
			'settings'   => admin_url( 'admin.php?page=wc-settings' ),
			'products'   => admin_url( 'edit.php?post_type=product' ),
			// A product's ID goes on the end.
			'product'    => admin_url( 'post.php?action=edit&post=' ),
		),
	);
}

/**
 * Get the shop's routes.
 *
 * @return array[] Route definitions, none when there is no shop.
 */
function cnl_editor_get_shop_routes() {
	if ( ! cnl_editor_has_shop() ) {
		return array();
	}

	return array(
		array(
			'path'           => '/shop',
			'route_module'   => 'create-not-learn-editor/routes/shop/route',
			'content_module' => 'create-not-learn-editor/routes/shop/content',
		),
		array(
			'path'           => '/shop/products',
			'route_module'   => 'create-not-learn-editor/routes/shop-products/route',
			'content_module' => 'create-not-learn-editor/routes/shop-products/content',
		),
		array(
			'path'           => '/shop/pages',
			'route_module'   => 'create-not-learn-editor/routes/shop-pages/route',
			'content_module' => 'create-not-learn-editor/routes/shop-pages/content',
		),
	);
}

/**
 * Get the shop's sidebar item.
 *
 * It starts out of the sidebar, under a parent no item has, as "Your site"
 * leads to the shop. The Selling workspace lifts it to the top level. See
 * `src/workspaces/index.js`.
 *
 * @return array[] Menu item definitions, none when there is no shop.
 */
function cnl_editor_get_shop_menu_items() {
	if ( ! cnl_editor_has_shop() ) {
		return array();
	}

	return array(
		array(
			'id'     => 'shop',
			'icon'   => 'dashicons-store',
			'label'  => __( 'Shop', 'create-not-learn-editor' ),
			'to'     => '/shop',
			'parent' => 'cnl-workspace-hidden',
		),
	);
}
