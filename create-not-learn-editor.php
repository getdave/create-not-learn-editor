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

require_once CNL_EDITOR_PATH . 'includes/dependencies.php';

add_action( 'admin_notices', 'cnl_editor_render_dependency_notice' );
add_action( 'plugins_loaded', 'cnl_editor_bootstrap', 20 );

/**
 * Bootstrap the plugin after all active plugins have loaded.
 */
function cnl_editor_bootstrap() {
	if ( ! cnl_editor_is_gutenberg_ready() ) {
		return;
	}

	require_once CNL_EDITOR_PATH . 'includes/content-types.php';
	require_once CNL_EDITOR_PATH . 'includes/setup-defaults.php';
	require_once CNL_EDITOR_PATH . 'includes/preview-context.php';
	require_once CNL_EDITOR_PATH . 'includes/rest-api.php';
	require_once CNL_EDITOR_PATH . 'includes/admin-page.php';

	cnl_editor_register_content_type_hooks();
	cnl_editor_register_rest_hooks();
	cnl_editor_register_admin_page_hooks();
}
