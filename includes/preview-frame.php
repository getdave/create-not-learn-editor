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

	return '1' === filter_input(
		INPUT_GET,
		'cnl-editor-preview',
		FILTER_SANITIZE_FULL_SPECIAL_CHARS
	);
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
