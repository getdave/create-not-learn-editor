/**
 * Internal dependencies
 */
import { getTitleText } from '../../records';
import { __ } from '../../wordpress-packages';
import { getNavigationPageTitle } from './navigation-blocks';

export const NAVIGATION_POST_TYPE = 'wp_navigation';
export const EMPTY_ARRAY = [];

export function getMenuTitle( menu ) {
	return getTitleText( menu?.title ) || __( 'Navigation' );
}

export function getPageTitle( page ) {
	return getNavigationPageTitle( page ) || __( '(no title)' );
}
