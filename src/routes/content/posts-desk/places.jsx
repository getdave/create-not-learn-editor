/**
 * The places down the side of the Posts desk: each status with how many posts
 * are in it, then the categories and tags in use. Picking one lists its posts
 * beside it.
 *
 * A status is an address of its own, `/types/post/list/<slug>`. A category or
 * tag is the "All" list narrowed with `?category=` or `?tag=`, and stands on
 * its own rather than narrowing a status, as a writer looks for "my travel
 * posts", not "my published travel posts".
 */

/**
 * Internal dependencies
 */
import { getPostViews } from '../post-views';
import {
	__,
	coreDataStore,
	decodeEntities,
	draftsIcon,
	Icon,
	lockIcon,
	pendingIcon,
	postCategoriesIcon,
	postListIcon,
	publishedIcon,
	scheduledIcon,
	tagIcon,
	trashIcon,
	useMemo,
	useSelect,
} from '../../../wordpress-packages';

const STATUS_ICONS = {
	all: postListIcon,
	drafts: draftsIcon,
	future: scheduledIcon,
	pending: pendingIcon,
	private: lockIcon,
	published: publishedIcon,
	trash: trashIcon,
};

// Shown whether or not they hold anything, so there's always somewhere to
// look for a draft or a post thrown away.
const ALWAYS_SHOWN = [ 'all', 'drafts', 'published', 'trash' ];

// The desk reads Drafts first, as that is where a writer picks up again.
const ORDER = [
	'all',
	'drafts',
	'published',
	'future',
	'pending',
	'private',
	'trash',
];

/*
 * Every term, used or not, as WordPress only counts published posts in a
 * term's count: a tag only drafts have yet would otherwise be missing. So the
 * places show no count for them either.
 */
const TERMS_QUERY = {
	_fields: 'id,name,count',
	orderby: 'count',
	order: 'desc',
	per_page: 20,
};

function getCountQuery( statuses ) {
	return {
		_fields: 'id',
		context: 'edit',
		per_page: 1,
		status: statuses.join( ',' ),
	};
}

/**
 * How many posts each status holds, by its slug, or `undefined` for one
 * still being counted.
 *
 * @return {Object<string, number|undefined>} Counts.
 */
function useStatusCounts() {
	return useSelect( ( select ) => {
		const store = select( coreDataStore );

		return Object.fromEntries(
			getPostViews().map( ( view ) => {
				const query = getCountQuery( view.statuses );

				// Asking for the records is what fetches the total.
				store.getEntityRecords( 'postType', 'post', query );

				return [
					view.slug,
					store.getEntityRecordsTotalItems?.(
						'postType',
						'post',
						query
					) ?? undefined,
				];
			} )
		);
	}, [] );
}

function Place( { count, icon, isCurrent, label, onClick } ) {
	return (
		<li>
			<button
				aria-current={ isCurrent ? 'page' : undefined }
				className="cnl-posts-desk__place"
				onClick={ onClick }
				type="button"
			>
				<Icon
					className="cnl-posts-desk__place-icon"
					icon={ icon }
					size={ 20 }
				/>
				<span className="cnl-posts-desk__place-label">{ label }</span>
				{ count !== undefined && (
					<span className="cnl-posts-desk__place-count">
						{ count }
					</span>
				) }
			</button>
		</li>
	);
}

function TermPlaces( { current, icon, label, onPick, terms } ) {
	if ( ! terms?.length ) {
		return null;
	}

	return (
		<>
			<h3 className="cnl-posts-desk__places-heading">{ label }</h3>
			<ul className="cnl-posts-desk__places-list" role="list">
				{ terms.map( ( term ) => (
					<Place
						icon={ icon }
						isCurrent={ current === term.id }
						key={ term.id }
						label={ decodeEntities( term.name ) }
						onClick={ () => onPick( term.id ) }
					/>
				) ) }
			</ul>
		</>
	);
}

/**
 * @param {Object}   props
 * @param {string}   props.statusSlug The status listed, when no category or
 *                                    tag is.
 * @param {number}   props.categoryId The category listed, if any.
 * @param {number}   props.tagId      The tag listed, if any.
 * @param {Function} props.onPick     Called with `{ status }`, `{ category }`
 *                                    or `{ tag }`.
 * @return {Element} The places.
 */
export default function PostsPlaces( {
	categoryId,
	onPick,
	statusSlug,
	tagId,
} ) {
	const counts = useStatusCounts();
	const { allCategories, defaultCategory, tags } = useSelect( ( select ) => {
		const store = select( coreDataStore );

		return {
			allCategories: store.getEntityRecords(
				'taxonomy',
				'category',
				TERMS_QUERY
			),
			defaultCategory: Number(
				store.getEntityRecord( 'root', 'site' )?.default_category
			),
			tags: store.getEntityRecords( 'taxonomy', 'post_tag', TERMS_QUERY ),
		};
	}, [] );
	// The default category, "Uncategorized" to begin with, only once
	// something is in it.
	const categories = useMemo(
		() =>
			allCategories?.filter(
				( term ) => term.count > 0 || term.id !== defaultCategory
			),
		[ allCategories, defaultCategory ]
	);
	const isTermPicked = !! categoryId || !! tagId;
	const views = getPostViews()
		.filter(
			( view ) =>
				ALWAYS_SHOWN.includes( view.slug ) || counts[ view.slug ]
		)
		.sort(
			( first, second ) =>
				ORDER.indexOf( first.slug ) - ORDER.indexOf( second.slug )
		);

	return (
		<nav aria-label={ __( 'Places' ) } className="cnl-posts-desk__places">
			<ul className="cnl-posts-desk__places-list" role="list">
				{ views.map( ( view ) => (
					<Place
						count={ counts[ view.slug ] }
						icon={ STATUS_ICONS[ view.slug ] }
						isCurrent={ ! isTermPicked && statusSlug === view.slug }
						key={ view.slug }
						label={ view.title }
						onClick={ () => onPick( { status: view.slug } ) }
					/>
				) ) }
			</ul>
			<TermPlaces
				current={ categoryId }
				icon={ postCategoriesIcon }
				label={ __( 'Categories' ) }
				onPick={ ( id ) => onPick( { category: id } ) }
				terms={ categories }
			/>
			<TermPlaces
				current={ tagId }
				icon={ tagIcon }
				label={ __( 'Tags' ) }
				onPick={ ( id ) => onPick( { tag: id } ) }
				terms={ tags }
			/>
		</nav>
	);
}
