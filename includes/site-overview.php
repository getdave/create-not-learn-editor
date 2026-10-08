<?php
/**
 * Site Overview: every page of the site, hand-made and dynamic, as a graph the
 * editor draws on a pan and zoom canvas.
 *
 * Hand-made pages come from the page hierarchy. Dynamic pages are the ones
 * WordPress builds from content: a collection that lists a content type (the
 * blog, the shop) and a single page that shows one item of it (a post, a
 * product). Each is drawn once, edited through the layout that renders it.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Get the Site Overview graph.
 *
 * @return array {
 *     @type array[] $groups Content types, in drawing order.
 *     @type array[] $nodes  Pages, with the group each belongs to.
 *     @type array[] $edges  Links from a page to the pages under it.
 * }
 */
function cnl_editor_get_site_overview() {
	$is_static_front = 'page' === get_option( 'show_on_front' );
	$page_on_front   = $is_static_front ? (int) get_option( 'page_on_front' ) : 0;
	$page_for_posts  = $is_static_front ? (int) get_option( 'page_for_posts' ) : 0;

	if ( $page_on_front && ! get_post( $page_on_front ) ) {
		$page_on_front = 0;
	}

	$groups = array(
		array(
			'name'  => 'home',
			'label' => __( 'Homepage', 'create-not-learn-editor' ),
		),
		array(
			'name'  => 'page',
			'label' => __( 'Pages', 'create-not-learn-editor' ),
		),
	);
	$nodes  = array( cnl_editor_get_site_overview_home_node( $page_on_front ) );
	$edges  = array();

	// Pages that render a collection belong with that content type.
	$archive_page_ids = array();

	foreach ( cnl_editor_get_content_post_types() as $post_type ) {
		if ( 'page' === $post_type->name || empty( $post_type->publicly_queryable ) ) {
			continue;
		}

		$group = cnl_editor_get_site_overview_group( $post_type, $page_on_front, $page_for_posts );

		$groups[]         = $group['group'];
		$nodes            = array_merge( $nodes, $group['nodes'] );
		$edges            = array_merge( $edges, $group['edges'] );
		$archive_page_ids = array_merge( $archive_page_ids, $group['archivePageIds'] );
	}

	$pages = cnl_editor_get_site_overview_pages( $page_on_front, $archive_page_ids );

	return array(
		'groups' => $groups,
		'nodes'  => array_merge( $nodes, $pages['nodes'] ),
		'edges'  => array_merge( $pages['edges'], $edges ),
	);
}

/**
 * Get the node for the site's homepage.
 *
 * @param int $page_on_front Page shown on the front, or 0 for latest posts.
 * @return array Node.
 */
function cnl_editor_get_site_overview_home_node( $page_on_front ) {
	$node = array(
		'id'          => 'home',
		'kind'        => 'home',
		'group'       => 'home',
		'title'       => __( 'Homepage', 'create-not-learn-editor' ),
		'description' => __( 'The first page visitors see', 'create-not-learn-editor' ),
		'url'         => home_url( '/' ),
		'previewUrl'  => cnl_editor_get_site_overview_preview_url( home_url( '/' ) ),
		'editLink'    => '',
	);

	if ( $page_on_front ) {
		$post = get_post( $page_on_front );

		return array_merge(
			$node,
			array(
				'postId'      => $page_on_front,
				'title'       => cnl_editor_get_site_overview_post_title( $post ),
				'status'      => $post->post_status,
				'statusLabel' => cnl_editor_get_preview_post_status_label( $post ),
				'editLink'    => cnl_editor_get_post_edit_route( $page_on_front ),
			)
		);
	}

	$template = cnl_editor_get_site_overview_template( array( 'front-page', 'home', 'index' ) );

	return array_merge(
		$node,
		array(
			'description' => __( 'Lists your latest posts', 'create-not-learn-editor' ),
			'editLink'    => $template ? cnl_editor_get_site_overview_template_edit_route( $template ) : '',
			'layout'      => $template ? $template->title : '',
		)
	);
}

