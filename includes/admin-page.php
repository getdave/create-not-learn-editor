<?php
/**
 * Admin page registration and rendering.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register admin page hooks.
 */
function cnl_editor_register_admin_page_hooks() {
	add_action( 'admin_menu', 'cnl_editor_register_admin_menu' );
	add_action( 'admin_init', 'cnl_editor_intercept_full_page_render' );
}

/**
 * Register the hidden full-page editor and visible Appearance link.
 */
function cnl_editor_register_admin_menu() {
	$GLOBALS['cnl_editor_admin_hook'] = add_submenu_page(
		'nothing',
		__( 'Create Not Learn Editor', 'create-not-learn-editor' ),
		__( 'Create Not Learn Editor', 'create-not-learn-editor' ),
		'edit_theme_options',
		CNL_EDITOR_SLUG,
		'cnl_editor_render_full_page'
	);

	global $submenu;

	if ( isset( $submenu['themes.php'] ) ) {
		$submenu['themes.php'][] = array(
			__( 'Create Not Learn', 'create-not-learn-editor' ),
			'edit_theme_options',
			'admin.php?page=' . CNL_EDITOR_SLUG,
		);
	}
}

/**
 * Check whether this request is for the full-page editor.
 *
 * @return bool Whether this is the full-page editor request.
 */
function cnl_editor_is_full_page_request() {
	$page = filter_input( INPUT_GET, 'page', FILTER_SANITIZE_FULL_SPECIAL_CHARS );

	return CNL_EDITOR_SLUG === $page;
}

/**
 * Render the full-page editor before WordPress prints the standard admin shell.
 */
function cnl_editor_intercept_full_page_render() {
	if ( cnl_editor_is_full_page_request() ) {
		cnl_editor_render_full_page();
	}
}

/**
 * Reset the per-request editor route and menu registries.
 */
function cnl_editor_reset_editor_registry() {
	$GLOBALS['cnl_editor_routes']     = array();
	$GLOBALS['cnl_editor_menu_items'] = array();
}

/**
 * Register a route for the Create Not Learn full-page editor.
 *
 * @param string      $path           Route path.
 * @param string|null $content_module Script module ID for stage/inspector content.
 * @param string|null $route_module   Script module ID for route lifecycle hooks.
 */
function cnl_editor_register_route( $path, $content_module = null, $route_module = null ) {
	$route = array( 'path' => $path );
	if ( ! empty( $content_module ) ) {
		$route['content_module'] = $content_module;
	}
	if ( ! empty( $route_module ) ) {
		$route['route_module'] = $route_module;
	}

	$GLOBALS['cnl_editor_routes'][] = $route;
}

/**
 * Register a menu item for the Create Not Learn full-page editor.
 *
 * @param string $id          Menu item ID.
 * @param string $label       Menu item label.
 * @param string $to          Route path.
 * @param string $parent_id   Optional parent item ID.
 * @param string $parent_type Optional parent type.
 * @param string $icon        Optional dashicon class.
 */
function cnl_editor_register_menu_item( $id, $label, $to, $parent_id = '', $parent_type = '', $icon = '' ) {
	$menu_item = array(
		'id'    => $id,
		'label' => $label,
		'to'    => $to,
	);

	if ( ! empty( $icon ) ) {
		$menu_item['icon'] = $icon;
	}

	if ( ! empty( $parent_id ) ) {
		$menu_item['parent'] = $parent_id;
	}

	if ( ! empty( $parent_type ) && in_array( $parent_type, array( 'drilldown', 'dropdown' ), true ) ) {
		$menu_item['parent_type'] = $parent_type;
	}

	$GLOBALS['cnl_editor_menu_items'][] = $menu_item;
}

/**
 * Get registered full-page editor routes.
 *
 * @return array[] Registered routes.
 */
function cnl_editor_get_registered_routes() {
	return $GLOBALS['cnl_editor_routes'] ?? array();
}

/**
 * Get registered full-page editor menu items.
 *
 * @return array[] Registered menu items.
 */
function cnl_editor_get_registered_menu_items() {
	return $GLOBALS['cnl_editor_menu_items'] ?? array();
}

/**
 * Register the plugin's default routes and menu items.
 */
