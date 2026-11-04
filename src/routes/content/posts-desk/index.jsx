/**
 * The Posts desk: places down the side, the posts in the place picked beside
 * them, and the post picked on the canvas. A writer finds a post by its words,
 * so the list shows each one's title and the start of its text, with when it
 * was last touched and whether it is out.
 *
 * The list is DataViews' list layout, searched with its own search box. The
 * places are addresses, so the back button and a reload keep the place.
 */

/**
 * WordPress dependencies
 */
import { useNavigate, useParams, useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { useDataViews } from '../../../use-dataviews';
import { getPickedTerms } from '../use-content-records';
import { POSTS_DESK_FIELDS } from './fields';
import PostsPlaces from './places';
import {
	__,
	externalIcon,
	Spinner,
	useMemo,
} from '../../../wordpress-packages';

const getItemId = ( item ) => String( item.id );

/**
 * @param {Object}   props
 * @param {Element}  props.empty        What an empty place shows.
 * @param {boolean}  props.isLoading    Whether the posts are loading.
 * @param {Function} props.onChangeView Called with DataViews' next view.
 * @param {Function} props.onSelect     Called with the ID of a post picked.
 * @param {Object[]} props.posts        The posts in the place picked.
 * @param {?Object}  props.selectedPost The post on the canvas.
 * @param {string}   props.statusSlug   The status picked.
 * @param {number}   props.totalPages   Pages of posts.
 * @param {Object[]} props.trashActions Core's trash, restore and delete.
 * @param {Object}   props.view         DataViews' view.
 * @return {Element} The desk.
 */
export default function PostsDesk( {
	empty,
	isLoading,
	onChangeView,
	onSelect,
	posts,
	selectedPost,
	statusSlug,
	totalPages,
	trashActions,
	view,
} ) {
	const navigate = useNavigate();
	const params = useParams( { strict: false } );
	const searchParams = useSearch( { strict: false } );
	const dataViews = useDataViews();
	const { category, tag } = getPickedTerms( { name: 'post' }, searchParams );
	const actions = useMemo(
		() => [
			{
				callback: ( [ item ] ) =>
					window.open( item.link, '_blank', 'noopener,noreferrer' ),
				icon: externalIcon,
				id: 'view',
				isEligible: ( item ) =>
					item.status === 'publish' && !! item.link,
				label: __( 'View on your site' ),
				supportsBulk: false,
			},
			// In the menu, not on the row, where the first would be.
			...trashActions.map( ( action ) => ( {
				...action,
				isPrimary: false,
			} ) ),
		],
		[ trashActions ]
	);
	const selection = useMemo(
		() => ( selectedPost ? [ getItemId( selectedPost ) ] : [] ),
		[ selectedPost ]
	);

	const pickPlace = ( place ) => {
		// Keeps the way back to where the visit began.
		const from = searchParams.from ? { from: searchParams.from } : {};

		navigate( {
			search: {
				...from,
				category: place.category || undefined,
				tag: place.tag || undefined,
			},
			to: `/types/${ params.type }/list/${ place.status || 'all' }`,
		} );
	};

	let list = (
		<div className="cnl-editor-spinner">
			<Spinner />
		</div>
	);

	if ( dataViews ) {
		const { DataViews } = dataViews;

		list = (
			<DataViews
				actions={ actions }
				data={ posts }
				defaultLayouts={ { list: true } }
				empty={ empty }
				fields={ POSTS_DESK_FIELDS }
				getItemId={ getItemId }
				isLoading={ isLoading }
				onChangeSelection={ ( ids ) => onSelect( ids[ 0 ] ) }
				onChangeView={ onChangeView }
				paginationInfo={ {
					totalItems: posts.length,
					totalPages,
				} }
				selection={ selection }
				view={ view }
			>
				<div className="cnl-posts-desk__search">
					<DataViews.Search label={ __( 'Search posts' ) } />
				</div>
				<div className="cnl-posts-desk__scroll">
					<DataViews.Layout />
					<DataViews.Pagination />
				</div>
			</DataViews>
		);
	}

	return (
		<div className="cnl-posts-desk">
			<PostsPlaces
				categoryId={ category }
				onPick={ pickPlace }
				statusSlug={ statusSlug }
				tagId={ tag }
			/>
			<div className="cnl-posts-desk__list">{ list }</div>
		</div>
	);
}
