<?php
/**
 * Title: Call to action on a picture
 * Slug: mainstay/cta-image
 * Categories: call-to-action
 * Keywords: call to action, cover, image, background, banner, booking, visit
 * Viewport width: 1400
 * Description: A large picture with rounded corners and a darkened overlay, with a centred heading, a sentence and a button on top.
 *
 * @package Mainstay
 */

?>
<!-- wp:group {"metadata":{"name":"Call to action with picture"},"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)"><!-- wp:cover {"url":"<?php echo esc_url( mainstay_image( 'bright-cafe' ) ); ?>","dimRatio":50,"minHeight":60,"minHeightUnit":"vh","align":"wide","className":"is-style-mainstay-soft","layout":{"type":"constrained"}} -->
<div class="wp-block-cover alignwide is-style-mainstay-soft" style="min-height:60vh"><img class="wp-block-cover__image-background" alt="" src="<?php echo esc_url( mainstay_image( 'bright-cafe' ) ); ?>" data-object-fit="cover"/><span aria-hidden="true" class="wp-block-cover__background has-background-dim"></span><div class="wp-block-cover__inner-container"><!-- wp:heading {"style":{"typography":{"textAlign":"center"}}} -->
<h2 class="wp-block-heading has-text-align-center">Stay as long as you like</h2>
<!-- /wp:heading -->

<!-- wp:paragraph {"style":{"typography":{"textAlign":"center"}}} -->
<p class="has-text-align-center">Plenty of seats, plugs by the window and nobody minds if one coffee turns into an afternoon. We open at 8am Tuesday to Friday, a little later at weekends.</p>
<!-- /wp:paragraph -->

<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->
<div class="wp-block-buttons"><!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="<?php echo esc_url( mainstay_page_url( 'visit', 'opening-hours' ) ); ?>">See opening hours</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons --></div></div>
<!-- /wp:cover --></div>
<!-- /wp:group -->
