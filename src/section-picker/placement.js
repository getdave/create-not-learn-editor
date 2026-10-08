/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Where a new section will go, as a sentence.
 *
 * @param {?string} previousTitle Title of the section it goes after.
 * @param {?string} nextTitle     Title of the section it goes before.
 * @return {string} The placement sentence.
 */
export function getPlacementText( previousTitle, nextTitle ) {
	if ( ! previousTitle && ! nextTitle ) {
		return __( 'It will be the first thing on the page.' );
	}

	if ( ! previousTitle ) {
		return sprintf(
			/* translators: %s: section name. */
			__( 'It will go at the top, above “%s”.' ),
			nextTitle
		);
	}

	if ( ! nextTitle ) {
		return __( 'It will go at the end of the page.' );
	}

	return sprintf(
		/* translators: %s: section name. */
		__( 'It will go after “%s”.' ),
		previousTitle
	);
}
