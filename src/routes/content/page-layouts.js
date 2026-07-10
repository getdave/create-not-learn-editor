/**
 * WordPress dependencies
 */
import { decodeEntities } from '@wordpress/html-entities';
import { __ } from '@wordpress/i18n';

export const EMPTY_ARRAY = [];
export const OTHER_PAGE_LAYOUT_TYPE = 'other';
export const PAGE_LAYOUTS_PER_PAGE = 2;

export function getPatternTitle( pattern ) {
	return decodeEntities(
		pattern?.title || pattern?.name || __( 'Untitled' )
	);
}

export function getPatternDescription( pattern ) {
	return decodeEntities( pattern?.description || '' );
}

export function getPatternContent( pattern ) {
	const content = pattern?.content;

	if ( typeof content === 'string' ) {
		return content;
	}

	return content?.raw || content?.rendered || '';
}

export function getPageLayoutTypes() {
	return [
		{ label: __( 'Homepages' ), slug: 'homepage' },
		{ label: __( 'Landing pages' ), slug: 'landing-page' },
		{ label: __( 'Events' ), slug: 'event' },
		{ label: __( 'Link in bio' ), slug: 'link-in-bio' },
		{ label: __( 'Personal' ), slug: 'personal' },
		{ label: __( 'Coming soon' ), slug: 'coming-soon' },
		{ label: __( 'Other designs' ), slug: OTHER_PAGE_LAYOUT_TYPE },
	];
}

export function normalizeLayoutText( value ) {
	return decodeEntities( String( value || '' ) ).toLowerCase();
}

export function getPatternTermTexts( term ) {
	if ( term === null || term === undefined ) {
		return [];
	}

	if ( [ 'string', 'number', 'boolean' ].includes( typeof term ) ) {
		return [ String( term ) ];
	}

	if ( Array.isArray( term ) ) {
		return term.flatMap( getPatternTermTexts );
	}

	if ( typeof term !== 'object' ) {
		return [];
	}

	const title = term.title;
	const rawTerms = [
		term.slug,
		term.name,
		term.label,
		term.value,
		term.id,
		typeof title === 'object' ? title?.raw : title,
		typeof title === 'object' ? title?.rendered : undefined,
	];

	return rawTerms
		.filter( ( value ) => value !== null && value !== undefined )
		.map( String );
}

export function normalizeLayoutSlug( value ) {
	return normalizeLayoutText( value )
		.trim()
		.replace( /[_\s]+/g, '-' )
		.replace( /[^a-z0-9/-]+/g, '' )
		.replace( /\/+/g, '/' );
}

export function getPatternTermSlugs( terms ) {
	return [
		...new Set(
			getPatternTermTexts( terms )
				.flatMap( ( term ) => {
					const normalized = normalizeLayoutSlug( term );
					const parts = normalized.split( '/' ).filter( Boolean );

					return [ normalized, parts.at( -1 ) ].filter( Boolean );
				} )
				.filter( Boolean )
		),
	];
}

export function getKnownPageLayoutType( slug ) {
	for ( const termSlug of getPatternTermSlugs( slug ) ) {
		switch ( termSlug ) {
			case 'homepage':
			case 'homepages':
			case 'home':
			case 'front-page':
			case 'frontpage':
				return 'homepage';
			case 'landing-page':
			case 'landing-pages':
			case 'landing':
				return 'landing-page';
			case 'event':
			case 'events':
				return 'event';
			case 'link-in-bio':
			case 'linkinbio':
			case 'link-in-bios':
				return 'link-in-bio';
			case 'personal':
			case 'bio':
			case 'cv':
			case 'resume':
				return 'personal';
			case 'coming-soon':
			case 'comingsoon':
				return 'coming-soon';
			case OTHER_PAGE_LAYOUT_TYPE:
				return OTHER_PAGE_LAYOUT_TYPE;
		}
	}

	return null;
}

export function inferPageLayoutTypes( pattern ) {
	const explicitTypes = getPatternTermTexts( pattern.pageTypes )
		.map( getKnownPageLayoutType )
		.filter( Boolean );

	if ( explicitTypes.length ) {
		return [ ...new Set( explicitTypes ) ];
	}

	const categoryTypes = getPatternTermTexts( pattern.categories )
		.map( getKnownPageLayoutType )
		.filter( Boolean );

	if ( categoryTypes.length ) {
		return [ ...new Set( categoryTypes ) ];
	}

	const patternText = [
		normalizeLayoutText( pattern.name ),
		normalizeLayoutText( pattern.title ),
		...getPatternTermTexts( pattern.categories ).map( normalizeLayoutText ),
	].join( ' ' );

	if (
		patternText.includes( 'event rsvp' ) ||
		patternText.includes( 'event-rsvp' ) ||
		patternText.includes( 'landing page for event' ) ||
		patternText.includes( 'landing-event' )
	) {
		return [ 'event' ];
	}

	if (
		patternText.includes( 'link in bio' ) ||
		patternText.includes( 'link-in-bio' )
	) {
		return [ 'link-in-bio' ];
	}

	if (
		patternText.includes( 'coming soon' ) ||
		patternText.includes( 'coming-soon' )
	) {
		return [ 'coming-soon' ];
	}

	if (
		patternText.includes( 'cv/bio' ) ||
		patternText.includes( 'cv bio' ) ||
		patternText.includes( 'cv-bio' )
	) {
		return [ 'personal' ];
	}

	if (
		patternText.includes( 'business homepage' ) ||
		patternText.includes( 'business-home' ) ||
		patternText.includes( 'portfolio homepage' ) ||
		patternText.includes( 'portfolio-home' ) ||
		patternText.includes( 'shop homepage' ) ||
		patternText.includes( 'shop-home' )
	) {
		return [ 'homepage' ];
	}

	if (
		patternText.includes( 'landing page for book' ) ||
		patternText.includes( 'landing-book' ) ||
		patternText.includes( 'landing page for podcast' ) ||
		patternText.includes( 'landing-podcast' )
	) {
		return [ 'landing-page' ];
	}

	return [ OTHER_PAGE_LAYOUT_TYPE ];
}

