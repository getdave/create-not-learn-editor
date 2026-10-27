<?php
/**
 * Title: Grid team
 * Slug: mainstay/grid-team
 * Inserter: no
 * Viewport width: 1400
 * Description: A heading, a large portrait, a quote and four small portraits, on a grid of six columns and three rows. Its blocks sit where the grid's manual placement puts them, so it needs Gutenberg's grid interactivity experiment.
 *
 * @package Mainstay
 */

?>
<!-- wp:group {"metadata":{"name":"Grid team"},"align":"full","className":"is-style-section-soft","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull is-style-section-soft" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)"><!-- wp:group {"metadata":{"name":"Team grid"},"align":"wide","layout":{"type":"grid","columnCount":6,"rowCount":3,"isManualPlacement":true}} -->
<div class="wp-block-group alignwide"><!-- wp:heading {"style":{"layout":{"columnStart":1,"rowStart":1,"columnSpan":4,"rowSpan":1}},"fontSize":"xx-large"} -->
<h2 class="wp-block-heading has-xx-large-font-size">The people behind the counter</h2>
<!-- /wp:heading -->

<!-- wp:image {"scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft","style":{"layout":{"columnStart":1,"rowStart":2,"columnSpan":2,"rowSpan":2}}} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'portrait-amara' ) ); ?>" alt="Amara, smiling" style="object-fit:cover"/></figure>
<!-- /wp:image -->

<!-- wp:paragraph {"style":{"layout":{"columnStart":3,"rowStart":2,"columnSpan":4,"rowSpan":1}},"fontSize":"large"} -->
<p class="has-large-font-size">“We wanted a shop where you could ask a silly question about a plant and get a proper answer.” Amara, co-owner</p>
<!-- /wp:paragraph -->

<!-- wp:image {"scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft","style":{"layout":{"columnStart":3,"rowStart":3,"columnSpan":1,"rowSpan":1}}} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'portrait-tom' ) ); ?>" alt="Tom" style="object-fit:cover"/></figure>
<!-- /wp:image -->

<!-- wp:image {"scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft","style":{"layout":{"columnStart":4,"rowStart":3,"columnSpan":1,"rowSpan":1}}} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'portrait-jo' ) ); ?>" alt="Jo" style="object-fit:cover"/></figure>
<!-- /wp:image -->

<!-- wp:image {"scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft","style":{"layout":{"columnStart":5,"rowStart":3,"columnSpan":1,"rowSpan":1}}} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'portrait-ruth' ) ); ?>" alt="Ruth" style="object-fit:cover"/></figure>
<!-- /wp:image -->

<!-- wp:image {"scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft","style":{"layout":{"columnStart":6,"rowStart":3,"columnSpan":1,"rowSpan":1}}} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'portrait-lena' ) ); ?>" alt="Lena" style="object-fit:cover"/></figure>
<!-- /wp:image --></div>
<!-- /wp:group --></div>
<!-- /wp:group -->
