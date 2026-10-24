/**
 * Answers what is typed without the language model, when it can be sure.
 *
 * The model is slow next to a picker. Many requests, like "change my
 * colours", only ask for a picker, and the model could do no more than
 * show it. With a decision model set up, TypeSafe's Jev, those are answered
 * straight away, as the chat does without a model. Jev also picks which
 * page and section a request means. Anything else goes to the model.
 *
 * The script's keyword matching isn't asked: it can't tell "edit my menu"
 * from "add a mobile menu", which the model can do and the menu picker
 * can't. See `decision-model.js`.
 */

/**
 * Internal dependencies
 */
import { routeWithDecisionModel } from './decision-model';

// How much of the conversation the decision model sees, to know what "it"
// is.
const RECENT_MESSAGES = 6;

/**
 * The last few things said in the chat, by either side, for the decision
 * model to know what a message refers to.
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
 * Work out what was typed asks for, without the language model, if the
 * decision model can be sure.
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

	return message ? routeWithDecisionModel( message, context ) : null;
}
