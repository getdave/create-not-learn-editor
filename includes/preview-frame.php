<?php
/**
 * The front end, as the canvas previews show it.
 *
 * The Preview side of a canvas is the real site in an iframe, loaded with the
 * `cnl-editor-preview` query arg. On those requests this keeps the site's own
 * links and forms inside the preview, opens other sites in a new tab, and
 * hides the admin chrome. Ported from Big Sky's Easy Mode preview
 * (`Big_Sky_Easy_Mode_Preview`).
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register preview frame hooks.
 */
function cnl_editor_register_preview_frame_hooks() {
	add_action( 'wp_head', 'cnl_editor_output_preview_frame_styles', 999 );
	add_action( 'wp_footer', 'cnl_editor_output_preview_navigation_script', 999 );
	add_filter( 'page_template_hierarchy', 'cnl_editor_preview_page_template' );

	foreach ( cnl_editor_get_template_hierarchy_types() as $type ) {
		add_filter( "{$type}_template_hierarchy", 'cnl_editor_preview_layout', 20 );
	}

	add_filter( 'pre_option_show_on_front', 'cnl_editor_preview_show_on_front' );
	add_filter( 'pre_option_page_on_front', 'cnl_editor_preview_page_on_front' );
	add_filter( 'render_block', 'cnl_editor_name_preview_block', 10, 2 );
}

/**
 * Whether this is a front-end request for a canvas preview.
 *
 * @return bool Whether the request is for a preview.
 */
function cnl_editor_is_preview_frame_request() {
	if ( is_admin() ) {
		return false;
	}

	// Asked for every block the front end renders, and the answer can't
	// change during a request.
	static $is_preview = null;

	if ( null === $is_preview ) {
		$is_preview = '1' === filter_input(
			INPUT_GET,
			'cnl-editor-preview',
			FILTER_SANITIZE_FULL_SPECIAL_CHARS
		);
	}

	return $is_preview;
}

/**
 * Show a page in a layout it hasn't been saved with yet.
 *
 * Choosing a layout in the Pages sidebar is an unsaved change, so what is
 * saved can't show it. The canvas passes the chosen layout's slug along as
 * `cnl-editor-template` instead, `default` for the theme's own choice, and the
 * preview puts it first in line, for those who could save it.
 *
 * @param string[] $templates Template candidates, most specific first.
 * @return string[] The candidates, with the chosen layout leading.
 */
function cnl_editor_preview_page_template( $templates ) {
	if ( ! cnl_editor_is_preview_frame_request() ) {
		return $templates;
	}

	$slug = filter_input( INPUT_GET, 'cnl-editor-template', FILTER_SANITIZE_FULL_SPECIAL_CHARS );

	if ( ! is_string( $slug ) || '' === $slug ) {
		return $templates;
	}

	$post_id = get_queried_object_id();

	if ( ! $post_id || ! current_user_can( 'edit_post', $post_id ) ) {
		return $templates;
	}

	// The saved layout no longer gets a say.
	$saved = get_page_template_slug( $post_id );

	if ( $saved ) {
		$templates = array_values( array_diff( $templates, array( $saved ) ) );
	}

	$slug = sanitize_title( $slug );

	if ( 'default' !== $slug ) {
		array_unshift( $templates, $slug );
	}

	return $templates;
}

/**
 * The template types WordPress looks up a request's template through.
 *
 * Each runs its candidates through a `{$type}_template_hierarchy` filter, and
 * the first type the request matches decides the template.
 *
 * @return string[] Template types, as they appear in the filter names.
 */
function cnl_editor_get_template_hierarchy_types() {
	return array(
		'404',
		'search',
		'frontpage',
		'home',
		'privacy',
		'taxonomy',
		'attachment',
		'single',
		'page',
		'singular',
		'category',
		'tag',
		'author',
		'date',
		'archive',
		'index',
	);
}

/**
 * Show a page of the site in a layout, whatever layout WordPress would pick.
 *
 * The Layouts tabs preview the layout picked there on a page that would use
 * it, like the latest post for Single Post. Another layout could win that
 * page, a more specific one, so the canvas passes the picked layout's slug
 * along as `cnl-editor-layout`, and the preview puts it first in line, for
 * those who could change layouts.
 *
 * @param string[] $templates Template candidates, most specific first.
 * @return string[] The candidates, with the layout leading.
 */
