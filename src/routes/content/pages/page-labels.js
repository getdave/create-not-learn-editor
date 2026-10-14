/**
 * How a page is labelled in lists: its icon, its role on the site and a badge
 * for its status.
 */

/**
 * Internal dependencies
 */
import {
	__,
	homeIcon,
	pageIcon,
	postListIcon,
} from '../../../wordpress-packages';

/**
 * A page's status as a badge, for the statuses visitors can't see.
 *
 * @param {string} status Page status.
 * @return {?Object} `{ intent, label }`, or null for a published page.
 */
export function getStatusBadge( status ) {
	switch ( status ) {
		case 'draft':
		case 'auto-draft':
			return { intent: 'draft', label: __( 'Draft' ) };
		case 'pending':
			return { intent: 'draft', label: __( 'Pending review' ) };
		case 'future':
			return { intent: 'informational', label: __( 'Scheduled' ) };
		case 'private':
			return { intent: 'informational', label: __( 'Private' ) };
		default:
			return null;
	}
}

export function getPageIcon( page, { frontPageId, postsPageId } ) {
	if ( Number( page.id ) === frontPageId ) {
		return homeIcon;
	}

	if ( Number( page.id ) === postsPageId ) {
		return postListIcon;
	}

	return pageIcon;
}

export function getPageRole( page, { frontPageId, postsPageId } ) {
	if ( Number( page.id ) === frontPageId ) {
		return __( 'Homepage' );
	}

	if ( Number( page.id ) === postsPageId ) {
		return __( 'Blog' );
	}

	return '';
}
