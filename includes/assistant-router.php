<?php
/**
 * Routing what is typed to the assistant with a decision model.
 *
 * A language model takes seconds to answer. Many requests only ask for one
 * of the chat's pickers, like "can I see some other palettes?", which a
 * decision model can pick out in a fraction of that. TypeSafe's Jev is one:
 * it doesn't write, it answers typed questions, like which of a set of
 * options a message asks for, with how confident it is.
 *
 * The chat's script answers what it can be sure of first. What it can't
 * goes here, and what Jev isn't sure of goes on to the language model. See
 * `src/chat/router.js`.
 *
 * The API key is set up under Settings > Connectors, as a connector of its
 * own, not an AI provider: AI providers generate text through the WP AI
 * Client, which Jev doesn't. The key stays on the server, so the editor
 * asks Jev through this plugin's REST API.
 *
 * @package CreateNotLearnEditor
 */

defined( 'ABSPATH' ) || exit;

const CNL_EDITOR_TYPESAFE_URL = 'https://api.typesafe.ai/v1/systemone';

/**
 * Register the assistant router's hooks.
 */
function cnl_editor_register_assistant_router_hooks() {
	add_action( 'wp_connectors_init', 'cnl_editor_register_typesafe_connector' );
	add_action( 'rest_api_init', 'cnl_editor_register_assistant_router_routes' );
}

/**
 * Add TypeSafe to Settings > Connectors, for its API key.
 *
 * Left alone if something else, like a plugin from TypeSafe, has already
 * added it. Its key is read from wherever that connector keeps it.
 *
 * @param WP_Connector_Registry $registry Connector registry.
 */
function cnl_editor_register_typesafe_connector( $registry ) {
	if ( $registry->is_registered( 'typesafe' ) ) {
		return;
	}

	$registry->register(
		'typesafe',
		array(
			'name'           => 'TypeSafe',
			'description'    => __( 'Lets the Create Not Learn assistant answer simple requests straight away, with TypeSafe’s Jev model.', 'create-not-learn-editor' ),
			'type'           => 'decision_model',
			'plugin'         => array(
				'file'      => plugin_basename( CNL_EDITOR_FILE ),
				'is_active' => '__return_true',
			),
			'authentication' => array(
				'method'          => 'api_key',
				'credentials_url' => 'https://console.typesafe.ai/keys',
				'env_var_name'    => 'TYPESAFE_API_KEY',
				'constant_name'   => 'TYPESAFE_API_KEY',
			),
		)
	);
}

/**
 * Get the TypeSafe API key, from the environment, a constant or Settings >
 * Connectors, in the order core reads a connector's key.
 *
 * @return string The key, or ''.
 */
function cnl_editor_get_typesafe_api_key() {
	$connector = function_exists( 'wp_get_connector' ) ? wp_get_connector( 'typesafe' ) : null;
	$auth      = $connector['authentication'] ?? array();

	if ( 'api_key' !== ( $auth['method'] ?? '' ) ) {
		return '';
	}

	$env_var_name = $auth['env_var_name'] ?? '';
	$env_value    = $env_var_name ? getenv( $env_var_name ) : false;

	if ( is_string( $env_value ) && '' !== $env_value ) {
		return $env_value;
	}

	$constant_name = $auth['constant_name'] ?? '';

	if ( $constant_name && defined( $constant_name ) && is_string( constant( $constant_name ) ) ) {
		return constant( $constant_name );
	}

	$key = empty( $auth['setting_name'] ) ? '' : get_option( $auth['setting_name'], '' );

	return is_string( $key ) ? $key : '';
}

/**
 * Whether the assistant can ask a decision model what is typed asks for.
 *
 * @return bool Whether it can.
 */
function cnl_editor_assistant_can_route() {
	return current_user_can( 'edit_theme_options' ) && '' !== cnl_editor_get_typesafe_api_key();
}

/**
 * Register the REST routes the chat asks Jev through.
 */