function cnl_editor_preview_layout( $templates ) {
	if ( ! cnl_editor_is_preview_frame_request() ) {
		return $templates;
	}

	$slug = filter_input( INPUT_GET, 'cnl-editor-layout', FILTER_SANITIZE_FULL_SPECIAL_CHARS );

	if ( ! is_string( $slug ) || '' === $slug || ! current_user_can( 'edit_theme_options' ) ) {
		return $templates;
	}

	array_unshift( $templates, sanitize_title( $slug ) );

	return $templates;
}

/**
 * Show the homepage as it will be once its choice is saved.
 *
 * Choosing between the homepage's page and the latest posts in the Pages
 * sidebar is an unsaved change too. The canvas passes the choice along as
 * `cnl-editor-show-on-front`, `page` or `posts`, and the preview shows it,
 * for those who could save it.
 *
 * @param mixed $value The option's value, or false to read it as saved.
 * @return mixed The choice passed along, or `$value`.
 */
function cnl_editor_preview_show_on_front( $value ) {
	// Who is asking is only known once WordPress has set up.
	if ( ! did_action( 'init' ) || ! cnl_editor_is_preview_frame_request() ) {
		return $value;
	}

	$choice = filter_input( INPUT_GET, 'cnl-editor-show-on-front', FILTER_SANITIZE_FULL_SPECIAL_CHARS );

	if ( ! in_array( $choice, array( 'page', 'posts' ), true ) || ! current_user_can( 'manage_options' ) ) {
		return $value;
	}

	return $choice;
}

/**
 * Show the homepage with the page it will show once that is saved.
 *
 * Picking a page for the homepage is an unsaved change like the choice above.
 * The canvas passes the page's ID along as `cnl-editor-page-on-front`, and the
 * preview shows it, for those who could save it.
 *
 * @param mixed $value The option's value, or false to read it as saved.
 * @return mixed The page ID passed along, or `$value`.
 */
function cnl_editor_preview_page_on_front( $value ) {
	if ( ! did_action( 'init' ) || ! cnl_editor_is_preview_frame_request() ) {
		return $value;
	}

	$page_id = filter_input( INPUT_GET, 'cnl-editor-page-on-front', FILTER_VALIDATE_INT );

	if ( ! is_int( $page_id ) || $page_id < 0 || ! current_user_can( 'manage_options' ) ) {
		return $value;
	}

	return $page_id;
}

/**
 * Name each block on a preview's page, on its outermost element.
 *
 * Browse matches what is pointed at or clicked in the preview to the same
 * block in the editor underneath, so the section can be picked in Edit. The
 * front end doesn't say which block made what, so previews mark each block's
 * outermost element with its name, as `data-cnl-block`. A block whose markup
 * starts with one of its own blocks, like a synced pattern, has no element of
 * its own, so the inner block keeps its name.
 *
 * @param string $block_content The block's markup.
 * @param array  $block         The block, parsed.
 * @return string The markup, with the block's name on its first element.
 */
function cnl_editor_name_preview_block( $block_content, $block ) {
	if ( '' === $block_content || empty( $block['blockName'] ) || ! cnl_editor_is_preview_frame_request() ) {
		return $block_content;
	}

	$processor = new WP_HTML_Tag_Processor( $block_content );

	if ( ! $processor->next_tag() || null !== $processor->get_attribute( 'data-cnl-block' ) ) {
		return $block_content;
	}

	$processor->set_attribute( 'data-cnl-block', $block['blockName'] );

	return $processor->get_updated_html();
}

/**
 * Hide the admin chrome inside the preview.
 *
 * The admin bar is already filtered off for previews, but some environments
 * still render its markup, so it is hidden here too.
 *
 * Unlike Easy Mode, the preview does not opt into cross-document view
 * transitions (`@view-transition { navigation: auto; }`). On the Pages canvas,
 * following a link also opens the page in the sidebar and loads it into the
 * editor, and that work landing while the iframe's transition runs crashes
 * Chrome's renderer outright (seen in Chrome and Chromium, headed only).
 */
function cnl_editor_output_preview_frame_styles() {
	if ( ! cnl_editor_is_preview_frame_request() ) {
		return;
	}
	?>
	<style id="cnl-editor-preview-frame-styles">
		html {
			margin-top: 0 !important;
		}

		html #wpadminbar {
			display: none !important;
		}
	</style>
	<?php
}

