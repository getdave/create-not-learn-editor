<?php
/**
 * Title: Grid cards
 * Slug: mainstay/grid-cards
 * Inserter: no
 * Viewport width: 1400
 * Description: A tall cover beside three coloured cards, on a grid of three columns and two rows. Its blocks sit where the grid's manual placement puts them, so it needs Gutenberg's grid interactivity experiment.
 *
 * @package Mainstay
 */

?>
<!-- wp:group {"metadata":{"name":"Grid cards"},"align":"full","className":"is-style-section-tint","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull is-style-section-tint" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)"><!-- wp:group {"metadata":{"name":"Cards grid"},"align":"wide","layout":{"type":"grid","columnCount":3,"rowCount":2,"isManualPlacement":true}} -->
<div class="wp-block-group alignwide"><!-- wp:cover {"url":"<?php echo esc_url( mainstay_image( 'bright-cafe' ) ); ?>","alt":"Tables in the café by a sunny window","dimRatio":40,"overlayColor":"contrast","isUserOverlayColor":true,"contentPosition":"bottom left","style":{"layout":{"columnStart":1,"rowStart":1,"columnSpan":1,"rowSpan":2},"border":{"radius":"16px"}},"layout":{"type":"constrained"}} -->
<div class="wp-block-cover has-custom-content-position is-position-bottom-left" style="border-radius:16px"><img class="wp-block-cover__image-background" alt="Tables in the café by a sunny window" src="<?php echo esc_url( mainstay_image( 'bright-cafe' ) ); ?>" data-object-fit="cover"/><span aria-hidden="true" class="wp-block-cover__background has-contrast-background-color has-background-dim-40 has-background-dim"></span><div class="wp-block-cover__inner-container"><!-- wp:heading {"textColor":"base","fontSize":"xx-large"} -->
<h2 class="wp-block-heading has-base-color has-text-color has-xx-large-font-size">The café</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Coffee from a roaster up the road and bakes from our back kitchen, every morning.</p>
<!-- /wp:paragraph --></div></div>
<!-- /wp:cover -->

<!-- wp:group {"className":"is-style-section-brand","style":{"layout":{"columnStart":2,"rowStart":1,"columnSpan":2,"rowSpan":1},"spacing":{"padding":{"top":"var:preset|spacing|40","bottom":"var:preset|spacing|40","left":"var:preset|spacing|40","right":"var:preset|spacing|40"}},"border":{"radius":"16px"}},"layout":{"type":"flex","orientation":"vertical","verticalAlignment":"space-between"}} -->
<div class="wp-block-group is-style-section-brand" style="border-radius:16px;padding-top:var(--wp--preset--spacing--40);padding-right:var(--wp--preset--spacing--40);padding-bottom:var(--wp--preset--spacing--40);padding-left:var(--wp--preset--spacing--40)"><!-- wp:heading {"fontSize":"xx-large"} -->
<h2 class="wp-block-heading has-xx-large-font-size">Weekend workshops</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Potting, terrariums and wreaths, in the back room on Saturday mornings.</p>
<!-- /wp:paragraph -->

<!-- wp:buttons -->
<div class="wp-block-buttons"><!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="#">Book a place</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons --></div>
<!-- /wp:group -->

<!-- wp:group {"className":"is-style-section-highlight","style":{"layout":{"columnStart":2,"rowStart":2,"columnSpan":1,"rowSpan":1},"spacing":{"padding":{"top":"var:preset|spacing|40","bottom":"var:preset|spacing|40","left":"var:preset|spacing|40","right":"var:preset|spacing|40"}},"border":{"radius":"16px"}},"layout":{"type":"flex","orientation":"vertical","verticalAlignment":"space-between"}} -->
<div class="wp-block-group is-style-section-highlight" style="border-radius:16px;padding-top:var(--wp--preset--spacing--40);padding-right:var(--wp--preset--spacing--40);padding-bottom:var(--wp--preset--spacing--40);padding-left:var(--wp--preset--spacing--40)"><!-- wp:paragraph {"fontSize":"huge"} -->
<p class="has-huge-font-size">8</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>people in each class, at most</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group -->

<!-- wp:group {"className":"is-style-section-contrast","style":{"layout":{"columnStart":3,"rowStart":2,"columnSpan":1,"rowSpan":1},"spacing":{"padding":{"top":"var:preset|spacing|40","bottom":"var:preset|spacing|40","left":"var:preset|spacing|40","right":"var:preset|spacing|40"}},"border":{"radius":"16px"}},"layout":{"type":"flex","orientation":"vertical","verticalAlignment":"space-between"}} -->
<div class="wp-block-group is-style-section-contrast" style="border-radius:16px;padding-top:var(--wp--preset--spacing--40);padding-right:var(--wp--preset--spacing--40);padding-bottom:var(--wp--preset--spacing--40);padding-left:var(--wp--preset--spacing--40)"><!-- wp:heading {"level":3,"fontSize":"x-large"} -->
<h3 class="wp-block-heading has-x-large-font-size">Open Tuesday to Sunday</h3>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>8am to 5pm in the week, 9am to 6pm on Saturdays and 10am to 4pm on Sundays.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group --></div>
<!-- /wp:group --></div>
<!-- /wp:group -->
