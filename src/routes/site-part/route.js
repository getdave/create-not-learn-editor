/**
 * Internal dependencies
 */
import { __ } from '../../wordpress-packages';

function createRoute( title ) {
	return {
		title: () => title,
		async canvas() {
			// The screen's own canvas, from its content module.
			return null;
		},
	};
}

export const sitePartsRoute = createRoute( __( 'Header & footer' ) );
export const headerRoute = createRoute( __( 'Header' ) );
export const footerRoute = createRoute( __( 'Footer' ) );