function cnl_editor_register_default_routes_and_menu() {
	foreach ( cnl_editor_get_routes() as $route ) {
		cnl_editor_register_route(
			$route['path'],
			$route['content_module'] ?? null,
			$route['route_module'] ?? null
		);
	}

	foreach ( cnl_editor_get_menu_items() as $item ) {
		cnl_editor_register_menu_item(
			$item['id'],
			$item['label'],
			$item['to'],
			$item['parent'] ?? '',
			$item['parent_type'] ?? '',
			$item['icon'] ?? ''
		);
	}
}
add_action( CNL_EDITOR_SLUG . '_init', 'cnl_editor_register_default_routes_and_menu', 5 );

/**
 * Get the visual theme layered on top of the design system.
 *
 * @return string Theme name: 'modern' or 'default'.
 */
function cnl_editor_get_ui_theme() {
	/**
	 * Filters the visual theme for the full-page editor.
	 *
	 * @param string $theme Theme name: 'modern' or 'default'.
	 */
	$theme = apply_filters( CNL_EDITOR_SLUG . '_ui_theme', CNL_EDITOR_UI_THEME );

	return in_array( $theme, array( 'modern', 'default' ), true ) ? $theme : 'default';
}

/**
 * Get the name to greet the user by: their first name, or their nickname.
 *
 * WordPress sets the nickname to the username until someone changes it, so
 * an untouched nickname is skipped rather than greeting people by login.
 *
 * @param WP_User $user User to greet.
 * @return string First name, nickname, or an empty string.
 */
function cnl_editor_get_greeting_name( $user ) {
	$first_name = trim( (string) $user->first_name );
	if ( '' !== $first_name ) {
		return $first_name;
	}

	$nickname = trim( (string) $user->nickname );
	if ( '' !== $nickname && $nickname !== $user->user_login ) {
		return $nickname;
	}

	return '';
}

/**
 * Get settings for the editor app.
 *
 * @return array App settings.
 */
function cnl_editor_get_app_settings() {
	$navigation_post_type = get_post_type_object( 'wp_navigation' );
	$theme                = wp_get_theme();
	$current_user         = wp_get_current_user();
	$lazy_editor_file     = WP_PLUGIN_DIR . '/gutenberg/build/modules/lazy-editor/index.js';
	$lazy_editor_version  = file_exists( $lazy_editor_file )
		? filemtime( $lazy_editor_file )
		: CNL_EDITOR_VERSION;

	return array(
		'version'             => CNL_EDITOR_VERSION,
		'minGutenberg'       => CNL_EDITOR_MIN_GUTENBERG_VERSION,
		'gutenbergVersion'   => defined( 'GUTENBERG_VERSION' ) ? GUTENBERG_VERSION : null,
		'restNamespace'      => CNL_EDITOR_REST_NAMESPACE,
		'restRoot'           => esc_url_raw( rest_url() ),
		'nonce'              => wp_create_nonce( 'wp_rest' ),
		'adminUrl'           => admin_url(),
		'homeUrl'            => home_url( '/' ),
		'lazyEditorModuleUrl' => add_query_arg(
			'ver',
			$lazy_editor_version,
			plugins_url( 'gutenberg/build/modules/lazy-editor/index.js' )
		),
		'siteName'           => get_bloginfo( 'name' ),
		'userName'           => cnl_editor_get_greeting_name( $current_user ),
		'uiTheme'            => cnl_editor_get_ui_theme(),
		'themeName'          => $theme->get( 'Name' ),
		'showOnFront'        => get_option( 'show_on_front' ),
		'pageOnFront'        => (int) get_option( 'page_on_front' ),
		'postTypes'          => cnl_editor_get_content_post_type_data(),
		'editablePostTypes'  => cnl_editor_get_editable_post_type_data(),
		'navigationRestBase' => $navigation_post_type && $navigation_post_type->rest_base
			? $navigation_post_type->rest_base
			: 'navigation',
	);
}

/**
 * Preload REST API data used by boot-based editor pages.
 */
function cnl_editor_preload_data() {
	$preload_paths = array(
		'/?_fields=description,gmt_offset,home,image_sizes,image_size_threshold,name,site_icon,site_icon_url,site_logo,timezone_string,url,page_for_posts,page_on_front,show_on_front',
		array( '/wp/v2/settings', 'OPTIONS' ),
	);

	$preload_data = array_reduce(
		$preload_paths,
		'rest_preload_api_request',
		array()
	);

	wp_add_inline_script(
		'wp-api-fetch',
		sprintf(
			'wp.apiFetch.use( wp.apiFetch.createPreloadingMiddleware( %s ) );',
			wp_json_encode( $preload_data )
		),
		'after'
	);
}

