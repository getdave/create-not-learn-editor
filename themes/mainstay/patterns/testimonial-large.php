<?php
/**
 * Title: Large testimonial
 * Slug: mainstay/testimonial-large
 * Categories: testimonials
 * Keywords: testimonial, quote, review, customer, feedback
 * Viewport width: 1400
 * Description: One big centred quote from a customer, with their photo, name and what they came in for.
 *
 * @package Mainstay
 */

?>
<!-- wp:group {"metadata":{"name":"Testimonial"},"align":"full","className":"is-style-section-tint","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"},"blockGap":"var:preset|spacing|40"}},"layout":{"type":"constrained","contentSize":"880px"}} -->
<div class="wp-block-group alignfull is-style-section-tint" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)"><!-- wp:quote {"textAlign":"center","fontSize":"x-large"} -->
<blockquote class="wp-block-quote has-text-align-center has-x-large-font-size"><!-- wp:paragraph -->
<p>I came in for a coffee and left with a monstera, a pot and a place on the terrarium workshop. Six months on, everything is still alive, which is a first for me.</p>
<!-- /wp:paragraph --></blockquote>
<!-- /wp:quote -->

<!-- wp:group {"style":{"spacing":{"blockGap":"var:preset|spacing|30"}},"layout":{"type":"flex","flexWrap":"nowrap","justifyContent":"center"}} -->
<div class="wp-block-group"><!-- wp:image {"width":"56px","aspectRatio":"1","scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-rounded"} -->
<figure class="wp-block-image size-full is-resized is-style-rounded"><img src="<?php echo esc_url( mainstay_image( 'portrait-jo' ) ); ?>" alt="Jo, smiling, in a pink top" style="aspect-ratio:1;object-fit:cover;width:56px;height:auto"/></figure>
<!-- /wp:image -->

<!-- wp:group {"style":{"spacing":{"blockGap":"0"}},"layout":{"type":"default"}} -->
<div class="wp-block-group"><!-- wp:paragraph {"style":{"typography":{"fontWeight":"600"}},"fontSize":"small"} -->
<p class="has-small-font-size" style="font-weight:600">Jo Hartley</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph {"fontSize":"small"} -->
<p class="has-small-font-size">Comes in most Saturdays</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group --></div>
<!-- /wp:group --></div>
<!-- /wp:group -->