/**
 * Get the group, collection and single page for one content type.
 *
 * @param WP_Post_Type $post_type      Post type object.
 * @param int          $page_on_front  Page shown on the front, or 0.
 * @param int          $page_for_posts Page that lists posts, or 0.
 * @return array {
 *     @type array   $group          Group.
 *     @type array[] $nodes          Collection and single nodes.
 *     @type array[] $edges          Links between them, and from the homepage.
 *     @type int[]   $archivePageIds Pages that render this type's collection.
 * }
 */
function cnl_editor_get_site_overview_group( $post_type, $page_on_front, $page_for_posts ) {
	$name   = $post_type->name;
	$labels = $post_type->labels;
	$counts = wp_count_posts( $name );
	$count  = isset( $counts->publish ) ? (int) $counts->publish : 0;

	$group = array(
		'name'     => $name,
		'label'    => $post_type->label,
		'singular' => $labels->singular_name,
		'count'    => $count,
	);

	$nodes            = array();
	$edges            = array();
	$archive_page_ids = array();
	$collection_id    = '';

	/*
	 * Posts are listed on the homepage when it shows the latest posts, and on
	 * the posts page otherwise. Other types are listed on their archive, which
	 * a page can stand in for, the way WooCommerce's Shop page does.
	 */
	if ( 'post' === $name ) {
		if ( ! $page_on_front ) {
			$collection_id = 'home';
		} else {
			$nodes[]       = cnl_editor_get_site_overview_collection_node(
				$post_type,
				$page_for_posts ? get_permalink( $page_for_posts ) : '',
				$page_for_posts,
				array( 'home', 'index' )
			);
			$collection_id = 'collection-' . $name;
		}

		if ( $page_for_posts ) {
			$archive_page_ids[] = $page_for_posts;
		}
	} elseif ( $post_type->has_archive ) {
		$archive_url     = get_post_type_archive_link( $name );
		$archive_page_id = cnl_editor_get_site_overview_archive_page_id( $post_type, $archive_url );

		$nodes[]       = cnl_editor_get_site_overview_collection_node(
			$post_type,
			$archive_url,
			$archive_page_id,
			array( 'archive-' . $name, 'archive', 'index' )
		);
		$collection_id = 'collection-' . $name;

		if ( $archive_page_id ) {
			$archive_page_ids[] = $archive_page_id;
		}
	}

	if ( $collection_id && 'home' !== $collection_id ) {
		$edges[] = array(
			'from' => 'home',
			'to'   => $collection_id,
			'kind' => 'link',
		);
	}

	$single_id = 'single-' . $name;
	$nodes[]   = cnl_editor_get_site_overview_single_node( $post_type, $count );
	$edges[]   = array(
		'from'  => $collection_id ? $collection_id : 'home',
		'to'    => $single_id,
		'kind'  => $collection_id ? 'items' : 'link',
		'count' => $count,
	);

	return array(
		'group'          => $group,
		'nodes'          => $nodes,
		'edges'          => $edges,
		'archivePageIds' => $archive_page_ids,
	);
}

/**
 * Get the page that renders a content type's archive, if one does.
 *
 * @param WP_Post_Type $post_type   Post type object.
 * @param string|false $archive_url Archive URL.
 * @return int Page ID, or 0.
 */
function cnl_editor_get_site_overview_archive_page_id( $post_type, $archive_url ) {
	$page_id = 0;

	if ( 'product' === $post_type->name && function_exists( 'wc_get_page_id' ) ) {
		$page_id = (int) wc_get_page_id( 'shop' );
	} elseif ( $archive_url ) {
		$page_id = (int) url_to_postid( $archive_url );
	}

	if ( $page_id <= 0 || 'page' !== get_post_type( $page_id ) ) {
		$page_id = 0;
	}

	/**
	 * Filters the page that renders a content type's archive on the Site Overview.
	 *
	 * @param int          $page_id   Page ID, or 0 when no page stands in.
	 * @param WP_Post_Type $post_type Post type object.
	 */
	return (int) apply_filters( CNL_EDITOR_SLUG . '_site_overview_archive_page_id', $page_id, $post_type );
}

