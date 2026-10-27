<?php
/**
 * Title: Grid hero
 * Slug: mainstay/grid-hero
 * Inserter: no
 * Viewport width: 1400
 * Description: A big heading and an introduction beside three photos, placed by hand on a grid of six columns and three rows. Its blocks sit where the grid's manual placement puts them, so it needs Gutenberg's grid interactivity experiment.
 *
 * @package Mainstay
 */

?>
<!-- wp:group {"metadata":{"name":"Grid hero"},"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)"><!-- wp:group {"metadata":{"name":"Hero grid"},"align":"wide","layout":{"type":"grid","columnCount":6,"rowCount":3,"isManualPlacement":true}} -->
<div class="wp-block-group alignwide"><!-- wp:heading {"level":1,"style":{"layout":{"columnStart":1,"rowStart":1,"columnSpan":3,"rowSpan":2}},"fontSize":"huge"} -->
<h1 class="wp-block-heading has-huge-font-size">Everything under one roof.</h1>
<!-- /wp:heading -->

<!-- wp:paragraph {"style":{"layout":{"columnStart":1,"rowStart":3,"columnSpan":3,"rowSpan":1}},"fontSize":"large"} -->
<p class="has-large-font-size">Plants, flowers, coffee and the odd workshop. Here's what's on at Fernhouse this season.</p>
<!-- /wp:paragraph -->

<!-- wp:image {"scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft","style":{"layout":{"columnStart":4,"rowStart":1,"columnSpan":3,"rowSpan":2}}} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'flower-shop-front' ) ); ?>" alt="The front of the shop, with flowers in buckets by the door" style="object-fit:cover"/></figure>
<!-- /wp:image -->

<!-- wp:image {"scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft","style":{"layout":{"columnStart":4,"rowStart":3,"columnSpan":1,"rowSpan":1}}} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'latte-art' ) ); ?>" alt="A latte with a leaf drawn in the foam" style="object-fit:cover"/></figure>
<!-- /wp:image -->

<!-- wp:image {"scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft","style":{"layout":{"columnStart":5,"rowStart":3,"columnSpan":2,"rowSpan":1}}} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'hands-in-soil' ) ); ?>" alt="Two hands holding a scoop of dark soil" style="object-fit:cover"/></figure>
<!-- /wp:image --></div>
<!-- /wp:group --></div>
<!-- /wp:group -->
