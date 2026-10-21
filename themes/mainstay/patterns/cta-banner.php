<?php
/**
 * Title: Call to action band
 * Slug: mainstay/cta-banner
 * Categories: call-to-action
 * Keywords: call to action, banner, band, contact, enquiry, visit, buttons
 * Viewport width: 1400
 * Description: A coloured band with a heading and one sentence on the left and two buttons on the right.
 *
 * @package Mainstay
 */

?>
<!-- wp:group {"metadata":{"name":"Call to action"},"align":"full","className":"is-style-section-brand","style":{"spacing":{"padding":{"top":"var:preset|spacing|50","bottom":"var:preset|spacing|50"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull is-style-section-brand" style="padding-top:var(--wp--preset--spacing--50);padding-bottom:var(--wp--preset--spacing--50)"><!-- wp:group {"align":"wide","style":{"spacing":{"blockGap":"var:preset|spacing|40"}},"layout":{"type":"flex","flexWrap":"wrap","justifyContent":"space-between"}} -->
<div class="wp-block-group alignwide"><!-- wp:group {"style":{"spacing":{"blockGap":"var:preset|spacing|20"},"layout":{"selfStretch":"fixed","flexSize":"640px"}},"layout":{"type":"default"}} -->
<div class="wp-block-group"><!-- wp:heading -->
<h2 class="wp-block-heading">Come and see us on Mill Lane</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>We're two minutes from Hebden Bridge station, with buckets of flowers by the door. Open Tuesday to Sunday.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group -->

<!-- wp:buttons -->
<div class="wp-block-buttons"><!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="<?php echo esc_url( mainstay_page_url( 'visit', 'find-us' ) ); ?>">Get directions</a></div>
<!-- /wp:button -->

<!-- wp:button {"className":"is-style-outline"} -->
<div class="wp-block-button is-style-outline"><a class="wp-block-button__link wp-element-button" href="<?php echo esc_url( mainstay_page_url( 'visit', 'opening-hours' ) ); ?>">See opening hours</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons --></div>
<!-- /wp:group --></div>
<!-- /wp:group -->
