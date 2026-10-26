/**
 * A section that lists posts, through a query loop somewhere inside it. Its
 * bar has Manage posts (or Manage products, from the loop's post type), a
 * menu with the few things worth changing about the list: how many it
 * shows, which category, and the order. Nothing else of the query loop's is
 * offered. The menu also leads to the posts' own screen, where they are
 * written.
 *
 * In a grid, how many is offered in whole rows of the theme's own grid, so
 * the last row is never half empty; the arrangement itself is Layout's to
 * change. A loop that lists whatever the page it is on would, as an
 * archive's does, follows WordPress's own query, so it can't be changed.
 */

/**
 * Internal dependencies
 */
import {
	blockEditorStore,
	coreDataStore,
	useDispatch,
	useSelect,
} from '../../wordpress-packages';

export const QUERY_BLOCK = 'core/query';
export const POST_TEMPLATE_BLOCK = 'core/post-template';

// How many rows of a grid can show.
const ROW_OPTIONS = [ 1, 2, 3 ];
// How many a list of posts, rather than a grid, can show.
const LIST_OPTIONS = [ 3, 5, 10 ];

export const ORDER_NEWEST = 'desc';
export const ORDER_OLDEST = 'asc';

const DEFAULT_PER_PAGE = 3;

/**
 * The first query loop in a block, the block itself included.
 *
 * @param {?Object} block A block, with its inner blocks.
 * @return {?Object} The query loop, or null.
 */
export function findQueryBlock( block ) {
	if ( ! block ) {
		return null;
	}

	if ( block.name === QUERY_BLOCK ) {
		return block;
	}

	for ( const inner of block.innerBlocks || [] ) {
		const found = findQueryBlock( inner );

		if ( found ) {
			return found;
		}
	}

	return null;
}

/**
 * The post type a query loop lists. One that follows the page's own query
 * lists posts, as an archive or the blog does.
 *
 * @param {Object} queryBlock A query loop.
 * @return {string} The post type's name.
 */
export function getQueryPostType( queryBlock ) {
	const query = queryBlock?.attributes?.query || {};

	return ( ! query.inherit && query.postType ) || 'post';
}

/**
 * How a query loop lists its posts, as the Posts choice offers it.
 *
 * @param {Object} queryBlock A query loop, with its inner blocks.
 * @return {Object} `{ inherit, perPage, order, termIds, perRow }`:
 *                  `perRow` is how many sit side by side in a grid, or null
 *                  for a list.
 */
export function getQueryLayout( queryBlock ) {
	const query = queryBlock.attributes.query || {};
	const template = ( queryBlock.innerBlocks || [] ).find(
		( inner ) => inner.name === POST_TEMPLATE_BLOCK
	);
	const layout = template?.attributes?.layout;
	const perRow =
		layout?.type === 'grid' ? Number( layout.columnCount ) || null : null;

	return {
		inherit: Boolean( query.inherit ),
		order: query.order === ORDER_OLDEST ? ORDER_OLDEST : ORDER_NEWEST,
		perPage: Number( query.perPage ) || DEFAULT_PER_PAGE,
		perRow,
		termIds: getIncludedTermIds( query.taxQuery ),
	};
}

/**
 * How many posts a query loop can be set to show: whole rows of its grid, or
 * a few for a list.
 *
 * @param {Object} layout From `getQueryLayout`.
 * @return {number[]} The numbers, smallest first.
 */
export function getCountOptions( layout ) {
	return layout.perRow
		? ROW_OPTIONS.map( ( rows ) => rows * layout.perRow )
		: LIST_OPTIONS;
}

/**
 * The terms a query loop is limited to, whichever taxonomy they are in.
 * Reads the shape Gutenberg uses now, `{ include: { category: [ … ] } }`,
 * and the older one, `{ category: [ … ] }`.
 *
 * @param {?Object} taxQuery The query's `taxQuery`.
 * @return {number[]} The term IDs.
 */
