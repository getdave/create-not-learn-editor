/**
 * Data for the Header and Footer screens: which site part the homepage uses,
 * what is in it, and the layouts the theme offers for it.
 */

/**
 * Internal dependencies
 */
import { getSitePartArea } from '../content/pages/data';
import {
	getBlockAttributes,
	getBlockName,
	getParsedBlocks,
} from '../navigation-edit/navigation-blocks';
import {
	blockEditorStore,
	coreDataStore,
	parseBlocks,
	serialize,
	useMemo,
	useSelect,
} from '../../wordpress-packages';

const EMPTY_ARRAY = [];

export const SITE_PART_PATHS = {
	footer: '/design/footer',
	header: '/design/header',
};

/**
 * Pick the part a screen is about from the site parts on the page, in the
 * order they appear: the first header, or the last footer.
 *
 * @param {Object[]} parts `{ area }` items, in page order.
 * @param {string}   area  `header` or `footer`.
 * @return {Object|null} The part, or `null` when the page has none.
 */
export function pickSitePart( parts, area ) {
	const matches = ( parts || EMPTY_ARRAY ).filter(
		( part ) => part.area === area
	);

	return ( area === 'footer' ? matches.at( -1 ) : matches[ 0 ] ) || null;
}

/**
 * Every site part in the editor, in page order.
 *
 * @param {Object} store `blockEditorStore` selectors.
 * @param {string} theme Current theme's stylesheet.
 * @return {Object[]} `{ area, clientId, id }` items.
 */
export function getSiteParts( store, theme ) {
	const parts = [];
	const visit = ( rootClientId ) =>
		store.getBlockOrder( rootClientId ).forEach( ( clientId ) => {
			if ( store.getBlockName( clientId ) === 'core/template-part' ) {
				const attributes = store.getBlockAttributes( clientId ) || {};
				const area = getSitePartArea( attributes, theme );

				if ( area ) {
					parts.push( {
						area,
						clientId,
						id: `${ attributes.theme || theme }//${
							attributes.slug
						}`,
					} );
				}

				// A part's own blocks are never another site part.
				return;
			}

			visit( clientId );
		} );

	visit( '' );

	return parts;
}

/**
 * The site part the editor on the canvas shows: the homepage's header or
 * footer. Read from the block editor, which the canvas fills, so it is only
 * known once the editor has loaded.
 *
 * @param {string} area `header` or `footer`.
 * @return {Object} `{ clientId, id, isEditorReady }`. `clientId` and `id` are
 *                  `null` until found, or when the page has no such part.
 */
export function useSitePart( area ) {
	const { clientId, id, isEditorReady } = useSelect(
		( select ) => {
			const store = select( blockEditorStore );
			const theme = select( coreDataStore ).getCurrentTheme()?.stylesheet;
			const isReady = !! theme && store.getBlockOrder( '' ).length > 0;
			const part = isReady
				? pickSitePart( getSiteParts( store, theme ), area )
				: null;

			return {
				clientId: part?.clientId || null,
				id: part?.id || null,
				isEditorReady: isReady,
			};
		},
		[ area ]
	);

	return { clientId, id, isEditorReady };
}

/**
 * What a site part holds that the screen offers controls for.
 *
 * @param {string[]} names Names of every block in the part.
 * @return {Object} `{ hasLogo, hasNavigation, hasSiteTitle,
 *                  hasSocialLinks }`.
 */
export function getSitePartContents( names ) {
	const has = ( name ) => ( names || EMPTY_ARRAY ).includes( name );

	return {
		hasLogo: has( 'core/site-logo' ),
		hasNavigation: has( 'core/navigation' ),
		hasSiteTitle: has( 'core/site-title' ),
		hasSocialLinks: has( 'core/social-links' ),
	};
}

/**
 * What a site part in the editor holds, and the menu its first Navigation
 * block shows. A Navigation block with links of its own, rather than a saved
 * menu, shows no menu: its links are changed where they are, on the canvas.
 *
 * @param {?string} clientId The part's client ID in the editor.
 * @return {Object} `{ hasLogo, hasNavigation, hasSiteTitle, hasSocialLinks,
 *                  navigationRef, showsMenu }`.
 */
export function useSitePartContents( clientId ) {
	const { names, navigationRef, showsMenu } = useSelect(
		( select ) => {
			if ( ! clientId ) {
				return { names: '', showsMenu: false };
			}

			const store = select( blockEditorStore );
			const descendants = store.getClientIdsOfDescendants( clientId );
			const navigationId = descendants.find(
				( id ) => store.getBlockName( id ) === 'core/navigation'
			);
			const ref = navigationId
				? store.getBlockAttributes( navigationId )?.ref
				: undefined;

			return {
				// Joined, so the selector returns a value that only changes
				// when the part's blocks do.
				names: [
					...new Set(
						descendants.map( ( id ) => store.getBlockName( id ) )
					),
				].join( ',' ),
				navigationRef: ref,
				showsMenu:
					!! navigationId &&
					( !! ref || ! store.getBlockCount( navigationId ) ),
			};
		},
		[ clientId ]
	);

	return useMemo(
		() => ( {
			...getSitePartContents( names ? names.split( ',' ) : [] ),
			navigationRef,
			showsMenu,
		} ),
		[ names, navigationRef, showsMenu ]
	);
}

