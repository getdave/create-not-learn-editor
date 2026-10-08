<?php
/**
 * A Page template with nothing but the header, the page's own content, and
 * the footer, available regardless of what the active theme ships.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register block template hooks.
 */
function cnl_editor_register_block_template_hooks() {
	add_action( 'init', 'cnl_editor_register_block_templates' );
	add_action( 'wp_insert_post', 'cnl_editor_set_default_page_template', 10, 3 );
}

/**
 * Register the "Blank page" template: header, content, footer, nothing else.
 *
 * Most themes bake a page title and featured image into their own Page
 * template. Registering our own gives every site a Page template that
 * doesn't, independent of the active theme.
 */
function cnl_editor_register_block_templates() {
	if ( ! function_exists( 'register_block_template' ) ) {
		return;
	}

	register_block_template(
		CNL_EDITOR_SLUG . '//blank-page',
		array(
			'title'       => __( 'Blank', 'create-not-learn-editor' ),
			'description' => __( 'Just the header, the page content, and the footer.', 'create-not-learn-editor' ),
			'content'     => cnl_editor_get_blank_page_template_content(),
			'post_types'  => array( 'page' ),
			'plugin'      => CNL_EDITOR_SLUG,
		)
	);
}

/**
 * Get the block markup for the "Blank page" template.
 *
 * @return string Block markup.
 */
function cnl_editor_get_blank_page_template_content() {
	return <<<'HTML'
<!-- wp:template-part {"slug":"header","tagName":"header"} /-->

<!-- wp:group {"tagName":"main","layout":{"type":"constrained"}} -->
<main class="wp-block-group">
<!-- wp:post-content /-->
</main>
<!-- /wp:group -->

<!-- wp:template-part {"slug":"footer","tagName":"footer"} /-->
HTML;
}

/**
 * Default new Pages to the "Blank page" template.
 *
 * Only applies on creation, and only when nothing has assigned a template
 * yet, so existing Pages and any explicit choice are left alone.
 *
 * @param int     $post_id Post ID.
 * @param WP_Post $post    Post object.
 * @param bool    $update  Whether this is an existing post being updated.
 */
function cnl_editor_set_default_page_template( $post_id, $post, $update ) {
	if ( $update || 'page' !== $post->post_type ) {
		return;
	}

	if ( get_post_meta( $post_id, '_wp_page_template', true ) ) {
		return;
	}

	update_post_meta( $post_id, '_wp_page_template', 'blank-page' );
}
