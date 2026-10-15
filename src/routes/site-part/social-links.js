/**
 * The site's social links, as the Header and Footer screens see them.
 *
 * They live where core keeps them, in each part's Social Icons blocks. The
 * screens treat them as one list for the site: the links in the part being
 * changed are written into every Social Icons block in the homepage's header
 * and footer, and carried over when either part takes a new layout.
 */

/**
 * Internal dependencies
 */
import {
	getBlockAttributes,
	getBlockName,
} from '../navigation-edit/navigation-blocks';
import { getSiteParts, pickSitePart } from './data';
import {
	__,
	_n,
	blockEditorStore,
	blocksStore,
	coreDataStore,
	createBlock,
	sprintf,
	useCallback,
	useMemo,
	useRegistry,
	useSelect,
} from '../../wordpress-packages';

const EMPTY_ARRAY = [];
const SOCIAL_LINKS = 'core/social-links';
const SOCIAL_LINK = 'core/social-link';

/**
 * Whether a link's address is one still to be filled in: missing, or the `#`
 * a theme's patterns put in its place.
 *
 * @param {?string} url The link's address.
 * @return {boolean} Whether it needs an address.
 */
export function isPlaceholderUrl( url ) {
	return ! url || url.trim() === '#';
}

/**
 * The links in a Social Icons block.
 *
 * @param {?Object} block Editor or parsed Social Icons block.
 * @return {Object[]} `{ label, service, url }` items, in order.
 */
export function getSocialLinks( block ) {
	return ( block?.innerBlocks || EMPTY_ARRAY )
		.filter( ( link ) => getBlockName( link ) === SOCIAL_LINK )
		.map( ( link ) => {
			const { label, service, url } = getBlockAttributes( link );

			return { label, service, url };
		} );
}

function createSocialLink( { label, service, url } ) {
	return createBlock( SOCIAL_LINK, {
		service,
		url,
		...( label ? { label } : {} ),
	} );
}

/**
 * Blocks with the links in each of their Social Icons blocks swapped for
 * others. Everything else about the blocks, the Social Icons' own style and
 * layout included, is left as it is.
 *
 * @param {Object[]} blocks Editor blocks.
 * @param {Object[]} links  `{ label, service, url }` items.
 * @return {Object[]} The blocks.
 */
export function withSocialLinks( blocks, links ) {
	return ( blocks || EMPTY_ARRAY ).map( ( block ) => {
		if ( getBlockName( block ) === SOCIAL_LINKS ) {
			return { ...block, innerBlocks: links.map( createSocialLink ) };
		}

		return block.innerBlocks?.length
			? {
					...block,
					innerBlocks: withSocialLinks( block.innerBlocks, links ),
				}
			: block;
	} );
}

/**
 * Whether two lists have the same services in the same order, so one can be
 * made the other by changing addresses alone.
 *
 * @param {Object[]} a Links.
 * @param {Object[]} b Links.
 * @return {boolean} Whether they line up.
 */
export function haveSameServices( a, b ) {
	return (
		a.length === b.length &&
		a.every( ( link, index ) => link.service === b[ index ].service )
	);
}

/**
 * The services that can be added: core's, less those already in the list.
 *
 * @param {Object[]} services Core's Social Icon variations.
 * @param {Object[]} links    The links there are.
 * @return {Object[]} The variations, by title.
 */
export function getAddableServices( services, links ) {
	const used = new Set( links.map( ( link ) => link.service ) );

	return ( services || EMPTY_ARRAY )
		.filter( ( service ) => ! used.has( service.name ) )
		.sort( ( a, b ) => a.title.localeCompare( b.title ) );
}

/**
 * A service's name, as core's Social Icon block calls it.
 *
 * @param {Object[]} services Core's Social Icon variations.
 * @param {string}   name     The service.
 * @return {Object} `{ icon, title }`. A service core doesn't know is shown by
 *                  its own name, with no icon.
 */
export function getService( services, name ) {
	const service = ( services || EMPTY_ARRAY ).find(
		( variation ) => variation.name === name
	);

	return {
		icon: service?.icon,
		title: service?.title || name || __( 'Social icon' ),
	};
}

/**
 * The line under the Social links row: which services there are, or how
 * many still need an address.
 *
 * @param {Object[]} links    The links.
 * @param {Object[]} services Core's Social Icon variations.
 * @return {string} The description.
 */
