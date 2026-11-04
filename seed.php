<?php
/**
 * Turn a fresh wp-env site into the Fernhouse demo site.
 *
 * Run by `scripts/setup-demo-site.mjs` after `wp-env start`, through
 * `wp eval-file`. Each version of the demo runs once per site: a version
 * number in the options table records which have, so later starts only add
 * what is new, and leave anything changed on the site since alone. Delete the
 * `cnl_demo_site_version` option to run it all again.
 *
 * Everything it adds is additive. It never overwrites a page someone has
 * changed, and only takes over the front page when the site still shows its
 * latest posts there, or a blank Home page from the editor's setup step.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

const CNL_DEMO_SITE_VERSION = 5;

$cnl_demo_installed_version = (int) get_option( 'cnl_demo_site_version' );

if ( $cnl_demo_installed_version >= CNL_DEMO_SITE_VERSION ) {
	WP_CLI::log( 'Demo site already set up, leaving it alone.' );
	return;
}

if ( ! wp_get_theme( 'mainstay' )->exists() ) {
	WP_CLI::warning( 'The Mainstay theme is not installed, so the demo site was not set up.' );
	return;
}

require_once ABSPATH . 'wp-admin/includes/image.php';

/**
 * The site's first administrator, who the demo content is written by.
 *
 * @return int User ID, or 0 if the site has no administrator.
 */
function cnl_demo_author_id() {
	$administrators = get_users(
		array(
			'role'    => 'administrator',
			'orderby' => 'ID',
			'number'  => 1,
			'fields'  => 'ID',
		)
	);

	return $administrators ? (int) $administrators[0] : 0;
}

// `wp eval-file` runs as nobody, and posts take their author from whoever is
// logged in, so the demo's posts and pages would have no author.
wp_set_current_user( cnl_demo_author_id() );

/**
 * Block markup that renders the given theme patterns in order.
 *
 * @param string[] $slugs Pattern slugs, without the `mainstay/` prefix.
 * @return string Block markup.
 */
function cnl_demo_patterns( $slugs ) {
	return implode(
		"\n\n",
		array_map(
			static function ( $slug ) {
				return '<!-- wp:pattern {"slug":"mainstay/' . $slug . '"} /-->';
			},
			$slugs
		)
	);
}

/**
 * The demo pages, each a stack of theme sections about what its title says.
 *
 * The homepage is the exception. It says where you are and what Fernhouse is,
 * then points to the other pages.
 *
 * @return array[] Slug, title and pattern slugs of each page, in menu order.
 */
function cnl_demo_pages() {
	return array(
		array(
			'slug'     => 'home',
			'title'    => 'Home',
			'patterns' => array( 'hero-split', 'services-cards', 'gallery-mosaic', 'testimonial-large', 'posts-latest', 'cta-banner' ),
		),
		array(
			'slug'     => 'about',
			'title'    => 'About',
			'patterns' => array( 'hero-centred', 'about-story', 'text-statement', 'about-values', 'about-stats', 'team-grid' ),
		),
		array(
			'slug'     => 'workshops',
			'title'    => 'Workshops',
			'patterns' => array( 'hero-cover', 'events-list', 'pricing-tiers', 'newsletter' ),
		),
		array(
			'slug'     => 'cafe',
			'title'    => 'Café',
			'patterns' => array( 'hero-collage', 'menu-list', 'gallery-grid', 'cta-image' ),
		),
		array(
			'slug'     => 'visit',
			'title'    => 'Visit',
			'patterns' => array( 'contact-split', 'contact-details', 'text-faq' ),
		),
	);
}

/**
 * Create a page, or fill an existing empty one with the same slug.
 *
 * @param string $slug       Page slug.
 * @param string $title      Page title.
 * @param string $content    Block markup.
 * @param int    $menu_order Position in automatic menus.
 * @return int Page ID, or 0 on failure.
 */
function cnl_demo_page( $slug, $title, $content, $menu_order ) {
	$page = get_page_by_path( $slug, OBJECT, 'page' );

	if ( $page ) {
		if ( '' === trim( $page->post_content ) ) {
			wp_update_post(
				array(
					'ID'           => $page->ID,
					'post_content' => $content,
					'post_status'  => 'publish',
					'menu_order'   => $menu_order,
				)
			);

			// Sections carry their own headings, so the page title stays out
			// of the way, as it does for pages the editor creates.
			if ( ! get_post_meta( $page->ID, '_wp_page_template', true ) ) {
				update_post_meta( $page->ID, '_wp_page_template', 'blank-page' );
			}
		}

		return (int) $page->ID;
	}

	$page_id = wp_insert_post(
		array(
			'post_type'    => 'page',
			'post_status'  => 'publish',
			'post_name'    => $slug,
			'post_title'   => $title,
			'post_content' => $content,
			'menu_order'   => $menu_order,
		),
		true
	);

	return is_wp_error( $page_id ) ? 0 : (int) $page_id;
}