/**
 * Get classic script dependencies required before script modules execute.
 *
 * @param array $boot_asset Gutenberg boot module asset metadata.
 * @return string[] Script handles.
 */
function cnl_editor_get_prerequisite_script_dependencies( $boot_asset ) {
	$script_deps = $boot_asset['dependencies'] ?? array();

	foreach ( cnl_editor_get_route_module_assets() as $asset ) {
		$script_deps = array_merge( $script_deps, $asset['dependencies'] ?? array() );
	}

	$script_deps = array_merge(
		$script_deps,
		array(
			'wp-api-fetch',
			'wp-components',
			'wp-element',
			'wp-i18n',
			'wp-url',
		)
	);

	return array_values( array_unique( $script_deps ) );
}

/**
 * Enqueue scripts and styles for the full-page editor document.
 *
 * @param array[] $routes     Registered routes.
 * @param array[] $menu_items Registered menu items.
 * @return bool Whether runtime assets were found and enqueued.
 */
function cnl_editor_enqueue_full_page_assets( $routes, $menu_items ) {
	$loader_file = CNL_EDITOR_PATH . 'build/pages/' . CNL_EDITOR_SLUG . '/loader.js';

	if ( ! file_exists( $loader_file ) ) {
		return false;
	}

	if ( function_exists( 'wp_enqueue_command_palette_assets' ) ) {
		wp_enqueue_command_palette_assets();
	}

	wp_enqueue_media();

	cnl_editor_preload_data();
	cnl_editor_register_boot_modules( $routes );
	cnl_editor_enqueue_built_styles();
	cnl_editor_enqueue_ui_theme_fonts();

	$boot_asset  = cnl_editor_get_gutenberg_boot_asset();
	$script_deps = cnl_editor_get_prerequisite_script_dependencies( $boot_asset );

	wp_register_script(
		'cnl-editor-prerequisites',
		'',
		$script_deps,
		$boot_asset['version'] ?? CNL_EDITOR_VERSION,
		true
	);

	wp_add_inline_script(
		'cnl-editor-prerequisites',
		'window.createNotLearnEditor = ' . wp_json_encode( cnl_editor_get_app_settings() ) . ';',
		'before'
	);

	wp_add_inline_script(
		'cnl-editor-prerequisites',
		sprintf(
			'import("@wordpress/boot").then((mod) => mod.init({ mountId: %s, menuItems: %s, routes: %s, initModules: %s, dashboardLink: %s }));',
			wp_json_encode( 'create-not-learn-editor-app' ),
			wp_json_encode( $menu_items, JSON_HEX_TAG | JSON_UNESCAPED_SLASHES ),
			wp_json_encode( $routes, JSON_HEX_TAG | JSON_UNESCAPED_SLASHES ),
			wp_json_encode( array( '@create-not-learn-editor/app-init' ), JSON_HEX_TAG | JSON_UNESCAPED_SLASHES ),
			wp_json_encode( admin_url( '/' ) )
		),
		'after'
	);

	$style_dependencies = array_filter(
		$script_deps,
		static function ( $handle ) {
			return wp_style_is( $handle, 'registered' );
		}
	);

	wp_register_style(
		'cnl-editor-prerequisites',
		false,
		$style_dependencies,
		$boot_asset['version'] ?? CNL_EDITOR_VERSION
	);

	wp_enqueue_script( 'cnl-editor-prerequisites' );
	wp_enqueue_script_module( CNL_EDITOR_SLUG );
	wp_enqueue_style( 'cnl-editor-prerequisites' );
	cnl_editor_register_lazy_editor_compat_module();

	return true;
}

/**
 * Render the editor as a generated full-page admin document.
 */