export function isPagePatternCategory( category ) {
	return getPatternTermSlugs( category ).some( ( termSlug ) =>
		[ 'page', 'pages' ].includes( termSlug )
	);
}

export function isPageLayoutPattern( pattern ) {
	if ( pattern.inserter === false ) {
		return false;
	}

	if ( getPatternTermSlugs( pattern.postTypes ).includes( 'page' ) ) {
		return true;
	}

	if (
		getPatternTermSlugs( pattern.blockTypes ).includes(
			'core/post-content'
		)
	) {
		return true;
	}

	return isPagePatternCategory( pattern.categories );
}

export function getPageLayoutGroups( patterns ) {
	const groups = getPageLayoutTypes().map( ( type ) => ( {
		...type,
		patterns: [],
	} ) );
	const groupBySlug = new Map(
		groups.map( ( group ) => [ group.slug, group ] )
	);

	for ( const pattern of patterns ) {
		for ( const pageType of inferPageLayoutTypes( pattern ) ) {
			const group =
				groupBySlug.get( pageType ) ||
				groupBySlug.get( OTHER_PAGE_LAYOUT_TYPE );

			if ( group && ! group.patterns.includes( pattern ) ) {
				group.patterns.push( pattern );
			}
		}
	}

	return groups.filter( ( group ) => group.patterns.length );
}

export function getTemplateSlug( item ) {
	const template = item?.template;

	if ( ! template || template === 'default' ) {
		return '';
	}

	return template;
}

export function getTemplateBySlug( templates, slug ) {
	if ( ! slug ) {
		return undefined;
	}

	return templates.find(
		( template ) =>
			template.slug === slug ||
			String( template.id ).endsWith( `//${ slug }` )
	);
}

export function getPreviewTemplateForPost( item, templates, appSettings = {} ) {
	const customTemplate = getTemplateBySlug(
		templates,
		getTemplateSlug( item )
	);

	if ( customTemplate ) {
		return customTemplate;
	}

	if (
		item.type === 'page' &&
		appSettings.pageOnFront &&
		Number( item.id ) === Number( appSettings.pageOnFront )
	) {
		return (
			getTemplateBySlug( templates, 'front-page' ) ||
			getTemplateBySlug( templates, 'page' )
		);
	}

	if ( item.type === 'post' ) {
		return (
			getTemplateBySlug( templates, 'single-post' ) ||
			getTemplateBySlug( templates, 'single' )
		);
	}

	return (
		getTemplateBySlug(
			templates,
			item.type ? `single-${ item.type }` : ''
		) ||
		getTemplateBySlug( templates, 'page' ) ||
		templates[ 0 ]
	);
}

export function getPreviewContent( item, template ) {
	const postContent = item?.content?.raw || '';
	const templateContent = template?.content?.raw || '';

	if ( ! templateContent ) {
		return postContent;
	}

	let didReplace = false;
	const replacePostContent = () => {
		didReplace = true;
		return postContent;
	};
	const pairedPostContentBlock =
		/<!--\s+wp:post-content\b[\s\S]*?-->([\s\S]*?)<!--\s+\/wp:post-content\s+-->/g;
	const selfClosingPostContentBlock =
		/<!--\s+wp:post-content\b[\s\S]*?\/-->/g;
	const nextContent = templateContent
		.replace( pairedPostContentBlock, replacePostContent )
		.replace( selfClosingPostContentBlock, replacePostContent );

	return didReplace ? nextContent : templateContent;
}

export function getSelectedTemplateContent( templates, selectedTemplateSlug ) {
	const selectedTemplate = selectedTemplateSlug
		? templates.find(
				( template ) =>
					template.slug === selectedTemplateSlug ||
					String( template.id ) === String( selectedTemplateSlug )
		  )
		: undefined;

	return (
		selectedTemplate?.content?.raw ||
		getTemplateBySlug( templates, 'page' )?.content?.raw ||
		templates[ 0 ]?.content?.raw ||
		''
	);
}

export function getPatternPreviewContent( pattern, templateContent ) {
	const patternContent = getPatternContent( pattern );

	if ( ! templateContent ) {
		return patternContent;
	}

	return getPreviewContent(
		{
			content: {
				raw: patternContent,
			},
		},
		{
			content: {
				raw: templateContent,
			},
		}
	);
}
