/**
 * Data for the Header and Footer screens: which site part the homepage uses,
 * what is in it, and the layouts the theme offers for it.
 */

/**
 * Internal dependencies
 */
import { getSitePartArea } from '../content/pages/data';
import {
	blockEditorStore,
	coreDataStore,
	useMemo,
	useSelect,
} from '../../wordpress-packages';

const EMPTY_ARRAY = [];

// The screen that leads to the Header and Footer screens.
export const SITE_PARTS_PATH = '/design/header-footer';

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

export {
	getCurrentPatternName,
	getSitePartContent,
	getSitePartPatterns,
	putLayoutFirst,
	useSitePartLayouts,
} from './layouts';