/**
 * Copy one of the theme's bundled images into the media library.
 *
 * Photos are dated an hour back, so the logo, added at the current time, comes
 * first in the media library.
 *
 * @param string $name Image name, without the extension.
 * @param string $alt  Alternative text.
 * @param array  $args Optional `title` and `date` (local time, MySQL format).
 * @return int Attachment ID, or 0 on failure.
 */
function cnl_demo_attachment( $name, $alt, $args = array() ) {
	$existing = get_posts(
		array(
			'post_type'   => 'attachment',
			'post_status' => 'inherit',
			'name'        => 'fernhouse-' . $name,
			'fields'      => 'ids',
			'numberposts' => 1,
		)
	);

	if ( $existing ) {
		return (int) $existing[0];
	}

	$source = wp_get_theme( 'mainstay' )->get_stylesheet_directory() . '/assets/images/' . $name . '.webp';

	if ( ! file_exists( $source ) ) {
		return 0;
	}

	// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- Local theme file.
	$upload = wp_upload_bits( 'fernhouse-' . $name . '.webp', null, file_get_contents( $source ) );

	if ( ! empty( $upload['error'] ) ) {
		return 0;
	}

	$attachment_id = wp_insert_attachment(
		array(
			'post_mime_type' => 'image/webp',
			'post_name'      => 'fernhouse-' . $name,
			'post_title'     => isset( $args['title'] ) ? $args['title'] : ucfirst( str_replace( '-', ' ', $name ) ),
			'post_status'    => 'inherit',
			'post_date'      => isset( $args['date'] ) ? $args['date'] : wp_date( 'Y-m-d H:i:s', time() - HOUR_IN_SECONDS ),
		),
		$upload['file']
	);

	if ( is_wp_error( $attachment_id ) || ! $attachment_id ) {
		return 0;
	}

	wp_update_attachment_metadata( $attachment_id, wp_generate_attachment_metadata( $attachment_id, $upload['file'] ) );
	update_post_meta( $attachment_id, '_wp_attachment_image_alt', $alt );

	return (int) $attachment_id;
}

/**
 * Create a published post with a featured image, unless its slug exists.
 *
 * @param array $post Slug, title, excerpt, content, date, category, image and alt.
 */
function cnl_demo_post( $post ) {
	if ( get_page_by_path( $post['slug'], OBJECT, 'post' ) ) {
		return;
	}

	$category = term_exists( $post['category'], 'category' );

	if ( ! $category ) {
		$category = wp_insert_term( $post['category'], 'category' );
	}

	$post_id = wp_insert_post(
		array(
			'post_type'     => 'post',
			'post_status'   => 'publish',
			'post_name'     => $post['slug'],
			'post_title'    => $post['title'],
			'post_excerpt'  => $post['excerpt'],
			'post_content'  => $post['content'],
			'post_date'     => $post['date'],
			'post_category' => is_wp_error( $category ) ? array() : array( (int) $category['term_id'] ),
		),
		true
	);

	if ( is_wp_error( $post_id ) ) {
		return;
	}

	$attachment_id = cnl_demo_attachment( $post['image'], $post['alt'] );

	if ( $attachment_id ) {
		set_post_thumbnail( $post_id, $attachment_id );
	}
}

/**
 * Paragraph blocks from plain strings.
 *
 * @param string[] $paragraphs Paragraph text.
 * @return string Block markup.
 */
function cnl_demo_paragraphs( $paragraphs ) {
	return implode(
		"\n\n",
		array_map(
			static function ( $text ) {
				return "<!-- wp:paragraph -->\n<p>" . esc_html( $text ) . "</p>\n<!-- /wp:paragraph -->";
			},
			$paragraphs
		)
	);
}

/**
 * Version 1: switch to Mainstay, name the site, and add the pages, posts and
 * menu.
 */
