/**
 * Internal dependencies
 */
import { getTitleText } from '../../records';
import { isPageInMenu } from './menu-status';
import { getStatusLabel } from './helpers';
import { useDataViews } from '../../use-dataviews';
import {
	Badge,
	coreDataStore,
	Stack,
	__,
	sprintf,
	useMemo,
	useSelect,
} from '../../wordpress-packages';

const NO_AUTHORS = new Map();

export const DEFAULT_CONTENT_LAYOUTS = {
	list: true,
	table: {
		layout: {
			styles: {
				author: {
					align: 'start',
				},
			},
		},
	},
};

const STATUS_OPTIONS = [
	{ label: __( 'Published' ), value: 'publish' },
	{ label: __( 'Draft' ), value: 'draft' },
	{ label: __( 'Scheduled' ), value: 'future' },
	{ label: __( 'Pending review' ), value: 'pending' },
	{ label: __( 'Private' ), value: 'private' },
];

function getDateLabel( post ) {
	const date = post?.date || post?.modified;

	if ( ! date ) {
		return __( 'No date' );
	}

	const prefix =
		post.status === 'publish' ? __( 'Published' ) : __( 'Modified' );
	const formatted = new Date( date ).toLocaleString( undefined, {
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		month: 'short',
		year: 'numeric',
	} );

	return sprintf(
		/* translators: 1: date prefix, 2: formatted date. */
		__( '%1$s: %2$s' ),
		prefix,
		formatted
	);
}

function getStatusIntent( status ) {
	switch ( status ) {
		case 'draft':
		case 'auto-draft':
		case 'pending':
			return 'draft';
		case 'future':
		case 'private':
			return 'informational';
		default:
			return 'none';
	}
}

function renderSiteRoleBadges( item, siteRoles ) {
	const badges = [];

	if ( item.status !== 'publish' ) {
		badges.push( {
			intent: getStatusIntent( item.status ),
			label: getStatusLabel( item.status ),
		} );
	}

	if ( Number( item.id ) === siteRoles.frontPageId ) {
		badges.push( { intent: 'informational', label: __( 'Homepage' ) } );
	}

	if ( Number( item.id ) === siteRoles.postsPageId ) {
		badges.push( { intent: 'informational', label: __( 'Blog' ) } );
	}

	if ( siteRoles.menuPages ) {
		badges.push(
			isPageInMenu( item, siteRoles.menuPages )
				? { intent: 'stable', label: __( 'In menu' ) }
				: { intent: 'none', label: __( 'Not in menu' ) }
		);
	}

	return (
		<Stack className="routes-post-list__badges" gap="xs" wrap="wrap">
			{ badges.map( ( badge ) => (
				<Badge intent={ badge.intent } key={ badge.label }>
					{ badge.label }
				</Badge>
			) ) }
		</Stack>
	);
}

/**
 * The names of the people who wrote the given posts.
 *
 * @param {Object[]} posts Post records.
 * @return {Map<number, string>} Author names keyed by user ID.
 */
export function usePostAuthors( posts ) {
	const authorIds = useMemo(
		() =>
			[
				...new Set(
					posts
						.map( ( post ) => Number( post.author ) )
						.filter( ( id ) => id > 0 )
				),
			].sort( ( first, second ) => first - second ),
		[ posts ]
	);
	const authorIdsKey = authorIds.join( ',' );
	const users = useSelect(
		( select ) =>
			authorIdsKey
				? select( coreDataStore ).getEntityRecords( 'root', 'user', {
						_fields: 'id,name',
						context: 'view',
						include: authorIdsKey,
						per_page: 100,
					} )
				: null,
		[ authorIdsKey ]
	);

	return useMemo(
		() =>
			users
				? new Map( users.map( ( user ) => [ user.id, user.name ] ) )
				: NO_AUTHORS,
		[ users ]
	);
}

function getAuthorName( item, authors ) {
	const authorId = Number( item.author );

	if ( ! authorId ) {
		return __( 'No author' );
	}

	return authors.get( authorId ) || '';
}

export function getContentFields( siteRoles = {}, authors = NO_AUTHORS ) {
	return [
		{
			enableGlobalSearch: true,
			enableHiding: false,
			getValue: ( { item } ) => getTitleText( item.title ),
			id: 'title',
			label: __( 'Title' ),
			render: ( { item } ) => (
				<span className="cnl-editor-dataviews-title">
					{ getTitleText( item.title ) }
				</span>
			),
			type: 'text',
		},
		{
			enableSorting: false,
			filterBy: false,
			getValue: ( { item } ) => getAuthorName( item, authors ),
			id: 'author',
			label: __( 'Author' ),
			type: 'text',
		},
		{
			elements: STATUS_OPTIONS,
			enableSorting: false,
			filterBy: {
				operators: [ 'isAny' ],
			},
			getValue: ( { item } ) => getStatusLabel( item.status ),
			id: 'status',
			label: __( 'Status' ),
			render: ( { item } ) =>
				item.status === 'publish' ? (
					getStatusLabel( item.status )
				) : (
					<Badge intent={ getStatusIntent( item.status ) }>
						{ getStatusLabel( item.status ) }
					</Badge>
				),
			type: 'text',
		},
		siteRoles.isPages && {
			enableSorting: false,
			filterBy: false,
			getValue: ( { item } ) =>
				isPageInMenu( item, siteRoles.menuPages )
					? __( 'In menu' )
					: __( 'Not in menu' ),
			id: 'on-site',
			label: __( 'Details' ),
			render: ( { item } ) => renderSiteRoleBadges( item, siteRoles ),
			type: 'text',
		},
		{
			enableSorting: false,
			filterBy: false,
			getValue: ( { item } ) => Number( item.comment_count ) || 0,
			id: 'comments',
			label: __( 'Comments' ),
			render: ( { item } ) => Number( item.comment_count ) || 0,
			type: 'integer',
		},
		{
			getValue: ( { item } ) => item.date || item.modified || '',
			id: 'date',
			label: __( 'Date' ),
			render: ( { item } ) => getDateLabel( item ),
			type: 'datetime',
		},
	].filter( Boolean );
}

export function getContentActions( navigate, type ) {
	return [
		{
			callback: ( items ) => {
				const item = items[ 0 ];
				if ( item?.id ) {
					navigate( {
						to: `/types/${ type.name }/edit/${ item.id }`,
					} );
				}
			},
			id: 'edit',
			isPrimary: true,
			label: __( 'Edit' ),
			supportsBulk: false,
		},
		{
			callback: ( items ) => {
				const item = items[ 0 ];
				if ( item?.link ) {
					window.open( item.link, '_blank', 'noopener,noreferrer' );
				}
			},
			id: 'open-preview',
			isEligible: ( item ) => !! item.link,
			label: __( 'Open preview' ),
			supportsBulk: false,
		},
	];
}

export function PostListDataViewsLayout() {
	// Only rendered inside `DataViews`, so the module has loaded.
	const { DataViews } = useDataViews();

	return (
		<div className="routes-post-list__dataviews">
			<div className="routes-post-list__dataviews-toolbar">
				<div className="routes-post-list__dataviews-toolbar-start">
					<DataViews.Search label={ __( 'Search content' ) } />
					<DataViews.FiltersToggle />
				</div>
				<div className="routes-post-list__dataviews-toolbar-end">
					<DataViews.ViewConfig />
					<DataViews.LayoutSwitcher />
				</div>
			</div>
			<DataViews.FiltersToggled className="routes-post-list__dataviews-filters" />
			<div className="routes-post-list__dataviews-scroll">
				<DataViews.Layout />
				<DataViews.Pagination />
			</div>
		</div>
	);
}
