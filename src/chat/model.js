/**
 * Answers from a language model, when one is connected.
 *
 * The model comes from the Agentic Editor plugin, whose chat endpoint runs
 * one turn of the model per request through the site's AI connector and
 * leaves the tools to the browser. This runs the loop: send the
 * conversation, run the tools the model asks for, send their results back,
 * and repeat until it answers.
 *
 * The model has our own tools, which show a skill's picker, and Agentic
 * Editor's block editor tools, which change the canvas. Showing a picker
 * ends the turn, since the user carries on in the picker. See
 * `model-tools.js`.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * because the chat is mounted from app init.
 */

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { settings } from '../settings';
import { findTargetPage } from './target-page';
import {
	carriesScript,
	getModelTool,
	getModelToolDeclarations,
	getSkillRequest,
} from './model-tools';
import { isSiteWide } from './scope';
import { openSitePart } from './site-parts';
import { listDesigns, readDesign, writeDesign } from './written-designs';

const CHAT_PATH = '/agentic-editor/v1/chat';

/*
 * Held in a variable so the build leaves the import for the browser to
 * resolve through the import map, where Agentic Editor registers the module.
 */
const TOOLS_MODULE = '@agentic-editor/webmcp-tools';

const MAX_ROUNDS = 25;

/*
 * How the endpoint replays tool calls: `native`, or `text` for a provider
 * that turns them down. The endpoint says which worked, so a conversation
 * finds out once.
 */
let historyMode = 'native';

// Bumped to stop a turn that is still running.
let conversation = 0;

/**
 * @return {boolean} Whether a language model answers what is typed.
 */
export function hasModel() {
	return !! settings.assistantModel;
}

/**
 * Stop any turn still running, and start the next conversation afresh.
 */
export function stopModel() {
	conversation += 1;
	historyMode = 'native';
}

/**
 * Agentic Editor's block editor tools, which it registers on the page.
 *
 * Only its own tools that run without asking are offered. The ones it asks
 * about first, like publishing a pattern or generating an image, are left
 * out, since this chat has nowhere to ask.
 *
 * @return {Promise<Object>} `{ tools, callTool }`.
 */
async function getEditorTools() {
	try {
		const module = await import( /* webpackIgnore: true */ TOOLS_MODULE );
		const tools = await module.listTools();

		return {
			tools: tools.filter(
				( tool ) => tool.source === 'local' && ! tool.approval
			),
			callTool: module.callTool,
		};
	} catch {
		return { tools: [], callTool: null };
	}
}

const SCREENS = [
	[ /^\/types\/page/, 'Pages' ],
	[ /^\/design/, 'Design' ],
	[ /^\/navigation/, 'Menus' ],
	[ /^\/advanced/, 'Advanced' ],
];

/**
 * Where the user is, for the endpoint to tell the model.
 *
 * @param {string} picked What the user picked in the chat, if anything.
 * @return {Object} Page context.
 */
function getContext( picked ) {
	const route =
		new URL( window.location.href ).searchParams.get( 'p' ) || '/';
	const screen = SCREENS.find( ( [ path ] ) => path.test( route ) );
	const page = findTargetPage();

	return {
		editor: 'create-not-learn-editor',
		screen: screen ? screen[ 1 ] : 'My site',
		notes: [
			page &&
				`The page open on the canvas is "${ page.title }" (page ID ${ page.id }).`,
			picked,
		]
			.filter( Boolean )
			.join( '\n' ),
	};
}

const ACTIONS = {
	'list-designs': listDesigns,
	'open-site-part': openSitePart,
	'read-design': readDesign,
};

/**
 * Run one tool call.
 *
 * @param {Object}   call      `{ name, arguments }`.
 * @param {Object}   editor    `{ tools, callTool }`.
 * @param {Function} showSkill Shows a skill's picker.
 * @param {string}   typed     What the user last typed.
 * @return {Promise<Object>} `{ response, shown }`: what to tell the model,
 *                           and what the chat said when it showed a picker.
 */
