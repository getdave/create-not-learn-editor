<?php
/**
 * Title: Hero with a photo collage
 * Slug: mainstay/hero-collage
 * Categories: banner
 * Keywords: hero, intro, welcome, collage, photos, images
 * Viewport width: 1400
 * Description: A headline and a short paragraph on the left, with three photos arranged in a staggered collage on the right.
 *
 * @package Mainstay
 */

?>
<!-- wp:group {"metadata":{"name":"Hero with collage"},"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)"><!-- wp:columns {"verticalAlignment":"center","align":"wide","style":{"spacing":{"blockGap":{"left":"var:preset|spacing|60"}}}} -->
<div class="wp-block-columns alignwide are-vertically-aligned-center"><!-- wp:column {"verticalAlignment":"center","width":"44%","style":{"spacing":{"blockGap":"var:preset|spacing|40"}}} -->
<div class="wp-block-column is-vertically-aligned-center" style="flex-basis:44%"><!-- wp:heading {"level":1} -->
<h1 class="wp-block-heading">Fresh flowers every Tuesday and Friday.</h1>
<!-- /wp:heading -->

<!-- wp:paragraph {"fontSize":"large"} -->
<p class="has-large-font-size">Our cut flowers come from growers in Yorkshire and Lancashire. Tell us who they're for and we'll make up a bunch while you finish your coffee.</p>
<!-- /wp:paragraph -->

<!-- wp:buttons -->
<div class="wp-block-buttons"><!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="#">Order flowers</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons --></div>
<!-- /wp:column -->

<!-- wp:column {"verticalAlignment":"center","width":"56%"} -->
<div class="wp-block-column is-vertically-aligned-center" style="flex-basis:56%"><!-- wp:columns {"isStackedOnMobile":false,"style":{"spacing":{"blockGap":{"left":"var:preset|spacing|40"}}}} -->
<div class="wp-block-columns is-not-stacked-on-mobile"><!-- wp:column {"width":"56%","style":{"spacing":{"padding":{"top":"var:preset|spacing|60"}}}} -->
<div class="wp-block-column" style="padding-top:var(--wp--preset--spacing--60);flex-basis:56%"><!-- wp:image {"aspectRatio":"3/4","scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft"} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'holding-bouquet' ) ); ?>" alt="A woman holding a large bouquet of mixed flowers" style="aspect-ratio:3/4;object-fit:cover"/></figure>
<!-- /wp:image --></div>
<!-- /wp:column -->

<!-- wp:column {"width":"44%","style":{"spacing":{"blockGap":"var:preset|spacing|40"}}} -->
<div class="wp-block-column" style="flex-basis:44%"><!-- wp:image {"aspectRatio":"1","scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft"} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'tulips-and-iris' ) ); ?>" alt="Tulips and irises arranged in a vase on a wooden table" style="aspect-ratio:1;object-fit:cover"/></figure>
<!-- /wp:image -->

<!-- wp:image {"aspectRatio":"4/3","scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft"} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'cornflowers' ) ); ?>" alt="A bunch of bright blue cornflowers" style="aspect-ratio:4/3;object-fit:cover"/></figure>
<!-- /wp:image --></div>
<!-- /wp:column --></div>
<!-- /wp:columns --></div>
<!-- /wp:column --></div>
<!-- /wp:columns --></div>
<!-- /wp:group -->
