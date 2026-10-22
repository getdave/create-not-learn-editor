<?php
/**
 * Title: Services in cards
 * Slug: mainstay/services-cards
 * Categories: services
 * Keywords: services, cards, columns, offer, what we do
 * Viewport width: 1400
 * Description: A heading and short introduction above three columns, each with a picture, a title, a sentence and a link.
 *
 * @package Mainstay
 */

?>
<!-- wp:group {"metadata":{"name":"Services"},"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"},"blockGap":"var:preset|spacing|50"}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)"><!-- wp:group {"align":"wide","style":{"spacing":{"blockGap":"var:preset|spacing|30"}},"layout":{"type":"constrained","justifyContent":"left"}} -->
<div class="wp-block-group alignwide"><!-- wp:heading -->
<h2 class="wp-block-heading">What you'll find at Fernhouse</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>A plant shop, a café and a weekend workshop, all under one roof on Mill Lane. Most people come in for one and end up staying for the other two.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group -->

<!-- wp:columns {"align":"wide","style":{"spacing":{"blockGap":{"top":"var:preset|spacing|50","left":"var:preset|spacing|40"}}}} -->
<div class="wp-block-columns alignwide"><!-- wp:column {"style":{"spacing":{"blockGap":"var:preset|spacing|30"}}} -->
<div class="wp-block-column"><!-- wp:image {"aspectRatio":"4/3","scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft"} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'spider-plant' ) ); ?>" alt="A spider plant in a white pot on a wooden table" style="aspect-ratio:4/3;object-fit:cover"/></figure>
<!-- /wp:image -->

<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">The shop</h3>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>House plants big and small, cut flowers every Friday and pots made by potters in the valley.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p><a href="<?php echo esc_url( mainstay_page_url( 'visit' ) ); ?>">Come and have a look</a></p>
<!-- /wp:paragraph --></div>
<!-- /wp:column -->

<!-- wp:column {"style":{"spacing":{"blockGap":"var:preset|spacing|30"}}} -->
<div class="wp-block-column"><!-- wp:image {"aspectRatio":"4/3","scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft"} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'latte-and-croissant' ) ); ?>" alt="A latte with a leaf drawn in the foam next to a croissant, seen from above" style="aspect-ratio:4/3;object-fit:cover"/></figure>
<!-- /wp:image -->

<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">The café</h3>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Good coffee and bakes made each morning. Sit among the plants for as long as you like.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p><a href="<?php echo esc_url( mainstay_page_url( 'cafe', 'menu' ) ); ?>">Look at the café menu</a></p>
<!-- /wp:paragraph --></div>
<!-- /wp:column -->

<!-- wp:column {"style":{"spacing":{"blockGap":"var:preset|spacing|30"}}} -->
<div class="wp-block-column"><!-- wp:image {"aspectRatio":"4/3","scale":"cover","sizeSlug":"full","linkDestination":"none","className":"is-style-mainstay-soft"} -->
<figure class="wp-block-image size-full is-style-mainstay-soft"><img src="<?php echo esc_url( mainstay_image( 'trowel-and-soil' ) ); ?>" alt="A trowel, a terracotta pot and a heap of potting soil laid out on a table" style="aspect-ratio:4/3;object-fit:cover"/></figure>
<!-- /wp:image -->

<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Workshops</h3>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Small weekend classes in potting, terrariums and flower arranging. Everything you need is on the table.</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p><a href="<?php echo esc_url( mainstay_page_url( 'workshops', 'dates' ) ); ?>">See upcoming workshops</a></p>
<!-- /wp:paragraph --></div>
<!-- /wp:column --></div>
<!-- /wp:columns --></div>
<!-- /wp:group -->
