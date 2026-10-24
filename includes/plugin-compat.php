<?php
/**
 * Compatibility with other plugins.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register plugin compatibility hooks.
 */
function cnl_editor_register_plugin_compat_hooks() {
	add_filter( 'rest_pre_dispatch', 'cnl_editor_prepare_block_editor_assets_request', 10, 3 );
	add_action( CNL_EDITOR_SLUG . '_init', 'cnl_editor_enqueue_agentic_editor_abilities' );
	add_filter( 'agentic_editor_chat_system_instruction', 'cnl_editor_agentic_editor_system_instruction', 10, 2 );
	add_filter( 'rest_request_before_callbacks', 'cnl_editor_prepare_agentic_editor_chat_request', 10, 3 );
}

/**
 * Prefer our models for chat requests from this editor.
 *
 * Agentic Editor picks a model by a preference list it lets sites filter.
 * The filter doesn't say where the chat is, so it is only added for a
 * request this editor sent, leaving Agentic Editor's own chat as it is.
 *
 * @param mixed           $response Response to send instead, or the request's.
 * @param array           $handler  Route handler.
 * @param WP_REST_Request $request  Request.
 * @return mixed The response, untouched.
 */
function cnl_editor_prepare_agentic_editor_chat_request( $response, $handler, $request ) {
	if ( '/agentic-editor/v1/chat' !== $request->get_route() ) {
		return $response;
	}

	$body    = $request->get_json_params();
	$context = is_array( $body ) && isset( $body['context'] ) && is_array( $body['context'] )
		? $body['context']
		: array();

	if ( CNL_EDITOR_SLUG === ( $context['editor'] ?? '' ) ) {
		add_filter( 'agentic_editor_chat_model_preference', 'cnl_editor_assistant_model_preference' );
	}

	return $response;
}

/**
 * Put the models this editor prefers ahead of Agentic Editor's.
 *
 * The chat's turns are short and mostly pick a tool, so a small, cheap model
 * does well. The first model in the list the site's connectors offer is
 * used, so Agentic Editor's own preferences still apply where none of ours
 * is offered.
 *
 * @param array $models Preferred models, best first.
 * @return array Preferred models, best first.
 */
function cnl_editor_assistant_model_preference( $models ) {
	/**
	 * Filters the models the chat prefers, best first.
	 *
	 * @param string[] $preferred Model IDs.
	 */
	$preferred = apply_filters( CNL_EDITOR_SLUG . '_assistant_model_preference', array( 'gpt-6-luna' ) );
	$preferred = is_array( $preferred ) ? array_filter( $preferred, 'is_string' ) : array();

	return array_values( array_unique( array_merge( $preferred, is_array( $models ) ? $models : array() ) ) );
}

/**
 * Get what the chat needs to talk to a language model, if it can.
 *
 * The model comes from the Agentic Editor plugin, which runs the chat through
 * the site's AI connector, set up under Settings > Connectors. Without the
 * plugin, a connector, or the user being allowed to use it, the chat stays
 * scripted.
 *
 * Worked out once a request, since asking whether there is a connector can
 * ask the AI provider which models it has.
 *
 * @return array|null `maxToolRounds`, or null.
 */
function cnl_editor_get_assistant_model() {
	static $model = false;

	if ( false !== $model ) {
		return $model;
	}

	if (
		! function_exists( 'agentic_editor_enqueue_abilities' ) ||
		! function_exists( 'agentic_editor_user_can_chat' ) ||
		! function_exists( 'agentic_editor_chat_is_available' ) ||
		! agentic_editor_user_can_chat() ||
		! agentic_editor_chat_is_available()
	) {
		$model = null;
		return $model;
	}

	$model = array(
		'maxToolRounds' => function_exists( 'agentic_editor_chat_max_tool_rounds' )
			? agentic_editor_chat_max_tool_rounds()
			: 25,
	);

	return $model;
}

