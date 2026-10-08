/**
 * Data shared by the Site Overview's sidebar and canvas.
 */

/**
 * WordPress dependencies
 */
import { useNavigate, useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { namespace } from '../../settings';
import { cnlEditorStore } from '../../records';
import {
	__,
	homeIcon,
	pageIcon,
	postIcon,
	postListIcon,
	sprintf,
	storeIcon,
	useCallback,
	useSelect,
} from '../../wordpress-packages';

export const SITE_OVERVIEW_PATH = '/site-overview';

/**
 * The site overview, as it comes from the REST API.
 *
 * @return {Object} `{ error, isLoading, siteOverview }`.
 */
export function useSiteOverview() {
	return useSelect( ( select ) => {
		const store = select( cnlEditorStore );

		return {
			error: store.getSiteOverviewError(),
			isLoading: ! store.hasFinishedResolution( 'getSiteOverview', [
				namespace,
			] ),
			siteOverview: store.getSiteOverview( namespace ),
		};
	}, [] );
}

/**
 * The selected page, kept in the URL so the sidebar and canvas share it.
 *
 * @return {Array} `[ selectedId, setSelectedId ]`.
 */
export function useSelectedNode() {
	const navigate = useNavigate();
	const search = useSearch( { strict: false } );
	const selectedId = typeof search?.node === 'string' ? search.node : '';
	const setSelectedId = useCallback(
		( id ) => {
			const { node, ...rest } = search || {};

			if ( ( node || '' ) === ( id || '' ) ) {
				return;
			}

			navigate( {
				search: id ? { ...rest, node: id } : rest,
				to: SITE_OVERVIEW_PATH,
			} );
		},
		[ navigate, search ]
	);

	return [ selectedId, setSelectedId ];
}

/**
 * What kind of page a node is, in plain words.
 *
 * @param {Object} node Site Overview node.
 * @return {string} Label.
 */
export function getNodeKindLabel( node ) {
	switch ( node?.kind ) {
		case 'home':
			return __( 'Homepage' );
		case 'collection':
			return __( 'Collection' );
		case 'single':
			return __( 'Single' );
		default:
			return __( 'Page' );
	}
}

/**
 * Whether WordPress builds the page from content, rather than someone making
 * it by hand.
 *
 * @param {Object} node Site Overview node.
 * @return {boolean} Whether the page is dynamic.
 */
export function isDynamicNode( node ) {
	return (
		node?.kind === 'collection' ||
		node?.kind === 'single' ||
		( node?.kind === 'home' && ! node?.postId )
	);
}

export function getNodeIcon( node ) {
	if ( node?.kind === 'home' ) {
		return homeIcon;
	}

	if ( node?.kind === 'collection' ) {
		return node.group === 'product' ? storeIcon : postListIcon;
	}

	if ( node?.kind === 'single' ) {
		return postIcon;
	}

	return pageIcon;
}

/**
 * How many items a collection lists, in words.
 *
 * @param {number} count Items.
 * @param {Object} group Content type the items are.
 * @return {string} Label, like "12 posts".
 */
export function getItemCountLabel( count, group ) {
	if ( ! group ) {
		return '';
	}

	return sprintf(
		/* translators: 1: Number of items. 2: Content type label, e.g. "posts". */
		__( '%1$d %2$s' ),
		count,
		( count === 1 ? group.singular : group.label ).toLowerCase()
	);
}

/**
 * Whether a page's status should be pointed out: anything not published.
 *
 * @param {Object} node Site Overview node.
 * @return {boolean} Whether to show the status.
 */
export function hasNotableStatus( node ) {
	return Boolean( node?.status && node.status !== 'publish' );
}