function cnl_demo_content() {
	switch_theme( 'mainstay' );

	update_option( 'blogname', 'Fernhouse' );
	update_option( 'blogdescription', 'Plants, coffee and potting workshops on Mill Lane' );

	// The pages, as stacks of theme sections.
	$home_id = 0;

	foreach ( cnl_demo_pages() as $menu_order => $page ) {
		$page_id = cnl_demo_page( $page['slug'], $page['title'], cnl_demo_patterns( $page['patterns'] ), $menu_order );

		if ( 'home' === $page['slug'] ) {
			$home_id = $page_id;
		}
	}

	// Only take over the front page if nobody has chosen one yet.
	$show_on_front = get_option( 'show_on_front' );
	$page_on_front = (int) get_option( 'page_on_front' );

	if ( $home_id && ( 'posts' === $show_on_front || $page_on_front === $home_id || ! $page_on_front ) ) {
		update_option( 'show_on_front', 'page' );
		update_option( 'page_on_front', $home_id );
	}

	// WordPress's sample content would sit oddly next to the demo, so it goes
	// unless someone has edited it.
	foreach ( array( array( 'sample-page', 'page' ), array( 'hello-world', 'post' ) ) as $sample ) {
		$sample_post = get_page_by_path( $sample[0], OBJECT, $sample[1] );

		if ( $sample_post && $sample_post->post_modified_gmt === $sample_post->post_date_gmt ) {
			wp_trash_post( $sample_post->ID );
		}
	}

	// A few journal posts, so the posts sections have something to show.
	$demo_posts = array(
		array(
			'slug'     => 'how-to-repot-a-plant-without-the-sulk',
			'title'    => 'How to repot a plant without the sulk',
			'excerpt'  => 'Spring is the time to give your plants more room. Here is how we do it in the shop, and what to expect in the week after.',
			'category' => 'Plant care',
			'image'    => 'trowel-and-soil',
			'alt'      => 'A trowel, a pot and fresh compost on a table',
			'date'     => '2026-09-28 09:00:00',
			'content'  => cnl_demo_paragraphs(
				array(
					'Most plants want a new pot every year or two, when roots start to circle the bottom or poke out of the drainage holes. Go up one size, no more. A pot that is too big holds water the roots can\'t reach yet, and that is how rot starts.',
					'Water the day before, so the root ball slides out in one piece. Loosen the outer roots with your fingers, sit the plant at the same depth it was before, and fill around it with fresh compost. Press it down gently and water it in.',
					'Expect a week of drooping. That is the plant settling, not dying. Keep it out of direct sun, hold off on feeding for a month, and it will be back to itself before you know it.',
				)
			),
		),
		array(
			'slug'     => 'our-autumn-workshops-are-booking-now',
			'title'    => 'Our autumn workshops are booking now',
			'excerpt'  => 'Terrariums, wreaths and a new evening class for complete beginners. Places are small, so they go quickly.',
			'category' => 'Workshops',
			'image'    => 'hands-in-soil',
			'alt'      => 'Two hands holding a scoop of dark soil',
			'date'     => '2026-10-02 09:00:00',
			'content'  => cnl_demo_paragraphs(
				array(
					'This season we are running our terrarium mornings every other Saturday, wreath making from the middle of November, and something new: a Thursday evening class for people who have never kept a plant alive.',
					'Every workshop is eight people at most, with tea, cake and everything you need included. You take home what you make.',
					'Book online or at the till. If a date is full, ask us to put you on the list, as places often come back.',
				)
			),
		),
		array(
			'slug'     => 'the-flowers-we-cant-stop-buying-this-month',
			'title'    => 'The flowers we can\'t stop buying this month',
			'excerpt'  => 'Cornflowers, late dahlias and a bucket of carnations that changed our minds about carnations.',
			'category' => 'Flowers',
			'image'    => 'cornflowers',
			'alt'      => 'A bunch of bright blue cornflowers',
			'date'     => '2026-10-09 09:00:00',
			'content'  => cnl_demo_paragraphs(
				array(
					'Every week our growers send a list, and every week we order more than we meant to. This month it has been cornflowers, the last of the dahlias, and carnations, which we used to walk straight past.',
					'Grown locally and cut the day before, they last far longer than you would think. Strip the lower leaves, recut the stems at an angle and change the water every couple of days.',
					'Come in early on Saturdays for the best of the buckets.',
				)
			),
		),
	);

	foreach ( $demo_posts as $demo_post ) {
		cnl_demo_post( $demo_post );
	}

	// A menu, if the site has none, listing the pages in their menu order.
	$has_navigation = get_posts(
		array(
			'post_type'   => 'wp_navigation',
			'post_status' => array( 'publish', 'draft' ),
			'fields'      => 'ids',
			'numberposts' => 1,
		)
	);

	if ( ! $has_navigation ) {
		wp_insert_post(
			array(
				'post_type'    => 'wp_navigation',
				'post_status'  => 'publish',
				'post_name'    => 'main-menu',
				'post_title'   => 'Main menu',
				'post_content' => '<!-- wp:page-list /-->',
			)
		);
	}
}

