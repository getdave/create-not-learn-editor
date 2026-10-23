/**
 * Internal dependencies
 */
import { EMPTY_ARRAY } from './list-shared';
import { __ } from '../../wordpress-packages';

export const PATTERN_TYPES = {
	theme: 'theme',
	user: 'user',
};
export const PATTERN_SYNC_STATUS = {
	full: 'fully',
	unsynced: 'unsynced',
};

function decodeText( value, fallback = '' ) {
	const element = document.createElement( 'textarea' );
	element.innerHTML = String( value || '' )
		.replace( /<[^>]+>/g, '' )
		.trim();
	return element.value || fallback;
}

export function getPatternTitle( pattern ) {
	return decodeText( pattern?.title, __( 'Untitled pattern' ) );
}

export function getPatternDescription( pattern ) {
	return decodeText( pattern?.description || '' );
}

export function getPatternSyncStatusLabel( syncStatus ) {
	if ( syncStatus === PATTERN_SYNC_STATUS.unsynced ) {
		return __( 'Not synced' );
	}

	return __( 'Synced' );
}

export function getPatternTypeLabel( type ) {
	if ( type === PATTERN_TYPES.user ) {
		return __( 'Saved by you' );
	}

	return __( 'From your theme' );
}

function getUserPatternCategorySlugs( pattern, userCategories ) {
	if ( ! Array.isArray( pattern?.wp_pattern_category ) ) {
		return EMPTY_ARRAY;
	}

	return pattern.wp_pattern_category
		.map(
			( categoryId ) =>
				userCategories.find(
					( category ) =>
						Number( category.id ) === Number( categoryId )
				)?.name
		)
		.filter( Boolean );
}

/*
 * Patterns can name categories nobody registered, such as the layouts' groups
 * or the Pattern Directory's "wireframe". Those only have a slug, so they are
 * left out wherever a category is shown.
 */
function getNamedCategories( pattern, categoryMap ) {
	return ( pattern?.categories || EMPTY_ARRAY ).filter( ( category ) =>
		categoryMap.has( category )
	);
}

export function getPatternCategoryLabels( pattern, categoryMap ) {
	const categories = getNamedCategories( pattern, categoryMap );

	if ( ! categories.length ) {
		return __( 'Other' );
	}

	return categories
		.map( ( category ) => categoryMap.get( category ) )
		.join( ', ' );
}

export function normalizeThemePattern( pattern ) {
	return {
		categories: pattern?.categories || EMPTY_ARRAY,
		content: pattern?.content || '',
		description: pattern?.description || '',
		id: `theme:${ pattern?.name || pattern?.title }`,
		keywords: pattern?.keywords || EMPTY_ARRAY,
		name: pattern?.name,
		syncStatus: PATTERN_SYNC_STATUS.unsynced,
		title: pattern?.title || pattern?.name || __( 'Untitled pattern' ),
		type: PATTERN_TYPES.theme,
		viewportWidth: pattern?.viewportWidth,
	};
}

export function normalizeUserPattern( pattern, userCategories ) {
	return {
		categories: getUserPatternCategorySlugs( pattern, userCategories ),
		content:
			typeof pattern?.content === 'string'
				? pattern.content
				: pattern?.content?.raw || '',
		description:
			typeof pattern?.excerpt === 'string'
				? pattern.excerpt
				: pattern?.excerpt?.raw || pattern?.description || '',
		id: `user:${ pattern?.id }`,
		keywords: EMPTY_ARRAY,
		name: pattern?.name || String( pattern?.id || '' ),
		recordId: pattern?.id,
		syncStatus: pattern?.wp_pattern_sync_status || PATTERN_SYNC_STATUS.full,
		title:
			typeof pattern?.title === 'string'
				? pattern.title
				: pattern?.title?.raw ||
					pattern?.title?.rendered ||
					__( 'Untitled pattern' ),
		type: PATTERN_TYPES.user,
	};
}

export function getPatternsForTab( patterns, activeTab ) {
	if ( activeTab === 'my-patterns' ) {
		return patterns.filter(
			( pattern ) => pattern.type === PATTERN_TYPES.user
		);
	}

	if ( activeTab === 'registered' ) {
		return patterns.filter(
			( pattern ) => pattern.type === PATTERN_TYPES.theme
		);
	}

	return patterns;
}

const MAX_CATEGORY_CHIPS = 10;

/**
 * The most common kinds of section, for quick filtering.
 *
 * @param {Object[]} patterns    Patterns in the current tab.
 * @param {Map}      categoryMap Category labels keyed by slug.
 * @return {Object[]} Chips with a value and a label.
 */
export function getPatternCategoryChips( patterns, categoryMap ) {
	const counts = new Map();

	patterns.forEach( ( pattern ) =>
		getNamedCategories( pattern, categoryMap ).forEach( ( category ) =>
			counts.set( category, ( counts.get( category ) || 0 ) + 1 )
		)
	);

	return [ ...counts.entries() ]
		.sort( ( [ , first ], [ , second ] ) => second - first )
		.slice( 0, MAX_CATEGORY_CHIPS )
		.map( ( [ value ] ) => ( {
			label: categoryMap.get( value ),
			value,
		} ) )
		.sort( ( first, second ) => first.label.localeCompare( second.label ) );
}
