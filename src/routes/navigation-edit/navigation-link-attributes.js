/**
 * WordPress dependencies
 */
import { escapeHTML } from '@wordpress/escape-html';
import { getPath, safeDecodeURI } from '@wordpress/url';

function normalizePath( path ) {
	return path ? path.replace( /\/+$/, '' ) : '';
}

function createUrlObject( url, baseUrl = null ) {
	try {
		const base =
			baseUrl ||
			( typeof window !== 'undefined'
				? window.location.origin
				: 'https://wordpress.org' );

		return new URL( url, base );
	} catch {
		return null;
	}
}

function shouldSeverEntityLink( originalUrl, newUrl ) {
	if ( ! originalUrl || ! newUrl ) {
		return false;
	}

	const originalUrlObject = createUrlObject( originalUrl );
	if ( ! originalUrlObject ) {
		return true;
	}

	const newUrlObject = createUrlObject( newUrl, originalUrl );
	if ( ! newUrlObject ) {
		return true;
	}

	const originalPath = normalizePath(
		getPath( originalUrlObject.toString() )
	);
	const newPath = normalizePath( getPath( newUrlObject.toString() ) );

	if (
		originalUrlObject.hostname !== newUrlObject.hostname ||
		originalPath !== newPath
	) {
		return true;
	}

	const originalPostId = originalUrlObject.searchParams.get( 'p' );
	const newPostId = newUrlObject.searchParams.get( 'p' );

	if ( originalPostId && newPostId && originalPostId !== newPostId ) {
		return true;
	}

	const originalPageId = originalUrlObject.searchParams.get( 'page_id' );
	const newPageId = newUrlObject.searchParams.get( 'page_id' );

	if ( originalPageId && newPageId && originalPageId !== newPageId ) {
		return true;
	}

	return Boolean(
		( originalPostId && newPageId ) || ( originalPageId && newPostId )
	);
}

function stripHTML( value = '' ) {
	return String( value ).replace( /<[^>]*>/g, '' );
}

function getNormalizedType( type = '' ) {
	return type === 'post_tag' ? 'tag' : type.replace( '-', '_' );
}

function getSuggestionsQuery( type, kind ) {
	const perPage = 20;

	switch ( type ) {
		case 'post':
		case 'page':
			return { type: 'post', subtype: type, perPage };
		case 'category':
			return { type: 'term', subtype: 'category', perPage };
		case 'tag':
			return { type: 'term', subtype: 'post_tag', perPage };
		case 'post_format':
			return { type: 'post-format', perPage };
		default:
			if ( kind === 'taxonomy' ) {
				return { type: 'term', subtype: type, perPage };
			}
			if ( kind === 'post-type' ) {
				return { type: 'post', subtype: type, perPage };
			}
			return {
				initialSuggestionsSearchOptions: {
					type: 'post',
					subtype: 'page',
					perPage,
				},
			};
	}
}

function buildNavigationLinkEntityBinding( kind ) {
	if ( kind !== 'post-type' && kind !== 'taxonomy' ) {
		throw new Error(
			`Invalid kind "${ kind }" provided to buildNavigationLinkEntityBinding.`
		);
	}

	return {
		url: {
			source: kind === 'taxonomy' ? 'core/term-data' : 'core/post-data',
			args: {
				field: 'link',
			},
		},
	};
}

function updateNavigationLinkAttributes(
	updatedValue = {},
	setAttributes,
	blockAttributes = {}
) {
	const {
		label: originalLabel = '',
		kind: originalKind = '',
		type: originalType = '',
	} = blockAttributes;

	const {
		title: newTitle = '',
		label: newLabel = '',
		url: newUrl,
		opensInNewTab,
		id: newId,
		kind: nextKind = originalKind,
		type: nextType = originalType,
	} = updatedValue;

	const finalLabel = newTitle || newLabel;
	const labelWithoutProtocol = finalLabel.replace( /http(s?):\/\//gi, '' );
	const urlWithoutProtocol = newUrl?.replace( /http(s?):\/\//gi, '' ) ?? '';
	const shouldUseNewLabel =
		finalLabel &&
		finalLabel !== originalLabel &&
		labelWithoutProtocol !== urlWithoutProtocol;
	const label = shouldUseNewLabel
		? escapeHTML( finalLabel )
		: originalLabel || escapeHTML( urlWithoutProtocol );
	const type = getNormalizedType( nextType );
	const isBuiltInType = [ 'post', 'page', 'tag', 'category' ].includes(
		type
	);
	const isCustomLink =
		( ! nextKind && ! isBuiltInType ) || nextKind === 'custom';
	const kind = isCustomLink ? 'custom' : nextKind;
	const attributes = {
		...( newUrl !== undefined
			? { url: newUrl ? encodeURI( safeDecodeURI( newUrl ) ) : newUrl }
			: {} ),
		...( label ? { label } : {} ),
		...( opensInNewTab !== undefined ? { opensInNewTab } : {} ),
		...( kind ? { kind } : {} ),
		...( type && type !== 'URL' ? { type } : {} ),
	};

	if ( newUrl && ! newId && blockAttributes.id ) {
		if ( shouldSeverEntityLink( blockAttributes.url, newUrl ) ) {
			attributes.id = undefined;
			attributes.kind = 'custom';
			attributes.type = 'custom';
		}
	} else if ( Number.isInteger( newId ) ) {
		attributes.id = newId;
	} else if ( blockAttributes.id ) {
		attributes.kind = kind;
		attributes.type = type;
	}

	setAttributes( attributes );

	const finalId = 'id' in attributes ? attributes.id : blockAttributes.id;
	const finalKind =
		'kind' in attributes ? attributes.kind : blockAttributes.kind;

	return {
		attributes,
		isEntityLink: !! finalId && finalKind !== 'custom',
	};
}

function getNavigationLinkControlValue( attributes = {}, entityRecord ) {
	const { label, url, opensInNewTab, kind, type, id } = attributes;

	return {
		url,
		opensInNewTab,
		title: label ? stripHTML( label ) : undefined,
		entityTitle: entityRecord?.title?.rendered || entityRecord?.name,
		kind,
		type,
		id,
	};
}

export {
	buildNavigationLinkEntityBinding,
	getNavigationLinkControlValue,
	getSuggestionsQuery,
	shouldSeverEntityLink,
	updateNavigationLinkAttributes,
};
