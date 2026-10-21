<?php
/**
 * Mainstay functions and definitions.
 *
 * @package Mainstay
 */

defined( 'ABSPATH' ) || exit;

/**
 * Load style.css in the editors as well as on the front end.
 */
function mainstay_setup() {
	add_editor_style( 'style.css' );
}
add_action( 'after_setup_theme', 'mainstay_setup' );

/**
 * Enqueue the theme stylesheet on the front end.
 */
function mainstay_enqueue_styles() {
	wp_enqueue_style(
		'mainstay-style',
		get_stylesheet_uri(),
		array(),
		wp_get_theme()->get( 'Version' )
	);
}
add_action( 'wp_enqueue_scripts', 'mainstay_enqueue_styles' );

/**
 * Register the pattern categories the theme uses that core doesn't.
 */
function mainstay_register_pattern_categories() {
	register_block_pattern_category(
		'mainstay/pages',
		array(
			'label'       => __( 'Pages', 'mainstay' ),
			'description' => __( 'Whole pages built from Mainstay sections.', 'mainstay' ),
		)
	);
}
add_action( 'init', 'mainstay_register_pattern_categories' );

/**
 * Get the URL of one of the theme's bundled images.
 *
 * @param string $name Image file name, without the extension.
 * @return string Image URL.
 */
function mainstay_image( $name ) {
	return get_theme_file_uri( 'assets/images/' . $name . '.webp' );
}

/**
 * Get the URL of one of the site's pages, for buttons that lead to it.
 *
 * Patterns call this as they load, so links follow the site's own address and
 * permalinks wherever it runs. A site without a published page of that slug
 * gets `#` instead, as the button has nowhere to go.
 *
 * @param string $slug     Page slug.
 * @param string $fragment Optional ID of a section on that page.
 * @return string Page URL.
 */
function mainstay_page_url( $slug, $fragment = '' ) {
	$page = get_page_by_path( $slug );

	if ( ! $page || 'publish' !== $page->post_status ) {
		return '#';
	}

	return get_permalink( $page ) . ( $fragment ? '#' . $fragment : '' );
}