/**
 * Get the node for the page that lists a content type.
 *
 * @param WP_Post_Type $post_type      Post type object.
 * @param string|false $url            Collection URL, or empty when not shown.
 * @param int          $page_id        Page standing in for the collection, or 0.
 * @param string[]     $template_slugs Template hierarchy that renders it.
 * @return array Node.
 */
function cnl_editor_get_site_overview_collection_node( $post_type, $url, $page_id, $template_slugs ) {
	$template = cnl_editor_get_site_overview_template( $template_slugs );
	$page     = $page_id ? get_post( $page_id ) : null;

	return array(
		'id'          => 'collection-' . $post_type->name,
		'kind'        => 'collection',
		'group'       => $post_type->name,
		'postId'      => $page ? $page->ID : 0,
		'title'       => $page ? cnl_editor_get_site_overview_post_title( $page ) : $post_type->labels->all_items,
		'description' => $url
			? sprintf(
				/* translators: %s: Plural content type label, e.g. "Posts". */
				__( 'Lists all your %s', 'create-not-learn-editor' ),
				strtolower( $post_type->label )
			)
			: __( 'Not on your site yet. Choose a page to list them in Settings.', 'create-not-learn-editor' ),
		'url'         => $url ? $url : '',
		'previewUrl'  => $url ? cnl_editor_get_site_overview_preview_url( $url ) : '',
		'editLink'    => $template ? cnl_editor_get_site_overview_template_edit_route( $template ) : '',
		'layout'      => $template ? $template->title : '',
	);
}

/**
 * Get the node for the page that shows one item of a content type.
 *
 * Previewed with the latest published item, as that is what visitors are
 * most likely to land on.
 *
 * @param WP_Post_Type $post_type Post type object.
 * @param int          $count     Published items.
 * @return array Node.
 */
function cnl_editor_get_site_overview_single_node( $post_type, $count ) {
	$name     = $post_type->name;
	$template = cnl_editor_get_site_overview_template( array( 'single-' . $name, 'single', 'singular', 'index' ) );
	$latest   = get_posts(
		array(
			'fields'           => 'ids',
			'numberposts'      => 1,
			'post_status'      => 'publish',
			'post_type'        => $name,
			'suppress_filters' => false,
		)
	);
	$url      = $latest ? get_permalink( $latest[0] ) : '';

	return array(
		'id'          => 'single-' . $name,
		'kind'        => 'single',
		'group'       => $name,
		'title'       => sprintf(
			/* translators: %s: Singular content type label, e.g. "Post". */
			__( 'Single %s', 'create-not-learn-editor' ),
			strtolower( $post_type->labels->singular_name )
		),
		'description' => sprintf(
			/* translators: %s: Singular content type label, e.g. "post". */
			__( 'How each %s looks', 'create-not-learn-editor' ),
			strtolower( $post_type->labels->singular_name )
		),
		'count'       => $count,
		'url'         => $url ? $url : '',
		'previewUrl'  => $url ? cnl_editor_get_site_overview_preview_url( $url ) : '',
		'previewOf'   => $latest ? cnl_editor_get_site_overview_post_title( get_post( $latest[0] ) ) : '',
		'editLink'    => $template ? cnl_editor_get_site_overview_template_edit_route( $template ) : '',
		'layout'      => $template ? $template->title : '',
	);
}

/**
 * Get the hand-made pages, and the links from each to the pages under it.
 *
 * The homepage and pages that render a collection are drawn elsewhere, so
 * their sub-pages hang from the homepage instead.
 *
 * @param int   $page_on_front    Page shown on the front, or 0.
 * @param int[] $archive_page_ids Pages that render a collection.
 * @return array { @type array[] $nodes, @type array[] $edges }
 */