/**
 * Load Agentic Editor's block editor abilities into the full-page editor, so
 * a language model can work on the canvas.
 *
 * Agentic Editor only loads them on the post and site editors by itself.
 * They load whether or not the site has an AI connector, as they do there,
 * since an agent in the browser can use them too.
 */
function cnl_editor_enqueue_agentic_editor_abilities() {
	if ( function_exists( 'agentic_editor_enqueue_abilities' ) ) {
		agentic_editor_enqueue_abilities();
	}
}

/**
 * Tell the model how to work in this editor, when the chat is ours.
 *
 * @param string $instruction System instruction.
 * @param array  $context     Page context the chat sent.
 * @return string The system instruction.
 */
function cnl_editor_agentic_editor_system_instruction( $instruction, $context ) {
	if ( ! is_array( $context ) || CNL_EDITOR_SLUG !== ( $context['editor'] ?? '' ) ) {
		return $instruction;
	}

	$lines = array(
		'',
		'This editor:',
		'- The user is building their site in a simplified editor for beginners. Use plain, friendly language and never mention blocks, templates, patterns or other WordPress terms unless the user does.',
		'- Tools whose names start with "cnl_" show the user a picker in the chat, such as a choice of colors or section designs, and the user finishes the change there. Prefer them whenever one fits the request, since the user sees each choice on their site before keeping it.',
		'- After calling a "cnl_" tool, reply with at most one short sentence, as the picker already explains itself. Do not list the choices it shows.',
		'- Use the other tools only for what no "cnl_" tool covers, such as changing the words or images on the page that is open.',
		'- Always make clear where a change shows: on every page of the site, or only on one page or post, which you name. The site\'s look, colors, fonts, title, logo, menu, header and footer, and any block inside a synced pattern, show on every page. Say so before changing them, not only after. The words, images and sections of a page or post change only that one.',
		'- The header and footer show on every page, and their blocks are locked until they are opened. To change their words, links, images or social links, call cnl_open_site_part first, then change the blocks it returns with editor_update-block. Ask for anything you need, like a social profile\'s address, only if the user hasn\'t given it.',
		'- When the user asks for a page or section about something, write it for them: find a design that suits it with cnl_get_designs, read it with cnl_get_design, rewrite its words for what they asked, and pass the result as `content`, with `based_on` and `design_name`, to cnl_add_page or cnl_add_section. The user sees it in the chat, first among the designs.',
		'- When the user has picked a design in the chat and asks to change it, such as "make this about sock puppets", read that design with cnl_get_design and do the same with it.',
		'- When rewriting a design, keep its block markup: the same blocks, attributes, class names and image URLs. Change only the words, and add or remove repeated items, like cards or list items, only by copying ones already there.',
	);

	return $instruction . "\n" . implode( "\n", $lines );
}

/**
 * Let WooCommerce survive Gutenberg's block editor assets request.
 *
 * The editor loads its assets from `/wp-block-editor/v1/assets`, which fires
 * `admin_enqueue_scripts` inside a REST request. WooCommerce's handlers for it
 * call admin helpers, like `wc_get_page_screen_id()`, that WooCommerce only
 * loads on wp-admin requests, so the request dies with a fatal error and the
 * editor never loads. Load those helpers for this one request.
 *
 * @param mixed           $result  Response to short-circuit with, or null.
 * @param WP_REST_Server  $server  REST server.
 * @param WP_REST_Request $request Request.
 * @return mixed The response, untouched.
 */
function cnl_editor_prepare_block_editor_assets_request( $result, $server, $request ) {
	if (
		'/wp-block-editor/v1/assets' !== $request->get_route() ||
		function_exists( 'wc_get_page_screen_id' ) ||
		! function_exists( 'WC' )
	) {
		return $result;
	}

	$admin_functions = WC()->plugin_path() . '/includes/admin/wc-admin-functions.php';

	if ( file_exists( $admin_functions ) ) {
		require_once $admin_functions;
	}

	return $result;
}
