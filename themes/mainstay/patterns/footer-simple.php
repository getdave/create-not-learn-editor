<?php
/**
 * Title: Simple footer
 * Slug: mainstay/footer-simple
 * Categories: footer
 * Block Types: core/template-part/footer
 * Viewport width: 1400
 * Description: One compact row with the site name, the menu and social links, and a small copyright line underneath.
 *
 * @package Mainstay
 */

?>
<!-- wp:group {"align":"full","style":{"spacing":{"padding":{"bottom":"var:preset|spacing|40"},"blockGap":"var:preset|spacing|40"}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull" style="padding-bottom:var(--wp--preset--spacing--40)"><!-- wp:separator {"align":"full"} -->
<hr class="wp-block-separator alignfull has-alpha-channel-opacity"/>
<!-- /wp:separator -->

<!-- wp:group {"align":"wide","style":{"spacing":{"blockGap":"var:preset|spacing|40"}},"layout":{"type":"flex","flexWrap":"wrap","justifyContent":"space-between"}} -->
<div class="wp-block-group alignwide"><!-- wp:site-title {"level":0} /-->

<!-- wp:navigation {"overlayMenu":"never","layout":{"type":"flex","justifyContent":"left"}} /-->

<!-- wp:social-links {"className":"is-style-logos-only","style":{"spacing":{"blockGap":{"left":"1rem"}}}} -->
<ul class="wp-block-social-links is-style-logos-only"><!-- wp:social-link {"url":"#","service":"instagram"} /-->

<!-- wp:social-link {"url":"#","service":"facebook"} /-->

<!-- wp:social-link {"url":"#","service":"tiktok"} /--></ul>
<!-- /wp:social-links --></div>
<!-- /wp:group -->

<!-- wp:paragraph {"className":"alignwide","fontSize":"small"} -->
<p class="alignwide has-small-font-size">© 2026 Fernhouse, 14 Mill Lane, Hebden Bridge</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group -->