/**
 * Keep the preview on the site.
 *
 * Links and forms to the site carry the preview query arg, so every page the
 * preview goes to is shown as a preview too. Links to other sites open in a
 * new tab, because other sites often refuse to be framed, and the preview
 * would be left on a page the canvas cannot read.
 */
function cnl_editor_output_preview_navigation_script() {
	if ( ! cnl_editor_is_preview_frame_request() ) {
		return;
	}
	?>
	<script id="cnl-editor-preview-navigation">
		( function () {
			var previewParam = 'cnl-editor-preview';
			var externalLinkOriginalAttributes = new WeakMap();

			function getUrl( value ) {
				if ( ! value || value.charAt( 0 ) === '#' ) {
					return null;
				}

				try {
					return new URL( value, window.location.href );
				} catch ( error ) {
					return null;
				}
			}

			function isHttpUrl( url ) {
				return /^https?:$/.test( url.protocol );
			}

			function getPreviewUrl( value ) {
				var nextUrl = getUrl( value );

				if (
					! nextUrl ||
					! isHttpUrl( nextUrl ) ||
					nextUrl.origin !== window.location.origin
				) {
					return null;
				}

				nextUrl.searchParams.set( previewParam, '1' );

				return nextUrl.toString();
			}

			function setExternalLinkRel( link ) {
				var relTokens = new Set(
					( link.getAttribute( 'rel' ) || '' )
						.split( /\s+/ )
						.filter( Boolean )
				);

				relTokens.delete( 'opener' );
				relTokens.add( 'noopener' );
				relTokens.add( 'noreferrer' );
				link.setAttribute( 'rel', Array.from( relTokens ).join( ' ' ) );
			}

			function rewriteExternalLink( link ) {
				var nextUrl = getUrl( link.getAttribute( 'href' ) );

				if (
					! nextUrl ||
					! isHttpUrl( nextUrl ) ||
					nextUrl.origin === window.location.origin
				) {
					return false;
				}

				if ( ! externalLinkOriginalAttributes.has( link ) ) {
					externalLinkOriginalAttributes.set( link, {
						target: link.getAttribute( 'target' ),
						rel: link.getAttribute( 'rel' ),
					} );
				}

				link.setAttribute( 'target', '_blank' );
				setExternalLinkRel( link );

				return true;
			}

			function restoreLinkAttributes( link ) {
				var original = externalLinkOriginalAttributes.get( link );

				if ( ! original ) {
					return;
				}

				if ( original.target === null ) {
					link.removeAttribute( 'target' );
				} else {
					link.setAttribute( 'target', original.target );
				}

				if ( original.rel === null ) {
					link.removeAttribute( 'rel' );
				} else {
					link.setAttribute( 'rel', original.rel );
				}

				externalLinkOriginalAttributes.delete( link );
			}

			function rewriteLink( link ) {
				if ( rewriteExternalLink( link ) ) {
					return;
				}

				restoreLinkAttributes( link );

				var previewUrl = getPreviewUrl( link.getAttribute( 'href' ) );

				if ( previewUrl ) {
					link.setAttribute( 'href', previewUrl );
				}
			}

			function rewriteForm( form ) {
				var previewUrl = getPreviewUrl(
					form.getAttribute( 'action' ) || window.location.href
				);

				if ( previewUrl ) {
					form.setAttribute( 'action', previewUrl );
				}
			}

			function processNode( root ) {
				if ( ! ( root instanceof Element || root instanceof Document ) ) {
					return;
				}

				if ( root instanceof Element ) {
					if ( root.matches( 'a[href]' ) ) {
						rewriteLink( root );
					}

					if ( root.matches( 'form' ) ) {
						rewriteForm( root );
					}
				}

				root.querySelectorAll( 'a[href]' ).forEach( rewriteLink );
				root.querySelectorAll( 'form' ).forEach( rewriteForm );
			}

			processNode( document );

			document.addEventListener( 'click', function ( event ) {
				var link = event.target.closest && event.target.closest( 'a[href]' );

				if ( link ) {
					rewriteLink( link );
				}
			}, true );

			document.addEventListener( 'submit', function ( event ) {
				if ( event.target instanceof HTMLFormElement ) {
					rewriteForm( event.target );
				}
			}, true );

			new MutationObserver( function ( mutations ) {
				mutations.forEach( function ( mutation ) {
					mutation.addedNodes.forEach( processNode );
				} );
			} ).observe( document.documentElement, {
				childList: true,
				subtree: true,
			} );
		} )();
	</script>
	<?php
}
