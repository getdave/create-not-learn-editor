<?php
/**
 * Title: Hero on a full-width photo
 * Slug: mainstay/hero-cover
 * Categories: banner
 * Keywords: hero, cover, photo, image, intro, welcome, banner
 * Viewport width: 1400
 * Description: A tall photo across the full width of the page, with a headline, a short line and a button in the bottom-left corner.
 *
 * @package Mainstay
 */

?>
<!-- wp:group {"metadata":{"name":"Hero on a photo"},"align":"full","layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull"><!-- wp:cover {"url":"<?php echo esc_url( mainstay_image( 'hands-in-soil' ) ); ?>","alt":"Two hands holding a scoop of dark soil","dimRatio":40,"minHeight":85,"minHeightUnit":"vh","contentPosition":"bottom center","align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-cover alignfull has-custom-content-position is-position-bottom-center" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60);min-height:85vh"><img class="wp-block-cover__image-background" alt="Two hands holding a scoop of dark soil" src="<?php echo esc_url( mainstay_image( 'hands-in-soil' ) ); ?>" data-object-fit="cover"/><span aria-hidden="true" class="wp-block-cover__background has-background-dim-40 has-background-dim"></span><div class="wp-block-cover__inner-container"><!-- wp:group {"align":"wide","style":{"spacing":{"blockGap":"var:preset|spacing|40"}},"layout":{"type":"constrained","contentSize":"760px","justifyContent":"left"}} -->
<div class="wp-block-group alignwide"><!-- wp:heading {"level":1,"fontSize":"huge"} -->
<h1 class="wp-block-heading has-huge-font-size">Get your hands in the soil this Saturday.</h1>
<!-- /wp:heading -->

<!-- wp:paragraph {"fontSize":"large"} -->
<p class="has-large-font-size">Small, friendly workshops in the back room of the shop. No experience needed, everything is on the table, and you take home whatever you make.</p>
<!-- /wp:paragraph -->

<!-- wp:buttons -->
<div class="wp-block-buttons"><!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="#dates">See what's on</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons --></div>
<!-- /wp:group --></div></div>
<!-- /wp:cover --></div>
<!-- /wp:group -->
