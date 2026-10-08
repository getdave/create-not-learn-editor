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
		'/site-overview',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'cnl_editor_rest_get_site_overview',
			'permission_callback' => static function () {
				return current_user_can( 'edit_theme_options' );
			},
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

	register_rest_route(
		CNL_EDITOR_REST_NAMESPACE,
		'/auto-drafts',
		array(
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => 'cnl_editor_rest_create_auto_draft',
			'permission_callback' => 'cnl_editor_rest_can_create_auto_draft',
			'args'                => array(
				'type' => array(
					'type'              => 'string',
					'required'          => true,
					'sanitize_callback' => 'sanitize_key',
				),
			),
		)
	);
}

/**
 * Get every page of the site, hand-made and dynamic, as a graph.
 *
 * @return WP_REST_Response Response.
 */
function cnl_editor_rest_get_site_overview() {
	return rest_ensure_response( cnl_editor_get_site_overview() );
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
 * Check whether the current user can create an auto-draft for a block-editor post type.
 *
 * @param WP_REST_Request $request Request.
 * @return true|WP_Error Whether the request can create an auto-draft.
 */
function cnl_editor_rest_can_create_auto_draft( $request ) {
	$post_type = get_post_type_object( $request['type'] );

	if ( ! $post_type || empty( $post_type->show_in_rest ) ) {
		return new WP_Error(
			'cnl_editor_invalid_post_type',
			__( 'This content type is not available in the editor.', 'create-not-learn-editor' ),
			array( 'status' => 404 )
		);
	}

	if ( ! function_exists( 'use_block_editor_for_post_type' ) || ! use_block_editor_for_post_type( $post_type->name ) ) {
		return new WP_Error(
			'cnl_editor_block_editor_required',
			__( 'This content type cannot be edited with the block editor.', 'create-not-learn-editor' ),
			array( 'status' => 400 )
		);
	}

	if ( ! current_user_can( $post_type->cap->create_posts ) ) {
		return new WP_Error(
			'cnl_editor_cannot_create',
			__( 'Sorry, you are not allowed to create this content.', 'create-not-learn-editor' ),
			array( 'status' => rest_authorization_required_code() )
		);
	}

	return true;
}

/**
 * Create an auto-draft for the block editor canvas.
 *
 * @param WP_REST_Request $request Request.
 * @return WP_REST_Response|WP_Error Response.
 */
function cnl_editor_rest_create_auto_draft( $request ) {
	$post_type = get_post_type_object( $request['type'] );

	if ( ! $post_type ) {
		return new WP_Error(
			'cnl_editor_invalid_post_type',
			__( 'This content type is not available in the editor.', 'create-not-learn-editor' ),
			array( 'status' => 404 )
		);
	}

	$post_id = wp_insert_post(
		array(
			'post_author'  => get_current_user_id(),
			'post_content' => '',
			'post_status'  => 'auto-draft',
			'post_title'   => __( 'Auto Draft', 'create-not-learn-editor' ),
			'post_type'    => $post_type->name,
		),
		true
	);

	if ( is_wp_error( $post_id ) ) {
		return $post_id;
	}

	$post = get_post( $post_id );

	if ( ! $post ) {
		return new WP_Error(
			'cnl_editor_auto_draft_missing',
			__( 'The auto-draft could not be loaded.', 'create-not-learn-editor' ),
			array( 'status' => 500 )
		);
	}

	return rest_ensure_response(
		array(
			'id'     => (int) $post->ID,
			'type'   => $post->post_type,
			'status' => $post->post_status,
		)
	);
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
