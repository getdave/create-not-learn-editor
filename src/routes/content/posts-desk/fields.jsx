/**
 * What the Posts desk's list shows of each post, as DataViews fields: its
 * title, the start of its words, when it was last touched and where it is.
 *
 * Laid out by DataViews' list layout, title first, the excerpt under it and
 * the rest on a line of their own.
 */

/**
 * Internal dependencies
 */
import { getTitleText } from '../../../records';
import { getStatusLabel } from '../helpers';
import {
	__,
	Badge,
	decodeEntities,
	sprintf,
} from '../../../wordpress-packages';

const STATUS_INTENTS = {
	draft: 'draft',
	future: 'informational',
	pending: 'draft',
	private: 'informational',
	publish: 'stable',
};

function isSameDay( first, second ) {
	return first.toDateString() === second.toDateString();
}

/**
 * A short date, as a writer's notes app gives one: the time for today, the
 * day and month for this year, and the year too for anything older.
 *
 * @param {string} value Date, as the REST API gives it.
 * @param {Date}   now   Today.
 * @return {string} The date.
 */
export function getShortDate( value, now = new Date() ) {
	const date = new Date( value );

	if ( Number.isNaN( date.getTime() ) ) {
		return '';
	}

	if ( isSameDay( date, now ) ) {
		return date.toLocaleTimeString( undefined, {
			hour: 'numeric',
			minute: '2-digit',
		} );
	}

	return date.toLocaleDateString( undefined, {
		day: 'numeric',
		month: 'short',
		year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
	} );
}

/**
 * When a post was last touched, as the list says it. A draft is dated by its
 * last change and a scheduled post by when it goes live.
 *
 * @param {Object} post Post record.
 * @param {Date}   now  Today.
 * @return {string} The date.
 */
export function getDeskDate( post, now = new Date() ) {
	if ( post.status === 'future' ) {
		return sprintf(
			/* translators: %s: When the post is published, like "20 Nov". */
			__( 'Goes live %s' ),
			getShortDate( post.date, now )
		);
	}

	if ( post.status === 'draft' || post.status === 'pending' ) {
		return getShortDate( post.modified || post.date, now );
	}

	return getShortDate( post.date || post.modified, now );
}

function getExcerptText( item ) {
	const rendered = item?.excerpt?.rendered || '';

	return decodeEntities( rendered.replace( /<[^>]+>/g, '' ) ).trim();
}

export const POSTS_DESK_FIELDS = [
	{
		enableGlobalSearch: true,
		enableHiding: false,
		getValue: ( { item } ) => getTitleText( item.title ),
		id: 'title',
		label: __( 'Title' ),
		render: ( { item } ) => (
			<span className="cnl-posts-desk__title">
				{ getTitleText( item.title ) || __( '(no title)' ) }
			</span>
		),
		type: 'text',
	},
	{
		enableHiding: false,
		enableSorting: false,
		filterBy: false,
		getValue: ( { item } ) => getExcerptText( item ),
		id: 'excerpt',
		label: __( 'Excerpt' ),
		render: ( { item } ) => (
			<span className="cnl-posts-desk__excerpt">
				{ getExcerptText( item ) }
			</span>
		),
		type: 'text',
	},
	{
		enableSorting: false,
		filterBy: false,
		getValue: ( { item } ) => item.date || item.modified || '',
		id: 'date',
		label: __( 'Date' ),
		render: ( { item } ) => (
			<span className="cnl-posts-desk__date">
				{ getDeskDate( item ) }
			</span>
		),
		type: 'datetime',
	},
	{
		enableSorting: false,
		filterBy: false,
		getValue: ( { item } ) => getStatusLabel( item.status ),
		id: 'status',
		label: __( 'Status' ),
		render: ( { item } ) =>
			item.status === 'trash' ? null : (
				<Badge intent={ STATUS_INTENTS[ item.status ] || 'none' }>
					{ getStatusLabel( item.status ) }
				</Badge>
			),
		type: 'text',
	},
];

export const POSTS_DESK_VIEW = {
	descriptionField: 'excerpt',
	fields: [ 'date', 'status' ],
	layout: {},
	titleField: 'title',
	type: 'list',
};
