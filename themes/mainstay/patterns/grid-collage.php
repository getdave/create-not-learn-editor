<?php
/**
 * Title: Grid collage
 * Slug: mainstay/grid-collage
 * Inserter: no
 * Viewport width: 1400
 * Description: Two tilted, overlapping photos beside a heading, a paragraph and a button, on a grid of eight columns and four rows. Its blocks sit where the grid's manual placement puts them, so it needs Gutenberg's grid interactivity experiment.
 *
 * @package Mainstay
 */

?>
<!-- wp:group {"metadata":{"name":"Grid collage"},"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)"><!-- wp:group {"metadata":{"name":"Collage grid"},"align":"wide","layout":{"type":"grid","columnCount":8,"rowCount":4,"isManualPlacement":true}} -->
<div class="wp-block-group alignwide"><!-- wp:image {"scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft","style":{"layout":{"columnStart":1,"rowStart":1,"columnSpan":3,"rowSpan":3},"rotate":-4}} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'flowers-on-stool' ) ); ?>" alt="A jug of flowers on a wooden stool" style="object-fit:cover"/></figure>
<!-- /wp:image -->

<!-- wp:image {"scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft","style":{"layout":{"columnStart":3,"rowStart":2,"columnSpan":3,"rowSpan":3},"rotate":3}} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'holding-bouquet' ) ); ?>" alt="Someone holding a wrapped bouquet" style="object-fit:cover"/></figure>
<!-- /wp:image -->

<!-- wp:heading {"style":{"layout":{"columnStart":6,"rowStart":1,"columnSpan":3,"rowSpan":2}},"fontSize":"xx-large"} -->
<h2 class="wp-block-heading has-xx-large-font-size">Something for every windowsill</h2>
<!-- /wp:heading -->

<!-- wp:paragraph {"style":{"layout":{"columnStart":6,"rowStart":3,"columnSpan":3,"rowSpan":1}}} -->
<p>Tell us how much light you get and we'll find a plant that does more than survive.</p>
<!-- /wp:paragraph -->

<!-- wp:buttons {"style":{"layout":{"columnStart":6,"rowStart":4,"columnSpan":3,"rowSpan":1}}} -->
<div class="wp-block-buttons"><!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="#">See the plants</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons --></div>
<!-- /wp:group --></div>
<!-- /wp:group -->
