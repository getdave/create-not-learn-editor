<?php
/**
 * Title: Contact with picture
 * Slug: mainstay/contact-split
 * Categories: contact
 * Keywords: contact, get in touch, email, phone, social, say hello
 * Viewport width: 1400
 * Description: A big heading, a short note, email, phone and social links beside a tall picture with an arched top.
 *
 * @package Mainstay
 */

?>
<!-- wp:group {"metadata":{"name":"Contact"},"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)"><!-- wp:columns {"verticalAlignment":"center","align":"wide","style":{"spacing":{"blockGap":{"top":"var:preset|spacing|50","left":"var:preset|spacing|60"}}}} -->
<div class="wp-block-columns alignwide are-vertically-aligned-center"><!-- wp:column {"verticalAlignment":"center","width":"56%","style":{"spacing":{"blockGap":"var:preset|spacing|40"}}} -->
<div class="wp-block-column is-vertically-aligned-center" style="flex-basis:56%"><!-- wp:heading {"fontSize":"xx-large"} -->
<h2 class="wp-block-heading has-xx-large-font-size">Come and say hello</h2>
<!-- /wp:heading -->

<!-- wp:paragraph {"fontSize":"large"} -->
<p class="has-large-font-size">Pop in, give us a ring or drop us a line. Whether it's a sad-looking fern or a question about a workshop, one of us will get back to you the same day.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p><a href="mailto:hello@fernhouse.co.uk">hello@fernhouse.co.uk</a><br><a href="tel:+441422845210">01422 845 210</a></p>
<!-- /wp:paragraph -->

<!-- wp:social-links {"className":"is-style-logos-only","style":{"spacing":{"blockGap":{"left":"1rem"}}}} -->
<ul class="wp-block-social-links is-style-logos-only"><!-- wp:social-link {"url":"#","service":"instagram"} /-->

<!-- wp:social-link {"url":"#","service":"facebook"} /-->

<!-- wp:social-link {"url":"#","service":"tiktok"} /--></ul>
<!-- /wp:social-links --></div>
<!-- /wp:column -->

<!-- wp:column {"verticalAlignment":"center","width":"44%"} -->
<div class="wp-block-column is-vertically-aligned-center" style="flex-basis:44%"><!-- wp:image {"aspectRatio":"4/5","scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-arch"} -->
<figure class="wp-block-image size-full is-style-mainstay-arch"><img src="<?php echo esc_url( mainstay_image( 'bright-cafe' ) ); ?>" alt="A bright café with a big menu board on the wall and two bikes leaning against the counter" style="aspect-ratio:4/5;object-fit:cover"/></figure>
<!-- /wp:image --></div>
<!-- /wp:column --></div>
<!-- /wp:columns --></div>
<!-- /wp:group -->
