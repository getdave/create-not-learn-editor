<?php
/**
 * Plugin Name: Create Not Learn Editor
 * Description: A standalone experimental site editor built on released WordPress and Gutenberg editor packages.
 * Version: 0.1.0
 * Requires at least: 7.0
 * Requires PHP: 7.4
 * Requires Plugins: gutenberg
 * Author: Create Not Learn
 * Text Domain: create-not-learn-editor
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

define( 'CNL_EDITOR_VERSION', '0.1.0' );
define( 'CNL_EDITOR_MIN_GUTENBERG_VERSION', '24.0.0' );
define( 'CNL_EDITOR_FILE', __FILE__ );
define( 'CNL_EDITOR_PATH', plugin_dir_path( __FILE__ ) );
define( 'CNL_EDITOR_URL', plugin_dir_url( __FILE__ ) );
define( 'CNL_EDITOR_SLUG', 'create-not-learn-editor' );
define( 'CNL_EDITOR_REST_NAMESPACE', 'create-not-learn-editor/v1' );

/*
 * Visual theme layered on top of the WordPress Design System.
 *
 * 'modern' softens corners and surfaces and sets headings in EB Garamond;
 * 'default' is stock WPDS. Override it in wp-config.php, or with the
 * `create-not-learn-editor_ui_theme` filter.
 */
if ( ! defined( 'CNL_EDITOR_UI_THEME' ) ) {
	define( 'CNL_EDITOR_UI_THEME', 'modern' );
}

require_once CNL_EDITOR_PATH . 'includes/dependencies.php';

register_activation_hook( CNL_EDITOR_FILE, 'cnl_editor_activate' );
add_action( 'admin_notices', 'cnl_editor_render_dependency_notice' );
add_action( 'plugins_loaded', 'cnl_editor_bootstrap', 20 );

/**
 * Create and assign the default Home page on activation, the same way core
 * seeds Sample Page and Privacy Policy Page when a site is first installed.
 */
function cnl_editor_activate() {
	if ( ! cnl_editor_is_gutenberg_ready() ) {
		return;
	}

	require_once CNL_EDITOR_PATH . 'includes/setup-defaults.php';

	cnl_editor_setup_site_defaults();
}

/**
 * Bootstrap the plugin after all active plugins have loaded.
 */
function cnl_editor_bootstrap() {
	if ( ! cnl_editor_is_gutenberg_ready() ) {
		return;
	}

	require_once CNL_EDITOR_PATH . 'includes/content-types.php';
	require_once CNL_EDITOR_PATH . 'includes/block-templates.php';
	require_once CNL_EDITOR_PATH . 'includes/setup-defaults.php';
	require_once CNL_EDITOR_PATH . 'includes/preview-context.php';
	require_once CNL_EDITOR_PATH . 'includes/preview-frame.php';
	require_once CNL_EDITOR_PATH . 'includes/site-overview.php';
	require_once CNL_EDITOR_PATH . 'includes/rest-api.php';
	require_once CNL_EDITOR_PATH . 'includes/admin-page.php';
	require_once CNL_EDITOR_PATH . 'includes/block-canvas-styles.php';
	require_once CNL_EDITOR_PATH . 'includes/layouts.php';
	require_once CNL_EDITOR_PATH . 'includes/plugin-compat.php';

	cnl_editor_register_content_type_hooks();
	cnl_editor_register_preview_frame_hooks();
	cnl_editor_register_block_template_hooks();
	cnl_editor_register_rest_hooks();
	cnl_editor_register_admin_page_hooks();
	cnl_editor_register_block_canvas_style_hooks();
	cnl_editor_register_layout_hooks();
	cnl_editor_register_plugin_compat_hooks();
}
