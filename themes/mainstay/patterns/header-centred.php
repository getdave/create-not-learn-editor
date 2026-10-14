<?php
/**
 * Title: Centred header
 * Slug: mainstay/header-centred
 * Categories: header
 * Block Types: core/template-part/header
 * Viewport width: 1400
 * Description: Logo and a large site name in the middle, the menu centred below and a thin line underneath.
 *
 * @package Mainstay
 */

?>
<!-- wp:group {"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|40"},"blockGap":"var:preset|spacing|40"}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--40)"><!-- wp:group {"align":"wide","style":{"spacing":{"blockGap":"var:preset|spacing|30"}},"layout":{"type":"flex","orientation":"vertical","justifyContent":"center"}} -->
<div class="wp-block-group alignwide"><!-- wp:group {"style":{"spacing":{"blockGap":"0.75rem"}},"layout":{"type":"flex","flexWrap":"nowrap","justifyContent":"center"}} -->
<div class="wp-block-group"><!-- wp:site-logo {"width":56,"shouldSyncIcon":true} /-->

<!-- wp:site-title {"level":0,"fontSize":"x-large"} /--></div>
<!-- /wp:group -->

<!-- wp:navigation {"layout":{"type":"flex","justifyContent":"center"}} /--></div>
<!-- /wp:group -->

<!-- wp:separator {"align":"full"} -->
<hr class="wp-block-separator alignfull has-alpha-channel-opacity"/>
<!-- /wp:separator --></div>
<!-- /wp:group -->
