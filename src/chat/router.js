/**
 * Answers what is typed without the language model, when it can be sure.
 *
 * The model is slow next to a picker. Many requests, like "change my
 * colours", only ask for a picker, and the model could do no more than
 * show it. Those are answered straight away, as the chat does without a
 * model. Anything else goes to the model: a request with more in it than
 * a picker answers, like "make my colours blue", one that refers back to
 * the conversation, like "make it darker", and any request to add a page
 * or section, which the model can write for.
 *
 * Each router in `ROUTERS` is asked in turn, cheapest first, until one is
 * sure: the script, then a decision model, if one is set up, which picks
 * one of the pickers rather than writing. See `decision-model.js`.
 */

/**
 * Internal dependencies
 */
import { routeWithDecisionModel } from './decision-model';
import { SECTION_COLOR, SECTION_LAYOUT, matchRequest } from './engine';

// How much of the conversation a router sees, to know what "it" is.
const RECENT_MESSAGES = 6;

// Words that ask for something without saying what.
const ROUTINE =
	/^(a|again|an|and|any|are|can|change|choose|could|different|do|edit|for|give|help|hey|hi|i|i'd|i'm|let|lets|like|me|more|my|need|new|now|of|ok|okay|on|options|other|our|please|pick|see|set|show|site|some|switch|swap|the|to|try|update|us|want|we|website|would|you)$/;

/*
 * The skills a picker answers in full, with the words that ask for each.
 * Adding a page or a section isn't here: the model can write one.
 */
const ROUTABLE = {
	undo: /^(undo|put|it|that|back|change|revert|go)$/,
	exit: /^(exit|close|quit|leave|stop|bye|goodbye|good|done|that|is|all|finish|finished|end|assistant|chat|ai|hide|this|thanks|thank)$/,
	greeting:
		/^(hi|hello|hey|hiya|howdy|good|morning|afternoon|evening|there)$/,
	thanks: /^(thanks|thank|cheers|ta|great|perfect|nice|lovely|brilliant|awesome|so|much|that|looks|good)$/,
	look: /^(look|looks|style|styles|restyle|theme|vibe|redesign|feel|makeover|design|appearance|whole|overall)$/,
	colors: /^(colou?rs?|palettes?|scheme|darker|lighter|brighter|warmer|cooler|bolder|muted|make)$/,
	fonts: /^(fonts?|typography|typefaces?|lettering|text|style|headings?)$/,
	logo: /^(logos?|add|upload|replace|remove|delete)$/,
	'site-title': /^(rename|name|title|call|called|as|is)$/,
	header: /^(header|top|layouts?|design|style|look)$/,
	footer: /^(footer|bottom|layouts?|design|style|look)$/,
	menu: /^(menus?|navigation|nav|bar|links?|reorder|rename)$/,
	'section-design': ( word ) =>
		/^(sections?|this|that|selected|current|make|layouts?|design|style|restyle|redesign|tweak)$/.test(
			word
		) ||
		SECTION_COLOR.test( word ) ||
		SECTION_LAYOUT.test( word ),
};

// A site name that is a request for one, like "something catchier".
const VAGUE_NAME = /^(something|anything|a better|a catchier|a new|better)\b/i;

// The words in a message, without "'s", so "section's" is "section".
function getWords( text ) {
	return (
		text
			.toLowerCase()
			.replace( /’/g, "'" )
			.match( /[\p{L}\p{N}']+/gu ) || []
	).map( ( word ) => word.replace( /'s$/, '' ) );
}

/**
 * Answer from the script, if what was typed says nothing beyond what the
 * picker it matches answers.
 *
 * @param {string} text What was typed.
 * @return {?Object} `{ skill, params }`, or `null`.
 */
export function routeByScript( text ) {
	const match = matchRequest( text );
	const isSkillWord = match && ROUTABLE[ match.skill ];

	if ( ! isSkillWord ) {
		return null;
	}

	let rest = text;

	// The name is the user's own words, so it says nothing more.
	if ( match.skill === 'site-title' && match.params.name ) {
		if ( VAGUE_NAME.test( match.params.name ) ) {
			return null;
		}

		rest = rest.replace( match.params.name, '' );
	}

	const isExplained = getWords( rest ).every(
		( word ) =>
			ROUTINE.test( word ) ||
			( typeof isSkillWord === 'function'
				? isSkillWord( word )
				: isSkillWord.test( word ) )
	);

	return isExplained ? match : null;
}

const ROUTERS = [ routeByScript, routeWithDecisionModel ];

/**
 * The last few things said in the chat, by either side, for a router to
 * know what a message refers to.
 *
 * @param {Object[]} messages The chat's messages.
 * @return {Object[]} `{ role, text }` items, oldest first.
 */
export function getRecentConversation( messages ) {
	return messages
		.filter(
			( message ) =>
				[ 'user', 'assistant' ].includes( message.role ) &&
				message.text &&
				message.status !== 'error'
		)
		.slice( -RECENT_MESSAGES )
		.map( ( { role, text } ) => ( { role, text } ) );
}

/**
 * Work out what was typed asks for, without the language model, if it can
 * be sure.
 *
 * @param {string}   text                 What was typed.
 * @param {Object}   context              What it might refer to.
 * @param {Object[]} context.conversation The conversation before it, from
 *                                        `getRecentConversation()`.
 * @param {string}   context.picked       What was picked in the chat.
 * @return {Promise<?Object>} `{ skill, params }`, or `null` for the language
 *                            model to answer.
 */
export async function routeRequest( text, context = {} ) {
	const message = String( text || '' ).trim();

	if ( ! message ) {
		return null;
	}

	for ( const router of ROUTERS ) {
		const route = await router( message, context );

		if ( route ) {
			return route;
		}
	}

	return null;
}