/**
 * Version 2: the rest of the theme's photos, and a logo to pick, in the media
 * library. Photos already there, such as the posts' featured images, are
 * left as they are.
 */
function cnl_demo_media_library() {
	$photos = array(
		'aloe-in-white-pot'    => 'A small aloe in a white square pot',
		'bakery-counter'       => 'A bakery counter piled with loaves and pastries',
		'breakfast-croissants' => 'Croissants on a table with cups of coffee and a pot of jam',
		'bright-cafe'          => 'A bright café with a big menu board on the wall and two bikes leaning against the counter',
		'carnations'           => 'A bunch of pink and red carnations on a pale background',
		'ceramics-shelf'       => 'Wooden shelves stacked with white and natural clay bowls and cups',
		'coffee-on-table'      => 'A flat white on a wooden table, seen from above',
		'coffee-sign'          => 'A lit coffee sign above a busy café counter',
		'cornflowers'          => 'A bunch of bright blue cornflowers',
		'croissant-tray'       => 'A tray of fresh croissants on the café counter',
		'daisies-in-tin'       => 'Daisies in a tin on a wooden table',
		'flower-buckets'       => 'Galvanised buckets of orange, yellow and pink cut flowers outside the shop',
		'flower-shop-front'    => 'A shop front with buckets of flowers and plants spilling onto the pavement',
		'flowers-on-stool'     => 'Sunflowers and a fern in a glass jar on a wooden stool',
		'glasshouse'           => 'Plants growing inside an old glasshouse with an iron frame',
		'greenhouse-interior'  => 'Sunlight falling through the glass roof of a greenhouse full of plants',
		'greenhouse-palms'     => 'Tall palms growing under a glass roof',
		'hands-in-soil'        => 'Two hands holding a scoop of dark soil',
		'holding-bouquet'      => 'A woman holding a big bouquet of summer flowers in the sunshine',
		'latte-and-croissant'  => 'A latte with a leaf drawn in the foam next to a croissant, seen from above',
		'latte-art'            => 'A latte with a leaf pattern in the foam, in a white cup',
		'open-sign'            => 'An open sign hanging in the shop window',
		'portrait-amara'       => 'Amara, smiling widely',
		'portrait-george'      => 'George, an older man with his arms crossed',
		'portrait-jo'          => 'Jo, smiling, in a pink top',
		'portrait-lena'        => 'Lena, with sunglasses pushed up into her hair',
		'portrait-ruth'        => 'Ruth, who has short dark hair',
		'portrait-tom'         => 'Tom, in a red jumper with his arms crossed',
		'pottery-wheel'        => 'A potter shaping clay on a wheel',
		'shelf-with-print'     => 'A framed print and a potted plant on a white shelf',
		'spider-plant'         => 'A spider plant in a white pot on a wooden table',
		'succulent-rosette'    => 'Close-up of a pink and blue succulent rosette',
		'succulents'           => 'Close-up of dusty blue succulents',
		'trowel-and-soil'      => 'A trowel, a pot and fresh compost on a table',
		'tulips-and-iris'      => 'A loose arrangement of pink tulips and purple iris on a wooden table',
		'wall-planters'        => 'Two wooden wall planters filled with small trailing plants on a dark wall',
		'white-shelf'          => 'A white shelf and a wire chair in a bright room',
	);

	foreach ( $photos as $name => $alt ) {
		$args = array();

		if ( 0 === strpos( $name, 'portrait-' ) ) {
			$args['title'] = 'Portrait of ' . ucfirst( substr( $name, strlen( 'portrait-' ) ) );
		}

		cnl_demo_attachment( $name, $alt, $args );
	}

	// Only added to the library, not set as the site logo, so picking one is
	// still left to whoever is trying the editor.
	cnl_demo_attachment(
		'logo',
		'Fernhouse',
		array(
			'title' => 'Fernhouse logo',
			'date'  => current_time( 'mysql' ),
		)
	);

	// The media modal opens on Upload files until someone has used the
	// library, which would hide the logo. Start admins on the library instead,
	// unless they have already picked a tab.
	foreach ( get_users( array( 'role' => 'administrator', 'fields' => 'ID' ) ) as $user_id ) {
		wp_parse_str( (string) get_user_option( 'user-settings', $user_id ), $settings );

		if ( isset( $settings['libraryContent'] ) ) {
			continue;
		}

		$settings['libraryContent'] = 'browse';
		update_user_option( $user_id, 'user-settings', build_query( $settings ), false );
		update_user_option( $user_id, 'user-settings-time', time(), false );
	}
}

