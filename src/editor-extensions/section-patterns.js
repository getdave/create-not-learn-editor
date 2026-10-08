/**
 * Every pattern added to a page arrives as content-only sections.
 *
 * Core treats a block carrying `metadata.patternName` as a content-only
 * section: its layout and styles are locked, and only its text, images and
 * links can be changed until "Edit section" unlocks it. Core stamps that name
 * on a pattern's blocks when it parses the pattern, but only when the pattern
 * has a single top-level block. One with several, such as a heading followed by
 * columns, would land fully editable.
 *
 * So the name is stamped on each top-level block of those patterns as they
 * arrive from the REST API, before core parses them. Only the opening
 * delimiter of each top-level block is rewritten. The rest of the markup is
 * left exactly as the theme wrote it, because re-serialising it would
 * normalise whitespace that some blocks, such as preformatted text, keep.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * for the same reason as `template-part-editing.js`: this is registered from
 * app init, and the barrel would make the editor a static dependency of boot.
 */

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';

const PATTERNS_PATH = /^\/wp\/v2\/block-patterns\/patterns(?:\?|$)/;

/**
 * Block comment delimiters, as matched by
 * `@wordpress/block-serialization-default-parser`. Groups: closer slash,
 * namespace with its slash, name, attributes JSON, (internal), void slash.
 */
const DELIMITER =
	/<!--\s+(\/)?wp:([a-z][a-z0-9_-]*\/)?([a-z][a-z0-9_-]*)\s+({(?:(?=([^}]+|}+(?=})|(?!}\s+\/?-->)[^])*)\5|[^]*?)}\s+)?(\/)?-->/g;

/**
 * Serialise block attributes the way core does in `serializeAttributes`, which
 * `@wordpress/blocks` does not export, so the JSON cannot close the comment.
 *
 * @param {Object} attributes Block attributes.
 * @return {string} Attributes JSON, safe inside a block comment.
 */
function serializeAttributes( attributes ) {
	return JSON.stringify( attributes )
		.replaceAll( '\\\\', '\\u005c' )
		.replaceAll( '--', '\\u002d\\u002d' )
		.replaceAll( '<', '\\u003c' )
		.replaceAll( '>', '\\u003e' )
		.replaceAll( '&', '\\u0026' )
		.replaceAll( '\\"', '\\u0022' );
}

/**
 * Stamp a pattern's name on each of its top-level blocks, so core treats every
 * one of them as a content-only section.
 *
 * Patterns with a single top-level block are left alone, because core stamps
 * those itself, along with a name for List View.
 *
 * @param {string} content     Pattern markup.
 * @param {string} patternName Pattern name.
 * @return {string} The markup, stamped where needed.
 */
export function stampPatternName( content, patternName ) {
	if ( typeof content !== 'string' || ! patternName ) {
		return content;
	}

	const roots = [];
	let depth = 0;

	for ( const match of content.matchAll( DELIMITER ) ) {
		const [ , isCloser, , , , , isVoid ] = match;

		if ( isCloser ) {
			depth = Math.max( 0, depth - 1 );
			continue;
		}

		if ( depth === 0 ) {
			roots.push( match );
		}

		if ( ! isVoid ) {
			depth++;
		}
	}

	if ( roots.length < 2 ) {
		return content;
	}

	let stamped = '';
	let offset = 0;

	for ( const root of roots ) {
		const [ token, , namespace = '', name, json, , isVoid ] = root;
		let attributes;

		try {
			attributes = json ? JSON.parse( json ) : {};
		} catch {
			return content;
		}

		const next = {
			...attributes,
			metadata: { ...attributes.metadata, patternName },
		};

		stamped +=
			content.slice( offset, root.index ) +
			`<!-- wp:${ namespace }${ name } ${ serializeAttributes( next ) } ${
				isVoid ? '/' : ''
			}-->`;
		offset = root.index + token.length;
	}

	return stamped + content.slice( offset );
}

/**
 * Stamp the block patterns core-data fetches.
 *
 * @param {Object}   options Request options.
 * @param {Function} next    Next middleware.
 * @return {Promise} The response.
 */
function sectionPatternsMiddleware( options, next ) {
	const response = next( options );

	if ( options.parse === false || ! PATTERNS_PATH.test( options.path ) ) {
		return response;
	}

	return response.then( ( patterns ) =>
		Array.isArray( patterns )
			? patterns.map( ( pattern ) => ( {
					...pattern,
					content: stampPatternName( pattern.content, pattern.name ),
				} ) )
			: patterns
	);
}

let isRegistered = false;

/**
 * Register the pattern stamping. Safe to call more than once. Call it before
 * anything fetches patterns, since core-data keeps the first response.
 */
export function registerSectionPatterns() {
	if ( isRegistered ) {
		return;
	}

	apiFetch.use( sectionPatternsMiddleware );
	isRegistered = true;
}