export function getSocialLinksDescription( links, services ) {
	if ( ! links.length ) {
		return __( 'None yet' );
	}

	const missing = links.filter( ( link ) =>
		isPlaceholderUrl( link.url )
	).length;

	if ( missing ) {
		return sprintf(
			/* translators: %d: Number of social links without an address. */
			_n( '%d needs an address', '%d need an address', missing ),
			missing
		);
	}

	return links
		.map( ( link ) => getService( services, link.service ).title )
		.join( ', ' );
}

/**
 * Client IDs of the Social Icons blocks in the homepage's header and footer,
 * those in the given part first.
 *
 * @param {Object} store `blockEditorStore` selectors.
 * @param {string} theme Current theme's stylesheet.
 * @param {string} area  The part to put first, `header` or `footer`.
 * @return {string[]} The client IDs.
 */
function getSocialLinksClientIds( store, theme, area ) {
	const parts = getSiteParts( store, theme );
	const order =
		area === 'footer' ? [ 'footer', 'header' ] : [ 'header', 'footer' ];

	return order.flatMap( ( key ) => {
		const part = pickSitePart( parts, key );

		return part
			? store
					.getClientIdsOfDescendants( part.clientId )
					.filter(
						( clientId ) =>
							store.getBlockName( clientId ) === SOCIAL_LINKS
					)
			: EMPTY_ARRAY;
	} );
}

/**
 * The site's social links, and a way to change them everywhere they show.
 *
 * @param {string} area The part the screen is about, `header` or `footer`.
 *                      Its links are the ones shown.
 * @return {Object} `{ links, services, setLinks, setUrl }`.
 */
export function useSocialLinks( area ) {
	const registry = useRegistry();
	// The block, which the store keeps the same until it changes.
	const { block, services } = useSelect(
		( select ) => {
			const store = select( blockEditorStore );
			const [ first ] = getSocialLinksClientIds(
				store,
				select( coreDataStore ).getCurrentTheme()?.stylesheet,
				area
			);

			return {
				block: first ? store.getBlock( first ) : null,
				services:
					select( blocksStore ).getBlockVariations( SOCIAL_LINK ),
			};
		},
		[ area ]
	);
	const links = useMemo(
		() => ( block ? getSocialLinks( block ) : null ),
		[ block ]
	);

	const getTargets = useCallback( () => {
		return getSocialLinksClientIds(
			registry.select( blockEditorStore ),
			registry.select( coreDataStore ).getCurrentTheme()?.stylesheet,
			area
		);
	}, [ area, registry ] );

	/*
	 * Write a list into every Social Icons block. Where a block already has
	 * the same services only its addresses change, so typing doesn't rebuild
	 * the blocks on the canvas, and core folds the keystrokes into one undo
	 * step. Otherwise its links are replaced, which, unlike inserting and
	 * removing, the part's content-only lock allows.
	 */
	const setLinks = useCallback(
		( nextLinks ) => {
			const store = registry.select( blockEditorStore );
			const { replaceInnerBlocks, updateBlockAttributes } =
				registry.dispatch( blockEditorStore );

			registry.batch( () => {
				getTargets().forEach( ( clientId ) => {
					const target = store.getBlock( clientId );

					if (
						! haveSameServices(
							getSocialLinks( target ),
							nextLinks
						)
					) {
						replaceInnerBlocks(
							clientId,
							nextLinks.map( createSocialLink ),
							false
						);
						return;
					}

					target.innerBlocks
						.filter( ( link ) => link.name === SOCIAL_LINK )
						.forEach( ( link, index ) => {
							if (
								link.attributes.url !== nextLinks[ index ].url
							) {
								updateBlockAttributes( link.clientId, {
									url: nextLinks[ index ].url,
								} );
							}
						} );
				} );
			} );
		},
		[ getTargets, registry ]
	);

	const setUrl = useCallback(
		( index, url ) =>
			setLinks(
				links.map( ( link, i ) =>
					i === index ? { ...link, url } : link
				)
			),
		[ links, setLinks ]
	);

	return useMemo(
		() => ( {
			links,
			services: services || EMPTY_ARRAY,
			setLinks,
			setUrl,
		} ),
		[ links, services, setLinks, setUrl ]
	);
}
