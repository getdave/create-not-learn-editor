<?php
/**
 * Embedded wp-admin compatibility bridge.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

if ( cnl_editor_is_admin_bridge_request() && ! defined( 'IFRAME_REQUEST' ) ) {
	define( 'IFRAME_REQUEST', true );
}

/**
 * Register admin bridge hooks.
 */
function cnl_editor_register_admin_bridge_hooks() {
	add_filter( 'screen_options_show_screen', 'cnl_editor_admin_bridge_show_screen_options' );
	add_filter( 'admin_body_class', 'cnl_editor_admin_bridge_body_class' );
	add_action( 'admin_enqueue_scripts', 'cnl_editor_admin_bridge_enqueue_styles' );
}

/**
 * Check whether the current wp-admin request is embedded by this editor.
 *
 * @return bool Whether this is an embedded admin bridge request.
 */
function cnl_editor_is_admin_bridge_request() {
	return is_admin() &&
		isset( $_GET['cnl_editor_admin_bridge'] ) &&
		'1' === sanitize_text_field( wp_unslash( $_GET['cnl_editor_admin_bridge'] ) );
}

/**
 * Hide Screen Options in embedded admin screens.
 *
 * @param bool $show_screen Whether to show Screen Options.
 * @return bool Whether to show Screen Options.
 */
function cnl_editor_admin_bridge_show_screen_options( $show_screen ) {
	return cnl_editor_is_admin_bridge_request() ? false : $show_screen;
}

/**
 * Add a body class to embedded admin screens.
 *
 * @param string $classes Space-separated body classes.
 * @return string Body classes.
 */
function cnl_editor_admin_bridge_body_class( $classes ) {
	if ( ! cnl_editor_is_admin_bridge_request() ) {
		return $classes;
	}

	return $classes . ' cnl-editor-admin-bridge';
}

/**
 * Hide duplicate wp-admin chrome in embedded edit screens.
 */
function cnl_editor_admin_bridge_enqueue_styles() {
	if ( ! cnl_editor_is_admin_bridge_request() ) {
		return;
	}

	$css = '
		html.wp-toolbar {
			padding-top: 0;
		}

		body.cnl-editor-admin-bridge #wpadminbar,
		body.cnl-editor-admin-bridge #adminmenumain,
		body.cnl-editor-admin-bridge #adminmenuback,
		body.cnl-editor-admin-bridge #adminmenuwrap,
		body.cnl-editor-admin-bridge #screen-meta,
		body.cnl-editor-admin-bridge #screen-meta-links,
		body.cnl-editor-admin-bridge #wpfooter {
			display: none !important;
		}

		body.cnl-editor-admin-bridge #wpcontent,
		body.cnl-editor-admin-bridge.auto-fold #wpcontent {
			margin-left: 0 !important;
			padding-left: 20px;
		}

		body.cnl-editor-admin-bridge.post-php #wpbody-content > .wrap > h1:first-child,
		body.cnl-editor-admin-bridge.post-new-php #wpbody-content > .wrap > h1:first-child {
			display: none;
		}

		body.cnl-editor-admin-bridge.post-php #wpbody-content > .wrap,
		body.cnl-editor-admin-bridge.post-new-php #wpbody-content > .wrap {
			margin-top: 20px;
		}
	';

	wp_register_style( 'cnl-editor-admin-bridge', false, array(), CNL_EDITOR_VERSION );
	wp_enqueue_style( 'cnl-editor-admin-bridge' );
	wp_add_inline_style( 'cnl-editor-admin-bridge', $css );
}
