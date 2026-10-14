<?php
/**
 * Title: Contact details and opening hours
 * Slug: mainstay/contact-details
 * Categories: contact
 * Keywords: contact, address, opening hours, phone, email, directions, find us
 * Viewport width: 1400
 * Description: Your address and a picture of the shop on one side, with opening hours, phone, email and a directions button on the other.
 *
 * @package Mainstay
 */

?>
<!-- wp:group {"metadata":{"name":"Contact details"},"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)"><!-- wp:columns {"align":"wide","style":{"spacing":{"blockGap":{"top":"var:preset|spacing|50","left":"var:preset|spacing|60"}}}} -->
<div class="wp-block-columns alignwide"><!-- wp:column {"width":"55%","style":{"spacing":{"blockGap":"var:preset|spacing|30"}}} -->
<div class="wp-block-column" style="flex-basis:55%"><!-- wp:heading -->
<h2 class="wp-block-heading">Find us on Mill Lane</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>14 Mill Lane, Hebden Bridge, HX7 8AD. We're two minutes from the station, opposite the old mill. Look for the buckets of flowers by the door.</p>
<!-- /wp:paragraph -->

<!-- wp:image {"aspectRatio":"4/3","scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft","style":{"spacing":{"margin":{"top":"var:preset|spacing|40"}}}} -->
<figure class="wp-block-image size-full is-style-mainstay-soft" style="margin-top:var(--wp--preset--spacing--40)"><img src="<?php echo esc_url( mainstay_image( 'flower-shop-front' ) ); ?>" alt="The front of the shop on the street, with buckets of cut flowers outside" style="aspect-ratio:4/3;object-fit:cover"/></figure>
<!-- /wp:image --></div>
<!-- /wp:column -->

<!-- wp:column {"width":"45%","style":{"spacing":{"blockGap":"var:preset|spacing|50"}}} -->
<div class="wp-block-column" style="flex-basis:45%"><!-- wp:group {"style":{"spacing":{"blockGap":"var:preset|spacing|30"}},"layout":{"type":"default"}} -->
<div class="wp-block-group"><!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Opening hours</h3>
<!-- /wp:heading -->

<!-- wp:group {"className":"mainstay-rows","layout":{"type":"default"}} -->
<div class="wp-block-group mainstay-rows"><!-- wp:group {"style":{"spacing":{"blockGap":"var:preset|spacing|30"}},"layout":{"type":"flex","flexWrap":"nowrap","justifyContent":"space-between"}} -->
<div class="wp-block-group"><!-- wp:paragraph -->
<p>Monday</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>Closed</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group -->

<!-- wp:group {"style":{"spacing":{"blockGap":"var:preset|spacing|30"}},"layout":{"type":"flex","flexWrap":"nowrap","justifyContent":"space-between"}} -->
<div class="wp-block-group"><!-- wp:paragraph -->
<p>Tuesday to Friday</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>8am to 5pm</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group -->

<!-- wp:group {"style":{"spacing":{"blockGap":"var:preset|spacing|30"}},"layout":{"type":"flex","flexWrap":"nowrap","justifyContent":"space-between"}} -->
<div class="wp-block-group"><!-- wp:paragraph -->
<p>Saturday</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>9am to 6pm</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group -->

<!-- wp:group {"style":{"spacing":{"blockGap":"var:preset|spacing|30"}},"layout":{"type":"flex","flexWrap":"nowrap","justifyContent":"space-between"}} -->
<div class="wp-block-group"><!-- wp:paragraph -->
<p>Sunday</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>10am to 4pm</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group --></div>
<!-- /wp:group --></div>
<!-- /wp:group -->

<!-- wp:group {"style":{"spacing":{"blockGap":"var:preset|spacing|30"}},"layout":{"type":"default"}} -->
<div class="wp-block-group"><!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Call or email</h3>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p><a href="tel:+441422845210">01422 845 210</a><br><a href="mailto:hello@fernhouse.co.uk">hello@fernhouse.co.uk</a></p>
<!-- /wp:paragraph --></div>
<!-- /wp:group -->

<!-- wp:buttons -->
<div class="wp-block-buttons"><!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="#">Get directions</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons --></div>
<!-- /wp:column --></div>
<!-- /wp:columns --></div>
<!-- /wp:group -->
