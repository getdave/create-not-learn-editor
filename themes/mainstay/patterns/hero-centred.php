<?php
/**
 * Title: Centred hero with three pictures
 * Slug: mainstay/hero-centred
 * Categories: banner
 * Keywords: hero, intro, welcome, centred, centered, images, arch
 * Viewport width: 1400
 * Description: A big centred headline with a short line and two buttons, and a row of three pictures underneath.
 *
 * @package Mainstay
 */

?>
<!-- wp:group {"metadata":{"name":"Centred hero"},"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)"><!-- wp:heading {"level":1,"align":"wide","style":{"typography":{"textAlign":"center"}},"fontSize":"huge"} -->
<h1 class="wp-block-heading has-text-align-center alignwide has-huge-font-size">A plant shop that started on a windowsill.</h1>
<!-- /wp:heading -->

<!-- wp:paragraph {"style":{"typography":{"textAlign":"center"}},"fontSize":"large"} -->
<p class="has-text-align-center has-large-font-size">Fernhouse began with a flat so full of plants there was nowhere left to sit. Now it's a shop and café on Mill Lane, run by four people who are happy to talk about ferns all day.</p>
<!-- /wp:paragraph -->

<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->
<div class="wp-block-buttons"><!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="#our-story">Read our story</a></div>
<!-- /wp:button -->

<!-- wp:button {"className":"is-style-outline"} -->
<div class="wp-block-button is-style-outline"><a class="wp-block-button__link wp-element-button" href="#team">Meet the team</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->

<!-- wp:columns {"isStackedOnMobile":false,"align":"wide","style":{"spacing":{"margin":{"top":"var:preset|spacing|50"},"blockGap":{"left":"var:preset|spacing|40"}}}} -->
<div class="wp-block-columns alignwide is-not-stacked-on-mobile" style="margin-top:var(--wp--preset--spacing--50)"><!-- wp:column {"verticalAlignment":"top","width":"30%"} -->
<div class="wp-block-column is-vertically-aligned-top" style="flex-basis:30%"><!-- wp:image {"aspectRatio":"3/4","scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft"} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'flowers-on-stool' ) ); ?>" alt="Sunflowers and a fern in a glass jar on a wooden stool" style="aspect-ratio:3/4;object-fit:cover"/></figure>
<!-- /wp:image --></div>
<!-- /wp:column -->

<!-- wp:column {"verticalAlignment":"center","width":"40%"} -->
<div class="wp-block-column is-vertically-aligned-center" style="flex-basis:40%"><!-- wp:image {"aspectRatio":"4/5","scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-arch"} -->
<figure class="wp-block-image size-full is-style-mainstay-arch"><img src="<?php echo esc_url( mainstay_image( 'greenhouse-palms' ) ); ?>" alt="Tall palms growing under a glass roof" style="aspect-ratio:4/5;object-fit:cover"/></figure>
<!-- /wp:image --></div>
<!-- /wp:column -->

<!-- wp:column {"verticalAlignment":"bottom","width":"30%"} -->
<div class="wp-block-column is-vertically-aligned-bottom" style="flex-basis:30%"><!-- wp:image {"aspectRatio":"1","scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft"} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'latte-art' ) ); ?>" alt="A flat white with a leaf drawn in the milk" style="aspect-ratio:1;object-fit:cover"/></figure>
<!-- /wp:image --></div>
<!-- /wp:column --></div>
<!-- /wp:columns --></div>
<!-- /wp:group -->
