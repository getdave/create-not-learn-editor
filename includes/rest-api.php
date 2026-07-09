<?php
/**
 * REST API endpoints.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register REST hooks.
 */
function cnl_editor_register_rest_hooks() {
	add_action( 'rest_api_init', 'cnl_editor_register_rest_routes' );
	add_filter( 'show_admin_bar', 'cnl_editor_hide_admin_bar_in_preview', PHP_INT_MAX );
}

/**
 * Register REST routes.
 */
function cnl_editor_register_rest_routes() {
	register_rest_route(
		CNL_EDITOR_REST_NAMESPACE,
		'/preview-context',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'cnl_editor_rest_get_preview_context',
			'permission_callback' => static function () {
				return current_user_can( 'edit_posts' );
			},
			'args'                => array(
				'url' => array(
					'type'              => 'string',
					'required'          => true,
					'sanitize_callback' => 'esc_url_raw',
				),
			),
		)
	);

	register_rest_route(
		CNL_EDITOR_REST_NAMESPACE,
		'/setup-defaults',
		array(
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => 'cnl_editor_rest_setup_defaults',
			'permission_callback' => static function () {
				return current_user_can( 'edit_theme_options' );
			},
		)
	);
}

/**
 * Get preview context for a URL.
 *
 * @param WP_REST_Request $request Request.
 * @return WP_REST_Response Response.
 */
function cnl_editor_rest_get_preview_context( $request ) {
	return rest_ensure_response(
		cnl_editor_get_preview_context( $request['url'] )
	);
}

/**
 * Run explicit site default setup.
 *
 * @return WP_REST_Response Response.
 */
function cnl_editor_rest_setup_defaults() {
	return rest_ensure_response( cnl_editor_setup_site_defaults() );
}

/**
 * Hide the WordPress admin bar inside Create Not Learn preview iframes.
 *
 * @param bool $show_admin_bar Whether to show the admin bar.
 * @return bool Whether to show the admin bar.
 */
function cnl_editor_hide_admin_bar_in_preview( $show_admin_bar ) {
	if ( is_admin() ) {
		return $show_admin_bar;
	}

	$is_preview = '1' === filter_input(
		INPUT_GET,
		'cnl-editor-preview',
		FILTER_SANITIZE_FULL_SPECIAL_CHARS
	);

	return $is_preview ? false : $show_admin_bar;
}