function cnl_editor_register_assistant_router_routes() {
	$conversation = array(
		'type'     => 'array',
		'default'  => array(),
		'maxItems' => 6,
		'items'    => array(
			'type'                 => 'object',
			'properties'           => array(
				'role' => array(
					'type' => 'string',
					'enum' => array( 'user', 'assistant' ),
				),
				'text' => array(
					'type'      => 'string',
					'maxLength' => 2000,
				),
			),
			'additionalProperties' => false,
		),
	);
	$text         = array(
		'type'      => 'string',
		'required'  => true,
		'minLength' => 1,
		'maxLength' => 2000,
	);
	$title        = array(
		'type'      => 'string',
		'maxLength' => 200,
	);

	register_rest_route(
		CNL_EDITOR_REST_NAMESPACE,
		'/assistant/route',
		array(
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => 'cnl_editor_rest_route_assistant_request',
			'permission_callback' => 'cnl_editor_assistant_can_route',
			'args'                => array(
				'text'            => $text,
				'conversation'    => $conversation,
				'picked'          => array(
					'type'      => 'string',
					'default'   => '',
					'maxLength' => 2000,
				),
				'pages'           => array(
					'type'     => 'array',
					'default'  => array(),
					'maxItems' => 100,
					'items'    => array(
						'type'                 => 'object',
						'properties'           => array(
							'id'     => array( 'type' => 'integer' ),
							'title'  => $title,
							'isHome' => array( 'type' => 'boolean' ),
							'isOpen' => array( 'type' => 'boolean' ),
						),
						'additionalProperties' => false,
					),
				),
				'sections'        => array(
					'type'     => 'array',
					'default'  => array(),
					'maxItems' => 50,
					'items'    => $title,
				),
				'selectedSection' => array(
					'type'    => array( 'integer', 'null' ),
					'default' => null,
				),
			),
		)
	);

	register_rest_route(
		CNL_EDITOR_REST_NAMESPACE,
		'/assistant/route/section',
		array(
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => 'cnl_editor_rest_route_assistant_section',
			'permission_callback' => 'cnl_editor_assistant_can_route',
			'args'                => array(
				'text'         => $text,
				'conversation' => $conversation,
				'page'         => array_merge( $title, array( 'required' => true ) ),
				'sections'     => array(
					'type'     => 'array',
					'required' => true,
					'minItems' => 1,
					'maxItems' => 50,
					'items'    => $title,
				),
			),
		)
	);
}

/**
 * What the chat can answer without the language model, for Jev to choose
 * from, keyed by the chat's skills. Each is a picker that answers the
 * request in full. Anything else is `other`, for the language model.
 *
 * @return array<string, string> Descriptions, keyed by skill.
 */
function cnl_editor_get_assistant_routes() {
	return array(
		'look'           => 'See or change the overall look of the whole site, which changes its colors, fonts and spacing together.',
		'colors'         => 'See or change the color palette of the whole site.',
		'fonts'          => 'See or change the fonts of the whole site.',
		'logo'           => 'Add, change or remove the site logo.',
		'site-title'     => 'Change the name or title of the site.',
		'header'         => 'Change the layout of the header at the top of every page.',
		'footer'         => 'Change the layout of the footer at the bottom of every page.',
		'menu'           => 'Change the site menu: reorder, rename, add or remove its links.',
		'section-design' => 'Change the layout or colors of a section already on a page, such as the one selected.',
		'undo'           => 'Undo the last change kept in this chat.',
		'exit'           => 'Finished, and wants to close the chat.',
		'greeting'       => 'Only says hello.',
		'thanks'         => 'Only says thanks, with nothing new to ask.',
		'other'          => 'Anything else, such as adding a page or section, writing or changing the words or images on a page, changing one particular block, a question, or more than one request at once.',
	);
}

/**
 * Ask Jev a set of questions about the same state.
 *
 * @param array $state     What the questions are about.
 * @param array $questions Questions, keyed by name.
 * @return array|WP_Error Answers, keyed by question name.
 */
function cnl_editor_ask_typesafe( $state, $questions ) {
	/**
	 * Filters the Jev model the assistant routes requests with.
	 *
	 * @param string $model Model name or alias.
	 */
	$model = apply_filters( CNL_EDITOR_SLUG . '_assistant_router_model', 'jev-latest' );

	$response = wp_remote_post(
		CNL_EDITOR_TYPESAFE_URL,
		array(
			'timeout' => 3,
			'headers' => array(
				'Authorization' => 'Bearer ' . cnl_editor_get_typesafe_api_key(),
				'Content-Type'  => 'application/json',
			),
			'body'    => wp_json_encode(
				array(
					'model'     => $model,
					'state'     => $state,
					'questions' => $questions,
				)
			),
		)
	);

	if ( is_wp_error( $response ) ) {
		return new WP_Error( 'cnl_editor_router_unavailable', $response->get_error_message(), array( 'status' => 502 ) );
	}

	$status  = wp_remote_retrieve_response_code( $response );
	$answers = json_decode( wp_remote_retrieve_body( $response ), true )['answers'] ?? null;

	if ( 200 !== $status || ! is_array( $answers ) ) {
		return new WP_Error(
			'cnl_editor_router_unavailable',
			sprintf( 'TypeSafe answered with HTTP %d.', $status ),
			array( 'status' => 502 )
		);
	}

	return $answers;
}

