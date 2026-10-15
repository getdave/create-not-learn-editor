/**
 * Internal dependencies
 */
import { getTitleText } from '../../records';
import { isPageInMenu } from './menu-status';
import { getStatusLabel } from './helpers';
import { Badge, DataViews, Stack, __, sprintf } from '../../wordpress-packages';

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

export function getContentFields( siteRoles = {} ) {
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
			getValue: ( { item } ) => item.author || '',
			id: 'author',
			label: __( 'Author' ),
			render: ( { item } ) =>
				sprintf(
					/* translators: %s: author ID. */
					__( 'Author ID %s' ),
					item.author || __( 'Unknown' )
				),
			type: 'integer',
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
