<?php
/**
 * Title: Photo mosaic
 * Slug: mainstay/gallery-mosaic
 * Categories: gallery
 * Keywords: gallery, photos, pictures, mosaic, images, collage
 * Viewport width: 1400
 * Description: One large photo with two smaller photos stacked beside it, each with rounded corners.
 *
 * @package Mainstay
 */

?>
<!-- wp:group {"metadata":{"name":"Photo mosaic"},"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)"><!-- wp:group {"align":"wide","layout":{"type":"grid","columnCount":3,"minimumColumnWidth":"12rem"}} -->
<div class="wp-block-group alignwide"><!-- wp:image {"height":"100%","scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft","style":{"layout":{"columnSpan":2,"rowSpan":2}}} -->
<figure class="wp-block-image size-full is-resized is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'flower-buckets' ) ); ?>" alt="Galvanised buckets of orange, yellow and pink cut flowers outside the shop" style="object-fit:cover;height:100%"/></figure>
<!-- /wp:image -->

<!-- wp:image {"aspectRatio":"4/3","scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft"} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'croissant-tray' ) ); ?>" alt="A tray of fresh croissants on the café counter" style="aspect-ratio:4/3;object-fit:cover"/></figure>
<!-- /wp:image -->

<!-- wp:image {"aspectRatio":"4/3","scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft"} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'succulent-rosette' ) ); ?>" alt="Close-up of a pink and blue succulent rosette" style="aspect-ratio:4/3;object-fit:cover"/></figure>
<!-- /wp:image --></div>
<!-- /wp:group --></div>
<!-- /wp:group -->