/**
 * How confident Jev has to be, from 0 to 1, for the assistant to act on an
 * answer rather than leave the request to the language model.
 *
 * @return float The lowest confidence to act on.
 */
function cnl_editor_get_assistant_router_threshold() {
	/**
	 * Filters how confident Jev has to be, from 0 to 1, for the assistant
	 * to act on its answer rather than ask the language model.
	 *
	 * A wrong guess shows a picker the user didn't ask for, or the wrong
	 * page or section, so this is higher than TypeSafe's suggested floor
	 * of 0.6.
	 *
	 * @param float $threshold Lowest confidence to act on.
	 */
	return (float) apply_filters( CNL_EDITOR_SLUG . '_assistant_router_confidence', 0.8 );
}

/**
 * A Choice question picking one of a page's sections, or none.
 *
 * @param string   $instructions What to decide.
 * @param string[] $sections     Section names, top to bottom.
 * @return array The question.
 */
function cnl_editor_get_section_question( $instructions, $sections ) {
	$criteria = array();

	foreach ( array_values( $sections ) as $index => $section ) {
		$criteria[ 'section-' . $index ] = sprintf( '"%s", section %d of %d from the top', $section, $index + 1, count( $sections ) );
	}

	$criteria['none'] = 'No section in particular, or one that isn\'t listed.';

	return array(
		'type'         => 'choice',
		'instructions' => $instructions,
		'criteria'     => $criteria,
	);
}

/**
 * The section a Choice answer picked, if it is sure enough.
 *
 * @param ?array $answer The answer.
 * @return ?int The section's index, top first, or null.
 */
function cnl_editor_get_answered_section( $answer ) {
	$choice = $answer['choice'] ?? 'none';

	if (
		! preg_match( '/^section-(\d+)$/', $choice, $matches ) ||
		(float) ( $answer['confidence'] ?? 0 ) < cnl_editor_get_assistant_router_threshold()
	) {
		return null;
	}

	return (int) $matches[1];
}

/**
 * Ask Jev which of the chat's pickers a message asks for.
 *
 * Which page and which section it means are asked at the same time, as the
 * chat already knows the site's pages and the open page's sections. Only
 * changing a section uses them, and only when Jev picks that.
 *
 * @param WP_REST_Request $request Request.
 * @return WP_REST_Response|WP_Error `{ skill, params, confidence }`, with a
 *                                   null `skill` for the language model.
 */
function cnl_editor_rest_route_assistant_request( $request ) {
	$pages     = $request['pages'];
	$sections  = $request['sections'];
	$state     = array(
		'message'      => $request['text'],
		'conversation' => $request['conversation'],
		'picked'       => $request['picked'],
		'pages'        => array_column( $pages, 'title' ),
	);
	$questions = array(
		'request'      => array(
			'type'         => 'choice',
			'instructions' => 'What does the user ask for in their latest message, `message`? Use the earlier `conversation`, and what they have `picked`, only to understand what the message refers to.',
			'criteria'     => cnl_editor_get_assistant_routes(),
		),
		'section_part' => array(
			'type'         => 'choice',
			'instructions' => 'If the message asks to change a section already on a page, what about it does it ask to change?',
			'criteria'     => array(
				'color'  => 'Its colors, background, or how light or dark it is.',
				'layout' => 'How its contents are laid out or arranged.',
				'both'   => 'Both, or it doesn\'t say.',
			),
		),
		'gives_name'   => array(
			'type'         => 'noul',
			'instructions' => 'Does the message give the new name for the site?',
		),
	);

	if ( $pages ) {
		$criteria = array();

		foreach ( $pages as $page ) {
			$notes = array_filter(
				array(
					empty( $page['isHome'] ) ? '' : 'the homepage',
					empty( $page['isOpen'] ) ? '' : 'open now',
				)
			);

			$criteria[ 'page-' . $page['id'] ] = $notes
				? sprintf( '"%s" (%s)', $page['title'], implode( ', ', $notes ) )
				: sprintf( '"%s"', $page['title'] );
		}

		$criteria['none'] = 'No page in particular.';

		$questions['page'] = array(
			'type'         => 'choice',
			'instructions' => 'Which of the site\'s `pages` does the message refer to, if any?',
			'criteria'     => $criteria,
		);
	}

	if ( $sections ) {
		$open = current( wp_list_filter( $pages, array( 'isOpen' => true ) ) );

		$state['open_page'] = array(
			'title'    => $open['title'] ?? '',
			'sections' => $sections,
			'selected' => null === $request['selectedSection'] ? null : ( $sections[ $request['selectedSection'] ] ?? null ),
		);

		$questions['section'] = cnl_editor_get_section_question(
			'If the message is about a section of the page open now, `open_page`, which section does it mean? "This section" means the one `selected`.',
			$sections
		);
	}

	$answers = cnl_editor_ask_typesafe( $state, $questions );

	if ( is_wp_error( $answers ) ) {
		return $answers;
	}

	return rest_ensure_response( cnl_editor_get_assistant_route( $answers, $pages ) );
}