async function runToolCall( call, editor, showSkill, typed ) {
	const args = call.arguments || {};
	const tool = getModelTool( call.name );

	if ( tool?.action ) {
		return { response: await ACTIONS[ tool.action ]( args ) };
	}

	if ( tool ) {
		const { params, text } = getSkillRequest( tool, args, typed );

		if ( args.content ) {
			const design = writeDesign( args );

			if ( design.error ) {
				return { response: { error: design.error } };
			}

			params.designs = [ design.pattern ];
		}

		const shown = await showSkill( tool.skill, params, text );

		return {
			shown,
			response: {
				shown: shown || '',
				changes: isSiteWide( tool.skill )
					? 'Every page of the site. The chat marks it so.'
					: 'Only the page it is on, named in the chat.',
				note: 'The user sees this in the chat now and finishes the change there.',
			},
		};
	}

	if ( ! editor.tools.some( ( { name } ) => name === call.name ) ) {
		return { response: { error: `Unknown tool: ${ call.name }` } };
	}

	if ( carriesScript( args ) ) {
		return {
			response: {
				error: 'Not run: this editor does not add raw HTML or scripts.',
			},
		};
	}

	const result = await editor.callTool( call.name, args );

	return { response: result.value };
}

/**
 * Answer what the user typed.
 *
 * @param {Object}   options           Options.
 * @param {Object[]} options.history   The conversation, from `buildHistory()`.
 * @param {string}   options.typed     What the user last typed.
 * @param {string}   options.picked    What the user picked in the chat, for
 *                                     the model to know what "this" is.
 * @param {Function} options.onRound   Called before asking the model again.
 * @param {Function} options.onText    Called with what the model says.
 * @param {Function} options.showSkill Called with a skill, its params and a
 *                                     request to show its picker. Resolves
 *                                     with what the chat said.
 * @return {Promise<?Object[]>} What the turn added to the conversation, for
 *                              replaying it, or `null` if it was stopped.
 */
export async function runModelTurn( {
	history,
	typed,
	picked,
	onRound,
	onText,
	showSkill,
} ) {
	const started = conversation;
	const isStopped = () => started !== conversation;
	const editor = await getEditorTools();
	const tools = [
		...getModelToolDeclarations(),
		...editor.tools.map( ( { name, description, inputSchema } ) => ( {
			name,
			description,
			inputSchema,
		} ) ),
	];
	const maxRounds = settings.assistantModel?.maxToolRounds || MAX_ROUNDS;
	const messages = [ ...history ];
	const added = [];

	for ( let round = 0; round <= maxRounds; round += 1 ) {
		if ( round > 0 ) {
			onRound();
		}

		const answer = await apiFetch( {
			path: CHAT_PATH,
			method: 'POST',
			data: {
				messages,
				tools,
				context: getContext( picked ),
				historyMode,
			},
		} );

		if ( isStopped() ) {
			return null;
		}

		historyMode = answer.historyMode || historyMode;

		const turn = { role: 'assistant', parts: answer.message?.parts || [] };
		const calls = answer.toolCalls || [];

		if ( answer.text?.trim() ) {
			onText( answer.text.trim() );
		}

		if ( ! calls.length ) {
			added.push( turn );
			return added;
		}

		if ( round === maxRounds ) {
			throw new Error(
				sprintf(
					/* translators: %d: how many rounds of changes. */
					__(
						'I stopped after %d rounds of changes. Ask again to carry on.'
					),
					maxRounds
				)
			);
		}

		const responses = [];
		let shown = null;

		for ( const call of calls ) {
			// One picker at a time: only the newest can be used.
			if ( shown !== null && getModelTool( call.name )?.skill ) {
				responses.push( {
					id: call.id,
					name: call.name,
					response: {
						error: 'Not run: a picker is already showing.',
					},
				} );
				continue;
			}

			const result = await runToolCall( call, editor, showSkill, typed );

			if ( isStopped() ) {
				return null;
			}

			if ( result.shown !== undefined ) {
				shown = result.shown || '';
			}

			responses.push( {
				id: call.id,
				name: call.name,
				response: result.response,
			} );
		}

		const toolTurn = { role: 'tool', responses };

		messages.push( turn, toolTurn );
		added.push( turn, toolTurn );

		// The user carries on in the picker, which said what it is for.
		if ( shown !== null ) {
			added.push( {
				role: 'assistant',
				parts: [ { text: shown || 'Done.' } ],
			} );
			return added;
		}
	}

	return added;
}
