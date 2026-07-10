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
	return decodeEntities( value || '' ).toLowerCase();
}

export function getKnownPageLayoutType( slug ) {
	switch ( slug ) {
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
		default:
			return null;
	}
}

export function inferPageLayoutTypes( pattern ) {
	const explicitTypes = ( pattern.pageTypes || [] )
		.map( getKnownPageLayoutType )
		.filter( Boolean );

	if ( explicitTypes.length ) {
		return [ ...new Set( explicitTypes ) ];
	}

	const categoryTypes = ( pattern.categories || [] )
		.map( getKnownPageLayoutType )
		.filter( Boolean );

	if ( categoryTypes.length ) {
		return [ ...new Set( categoryTypes ) ];
	}

	const patternText = [
		normalizeLayoutText( pattern.name ),
		normalizeLayoutText( pattern.title ),
		...( pattern.categories || [] ).map( normalizeLayoutText ),
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

export function isPageLayoutPattern( pattern ) {
	if ( pattern.inserter === false || ! pattern.content ) {
		return false;
	}

	if ( pattern.postTypes?.includes( 'page' ) ) {
		return true;
	}

	if ( pattern.blockTypes?.includes( 'core/post-content' ) ) {
		return true;
	}

	return !! pattern.categories?.some( ( category ) =>
		[ 'page', 'pages' ].includes( category )
	);
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
	const patternContent = pattern?.content || '';

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