/**
 * Version 3: keep each page to what its title says. Version 1 gave some pages
 * sections about other things, such as a plant subscription on Workshops, so
 * pages still exactly as it left them get their new sections. Pages changed
 * since are left alone.
 */
function cnl_demo_page_sections() {
	$version_1_patterns = array(
		'home'      => array( 'hero-split', 'services-cards', 'about-story', 'gallery-mosaic', 'testimonial-large', 'events-list', 'posts-latest', 'cta-banner' ),
		'about'     => array( 'hero-centred', 'text-statement', 'about-values', 'about-stats', 'team-grid', 'testimonials-grid' ),
		'workshops' => array( 'hero-cover', 'events-list', 'pricing-tiers', 'text-faq', 'newsletter' ),
		'visit'     => array( 'contact-split', 'contact-details', 'services-list', 'text-faq' ),
	);

	foreach ( cnl_demo_pages() as $page ) {
		if ( ! isset( $version_1_patterns[ $page['slug'] ] ) ) {
			continue;
		}

		$existing = get_page_by_path( $page['slug'], OBJECT, 'page' );

		if ( $existing && cnl_demo_patterns( $version_1_patterns[ $page['slug'] ] ) === $existing->post_content ) {
			wp_update_post(
				array(
					'ID'           => $existing->ID,
					'post_content' => cnl_demo_patterns( $page['patterns'] ),
				)
			);
		}
	}
}

/**
 * Version 4: give the posts and pages earlier versions added an author, as
 * they were added with none. Only posts and pages without an author change.
 */
function cnl_demo_post_authors() {
	global $wpdb;

	$author_id = cnl_demo_author_id();

	if ( ! $author_id ) {
		return;
	}

	// Not `get_posts()`, which takes an author of 0 to mean anyone.
	$authorless = $wpdb->get_col( "SELECT ID FROM {$wpdb->posts} WHERE post_author = 0 AND post_type IN ( 'post', 'page' )" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery

	foreach ( $authorless as $post_id ) {
		// Straight to the table, so the post's modified date stays as it was.
		$wpdb->update( $wpdb->posts, array( 'post_author' => $author_id ), array( 'ID' => $post_id ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
		clean_post_cache( $post_id );
	}
}

/**
 * Version 5: a Grid layouts page, to try the grid stack of Gutenberg pull
 * requests (https://github.com/WordPress/gutenberg/stack/85397) on. Its
 * sections are grids with blocks placed by hand, which Gutenberg only offers
 * with its grid interactivity and block rotation experiments on, so they are
 * turned on too, keeping any other experiment as it was.
 */
function cnl_demo_grid_layouts() {
	$experiments = get_option( 'gutenberg-experiments' );
	$experiments = is_array( $experiments ) ? $experiments : array();

	$experiments['gutenberg-grid-interactivity'] = '1';
	$experiments['gutenberg-block-rotation']     = '1';
	update_option( 'gutenberg-experiments', $experiments );

	cnl_demo_page(
		'grid-layouts',
		'Grid layouts',
		cnl_demo_patterns( array( 'grid-hero', 'grid-bento', 'grid-collage', 'grid-cards', 'grid-team' ) ),
		count( cnl_demo_pages() )
	);
}

if ( $cnl_demo_installed_version < 1 ) {
	cnl_demo_content();
}

if ( $cnl_demo_installed_version < 2 ) {
	cnl_demo_media_library();
}

if ( $cnl_demo_installed_version < 3 ) {
	cnl_demo_page_sections();
}

if ( $cnl_demo_installed_version < 4 ) {
	cnl_demo_post_authors();
}

if ( $cnl_demo_installed_version < 5 ) {
	cnl_demo_grid_layouts();
}

update_option( 'cnl_demo_site_version', CNL_DEMO_SITE_VERSION );

WP_CLI::success( 'Set up the Fernhouse demo site with the Mainstay theme.' );
