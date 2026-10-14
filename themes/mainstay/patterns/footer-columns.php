<?php
/**
 * Title: Footer with columns
 * Slug: mainstay/footer-columns
 * Categories: footer
 * Block Types: core/template-part/footer
 * Viewport width: 1400
 * Description: Site name and a short line about you, then columns for pages, opening hours and where to find you.
 *
 * @package Mainstay
 */

?>
<!-- wp:group {"align":"full","className":"is-style-section-contrast","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|40"},"blockGap":"var:preset|spacing|60"}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull is-style-section-contrast" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--40)"><!-- wp:columns {"align":"wide","style":{"spacing":{"blockGap":{"left":"var:preset|spacing|50"}}}} -->
<div class="wp-block-columns alignwide"><!-- wp:column {"width":"40%","style":{"spacing":{"blockGap":"var:preset|spacing|30"}}} -->
<div class="wp-block-column" style="flex-basis:40%"><!-- wp:site-title {"level":0,"fontSize":"x-large"} /-->

<!-- wp:site-tagline /--></div>
<!-- /wp:column -->

<!-- wp:column {"style":{"spacing":{"blockGap":"var:preset|spacing|30"}}} -->
<div class="wp-block-column"><!-- wp:heading {"fontSize":"small"} -->
<h2 class="wp-block-heading has-small-font-size">Pages</h2>
<!-- /wp:heading -->

<!-- wp:navigation {"overlayMenu":"never","style":{"spacing":{"blockGap":"0.5rem"}},"layout":{"type":"flex","orientation":"vertical"}} /--></div>
<!-- /wp:column -->

<!-- wp:column {"style":{"spacing":{"blockGap":"var:preset|spacing|30"}}} -->
<div class="wp-block-column"><!-- wp:heading {"fontSize":"small"} -->
<h2 class="wp-block-heading has-small-font-size">Opening hours</h2>
<!-- /wp:heading -->

<!-- wp:paragraph {"fontSize":"small"} -->
<p class="has-small-font-size">Tuesday to Friday, 8am to 5pm<br>Saturday, 9am to 6pm<br>Sunday, 10am to 4pm</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column -->

<!-- wp:column {"style":{"spacing":{"blockGap":"var:preset|spacing|30"}}} -->
<div class="wp-block-column"><!-- wp:heading {"fontSize":"small"} -->
<h2 class="wp-block-heading has-small-font-size">Find us</h2>
<!-- /wp:heading -->

<!-- wp:paragraph {"fontSize":"small"} -->
<p class="has-small-font-size">14 Mill Lane<br>Hebden Bridge<br>HX7 8AD</p>
<!-- /wp:paragraph -->

<!-- wp:social-links {"className":"is-style-logos-only","style":{"spacing":{"blockGap":{"left":"1rem"}}}} -->
<ul class="wp-block-social-links is-style-logos-only"><!-- wp:social-link {"url":"#","service":"instagram"} /-->

<!-- wp:social-link {"url":"#","service":"facebook"} /-->

<!-- wp:social-link {"url":"#","service":"tiktok"} /--></ul>
<!-- /wp:social-links --></div>
<!-- /wp:column --></div>
<!-- /wp:columns -->

<!-- wp:group {"align":"wide","style":{"spacing":{"blockGap":"var:preset|spacing|30"}},"layout":{"type":"flex","flexWrap":"wrap","justifyContent":"space-between"}} -->
<div class="wp-block-group alignwide"><!-- wp:paragraph {"fontSize":"small"} -->
<p class="has-small-font-size">© 2026 Fernhouse. Independent and proud of it.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph {"fontSize":"small"} -->
<p class="has-small-font-size">Made with <a href="https://wordpress.org">WordPress</a></p>
<!-- /wp:paragraph --></div>
<!-- /wp:group --></div>
<!-- /wp:group -->
