<?php
/**
 * Compatibility with other plugins.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register plugin compatibility hooks.
 */
function cnl_editor_register_plugin_compat_hooks() {
	add_filter( 'rest_pre_dispatch', 'cnl_editor_prepare_block_editor_assets_request', 10, 3 );
}

/**
 * Let WooCommerce survive Gutenberg's block editor assets request.
 *
 * The editor loads its assets from `/wp-block-editor/v1/assets`, which fires
 * `admin_enqueue_scripts` inside a REST request. WooCommerce's handlers for it
 * call admin helpers, like `wc_get_page_screen_id()`, that WooCommerce only
 * loads on wp-admin requests, so the request dies with a fatal error and the
 * editor never loads. Load those helpers for this one request.
 *
 * @param mixed           $result  Response to short-circuit with, or null.
 * @param WP_REST_Server  $server  REST server.
 * @param WP_REST_Request $request Request.
 * @return mixed The response, untouched.
 */
function cnl_editor_prepare_block_editor_assets_request( $result, $server, $request ) {
	if (
		'/wp-block-editor/v1/assets' !== $request->get_route() ||
		function_exists( 'wc_get_page_screen_id' ) ||
		! function_exists( 'WC' )
	) {
		return $result;
	}

	$admin_functions = WC()->plugin_path() . '/includes/admin/wc-admin-functions.php';

	if ( file_exists( $admin_functions ) ) {
		require_once $admin_functions;
	}

	return $result;
}