export function getIncludedTermIds( taxQuery ) {
	if ( ! taxQuery || typeof taxQuery !== 'object' ) {
		return [];
	}

	const included =
		'include' in taxQuery || 'exclude' in taxQuery
			? taxQuery.include || {}
			: taxQuery;

	return Object.values( included ).flat().map( Number ).filter( Boolean );
}

/**
 * A query limited to one term, or to none.
 *
 * @param {Object}  query    The query loop's `query`.
 * @param {string}  taxonomy The taxonomy's slug.
 * @param {?number} termId   The term, or null for every post.
 * @return {Object} The new query.
 */
export function withTerm( query, taxonomy, termId ) {
	const exclude = query.taxQuery?.exclude;
	const include = termId ? { [ taxonomy ]: [ termId ] } : undefined;
	const taxQuery =
		include || exclude
			? {
					...( include && { include } ),
					...( exclude && { exclude } ),
				}
			: undefined;

	return { ...query, taxQuery };
}

/**
 * The query loop in a section, and the post type it lists, while that type
 * has a screen of its own in the editor.
 *
 * @param {?string} clientId The section.
 * @return {?Object} `{ queryId, postType, label, name }`: `label` is the
 *                   type's plural name, as the screen is titled, and `name`
 *                   the type's own. Null when the section lists no posts.
 */
export function usePostsSection( clientId ) {
	return useSelect(
		( select ) => {
			if ( ! clientId ) {
				return null;
			}

			const queryBlock = findQueryBlock(
				select( blockEditorStore ).getBlock( clientId )
			);

			if ( ! queryBlock ) {
				return null;
			}

			const name = getQueryPostType( queryBlock );
			const type = select( coreDataStore ).getPostType( name );

			if ( ! type || type.visibility?.show_ui === false ) {
				return null;
			}

			return {
				label: type.labels?.name || type.name,
				name,
				queryId: queryBlock.clientId,
			};
		},
		[ clientId ]
	);
}

/**
 * Manage posts' controls, for a section that lists posts.
 *
 * @param {string} clientId The section.
 * @return {?Object} `{ label, layout, counts, terms, onCount, onTerm,
 *                   onOrder }`, or null when it lists none or follows the
 *                   page's own query. `terms` are `{ id, name }`, the
 *                   taxonomy's busiest first.
 */
export function usePostsChoice( clientId ) {
	const posts = usePostsSection( clientId );
	const { updateBlockAttributes } = useDispatch( blockEditorStore );
	const { queryBlock, taxonomy, terms } = useSelect(
		( select ) => {
			const block =
				posts && select( blockEditorStore ).getBlock( posts.queryId );

			if ( ! block ) {
				return {};
			}

			// The type's own categories, as a shop's products have theirs.
			const taxonomies = select( coreDataStore ).getTaxonomies( {
				per_page: -1,
				type: posts.name,
			} );
			const slug = taxonomies?.find(
				( item ) => item.hierarchical && item.visibility?.show_ui
			)?.slug;

			return {
				queryBlock: block,
				taxonomy: slug,
				terms: slug
					? select( coreDataStore ).getEntityRecords(
							'taxonomy',
							slug,
							{
								_fields: 'id,name',
								hide_empty: true,
								order: 'desc',
								orderby: 'count',
								per_page: 20,
							}
						)
					: null,
			};
		},
		[ posts?.queryId, posts?.name ]
	);

	if ( ! posts || ! queryBlock ) {
		return null;
	}

	const layout = getQueryLayout( queryBlock );

	if ( layout.inherit ) {
		return null;
	}

	const query = queryBlock.attributes.query || {};
	const setQuery = ( changes ) =>
		updateBlockAttributes( posts.queryId, {
			query: { ...query, ...changes },
		} );

	return {
		counts: getCountOptions( layout ),
		label: posts.label,
		layout,
		onOrder: ( order ) =>
			setQuery( {
				order,
				orderBy: query.orderBy || 'date',
			} ),
		onCount: ( perPage ) => setQuery( { perPage } ),
		onTerm: ( termId ) =>
			updateBlockAttributes( posts.queryId, {
				query: withTerm( query, taxonomy, termId ),
			} ),
		terms: taxonomy && terms ? terms : null,
	};
}
