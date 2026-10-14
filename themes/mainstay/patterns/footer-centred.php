<?php
/**
 * Title: Centred footer
 * Slug: mainstay/footer-centred
 * Categories: footer
 * Block Types: core/template-part/footer
 * Viewport width: 1400
 * Description: Logo, site name and tagline in the middle, with the menu, social links and small print centred below.
 *
 * @package Mainstay
 */

?>
<!-- wp:group {"align":"full","className":"is-style-section-soft","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|40"},"blockGap":"var:preset|spacing|40"}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull is-style-section-soft" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--40)"><!-- wp:group {"style":{"spacing":{"blockGap":"var:preset|spacing|30"}},"layout":{"type":"flex","orientation":"vertical","justifyContent":"center"}} -->
<div class="wp-block-group"><!-- wp:site-logo {"width":56,"shouldSyncIcon":true,"align":"center"} /-->

<!-- wp:site-title {"level":0,"style":{"typography":{"textAlign":"center"}},"fontSize":"x-large"} /-->

<!-- wp:site-tagline {"style":{"typography":{"textAlign":"center"}}} /--></div>
<!-- /wp:group -->

<!-- wp:navigation {"overlayMenu":"never","layout":{"type":"flex","justifyContent":"center"}} /-->

<!-- wp:social-links {"className":"is-style-logos-only","style":{"spacing":{"blockGap":{"left":"1rem"}}},"layout":{"type":"flex","justifyContent":"center"}} -->
<ul class="wp-block-social-links is-style-logos-only"><!-- wp:social-link {"url":"#","service":"instagram"} /-->

<!-- wp:social-link {"url":"#","service":"facebook"} /-->

<!-- wp:social-link {"url":"#","service":"tiktok"} /--></ul>
<!-- /wp:social-links -->

<!-- wp:paragraph {"style":{"typography":{"textAlign":"center"}},"fontSize":"small"} -->
<p class="has-text-align-center has-small-font-size">© 2026 Fernhouse, 14 Mill Lane, Hebden Bridge HX7 8AD</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group -->
