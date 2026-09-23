<?php
/**
 * Preview context helpers.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Normalize a URL path for local comparisons.
 *
 * @param string $url URL.
 * @return string Normalized path.
 */
function cnl_editor_normalize_url_path( $url ) {
	$parts = wp_parse_url( $url );
	$path  = isset( $parts['path'] ) ? $parts['path'] : '/';
	$path  = '/' . ltrim( $path, '/' );
	$path  = untrailingslashit( $path );

	return '' === $path ? '/' : $path;
}

/**
 * Get a normalized URL port.
 *
 * @param array $parts Parsed URL parts.
 * @return int|null URL port.
 */
function cnl_editor_get_url_port( $parts ) {
	if ( isset( $parts['port'] ) ) {
		return (int) $parts['port'];
	}

	if ( isset( $parts['scheme'] ) && 'https' === $parts['scheme'] ) {
		return 443;
	}

	if ( isset( $parts['scheme'] ) && 'http' === $parts['scheme'] ) {
		return 80;
	}

	return null;
}

/**
 * Determine whether a URL points at the current site.
 *
 * @param string $url URL.
 * @return bool Whether the URL is local.
 */
function cnl_editor_is_local_url( $url ) {
	$url_parts = wp_parse_url( $url );

	if ( empty( $url_parts['host'] ) ) {
		return true;
	}

	$home_parts = wp_parse_url( home_url( '/' ) );
	if ( empty( $home_parts['host'] ) ) {
		return false;
	}

	return strtolower( $url_parts['host'] ) === strtolower( $home_parts['host'] )
		&& cnl_editor_get_url_port( $url_parts ) === cnl_editor_get_url_port( $home_parts );
}

/**
 * Convert a local preview URL to an absolute URL.
 *
 * @param string $url URL.
 * @return string Absolute local URL or empty string.
 */
function cnl_editor_get_local_preview_url( $url ) {
	if ( '' === $url || ! cnl_editor_is_local_url( $url ) ) {
		return '';
	}

	if ( 0 === strpos( $url, '/' ) && 0 !== strpos( $url, '//' ) ) {
		return home_url( $url );
	}

	return $url;
}

/**
 * Get a Create Not Learn edit route for a post.
 *
 * @param int $post_id Post ID.
 * @return string Edit route or empty string.
 */
function cnl_editor_get_post_edit_route( $post_id ) {
	$post = get_post( $post_id );
	if ( ! $post ) {
		return '';
	}

	$post_type_object = get_post_type_object( $post->post_type );
	if (
		! $post_type_object ||
		empty( $post_type_object->show_in_rest ) ||
		! current_user_can( 'edit_post', $post_id )
	) {
		return '';
	}

	return '/types/' . $post->post_type . '/edit/' . $post_id;
}

/**
 * Get a post status label for preview context.
 *
 * @param WP_Post $post Post object.
 * @return string Post status label.
 */
function cnl_editor_get_preview_post_status_label( $post ) {
	$status = get_post_status_object( $post->post_status );
	if ( $status && ! empty( $status->label ) ) {
		return $status->label;
	}

	return __( 'Preview', 'create-not-learn-editor' );
}

/**
 * Get a stable status label for synthetic preview states.
 *
 * @param string $status Preview status slug.
 * @return string Preview status label.
 */
function cnl_editor_get_preview_status_label( $status ) {
	switch ( $status ) {
		case 'homepage':
		case 'publish':
			return __( 'Published', 'create-not-learn-editor' );
		case 'future':
			return __( 'Scheduled', 'create-not-learn-editor' );
		case 'draft':
		case 'auto-draft':
			return __( 'Draft', 'create-not-learn-editor' );
		case 'pending':
			return __( 'Pending review', 'create-not-learn-editor' );
		case 'private':
			return __( 'Private', 'create-not-learn-editor' );
		case 'trash':
			return __( 'Trash', 'create-not-learn-editor' );
		case 'archive':
			return __( 'Archive', 'create-not-learn-editor' );
		default:
			return __( 'Preview', 'create-not-learn-editor' );
	}
}

/**
 * Determine whether a title is effectively just "Home".
 *
 * @param string $title Page title.
 * @return bool Whether the title is a home-equivalent title.
 */
function cnl_editor_is_home_equivalent_title( $title ) {
	$normalized_title = strtolower(
		html_entity_decode(
			wp_strip_all_tags( (string) $title ),
			ENT_QUOTES,
			get_bloginfo( 'charset' )
		)
	);
	$normalized_title = preg_replace( '/[^a-z0-9]+/', '', $normalized_title );

	return in_array(
		$normalized_title,
		array( 'home', 'homepage', 'frontpage' ),
		true
	);
}

/**
 * Get preview context for a post.
 *
 * @param int    $post_id Post ID.
 * @param string $preview_type Optional preview type.
 * @param string $status_label Optional status label override.
 * @param string $status Optional status slug override.
 * @return array Preview context.
 */
function cnl_editor_get_post_preview_context( $post_id, $preview_type = '', $status_label = '', $status = '' ) {
	$post = get_post( $post_id );
	if ( ! $post ) {
		return array();
	}

	$post_type = get_post_type_object( $post->post_type );
	$title     = get_the_title( $post );
	if ( '' === $title ) {
		$title = $post_type ? $post_type->labels->singular_name : __( 'Untitled', 'create-not-learn-editor' );
	}

	$edit_route = cnl_editor_get_post_edit_route( $post_id );

	return array(
		'editLink'           => $edit_route,
		'previewLabel'       => $title,
		'previewStatus'      => $status ? $status : $post->post_status,
		'previewStatusLabel' => $status_label ? $status_label : cnl_editor_get_preview_post_status_label( $post ),
		'previewType'        => $preview_type ? $preview_type : $post->post_type,
		'previewTypeLabel'   => $post_type ? $post_type->labels->singular_name : __( 'Page', 'create-not-learn-editor' ),
		'previewEditLabel'   => 'page' === $post->post_type ? __( 'Edit page', 'create-not-learn-editor' ) : __( 'Edit', 'create-not-learn-editor' ),
		'previewCanEdit'     => '' !== $edit_route,
	);
}

