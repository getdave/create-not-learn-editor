<?php
/**
 * Content post type helpers.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

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
		$rest_base = $post_type->rest_base ? $post_type->rest_base : $post_type->name;

		$data[] = array(
			'name'       => $post_type->name,
			'restBase'   => $rest_base,
			'label'      => $post_type->label,
			'menuName'   => $post_type->labels->menu_name ? $post_type->labels->menu_name : $post_type->label,
			'singular'   => $post_type->labels->singular_name,
			'canCreate'  => current_user_can( $post_type->cap->create_posts ),
			'canEdit'    => current_user_can( $post_type->cap->edit_posts ),
			'menuIcon'   => cnl_editor_get_content_post_type_icon( $post_type ),
			'archiveUrl' => $post_type->has_archive ? get_post_type_archive_link( $post_type->name ) : null,
		);
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
