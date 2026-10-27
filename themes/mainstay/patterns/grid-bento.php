<?php
/**
 * Title: Grid bento
 * Slug: mainstay/grid-bento
 * Inserter: no
 * Viewport width: 1400
 * Description: A cover, five photos and a coloured card of different sizes, filling a grid of four columns and three rows. Its blocks sit where the grid's manual placement puts them, so it needs Gutenberg's grid interactivity experiment.
 *
 * @package Mainstay
 */

?>
<!-- wp:group {"metadata":{"name":"Grid bento"},"align":"full","className":"is-style-section-soft","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull is-style-section-soft" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)"><!-- wp:group {"metadata":{"name":"Bento grid"},"align":"wide","layout":{"type":"grid","columnCount":4,"rowCount":3,"isManualPlacement":true}} -->
<div class="wp-block-group alignwide"><!-- wp:cover {"url":"<?php echo esc_url( mainstay_image( 'greenhouse-interior' ) ); ?>","alt":"Sunlight through the glass roof of the greenhouse","dimRatio":40,"overlayColor":"contrast","isUserOverlayColor":true,"contentPosition":"bottom left","style":{"layout":{"columnStart":1,"rowStart":1,"columnSpan":2,"rowSpan":2},"border":{"radius":"16px"}},"layout":{"type":"constrained"}} -->
<div class="wp-block-cover has-custom-content-position is-position-bottom-left" style="border-radius:16px"><img class="wp-block-cover__image-background" alt="Sunlight through the glass roof of the greenhouse" src="<?php echo esc_url( mainstay_image( 'greenhouse-interior' ) ); ?>" data-object-fit="cover"/><span aria-hidden="true" class="wp-block-cover__background has-contrast-background-color has-background-dim-40 has-background-dim"></span><div class="wp-block-cover__inner-container"><!-- wp:heading {"textColor":"base","fontSize":"xx-large"} -->
<h2 class="wp-block-heading has-base-color has-text-color has-xx-large-font-size">The glasshouse</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Our biggest plants live out back, under the old glass roof.</p>
<!-- /wp:paragraph --></div></div>
<!-- /wp:cover -->

<!-- wp:image {"scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft","style":{"layout":{"columnStart":3,"rowStart":1,"columnSpan":1,"rowSpan":1}}} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'latte-and-croissant' ) ); ?>" alt="A latte and a croissant seen from above" style="object-fit:cover"/></figure>
<!-- /wp:image -->

<!-- wp:image {"scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft","style":{"layout":{"columnStart":4,"rowStart":1,"columnSpan":1,"rowSpan":2}}} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'succulents' ) ); ?>" alt="Rows of small succulents in pots" style="object-fit:cover"/></figure>
<!-- /wp:image -->

<!-- wp:image {"scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft","style":{"layout":{"columnStart":3,"rowStart":2,"columnSpan":1,"rowSpan":1}}} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'ceramics-shelf' ) ); ?>" alt="A shelf of handmade pots" style="object-fit:cover"/></figure>
<!-- /wp:image -->

<!-- wp:image {"scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft","style":{"layout":{"columnStart":1,"rowStart":3,"columnSpan":1,"rowSpan":1}}} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'tulips-and-iris' ) ); ?>" alt="A bunch of tulips and irises" style="object-fit:cover"/></figure>
<!-- /wp:image -->

<!-- wp:group {"className":"is-style-section-highlight","style":{"layout":{"columnStart":2,"rowStart":3,"columnSpan":2,"rowSpan":1},"spacing":{"padding":{"top":"var:preset|spacing|40","bottom":"var:preset|spacing|40","left":"var:preset|spacing|40","right":"var:preset|spacing|40"}},"border":{"radius":"16px"}},"layout":{"type":"flex","orientation":"vertical","verticalAlignment":"space-between"}} -->
<div class="wp-block-group is-style-section-highlight" style="border-radius:16px;padding-top:var(--wp--preset--spacing--40);padding-right:var(--wp--preset--spacing--40);padding-bottom:var(--wp--preset--spacing--40);padding-left:var(--wp--preset--spacing--40)"><!-- wp:heading {"level":3,"fontSize":"x-large"} -->
<h3 class="wp-block-heading has-x-large-font-size">Fresh flowers every Friday</h3>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Cut that morning by growers in the valley. Come early for the best of them.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group -->

<!-- wp:image {"scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft","style":{"layout":{"columnStart":4,"rowStart":3,"columnSpan":1,"rowSpan":1}}} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'pottery-wheel' ) ); ?>" alt="Hands shaping clay on a pottery wheel" style="object-fit:cover"/></figure>
<!-- /wp:image --></div>
<!-- /wp:group --></div>
<!-- /wp:group -->
