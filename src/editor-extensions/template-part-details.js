/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Build the overlay button's label.
 *
 * @param {string} [areaLabel] The theme's label for the part's area, such as "Header".
 * @param {string} [title]     The template part's own title.
 * @return {string} Button label.
 */
export function getTemplatePartEditLabel( areaLabel, title ) {
	const name = ( areaLabel || title || '' ).trim();

	if ( ! name ) {
		return __( 'Edit template part' );
	}

	return sprintf(
		/* translators: %s: template part area or title, for example "Header". */
		__( 'Edit %s' ),
		name
	);
}

/**
 * Build a template part's entity ID from its block attributes.
 *
 * @param {Object} attributes  Template part block attributes.
 * @param {string} [themeSlug] Stylesheet of the current theme, used when the block names no theme.
 * @return {string|null} Entity ID, or null when the block has no part yet.
 */
export function getTemplatePartId( attributes, themeSlug ) {
	const theme = attributes?.theme || themeSlug;

	return attributes?.slug && theme
		? `${ theme }//${ attributes.slug }`
		: null;
}

/**
 * Find the theme's label for a template part area.
 *
 * @param {Array}  [definedAreas] The theme's `default_template_part_areas`.
 * @param {string} [area]         Area the part belongs to.
 * @return {string|undefined} The area's label, when the theme defines one.
 */
export function getTemplatePartAreaLabel( definedAreas, area ) {
	return definedAreas?.find( ( definedArea ) => definedArea.area === area )
		?.label;
}