function cnl_editor_get_site_overview_pages( $page_on_front, $archive_page_ids ) {
	$pages = get_posts(
		array(
			// More than a site overview can usefully show; kept bounded for speed.
			'numberposts'      => 200,
			'order'            => 'ASC',
			'orderby'          => array(
				'menu_order' => 'ASC',
				'title'      => 'ASC',
			),
			'post_status'      => array( 'publish', 'future', 'draft', 'pending', 'private' ),
			'post_type'        => 'page',
			'suppress_filters' => false,
		)
	);

	$excluded = array_merge( array( $page_on_front ), $archive_page_ids );
	$drawn    = array();

	foreach ( $pages as $page ) {
		if ( ! in_array( $page->ID, $excluded, true ) && current_user_can( 'read_post', $page->ID ) ) {
			$drawn[ $page->ID ] = $page;
		}
	}

	$nodes = array();
	$edges = array();

	foreach ( $drawn as $page ) {
		$is_published = 'publish' === $page->post_status;
		$url          = $is_published ? get_permalink( $page ) : get_preview_post_link( $page );
		$parent_id    = (int) $page->post_parent;

		$nodes[] = array(
			'id'          => 'page-' . $page->ID,
			'kind'        => 'page',
			'group'       => 'page',
			'postId'      => $page->ID,
			'title'       => cnl_editor_get_site_overview_post_title( $page ),
			'status'      => $page->post_status,
			'statusLabel' => cnl_editor_get_preview_post_status_label( $page ),
			'url'         => $is_published ? $url : '',
			'previewUrl'  => $url ? cnl_editor_get_site_overview_preview_url( $url ) : '',
			'editLink'    => cnl_editor_get_post_edit_route( $page->ID ),
		);

		$edges[] = array(
			'from' => isset( $drawn[ $parent_id ] ) ? 'page-' . $parent_id : 'home',
			'to'   => 'page-' . $page->ID,
			'kind' => 'child',
		);
	}

	return array(
		'nodes' => $nodes,
		'edges' => $edges,
	);
}

/**
 * Get the first template in a hierarchy that exists, the one WordPress would
 * render with.
 *
 * Looks beyond the theme, so templates plugins add, like WooCommerce's
 * product templates, are found too.
 *
 * @param string[] $slugs Template slugs, most specific first.
 * @return WP_Block_Template|null Template, or null if none is editable.
 */
function cnl_editor_get_site_overview_template( $slugs ) {
	if ( ! function_exists( 'get_block_templates' ) ) {
		return null;
	}

	$template_post_type = get_post_type_object( 'wp_template' );
	if (
		! $template_post_type ||
		empty( $template_post_type->show_in_rest ) ||
		! current_user_can( $template_post_type->cap->edit_posts )
	) {
		return null;
	}

	foreach ( $slugs as $slug ) {
		// Not always a list: WooCommerce's filter keys its templates.
		$templates = array_values( get_block_templates( array( 'slug__in' => array( $slug ) ), 'wp_template' ) );
		if ( ! empty( $templates ) ) {
			return $templates[0];
		}
	}

	return null;
}

/**
 * Get the editor route that edits a template.
 *
 * @param WP_Block_Template $template Template.
 * @return string Route.
 */
function cnl_editor_get_site_overview_template_edit_route( $template ) {
	return '/wp_template?postId=' . rawurlencode( $template->id );
}

/**
 * Get a post's title as plain text.
 *
 * @param WP_Post $post Post.
 * @return string Title, or a placeholder for an untitled post.
 */
function cnl_editor_get_site_overview_post_title( $post ) {
	$title = trim( wp_strip_all_tags( get_the_title( $post ) ) );

	return '' !== $title ? html_entity_decode( $title, ENT_QUOTES, get_bloginfo( 'charset' ) ) : __( '(no title)', 'create-not-learn-editor' );
}

/**
 * Get the URL that shows a page in a preview frame, without the admin bar.
 *
 * @param string $url Page URL.
 * @return string Preview URL.
 */
function cnl_editor_get_site_overview_preview_url( $url ) {
	return add_query_arg( 'cnl-editor-preview', '1', $url );
}