function cnl_editor_render_full_page() {
	if ( ! current_user_can( 'edit_theme_options' ) ) {
		wp_die( esc_html__( 'Sorry, you are not allowed to access this page.', 'create-not-learn-editor' ) );
	}

	set_current_screen();
	remove_action( 'admin_head', 'wp_admin_bar_header' );

	foreach ( wp_scripts()->queue as $script ) {
		wp_dequeue_script( $script );
	}
	foreach ( wp_styles()->queue as $style ) {
		wp_dequeue_style( $style );
	}

	cnl_editor_reset_editor_registry();

	/**
	 * Fires when the full-page editor is initialized so extensions can register
	 * routes and menu items.
	 */
	do_action( CNL_EDITOR_SLUG . '_init' );

	$menu_items   = cnl_editor_get_registered_menu_items();
	$routes       = cnl_editor_get_registered_routes();
	$assets_ready = cnl_editor_enqueue_full_page_assets( $routes, $menu_items );

	?>
	<!DOCTYPE html>
	<html <?php language_attributes(); ?>>
	<head>
		<meta charset="<?php bloginfo( 'charset' ); ?>">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<title><?php echo esc_html( get_admin_page_title() ); ?></title>
		<style>
			html {
				background: #f1f1f1;
				color: #444;
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
				font-size: 13px;
				line-height: 1.4em;
			}
			body {
				margin: 0;
			}
			#wpadminbar {
				display: none;
			}
		</style>
	<?php
	global $hook_suffix;
	// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
	$hook_suffix = CNL_EDITOR_SLUG;

	cnl_editor_print_ui_theme_font_preload();
	print_admin_styles();
	print_head_scripts();

	/** This action is documented in wp-admin/admin-header.php */
	do_action( "admin_head-{$hook_suffix}" );

	/** This action is documented in wp-admin/admin-header.php */
	do_action( 'admin_head' );
	?>
	</head>
	<body class="<?php echo esc_attr( 'create-not-learn-editor cnl-ui-theme-' . cnl_editor_get_ui_theme() ); ?>"<?php echo 'modern' === cnl_editor_get_ui_theme() ? ' data-wpds-corner-radius="moderate"' : ''; ?>>
		<div id="create-not-learn-editor-app" style="height: 100vh; box-sizing: border-box;">
			<?php if ( ! $assets_ready ) : ?>
				<div class="cnl-editor-loading">
					<?php esc_html_e( 'Create Not Learn Editor assets are missing. Run npm install and npm run build in the plugin directory.', 'create-not-learn-editor' ); ?>
				</div>
			<?php endif; ?>
		</div>
	<?php
	/** This action is documented in wp-admin/admin-footer.php */
	do_action( 'admin_footer', '' );

	cnl_editor_register_lazy_editor_compat_module();
	wp_script_modules()->print_import_map();
	print_footer_scripts();
	wp_script_modules()->print_enqueued_script_modules();
	wp_script_modules()->print_script_module_preloads();
	wp_script_modules()->print_script_module_data();

	/** This action is documented in wp-admin/admin-footer.php */
	do_action( "admin_footer-{$hook_suffix}" );
	?>
	</body>
	</html>
	<?php
	exit;
}

/**
 * Get the Gutenberg boot module asset metadata.
 *
 * @return array Asset metadata.
 */
function cnl_editor_get_gutenberg_boot_asset() {
	$asset_file = WP_PLUGIN_DIR . '/gutenberg/build/modules/boot/index.min.asset.php';

	if ( file_exists( $asset_file ) ) {
		return require $asset_file;
	}

	return array(
		'dependencies' => array(
			'wp-components',
			'wp-core-data',
			'wp-data',
			'wp-editor',
			'wp-element',
			'wp-i18n',
			'wp-url',
		),
		'version'      => CNL_EDITOR_VERSION,
	);
}

/**
 * Get all built route module asset arrays.
 *
 * @return array[] Asset metadata.
 */
function cnl_editor_get_route_module_assets() {
	$assets = array();

	foreach ( cnl_editor_get_module_map() as $module ) {
		$asset_file = CNL_EDITOR_PATH . 'build/' . $module['path'] . '.asset.php';
		if ( file_exists( $asset_file ) ) {
			$assets[] = require $asset_file;
		}
	}

	return $assets;
}

/**
 * Register this plugin's script modules.
 *
 * @param array[] $routes Registered route definitions.
 */
