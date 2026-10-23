<?php
/**
 * Title: Our story with a photo
 * Slug: mainstay/about-story
 * Categories: about
 * Keywords: about, story, history, owners, photo
 * Viewport width: 1400
 * Description: A tall photo beside a heading, two short paragraphs about how the business started and a sign-off from the owners.
 *
 * @package Mainstay
 */

?>
<!-- wp:group {"metadata":{"name":"Our story"},"anchor":"our-story","align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"}}},"layout":{"type":"constrained"}} -->
<div id="our-story" class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)"><!-- wp:columns {"verticalAlignment":"center","align":"wide","style":{"spacing":{"blockGap":{"left":"var:preset|spacing|60"}}}} -->
<div class="wp-block-columns alignwide are-vertically-aligned-center"><!-- wp:column {"verticalAlignment":"center","width":"45%"} -->
<div class="wp-block-column is-vertically-aligned-center" style="flex-basis:45%"><!-- wp:image {"aspectRatio":"4/5","scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft"} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'open-sign' ) ); ?>" alt="An open sign hanging in the shop window" style="aspect-ratio:4/5;object-fit:cover"/></figure>
<!-- /wp:image --></div>
<!-- /wp:column -->

<!-- wp:column {"verticalAlignment":"center","width":"55%","style":{"spacing":{"blockGap":"var:preset|spacing|30"}}} -->
<div class="wp-block-column is-vertically-aligned-center" style="flex-basis:55%"><!-- wp:heading -->
<h2 class="wp-block-heading">How Fernhouse started</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>We opened in 2019 in what used to be a bike repair shop on Mill Lane. We'd spent years filling our flat with plants and wanted somewhere to share them, with proper coffee for anyone who came in to look.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>We still buy most of our plants from small growers we know by name, and everything on the counter is baked in the back kitchen each morning. If you're not sure what will cope on your windowsill, just ask. That's what we're here for.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph {"style":{"spacing":{"margin":{"top":"var:preset|spacing|40"}}},"fontSize":"small"} -->
<p class="has-small-font-size" style="margin-top:var(--wp--preset--spacing--40)">Amara and Tom, owners</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column --></div>
<!-- /wp:columns --></div>
<!-- /wp:group -->