/**
 * The theme's layouts for a site part: its patterns for that area.
 *
 * @param {Object[]} patterns Block patterns.
 * @param {string}   area     `header` or `footer`.
 * @return {Object[]} The patterns for the part.
 */
export function getSitePartPatterns( patterns, area ) {
	const blockType = `core/template-part/${ area }`;

	return ( patterns || EMPTY_ARRAY ).filter(
		( pattern ) =>
			pattern?.inserter !== false &&
			( pattern?.blockTypes || EMPTY_ARRAY ).includes( blockType )
	);
}

/**
 * The layouts with one moved to the front, the rest in their own order.
 *
 * @param {Object[]} layouts The part's layouts.
 * @param {?string}  name    Pattern name to lead with.
 * @return {Object[]} The layouts.
 */
export function putLayoutFirst( layouts, name ) {
	const lead = name && layouts.find( ( pattern ) => pattern.name === name );

	return lead
		? [ lead, ...layouts.filter( ( pattern ) => pattern !== lead ) ]
		: layouts;
}

function getRawContent( content ) {
	return typeof content === 'string' ? content : content?.raw || '';
}

function normalize( markup ) {
	return String( markup || '' )
		.replace( />\s+</g, '><' )
		.replace( /\s+/g, ' ' )
		.trim();
}

/*
 * Without what placing a layout adds to it, or fills in on it: the name a
 * pattern is stamped with in a part, the menu a Navigation block without one
 * is given, and the site's social links.
 */
function withoutPlacementDetails( blocks ) {
	return blocks.map( ( block ) => {
		const key = block.attributes ? 'attributes' : 'attrs';
		const { metadata, ...attributes } = block[ key ] || {};
		const name = getBlockName( block );

		if ( name === 'core/navigation' ) {
			delete attributes.ref;
		}

		return {
			...block,
			[ key ]: attributes,
			innerBlocks:
				name === 'core/social-links'
					? []
					: withoutPlacementDetails( block.innerBlocks || [] ),
		};
	} );
}

function toComparable( content ) {
	return normalize(
		serialize(
			withoutPlacementDetails(
				parseBlocks( content, { __unstableSkipMigrationLogs: true } )
			)
		)
	);
}

/**
 * Which of the theme's layouts a site part is using, if any.
 *
 * A part that only places a pattern, as many themes' own parts do, uses that
 * pattern. Otherwise its blocks must match a layout's, give or take spacing,
 * what placing it adds and the social links filled in on it. A part that
 * has been changed since matches none.
 *
 * @param {string}   content  The part's markup.
 * @param {Object[]} patterns The part's layouts.
 * @return {?string} The layout's pattern name, or `null`.
 */
export function getCurrentPatternName( content, patterns ) {
	if ( ! content || ! patterns?.length ) {
		return null;
	}

	const blocks = getParsedBlocks( content ).filter( ( block ) =>
		getBlockName( block )
	);

	if (
		blocks.length === 1 &&
		getBlockName( blocks[ 0 ] ) === 'core/pattern'
	) {
		const { slug } = getBlockAttributes( blocks[ 0 ] );

		return (
			patterns.find( ( pattern ) => pattern.name === slug )?.name || null
		);
	}

	const comparable = toComparable( content );

	return (
		patterns.find(
			( pattern ) =>
				toComparable( getRawContent( pattern.content ) ) === comparable
		)?.name || null
	);
}

/**
 * A site part's markup as it stands, with any unsaved changes.
 *
 * @param {Object} record Edited template part record.
 * @return {string} Its markup.
 */
export function getSitePartContent( record ) {
	if ( Array.isArray( record?.blocks ) ) {
		return serialize( record.blocks );
	}

	return getRawContent( record?.content );
}

/**
 * The theme's layouts for a site part, and which one it uses as it stands.
 *
 * @param {string}  area `header` or `footer`.
 * @param {?string} id   The part's template part ID.
 * @return {Object} `{ content, currentName, hasResolved, layouts }`.
 *                  `hasResolved` is whether the theme's patterns have loaded.
 */
export function useSitePartLayouts( area, id ) {
	const { content, hasResolved, patterns } = useSelect(
		( select ) => {
			const store = select( coreDataStore );

			return {
				content: id
					? getSitePartContent(
							store.getEditedEntityRecord(
								'postType',
								'wp_template_part',
								id
							)
						)
					: '',
				hasResolved: store.hasFinishedResolution(
					'getBlockPatterns',
					[]
				),
				patterns: store.getBlockPatterns?.() || EMPTY_ARRAY,
			};
		},
		[ id ]
	);
	const layouts = useMemo(
		() => getSitePartPatterns( patterns, area ),
		[ area, patterns ]
	);
	const currentName = useMemo(
		() => getCurrentPatternName( content, layouts ),
		[ content, layouts ]
	);

	return { content, currentName, hasResolved, layouts };
}