function cnl_editor_register_boot_modules( $routes = null ) {
	if ( null === $routes ) {
		$routes = cnl_editor_get_routes();
	}

	foreach ( cnl_editor_get_module_map() as $module ) {
		if ( '@wordpress/lazy-editor' === $module['id'] ) {
			cnl_editor_register_lazy_editor_compat_module();
			continue;
		}
		cnl_editor_register_script_module_from_build( $module['id'], $module['path'] );
	}

	$boot_dependencies = array(
		array(
			'id'     => '@wordpress/boot',
			'import' => 'static',
		),
		array(
			'id'     => '@create-not-learn-editor/app-init',
			'import' => 'static',
		),
	);

	foreach ( $routes as $route ) {
		if ( isset( $route['route_module'] ) ) {
			$boot_dependencies[] = array(
				'id'     => $route['route_module'],
				'import' => 'static',
			);
		}

		if ( isset( $route['content_module'] ) ) {
			$boot_dependencies[] = array(
				'id'     => $route['content_module'],
				'import' => 'dynamic',
			);
		}
	}

	/**
	 * Filters boot script-module dependencies for the full-page editor.
	 *
	 * @param array $boot_dependencies Boot dependencies for the page.
	 */
	$boot_dependencies = apply_filters(
		CNL_EDITOR_SLUG . '_boot_dependencies',
		$boot_dependencies
	);

	wp_register_script_module(
		CNL_EDITOR_SLUG,
		CNL_EDITOR_URL . 'build/pages/' . CNL_EDITOR_SLUG . '/loader.js',
		$boot_dependencies,
		CNL_EDITOR_VERSION
	);
}

/**
 * Replace Gutenberg's affected lazy editor module with the compatibility
 * wrapper after Gutenberg has registered its released package.
 */
function cnl_editor_register_lazy_editor_compat_module() {
	// Let Gutenberg register its generated module map before replacing this ID.
	wp_scripts();
	wp_deregister_script_module( '@wordpress/lazy-editor' );
	cnl_editor_register_script_module_from_build(
		'@wordpress/lazy-editor',
		'modules/lazy-editor-compat/index.min'
	);
}

/**
 * Register one built script module.
 *
 * @param string $id Module ID.
 * @param string $path Build-relative path without extension.
 */
function cnl_editor_register_script_module_from_build( $id, $path ) {
	$asset_file = CNL_EDITOR_PATH . 'build/' . $path . '.asset.php';
	$asset      = file_exists( $asset_file ) ? require $asset_file : array();
	$deps       = $asset['module_dependencies'] ?? array();

	wp_register_script_module(
		$id,
		CNL_EDITOR_URL . 'build/' . $path . '.js',
		$deps,
		$asset['version'] ?? CNL_EDITOR_VERSION
	);
}

/**
 * Enqueue the web fonts used by the active visual theme.
 *
 * The modern theme sets the black sidebar's headings in EB Garamond, the
 * heading face on WordPress.org. The font ships with the plugin rather than
 * loading from a third-party CDN.
 */
function cnl_editor_enqueue_ui_theme_fonts() {
	if ( 'modern' !== cnl_editor_get_ui_theme() ) {
		return;
	}

	wp_enqueue_style(
		'cnl-editor-font-eb-garamond',
		CNL_EDITOR_URL . 'assets/fonts/eb-garamond/style.css',
		array(),
		CNL_EDITOR_VERSION
	);
}

/**
 * Preload the heading font so screen titles do not flash in a fallback face.
 */
function cnl_editor_print_ui_theme_font_preload() {
	if ( 'modern' !== cnl_editor_get_ui_theme() ) {
		return;
	}

	printf(
		'<link rel="preload" href="%s" as="font" type="font/woff2" crossorigin>' . "\n",
		esc_url( CNL_EDITOR_URL . 'assets/fonts/eb-garamond/EBGaramond-latin.woff2' )
	);
}

/**
 * Enqueue CSS emitted by the module build.
 */
function cnl_editor_enqueue_built_styles() {
	$build_path = CNL_EDITOR_PATH . 'build';

	if ( ! is_dir( $build_path ) ) {
		return;
	}

	$iterator = new RecursiveIteratorIterator(
		new RecursiveDirectoryIterator( $build_path, FilesystemIterator::SKIP_DOTS )
	);

	foreach ( $iterator as $file ) {
		if ( ! $file->isFile() || 'css' !== $file->getExtension() ) {
			continue;
		}

		$style_file = $file->getPathname();
		$basename = basename( $style_file );

		if ( '-rtl.css' === substr( $basename, -8 ) ) {
			continue;
		}

		$relative_path = str_replace( CNL_EDITOR_PATH . 'build/', '', $style_file );
		$handle        = 'cnl-editor-' . sanitize_key( str_replace( array( '/', '.' ), '-', substr( $relative_path, 0, -4 ) ) );

		wp_enqueue_style(
			$handle,
			CNL_EDITOR_URL . 'build/' . $relative_path,
			array( 'wp-components' ),
			filemtime( $style_file )
		);

		if ( file_exists( substr( $style_file, 0, -4 ) . '-rtl.css' ) ) {
			wp_style_add_data( $handle, 'rtl', 'replace' );
		}
	}
}

