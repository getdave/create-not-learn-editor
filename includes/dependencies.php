<?php
/**
 * Runtime dependency checks.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Check whether the active Gutenberg plugin exposes the runtime this plugin needs.
 *
 * @return bool Whether Gutenberg is active and recent enough.
 */
function cnl_editor_is_gutenberg_ready() {
	return defined( 'GUTENBERG_VERSION' ) &&
		version_compare( GUTENBERG_VERSION, CNL_EDITOR_MIN_GUTENBERG_VERSION, '>=' );
}

/**
 * Render an admin notice when Gutenberg is missing or too old.
 */
function cnl_editor_render_dependency_notice() {
	if ( cnl_editor_is_gutenberg_ready() || ! current_user_can( 'activate_plugins' ) ) {
		return;
	}

	$message = defined( 'GUTENBERG_VERSION' )
		? sprintf(
			/* translators: 1: required Gutenberg version, 2: current Gutenberg version. */
			__( 'Create Not Learn Editor requires Gutenberg %1$s or newer. The active Gutenberg version is %2$s.', 'create-not-learn-editor' ),
			CNL_EDITOR_MIN_GUTENBERG_VERSION,
			GUTENBERG_VERSION
		)
		: sprintf(
			/* translators: %s: required Gutenberg version. */
			__( 'Create Not Learn Editor requires the Gutenberg plugin %s or newer to be installed and activated.', 'create-not-learn-editor' ),
			CNL_EDITOR_MIN_GUTENBERG_VERSION
		);

	printf(
		'<div class="notice notice-error"><p>%s</p></div>',
		esc_html( $message )
	);
}
