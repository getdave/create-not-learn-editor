/**
 * Works out what a message to the chat is asking for.
 *
 * A scripted stand-in for a language model: each request the chat can help
 * with is matched by the words it is likely to be asked in, in order, so a
 * more particular request wins over a broader one, and small talk only
 * counts when nothing else does. "Add a section to my About page" is about
 * a section, not a page, "add the About page to my menu" is about the menu,
 * and "make my header colors warmer" is about colors, not the header's
 * layout.
 *
 * Kept free of React and WordPress packages so it can be tested on its own.
 */

/**
 * The requests, most particular first. Each `test` is matched against the
 * whole message.
 */
const RULES = [
	{
		skill: 'undo',
		test: /^\s*(undo|undo (that|it)|put it back|change it back|revert( (that|it))?|go back)\b/i,
	},
	{
		skill: 'exit',
		test: /^\s*(?:please\s+)?(?:exit|close|quit|leave|stop|bye|goodbye|good bye|i'?m done|i am done|that'?s all|that is all|all done|finish|finished|end|(?:close|exit|quit|leave|hide|end)\s+(?:the\s+|this\s+)?(?:assistant|chat|ai))(?:[,\s]+(?:please|now|thanks|thank you))?[\s!.]*$/i,
	},
	{ skill: 'add-section', test: /\bsections?\b/i },
	{
		skill: 'menu',
		test: /\b(menus?|navigation|nav ?bar|nav links)\b/i,
	},
	{
		skill: 'add-page',
		test: /\b(add|create|make|new|start|build)\b.*\bpages?\b/i,
	},
	{
		skill: 'logo',
		test: /\blogos?\b/i,
	},
	{
		skill: 'site-title',
		test: /\b(rename|site'?s? (name|title)|(name|title) (of )?(my|the) (site|website)|name my|call (my|the) (site|website)|site title)\b/i,
	},
	{
		skill: 'colors',
		test: /\b(colou?rs?|palettes?|darker|lighter|brighter|warmer|cooler|bolder|muted)\b/i,
	},
	{
		skill: 'fonts',
		test: /\b(fonts?|typography|typefaces?|lettering|headings? font|text style)\b/i,
	},
	{ skill: 'header', test: /\b(header|top of (the|my) (site|pages?))\b/i },
	{
		skill: 'footer',
		test: /\b(footer|bottom of (the|my) (site|pages?))\b/i,
	},
	{
		skill: 'look',
		test: /\b(looks?|styles?|restyle|theme|vibe|redesign|feel|makeover|design|appearance)\b/i,
	},
	{
		skill: 'greeting',
		test: /^\s*(hi|hello|hey|hiya|howdy|good (morning|afternoon|evening))\b[\s!.,]*(there)?[\s!.]*$/i,
	},
	{
		skill: 'thanks',
		test: /^\s*(thanks|thank you|cheers|ta|great|perfect|nice|lovely|brilliant|awesome)\b[\s\w!.,]{0,20}$/i,
	},
];

// Replies that only confirm what is waiting to be sent.
const CONFIRMATION =
	/^\s*(yes|yeah|yep|yup|ok|okay|sure|save( it| that)?|keep( it| that)?|do it|go( for it)?|that one|this one|perfect|great|looks good|lgtm|send( it)?|apply( it)?|done)\b[\s!.]*$/i;

// Words that say nothing about what a page or section is for.
const FILLER = new Set( [
	'a',
	'an',
	'another',
	'blank',
	'empty',
	'my',
	'new',
	'one',
	'some',
	'the',
	'this',
	'web',
] );

const QUOTES = /^["'“‘]+|["'”’.!?]+$/g;

function clean( value ) {
	return String( value || '' )
		.trim()
		.replace( QUOTES, '' )
		.trim();
}

function capitalize( value ) {
	return value.replace(
		/(^|\s)(\p{Ll})/gu,
		( match, space, letter ) => space + letter.toUpperCase()
	);
}

/**
 * Strip filler words from the start of a phrase.
 *
 * @param {string} value Phrase.
 * @return {string} The phrase, or '' when it was only filler.
 */
function withoutFiller( value ) {
	const words = clean( value ).split( /\s+/ ).filter( Boolean );

	while ( words.length && FILLER.has( words[ 0 ].toLowerCase() ) ) {
		words.shift();
	}

	return words.join( ' ' );
}

/**
 * The first phrase the patterns find in a message that says something.
 *
 * @param {string}   text     Message.
 * @param {RegExp[]} patterns Patterns, each capturing the phrase.
 * @param {Function} tidy     Tidies a phrase up, returning '' for filler.
 * @return {string} The phrase, or ''.
 */
function firstMatch( text, patterns, tidy = clean ) {
	for ( const pattern of patterns ) {
		const phrase = tidy( text.match( pattern )?.[ 1 ] );

		if ( phrase ) {
			return phrase;
		}
	}

	return '';
}

/**
 * The new name a message gives the site, if it gives one.
 *
 * @param {string} text Message.
 * @return {string} The name, or ''.
 */
export function getSiteNameFromText( text ) {
	return firstMatch( text, [
		/\b(?:rename|call)\s+(?:my |the )?(?:site|website)\s+(?:to\s+|as\s+)?(.+)$/i,
		/\bname (?:of (?:my |the )?(?:site|website) )?to\s+(.+)$/i,
		/\bname (?:my |the )?(?:site|website)\s+(.+)$/i,
		/\bsite'?s? (?:name|title) (?:to|as)\s+(.+)$/i,
		/\b(?:title|name) of (?:my |the )?(?:site|website) to\s+(.+)$/i,
	] );
}

/**
 * The title of the page a message asks for, if it names one.
 *
 * @param {string} text Message.
 * @return {string} The title, or ''.
 */
export function getPageTitleFromText( text ) {
	const named = firstMatch( text, [
		/\bpages?\s+(?:called|named|titled)\s+(.+)$/i,
	] );

	if ( named ) {
		return named;
	}

	const kind = firstMatch(
		text,
		[
			/\b(?:add|create|make|start|build)\s+(?:me\s+)?(.+?)\s+pages?\b/i,
			/\bnew\s+(.+?)\s+pages?\b/i,
		],
		withoutFiller
	);

	return kind ? capitalize( kind ) : '';
}

/**
 * What kind of section a message asks for, if it says.
 *
 * @param {string} text Message.
 * @return {string} Words to search the section designs for, or ''.
 */
export function getSectionSearchFromText( text ) {
	return firstMatch(
		text,
		[
			/\b(?:add|insert|put|include|need|want)\s+(?:me\s+)?(.+?)\s+sections?\b/i,
			/\bsections?\s+(?:with|for|about|showing|of)\s+(?:my\s+|our\s+|the\s+)?(.+?)(?:\s+(?:to|on|in)\s+.*)?$/i,
		],
		withoutFiller
	);
}

/**
 * Whether a message only confirms what is waiting to be sent.
 *
 * @param {string} text Message.
 * @return {boolean} Whether it is a confirmation.
 */
export function isConfirmation( text ) {
	return CONFIRMATION.test( text );
}

/**
 * Work out what a message asks for.
 *
 * @param {string} text Message.
 * @return {?Object} `{ skill, params }`, or `null` when nothing matches.
 */
export function matchRequest( text ) {
	const message = String( text || '' ).trim();

	if ( ! message ) {
		return null;
	}

	const rule = RULES.find( ( { test } ) => test.test( message ) );

	if ( ! rule ) {
		return null;
	}

	switch ( rule.skill ) {
		case 'site-title':
			return {
				skill: rule.skill,
				params: { name: getSiteNameFromText( message ) },
			};
		case 'add-page':
			return {
				skill: rule.skill,
				params: { title: getPageTitleFromText( message ) },
			};
		case 'add-section':
			return {
				skill: rule.skill,
				params: { search: getSectionSearchFromText( message ) },
			};
	}

	return { skill: rule.skill, params: {} };
}