/**
 * Get the plugin script module map.
 *
 * @return array[] Module definitions.
 */
function cnl_editor_get_module_map() {
	return array(
		array(
			'id'   => '@create-not-learn-editor/app-init',
			'path' => 'modules/app-init/index.min',
		),
		array(
			'id'   => '@wordpress/lazy-editor',
			'path' => 'modules/lazy-editor-compat/index.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/home/route',
			'path' => 'routes/home/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/home/content',
			'path' => 'routes/home/content.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/site-overview/route',
			'path' => 'routes/site-overview/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/site-overview/content',
			'path' => 'routes/site-overview/content.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/content-base/route',
			'path' => 'routes/content-base/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/content-base/content',
			'path' => 'routes/content-base/content.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/content/route',
			'path' => 'routes/content/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/content/content',
			'path' => 'routes/content/content.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/navigation/route',
			'path' => 'routes/navigation/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/navigation/content',
			'path' => 'routes/navigation/content.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/navigation-edit/route',
			'path' => 'routes/navigation-edit/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/navigation-edit/content',
			'path' => 'routes/navigation-edit/content.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/template-part-edit/route',
			'path' => 'routes/template-part-edit/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/template-edit/route',
			'path' => 'routes/template-edit/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/styles/route',
			'path' => 'routes/styles/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/styles/content',
			'path' => 'routes/styles/content.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/identity/route',
			'path' => 'routes/identity/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/identity/content',
			'path' => 'routes/identity/content.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/patterns/route',
			'path' => 'routes/patterns/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/patterns/content',
			'path' => 'routes/patterns/content.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/template-parts/route',
			'path' => 'routes/template-parts/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/template-parts/content',
			'path' => 'routes/template-parts/content.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/templates/route',
			'path' => 'routes/templates/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/templates/content',
			'path' => 'routes/templates/content.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/post-edit/route',
			'path' => 'routes/post-edit/route.min',
		),
		array(
			'id'   => 'create-not-learn-editor/routes/post-new/route',
			'path' => 'routes/post-new/route.min',
		),
	);
}

/**
 * Get route definitions for the boot app.
 *
 * @return array[] Route definitions.
 */
function cnl_editor_get_routes() {
	return array(
		array(
			'path'           => '/',
			'route_module'   => 'create-not-learn-editor/routes/home/route',
			'content_module' => 'create-not-learn-editor/routes/home/content',
		),
		array(
			'path'           => '/site-overview',
			'route_module'   => 'create-not-learn-editor/routes/site-overview/route',
			'content_module' => 'create-not-learn-editor/routes/site-overview/content',
		),
		array(
			'path'           => '/types/$type',
			'route_module'   => 'create-not-learn-editor/routes/content-base/route',
			'content_module' => 'create-not-learn-editor/routes/content-base/content',
		),
		array(
			'path'           => '/types/$type/list/$view',
			'route_module'   => 'create-not-learn-editor/routes/content/route',
			'content_module' => 'create-not-learn-editor/routes/content/content',
		),
		array(
			'path'         => '/types/$type/edit/$id',
			'route_module' => 'create-not-learn-editor/routes/post-edit/route',
		),
		array(
			'path'         => '/types/$type/new',
			'route_module' => 'create-not-learn-editor/routes/post-new/route',
		),
		array(
			'path'           => '/navigation',
			'route_module'   => 'create-not-learn-editor/routes/navigation/route',
			'content_module' => 'create-not-learn-editor/routes/navigation/content',
		),
		array(
			'path'           => '/navigation/edit/$id',
			'route_module'   => 'create-not-learn-editor/routes/navigation-edit/route',
			'content_module' => 'create-not-learn-editor/routes/navigation-edit/content',
		),
		array(
			'path'         => '/wp_template',
			'route_module' => 'create-not-learn-editor/routes/template-edit/route',
		),
		array(
			'path'         => '/wp_template_part',
			'route_module' => 'create-not-learn-editor/routes/template-part-edit/route',
		),
		array(
			'path'           => '/styles',
			'route_module'   => 'create-not-learn-editor/routes/styles/route',
			'content_module' => 'create-not-learn-editor/routes/styles/content',
		),
		array(
			'path'           => '/identity',
			'route_module'   => 'create-not-learn-editor/routes/identity/route',
			'content_module' => 'create-not-learn-editor/routes/identity/content',
		),
		array(
			'path'           => '/patterns',
			'route_module'   => 'create-not-learn-editor/routes/patterns/route',
			'content_module' => 'create-not-learn-editor/routes/patterns/content',
		),
		array(
			'path'           => '/template-parts',
			'route_module'   => 'create-not-learn-editor/routes/template-parts/route',
			'content_module' => 'create-not-learn-editor/routes/template-parts/content',
		),
		array(
			'path'           => '/templates',
			'route_module'   => 'create-not-learn-editor/routes/templates/route',
			'content_module' => 'create-not-learn-editor/routes/templates/content',
		),
	);
}

