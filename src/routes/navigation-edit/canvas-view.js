/**
 * WordPress dependencies
 */
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Device types the editor canvas can be rendered at.
 *
 * Lowercase in URLs, PascalCase in the editor store, which is what
 * `setDeviceType` expects.
 */
export const CANVAS_VIEW_DEVICES = [ 'Desktop', 'Tablet', 'Mobile' ];

export const DEFAULT_CANVAS_VIEW_DEVICE = 'Desktop';

/**
 * Normalize a device type to one the editor canvas has a width for.
 *
 * @param {string} value Device type.
 * @return {string} A supported device type.
 */
export function getCanvasViewDevice( value ) {
	return CANVAS_VIEW_DEVICES.includes( value )
		? value
		: DEFAULT_CANVAS_VIEW_DEVICE;
}

/**
 * Summarize where a menu is shown, for the canvas header.
 *
 * Shown in both canvas views: in the locations view it labels what is below it,
 * and in the site preview it explains why a menu may be missing from the page.
 *
 * @param {number} count Number of locations the menu is assigned to.
 * @return {string} Summary text.
 */
export function getMenuLocationsSummary( count ) {
	if ( ! count ) {
		return __( 'Not shown on your site' );
	}

	return sprintf(
		/* translators: %d: Number of locations where this navigation menu is shown. */
		_n( 'Shown in %d location', 'Shown in %d locations', count ),
		count
	);
}