/**
 * Get preview context for a static page used as the site's front page.
 *
 * @param int $post_id Front page post ID.
 * @return array Preview context.
 */
function cnl_editor_get_static_front_page_preview_context( $post_id ) {
	$context = cnl_editor_get_post_preview_context(
		$post_id,
		'home',
		cnl_editor_get_preview_status_label( 'homepage' ),
		'homepage'
	);

	if ( empty( $context ) ) {
		return array();
	}

	$page_title = get_the_title( $post_id );
	if ( '' === $page_title ) {
		$page_title = __( 'Untitled', 'create-not-learn-editor' );
	}

	$context['previewLabel'] = cnl_editor_is_home_equivalent_title( $page_title )
		? __( 'Home', 'create-not-learn-editor' )
		: sprintf(
			/* translators: %s: The title of the static page used as the homepage. */
			__( 'Home (%s)', 'create-not-learn-editor' ),
			$page_title
		);
	$context['previewDocumentStatus']      = 'home-static';
	$context['previewDocumentStatusLabel'] = __( 'Home (Static)', 'create-not-learn-editor' );

	return $context;
}

/**
 * Get the editable template ID that renders the "Home (Latest Posts)" front page.
 *
 * Mirrors the front-page &gt; home &gt; index template hierarchy WordPress uses to
 * resolve the blog index on the front end.
 *
 * @return string Template ID (theme//slug) or empty string if none is editable.
 */
function cnl_editor_get_front_page_template_id() {
	if ( ! function_exists( 'get_block_template' ) ) {
		return '';
	}

	$template_post_type = get_post_type_object( 'wp_template' );
	if (
		! $template_post_type ||
		empty( $template_post_type->show_in_rest ) ||
		! current_user_can( $template_post_type->cap->edit_posts )
	) {
		return '';
	}

	$theme = get_stylesheet();
	foreach ( array( 'front-page', 'home', 'index' ) as $slug ) {
		$template = get_block_template( $theme . '//' . $slug, 'wp_template' );
		if ( $template ) {
			return $template->id;
		}
	}

	return '';
}

/**
 * Get preview context for the site's front page.
 *
 * @return array Preview context.
 */
function cnl_editor_get_front_page_preview_context() {
	if ( 'page' === get_option( 'show_on_front' ) ) {
		$page_on_front = (int) get_option( 'page_on_front' );
		if ( $page_on_front ) {
			return cnl_editor_get_static_front_page_preview_context( $page_on_front );
		}
	}

	$template_id = cnl_editor_get_front_page_template_id();

	return array(
		'editLink'           => $template_id ? '/wp_template?postId=' . rawurlencode( $template_id ) : '',
		'previewLabel'       => __( 'Home', 'create-not-learn-editor' ),
		'previewStatus'      => 'homepage',
		'previewStatusLabel' => cnl_editor_get_preview_status_label( 'homepage' ),
		'previewType'        => 'template',
		'previewTypeLabel'   => __( 'Template', 'create-not-learn-editor' ),
		'previewEditLabel'   => __( 'Edit template', 'create-not-learn-editor' ),
		'previewCanEdit'     => '' !== $template_id,
		'previewTone'        => 'global',
		'previewDocumentStatus'      => 'home-latest-posts',
		'previewDocumentStatusLabel' => __( 'Home (Latest Posts)', 'create-not-learn-editor' ),
	);
}

/**
 * Get preview context for a local preview URL.
 *
 * @param string $url Preview URL.
 * @return array Preview context.
 */
function cnl_editor_get_preview_context( $url ) {
	$url = remove_query_arg( 'cnl-editor-preview', $url );
	$url = cnl_editor_get_local_preview_url( $url );
	if ( '' === $url ) {
		return array();
	}

	if (
		cnl_editor_normalize_url_path( $url ) ===
		cnl_editor_normalize_url_path( home_url( '/' ) )
	) {
		return cnl_editor_get_front_page_preview_context();
	}

	$post_id = url_to_postid( $url );
	if ( $post_id ) {
		$page_on_front = (int) get_option( 'page_on_front' );
		$page_for_posts = (int) get_option( 'page_for_posts' );
		if (
			'page' === get_option( 'show_on_front' ) &&
			$page_on_front &&
			$post_id === $page_on_front
		) {
			return cnl_editor_get_static_front_page_preview_context( $post_id );
		}

		if ( $page_for_posts && $post_id === $page_for_posts ) {
			$context = cnl_editor_get_post_preview_context( $post_id, 'posts-page' );
			if ( empty( $context ) ) {
				return array();
			}

			$context['previewDocumentStatus']      = 'posts-page';
			$context['previewDocumentStatusLabel'] = __( 'Posts Page', 'create-not-learn-editor' );

			return $context;
		}

		return cnl_editor_get_post_preview_context( $post_id );
	}

	return array(
		'editLink'           => '',
		'previewLabel'       => __( 'Site preview', 'create-not-learn-editor' ),
		'previewStatus'      => 'preview',
		'previewStatusLabel' => __( 'Preview', 'create-not-learn-editor' ),
		'previewType'        => 'preview',
		'previewTypeLabel'   => __( 'Page', 'create-not-learn-editor' ),
		'previewEditLabel'   => __( 'Edit', 'create-not-learn-editor' ),
		'previewCanEdit'     => false,
	);
}
