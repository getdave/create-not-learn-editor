<?php
/**
 * Layouts: plain section shapes offered by the "Add a section" picker.
 *
 * Ported from the core set of Layout Primitives
 * (https://github.com/getdave/editor-layout-primitives). Each layout is a
 * block pattern of empty blocks with placeholder hints, so people fill in
 * their own words and pictures and the theme decides how it looks. Previews
 * draw the empty blocks as wireframes, see `src/layouts/`.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * The pattern category the picker reads layouts from.
 */
const CNL_EDITOR_LAYOUT_CATEGORY = 'cnl-layouts';

/**
 * Register layout hooks.
 */
function cnl_editor_register_layout_hooks() {
	add_action( 'init', 'cnl_editor_register_layout_patterns', 20 );
	add_filter( 'block_editor_settings_all', 'cnl_editor_add_layout_styles' );
}

/**
 * Layouts in the order the picker shows them: each slug's title, and the
 * group it is listed under. The groups are by shape, see
 * `getLayoutGroups()` in `src/section-picker/groups.js`.
 *
 * @return array<string, array{0: string, 1: string}> Title and group, keyed
 *                                                    by slug.
 */
function cnl_editor_get_layouts() {
	return array(
		'hero'                   => array( __( 'Hero', 'create-not-learn-editor' ), 'banners' ),
		'image-overlay'          => array( __( 'Image with heading over it', 'create-not-learn-editor' ), 'banners' ),
		'hero-image'             => array( __( 'Hero with image below', 'create-not-learn-editor' ), 'banners' ),
		'big-statement'          => array( __( 'Big statement', 'create-not-learn-editor' ), 'banners' ),
		'intro'                  => array( __( 'Intro', 'create-not-learn-editor' ), 'text' ),
		'quote'                  => array( __( 'Quote', 'create-not-learn-editor' ), 'text' ),
		'heading-text'           => array( __( 'Heading and text', 'create-not-learn-editor' ), 'text' ),
		'two-column-text'        => array( __( 'Text in two columns', 'create-not-learn-editor' ), 'text' ),
		'questions-answers'      => array( __( 'Questions and answers', 'create-not-learn-editor' ), 'text' ),
		'image-text'             => array( __( 'Image left, text right', 'create-not-learn-editor' ), 'image-text' ),
		'text-image'             => array( __( 'Text left, image right', 'create-not-learn-editor' ), 'image-text' ),
		'image-above-text'       => array( __( 'Image above text', 'create-not-learn-editor' ), 'image-text' ),
		'alternating-image-text' => array( __( 'Alternating image and text', 'create-not-learn-editor' ), 'image-text' ),
		'profile'                => array( __( 'Profile', 'create-not-learn-editor' ), 'image-text' ),
		'three-columns'          => array( __( 'Three columns with images', 'create-not-learn-editor' ), 'columns' ),
		'three-features'         => array( __( 'Three features', 'create-not-learn-editor' ), 'columns' ),
		'two-columns-images'     => array( __( 'Two columns with images', 'create-not-learn-editor' ), 'columns' ),
		'four-features'          => array( __( 'Four features', 'create-not-learn-editor' ), 'columns' ),
		'team'                   => array( __( 'Team', 'create-not-learn-editor' ), 'columns' ),
		'three-quotes'           => array( __( 'Three quotes', 'create-not-learn-editor' ), 'columns' ),
		'key-numbers'            => array( __( 'Key numbers', 'create-not-learn-editor' ), 'columns' ),
		'three-offers'           => array( __( 'Three offers', 'create-not-learn-editor' ), 'columns' ),
		'image-grid'             => array( __( 'Image grid', 'create-not-learn-editor' ), 'images' ),
		'two-images'             => array( __( 'Two images side by side', 'create-not-learn-editor' ), 'images' ),
		'wide-image'             => array( __( 'Wide image', 'create-not-learn-editor' ), 'images' ),
		'large-two-small'        => array( __( 'One large image and two small', 'create-not-learn-editor' ), 'images' ),
		'logo-strip'             => array( __( 'Logo strip', 'create-not-learn-editor' ), 'images' ),
		'call-to-action'         => array( __( 'Call to action banner', 'create-not-learn-editor' ), 'calls-to-action' ),
		'centred-cta'            => array( __( 'Centred call to action', 'create-not-learn-editor' ), 'calls-to-action' ),
		'cta-image'              => array( __( 'Call to action on an image', 'create-not-learn-editor' ), 'calls-to-action' ),
	);
}

/**
 * Register the Layouts category and a pattern for each layout.
 */
function cnl_editor_register_layout_patterns() {
	register_block_pattern_category(
		CNL_EDITOR_LAYOUT_CATEGORY,
		array(
			'label'       => __( 'Layouts', 'create-not-learn-editor' ),
			'description' => __( 'Simple starting layouts to fill with your own content.', 'create-not-learn-editor' ),
		)
	);

	foreach ( cnl_editor_get_layouts() as $slug => list( $title, $group ) ) {
		$file = CNL_EDITOR_PATH . "patterns/layouts/{$slug}.html";

		if ( ! file_exists( $file ) ) {
			continue;
		}

		register_block_pattern(
			"create-not-learn-editor/layout-{$slug}",
			array(
				'title'         => $title,
				// The group's category is left unregistered, so core's
				// inserter still lists every layout under Layouts alone.
				'categories'    => array( CNL_EDITOR_LAYOUT_CATEGORY, CNL_EDITOR_LAYOUT_CATEGORY . '-' . $group ),
				'keywords'      => array( 'layout', 'wireframe' ),
				'viewportWidth' => 1200,
				'content'       => file_get_contents( $file ), // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
			)
		);
	}
}

/**
 * Add the wireframe and empty-state styles to the resolved editor settings.
 *
 * Previews and the edit canvas both render in iframes styled from these
 * settings, so this one stylesheet reaches the picker's thumbnails and the
 * inserted layouts alike. See `cnl_editor_add_block_hover_label_style()`.
 *
 * @param array $settings Editor settings.
 * @return array Filtered editor settings.
 */
function cnl_editor_add_layout_styles( $settings ) {
	$file = CNL_EDITOR_PATH . 'assets/layouts.css';

	if ( ! file_exists( $file ) ) {
		return $settings;
	}

	if ( ! isset( $settings['styles'] ) || ! is_array( $settings['styles'] ) ) {
		$settings['styles'] = array();
	}

	$settings['styles'][] = array(
		'css' => file_get_contents( $file ), // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
	);

	return $settings;
}