/**
 * Get menu item definitions for the boot app.
 *
 * @return array[] Menu item definitions.
 */
function cnl_editor_get_menu_items() {
	$post_types = cnl_editor_get_content_post_type_data();
	$items      = array(
		array(
			'id'    => 'home',
			'icon'  => 'dashicons-admin-home',
			'label' => __( 'My site', 'create-not-learn-editor' ),
			'to'    => '/',
		),
		array(
			'id'    => 'site-overview',
			'icon'  => 'dashicons-networking',
			'label' => __( 'Site Overview', 'create-not-learn-editor' ),
			'to'    => '/site-overview',
		),
		array(
			'id'          => 'content',
			'icon'        => 'dashicons-admin-post',
			'label'       => __( 'Content', 'create-not-learn-editor' ),
			// A fallback path prefix, shorter than every sub-item's `to`
			// below so the sidebar's drilldown-restoration logic (which
			// matches by longest `to` prefix) always prefers the specific
			// sub-item over this parent.
			'to'          => '/types',
			'parent_type' => 'drilldown',
		),
	);

	foreach ( $post_types as $post_type ) {
		$items[] = array(
			'id'     => 'page' === $post_type['name'] ? 'pages' : 'content-' . $post_type['name'],
			'icon'   => $post_type['menuIcon'],
			'label'  => $post_type['menuName'],
			// The route prefix, not a specific list view: switching tabs or
			// filters within the list (or editing/creating an item) changes
			// the URL past this point, and the sidebar's drilldown-restoration
			// logic matches by longest `to` prefix, so this must cover every
			// URL under this post type for the drilldown to stay open.
			'to'     => '/types/' . $post_type['name'],
			'parent' => 'content',
		);
	}

	$items[] = array(
		'id'    => 'navigation',
		'icon'  => '',
		'label' => __( 'Menus', 'create-not-learn-editor' ),
		'to'    => '/navigation',
	);
	$items[] = array(
		'id'          => 'design',
		'icon'        => 'dashicons-admin-appearance',
		'label'       => __( 'Design', 'create-not-learn-editor' ),
		// Not a real route: only used to identify this parent for the
		// sidebar's drilldown-restoration logic, which must not mistake it
		// for one of its sub-items (see the `content` item above).
		'to'          => '/design',
		'parent_type' => 'drilldown',
	);
	$items[] = array(
		'id'     => 'styles',
		'label'  => __( 'Colors & fonts', 'create-not-learn-editor' ),
		'to'     => '/styles',
		'parent' => 'design',
	);
	$items[] = array(
		'id'     => 'identity',
		'label'  => __( 'Name & logo', 'create-not-learn-editor' ),
		'to'     => '/identity',
		'parent' => 'design',
	);
	$items[] = array(
		'id'          => 'advanced',
		'icon'        => 'dashicons-admin-generic',
		'label'       => __( 'Advanced', 'create-not-learn-editor' ),
		// Not a real route: see the `design` item above.
		'to'          => '/advanced',
		'parent_type' => 'drilldown',
	);
	$items[] = array(
		'id'     => 'patterns',
		'label'  => __( 'Sections', 'create-not-learn-editor' ),
		'to'     => '/patterns',
		'parent' => 'advanced',
	);
	$items[] = array(
		'id'     => 'templateParts',
		'label'  => __( 'Site parts', 'create-not-learn-editor' ),
		'to'     => '/template-parts',
		'parent' => 'advanced',
	);
	$items[] = array(
		'id'     => 'templates',
		'label'  => __( 'Layouts', 'create-not-learn-editor' ),
		'to'     => '/templates',
		'parent' => 'advanced',
	);

	return $items;
}
