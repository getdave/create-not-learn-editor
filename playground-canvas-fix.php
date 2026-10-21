<?php
/**
 * Plugin Name: Create Not Learn Playground canvas fix
 * Description: Demo only. Keeps the edit canvas from staying blank in WordPress Playground.
 *
 * The blueprint installs this as a must-use plugin. It is not part of the
 * plugin and does nothing outside Playground.
 *
 * Playground loads the block editor's canvas through `/wp-includes/empty.html`,
 * which `document.write()`s the canvas markup in. That markup ends with a body
 * that removes itself as it is parsed. Written that way, after the canvas's
 * stylesheets, Chrome never starts rendering the document, so the canvas stays
 * grey. Core's editor screens escape it because they are cross-origin
 * isolated, which this editor can't be without losing access to its previews.
 *
 * This wraps Playground's `__playground_ControlledIframe` so the body is
 * removed on the canvas's `load` event instead, which still happens before the
 * editor puts its own body in.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'admin_head-create-not-learn-editor',
	static function () {
		?>
		<script>
		( function () {
			var removeNow = '<script>document.currentScript.parentElement.remove()<\/script>';
			var removeOnLoad = '<script>window.addEventListener("load",function(){document.body&&document.body.remove()})<\/script>';
			var fixed = {};
			var wrapped;

			function fixSource( src ) {
				if ( ! src || src.indexOf( 'blob:' ) !== 0 ) {
					return src;
				}
				if ( ! fixed[ src ] ) {
					fixed[ src ] = src;
					try {
						var xhr = new XMLHttpRequest();
						xhr.open( 'GET', src, false );
						xhr.overrideMimeType( 'text/plain;charset=utf-8' );
						xhr.send();
						if ( xhr.responseText.indexOf( removeNow ) !== -1 ) {
							fixed[ src ] = URL.createObjectURL(
								new Blob( [ xhr.responseText.replace( removeNow, removeOnLoad ) ], { type: 'text/html' } )
							);
						}
					} catch ( e ) {}
				}
				return fixed[ src ];
			}

			function wrap( Original ) {
				var element = window.wp.element;
				return element.forwardRef( function ( props, ref ) {
					var src = element.useMemo( function () {
						return fixSource( props.src );
					}, [ props.src ] );
					return element.createElement( Original, Object.assign( {}, props, { ref: ref, src: src } ) );
				} );
			}

			var existing = window.__playground_ControlledIframe;
			if ( existing ) {
				wrapped = wrap( existing );
			}

			Object.defineProperty( window, '__playground_ControlledIframe', {
				configurable: true,
				get: function () {
					return wrapped;
				},
				set: function ( Original ) {
					wrapped = wrap( Original );
				},
			} );
		} )();
		</script>
		<?php
	}
);
