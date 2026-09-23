<?php
/**
 * Content post type helpers.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register content type hooks.
 */
function cnl_editor_register_content_type_hooks() {
	add_action( 'init', 'cnl_editor_set_page_default_rendering_mode', 20 );
}

/**
 * Default Pages to the full template rendering mode, so the editor always
 * shows the surrounding template context when editing a Page.
 */
function cnl_editor_set_page_default_rendering_mode() {
	add_post_type_support( 'page', 'editor', array( 'default-mode' => 'template-locked' ) );
}

/**
 * Get post types that should appear in the Create Not Learn content menu.
 *
 * @return WP_Post_Type[] Post type objects keyed by post type name.
 */
function cnl_editor_get_content_post_types() {
	$excluded_post_types = array(
		'attachment',
		'nav_menu_item',
		'wp_block',
		'wp_font_face',
		'wp_font_family',
		'wp_global_styles',
		'wp_navigation',
		'wp_template',
		'wp_template_part',
	);

	$post_types = get_post_types(
		array(
			'public'       => true,
			'show_in_rest' => true,
			'show_ui'      => true,
		),
		'objects'
	);

	$post_types = array_filter(
		$post_types,
		static function ( $post_type ) use ( $excluded_post_types ) {
			return ! in_array( $post_type->name, $excluded_post_types, true );
		}
	);

	return cnl_editor_sort_content_post_types( $post_types );
}

/**
 * Sort post types with pages and posts first.
 *
 * @param WP_Post_Type[] $post_types Post types keyed by name.
 * @return WP_Post_Type[] Sorted post types.
 */
function cnl_editor_sort_content_post_types( $post_types ) {
	$preferred_order = array(
		'page' => 0,
		'post' => 1,
	);

	uksort(
		$post_types,
		static function ( $a, $b ) use ( $preferred_order ) {
			$a_order = $preferred_order[ $a ] ?? 100;
			$b_order = $preferred_order[ $b ] ?? 100;

			if ( $a_order !== $b_order ) {
				return $a_order <=> $b_order;
			}

			return strnatcasecmp( $a, $b );
		}
	);

	return $post_types;
}

/**
 * Get a JSON-ready post type list for the editor app.
 *
 * @return array[] Content post types.
 */
function cnl_editor_get_content_post_type_data() {
	$post_types = cnl_editor_get_content_post_types();
	$data       = array();

	foreach ( $post_types as $post_type ) {
		$data[] = cnl_editor_get_post_type_data( $post_type );
	}

	return $data;
}

/**
 * Get JSON-ready post type data for the editor app.
 *
 * @param WP_Post_Type $post_type Post type object.
 * @return array Post type data.
 */
function cnl_editor_get_post_type_data( $post_type ) {
	$rest_base = $post_type->rest_base ? $post_type->rest_base : $post_type->name;

	return array(
		'name'       => $post_type->name,
		'restBase'   => $rest_base,
		'label'      => $post_type->label,
		'menuName'   => $post_type->labels->menu_name ? $post_type->labels->menu_name : $post_type->label,
		'singular'   => $post_type->labels->singular_name,
		'canCreate'  => current_user_can( $post_type->cap->create_posts ),
		'canEdit'     => current_user_can( $post_type->cap->edit_posts ),
		'blockEditor' => function_exists( 'use_block_editor_for_post_type' ) &&
			use_block_editor_for_post_type( $post_type->name ),
		'menuIcon'    => cnl_editor_get_content_post_type_icon( $post_type ),
		'archiveUrl'  => $post_type->has_archive ? get_post_type_archive_link( $post_type->name ) : null,
		'newUrl'      => add_query_arg( 'post_type', $post_type->name, admin_url( 'post-new.php' ) ),
	);
}

/**
 * Get post types that can be opened in the editor canvas.
 *
 * @return array[] Editable post type data.
 */
function cnl_editor_get_editable_post_type_data() {
	$post_types = cnl_editor_get_content_post_types();

	$navigation_post_type = get_post_type_object( 'wp_navigation' );
	if (
		$navigation_post_type &&
		! empty( $navigation_post_type->show_in_rest ) &&
		! empty( $navigation_post_type->show_ui )
	) {
		$post_types[ $navigation_post_type->name ] = $navigation_post_type;
	}

	$template_post_type = get_post_type_object( 'wp_template' );
	if (
		$template_post_type &&
		! empty( $template_post_type->show_in_rest ) &&
		current_user_can( $template_post_type->cap->edit_posts )
	) {
		$post_types[ $template_post_type->name ] = $template_post_type;
	}

	$template_part_post_type = get_post_type_object( 'wp_template_part' );
	if (
		$template_part_post_type &&
		! empty( $template_part_post_type->show_in_rest ) &&
		current_user_can( $template_part_post_type->cap->edit_posts )
	) {
		$post_types[ $template_part_post_type->name ] = $template_part_post_type;
	}

	$pattern_post_type = get_post_type_object( 'wp_block' );
	if (
		$pattern_post_type &&
		! empty( $pattern_post_type->show_in_rest ) &&
		current_user_can( $pattern_post_type->cap->edit_posts )
	) {
		$post_types[ $pattern_post_type->name ] = $pattern_post_type;
	}

	$data = array();
	foreach ( $post_types as $post_type ) {
		$data[] = cnl_editor_get_post_type_data( $post_type );
	}

	return $data;
}

/**
 * Get the sidebar icon for a content post type.
 *
 * @param WP_Post_Type $post_type Post type object.
 * @return string Dashicon class.
 */
function cnl_editor_get_content_post_type_icon( $post_type ) {
	if ( 'page' === $post_type->name ) {
		return 'dashicons-admin-page';
	}

	if ( 'post' === $post_type->name ) {
		return 'dashicons-admin-post';
	}

	if ( is_string( $post_type->menu_icon ) && 0 === strpos( $post_type->menu_icon, 'dashicons-' ) ) {
		return $post_type->menu_icon;
	}

	return 'dashicons-admin-post';
}
