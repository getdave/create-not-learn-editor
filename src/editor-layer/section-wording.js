/**
 * Core's pattern wording, said as sections while a page is being edited.
 *
 * Everywhere else in this editor, patterns are called sections. Core's own
 * strings are swapped through the i18n filters rather than by reaching into
 * its components, and only while a page is open in the edit canvas, so other
 * post types and other screens keep core's wording.
 *
 * Strings are swapped whole rather than word by word, so "Pattern Directory",
 * links to WordPress.org and the starter page picker, which offers whole pages
 * rather than sections, keep theirs.
 *
 * Each replacement is translated when it is asked for, so it follows the
 * site's language like the string it replaces.
 */

/**
 * WordPress dependencies
 */
import { useEffect } from '@wordpress/element';
import { addFilter, removeFilter } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';

const NAMESPACE = 'create-not-learn-editor/section-wording';

/**
 * Separates a string's context from its text, as in gettext.
 */
const CONTEXT_SEPARATOR = '\u0004';

const SECTION_WORDING = {
	Patterns: () => __( 'Sections' ),
	Pattern: () => __( 'Section' ),
	'Patterns list': () => __( 'Sections list' ),
	'My patterns': () => __( 'My sections' ),
	'My pattern': () => __( 'My section' ),
	'A block pattern.': () => __( 'A section.' ),
	'Explore all patterns': () => __( 'Explore all sections' ),
	'Filter patterns': () => __( 'Filter sections' ),
	'Drag and drop patterns into the canvas.': () =>
		__( 'Drag and drop sections into the canvas.' ),
	'Drop pattern.': () => __( 'Drop section.' ),
	'Next pattern': () => __( 'Next section' ),
	'Previous pattern': () => __( 'Previous section' ),
	'Pattern "%s" inserted.': () =>
		/* translators: %s: section name. */
		__( 'Section "%s" inserted.' ),
	'Edit pattern': () => __( 'Edit section' ),
	'Exit pattern': () => __( 'Exit section' ),
	'Enable editing all patterns': () => __( 'Enable editing all sections' ),
	'Disable editing all patterns': () => __( 'Disable editing all sections' ),
	'Create pattern': () => __( 'Create section' ),
	'Duplicate pattern': () => __( 'Duplicate section' ),
	'Rename pattern': () => __( 'Rename section' ),
	'Pattern renamed': () => __( 'Section renamed' ),
	'Manage patterns': () => __( 'Manage sections' ),
	'Sync this pattern across multiple locations.': () =>
		__( 'Sync this section across multiple locations.' ),
	'Synced pattern created: %s': () =>
		/* translators: %s: section name. */
		__( 'Synced section created: %s' ),
	'Unsynced pattern created: %s': () =>
		/* translators: %s: section name. */
		__( 'Unsynced section created: %s' ),
	'Detach pattern?': () => __( 'Detach section?' ),
	'Blocks will no longer be associated with this pattern and will be fully editable.':
		() =>
			__(
				'Blocks will no longer be associated with this section and will be fully editable.'
			),
	'The blocks will be separated from the original pattern and will be fully editable. Future changes to the pattern will not apply here.':
		() =>
			__(
				'The blocks will be separated from the original section and will be fully editable. Future changes to the section will not apply here.'
			),
	[ `Generic label for pattern inserter button${ CONTEXT_SEPARATOR }Add pattern` ]:
		() => __( 'Add section' ),
	[ `block title${ CONTEXT_SEPARATOR }Pattern` ]: () => __( 'Section' ),
};

/**
 * The section wording for one of core's pattern strings.
 *
 * @param {string}  text    Untranslated string.
 * @param {?string} context Its translation context, if any.
 * @return {string|undefined} The section wording, or undefined to keep core's.
 */
export function getSectionWording( text, context ) {
	const key = context ? `${ context }${ CONTEXT_SEPARATOR }${ text }` : text;

	return Object.hasOwn( SECTION_WORDING, key )
		? SECTION_WORDING[ key ]()
		: undefined;
}

function filterGettext( translation, text ) {
	return getSectionWording( text ) ?? translation;
}

function filterGettextWithContext( translation, text, context ) {
	return getSectionWording( text, context ) ?? translation;
}

/**
 * Start saying sections for patterns.
 *
 * Filtered on the default text domain only, which is core's.
 *
 * @return {Function} Stops it again.
 */
export function enableSectionWording() {
	addFilter( 'i18n.gettext_default', NAMESPACE, filterGettext );
	addFilter(
		'i18n.gettext_with_context_default',
		NAMESPACE,
		filterGettextWithContext
	);

	return () => {
		removeFilter( 'i18n.gettext_default', NAMESPACE );
		removeFilter( 'i18n.gettext_with_context_default', NAMESPACE );
	};
}

/**
 * Say sections for patterns for as long as `isActive` is true.
 *
 * Core's strings are read again on every render, so anything drawn after this
 * turns on, such as the inserter or a selected section's toolbar, uses the new
 * wording.
 *
 * @param {boolean} isActive Whether to swap the wording.
 */
export function useSectionWording( isActive ) {
	useEffect(
		() => ( isActive ? enableSectionWording() : undefined ),
		[ isActive ]
	);
}
