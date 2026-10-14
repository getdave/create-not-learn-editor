<?php
/**
 * Title: Call to action on a picture
 * Slug: mainstay/cta-image
 * Categories: call-to-action
 * Keywords: call to action, cover, image, background, banner, booking
 * Viewport width: 1400
 * Description: A large picture with rounded corners and a darkened overlay, with a centred heading, a sentence and a button on top.
 *
 * @package Mainstay
 */

?>
<!-- wp:group {"metadata":{"name":"Call to action with picture"},"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)"><!-- wp:cover {"url":"<?php echo esc_url( mainstay_image( 'hands-in-soil' ) ); ?>","dimRatio":50,"minHeight":60,"minHeightUnit":"vh","align":"wide","className":"is-style-mainstay-soft","layout":{"type":"constrained"}} -->
<div class="wp-block-cover alignwide is-style-mainstay-soft" style="min-height:60vh"><img class="wp-block-cover__image-background" alt="" src="<?php echo esc_url( mainstay_image( 'hands-in-soil' ) ); ?>" data-object-fit="cover"/><span aria-hidden="true" class="wp-block-cover__background has-background-dim"></span><div class="wp-block-cover__inner-container"><!-- wp:heading {"style":{"typography":{"textAlign":"center"}}} -->
<h2 class="wp-block-heading has-text-align-center">Get your hands dirty this weekend</h2>
<!-- /wp:heading -->

<!-- wp:paragraph {"style":{"typography":{"textAlign":"center"}}} -->
<p class="has-text-align-center">Our potting workshops run every Saturday morning. Two hours, eight people, and you take home whatever you make.</p>
<!-- /wp:paragraph -->

<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->
<div class="wp-block-buttons"><!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="#">Book a place</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons --></div></div>
<!-- /wp:cover --></div>
<!-- /wp:group -->
