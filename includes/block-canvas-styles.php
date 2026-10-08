<?php
/**
 * Styling injected into the block editor canvas iframe.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register hooks that style the block editor canvas.
 */
function cnl_editor_register_block_canvas_style_hooks() {
	add_filter( 'block_editor_settings_all', 'cnl_editor_add_block_hover_label_style' );
}

/**
 * Add the block name label style to the resolved editor settings.
 *
 * The canvas renders in an iframe populated from these settings (fetched via
 * the wp-block-editor/v1/assets REST route), so styles enqueued on the admin
 * page never reach it. Adding to `styles` here is the supported way to style
 * canvas-only elements such as the block wrapper's `data-title` attribute.
 *
 * @param array $settings Editor settings.
 * @return array Filtered editor settings.
 */
function cnl_editor_add_block_hover_label_style( $settings ) {
	if ( ! isset( $settings['styles'] ) || ! is_array( $settings['styles'] ) ) {
		$settings['styles'] = array();
	}

	$settings['styles'][] = array(
		'css' => cnl_editor_get_block_hover_label_css(),
	);

	return $settings;
}

/**
 * Get the CSS that shows a block's name in a small label on hover, for as long
 * as no block is selected.
 *
 * Relies on the `data-title` attribute Gutenberg already renders on every
 * block wrapper (the block type's human-readable title), so no JavaScript is
 * needed to source the name.
 *
 * @return string CSS.
 */
function cnl_editor_get_block_hover_label_css() {
	return '
		.block-editor-block-list__block {
			position: relative;
		}

		/*
		 * Labels are an aid to finding your way around a page nothing has been
		 * picked out of yet. Once a block is selected the toolbar names it and
		 * the outline marks it, so every label goes, not only the one on the
		 * selected block: a name floating over whatever the pointer passes on
		 * the way to the toolbar only competes with the selection.
		 */
		.is-root-container:not(:has(.block-editor-block-list__block:is(.is-selected, .is-multi-selected)))
			.block-editor-block-list__block:hover:not(:has(.block-editor-block-list__block:hover))::before {
			content: attr(data-title);
			position: absolute;
			top: 0;
			left: 0;
			transform: translateY(-100%);
			z-index: 1;
			padding: 2px 6px;
			background: var(--wp-admin-theme-color, #007cba);
			color: #fff;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, sans-serif;
			font-size: 11px;
			font-weight: 500;
			line-height: 1.6;
			letter-spacing: 0.2px;
			text-transform: uppercase;
			white-space: nowrap;
			pointer-events: none;
		}

		/*
		 * Template parts and synced patterns are shared across the site rather
		 * than owned by the page being edited, so their label takes the colour
		 * the editor already uses to mark them, matching the outline core draws
		 * around the same two blocks.
		 */
		.is-root-container:not(:has(.block-editor-block-list__block:is(.is-selected, .is-multi-selected)))
			.block-editor-block-list__block.wp-block-template-part:hover:not(:has(.block-editor-block-list__block:hover))::before,
		.is-root-container:not(:has(.block-editor-block-list__block:is(.is-selected, .is-multi-selected)))
			.block-editor-block-list__block.is-reusable:hover:not(:has(.block-editor-block-list__block:hover))::before {
			background: var(--wp-block-synced-color, #7a00df);
		}

		/*
		 * The topmost block has nothing above it to hold the label, so it would
		 * be drawn outside the canvas and clipped. That one sits just inside
		 * the block instead.
		 */
		.is-root-container:not(:has(.block-editor-block-list__block:is(.is-selected, .is-multi-selected)))
			> .block-editor-block-list__block:first-child:hover:not(:has(.block-editor-block-list__block:hover))::before {
			transform: none;
		}
	';
}