/**
 * Ask Jev which section of a page a message means, for a page that isn't
 * open, whose sections weren't known until Jev picked it.
 *
 * @param WP_REST_Request $request Request.
 * @return WP_REST_Response|WP_Error `{ sectionIndex }`, null when Jev isn't
 *                                   sure.
 */
function cnl_editor_rest_route_assistant_section( $request ) {
	$answers = cnl_editor_ask_typesafe(
		array(
			'message'      => $request['text'],
			'conversation' => $request['conversation'],
			'page'         => array(
				'title'    => $request['page'],
				'sections' => $request['sections'],
			),
		),
		array(
			'section' => cnl_editor_get_section_question(
				'Which section of `page` does the user\'s latest message, `message`, ask to change? Use the earlier `conversation` only to understand what the message refers to.',
				$request['sections']
			),
		)
	);

	if ( is_wp_error( $answers ) ) {
		return $answers;
	}

	return rest_ensure_response(
		array( 'sectionIndex' => cnl_editor_get_answered_section( $answers['section'] ?? null ) )
	);
}

/**
 * Turn Jev's answers into the skill the chat shows, if it is sure enough.
 *
 * @param array $answers Jev's answers, keyed by question.
 * @param array $pages   The pages it chose from.
 * @return array `{ skill, params, confidence }`.
 */
function cnl_editor_get_assistant_route( $answers, $pages = array() ) {
	$choice     = $answers['request']['choice'] ?? 'other';
	$confidence = (float) ( $answers['request']['confidence'] ?? 0 );
	$threshold  = cnl_editor_get_assistant_router_threshold();
	$route      = array(
		'skill'      => null,
		'params'     => new stdClass(),
		'confidence' => $confidence,
	);

	if (
		'other' === $choice ||
		! array_key_exists( $choice, cnl_editor_get_assistant_routes() ) ||
		$confidence < $threshold
	) {
		return $route;
	}

	// The site title picker can only put in a name the script finds.
	if ( 'site-title' === $choice && ( $answers['gives_name']['noul'] ?? 1 ) >= 0.5 ) {
		return $route;
	}

	$route['skill'] = $choice;

	if ( 'site-title' === $choice ) {
		$route['params'] = array( 'name' => '' );
	}

	if ( 'section-design' === $choice ) {
		$part   = $answers['section_part']['choice'] ?? 'both';
		$params = array(
			'focus' => in_array( $part, array( 'color', 'layout' ), true ) ? $part : 'both',
		);

		$page_answer = $answers['page'] ?? array();
		$page_id     = preg_match( '/^page-(\d+)$/', $page_answer['choice'] ?? '', $matches )
			? (int) $matches[1]
			: 0;
		$open        = current( wp_list_filter( $pages, array( 'isOpen' => true ) ) );
		$open_id     = (int) ( $open['id'] ?? 0 );

		if ( $page_id && (float) ( $page_answer['confidence'] ?? 0 ) >= $threshold ) {
			$params['pageId'] = $page_id;
		}

		// Its sections were only asked about for the open page.
		if ( ( $params['pageId'] ?? $open_id ) === $open_id ) {
			$section = cnl_editor_get_answered_section( $answers['section'] ?? null );

			if ( null !== $section ) {
				$params['sectionIndex'] = $section;
			}
		}

		$route['params'] = $params;
	}

	return $route;
}
