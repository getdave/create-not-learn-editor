/**
 * What Compose works on in the editor: the page's sections, and what the
 * template puts around them, like the header, footer and title.
 *
 * Sections are the blocks of core's section root, the one its own zoom-out
 * treats as sections: the Post Content block when a page is shown in its
 * template, or a template's `main` group. Without one, the template's own
 * top-level blocks are taken, less its header and footer.
 */

/**
 * Internal dependencies
 */
import { unlock } from '../../lock-unlock';
import {
	blockEditorStore,
	coreDataStore,
	useMemo,
	useSelect,
} from '../../wordpress-packages';

const SITE_PART_AREAS = [ 'header', 'footer' ];

const EMPTY_ARRAY = [];

/**
 * The header or footer a template part block shows, if it shows one.
 *
 * @param {Object} attributes Template part block attributes.
 * @param {Object} record     Its template part record, if loaded.
 * @return {?string} `header`, `footer`, or nothing.
 */
export function getSitePartArea( attributes, record ) {
	const area = attributes?.area || record?.area;

	if ( SITE_PART_AREAS.includes( area ) ) {
		return area;
	}

	return (
		SITE_PART_AREAS.find( ( name ) =>
			String( attributes?.slug || '' ).includes( name )
		) || null
	);
}

/**
 * Describe a block the template puts around the page's sections.
 *
 * @param {string} clientId Block client ID.
 * @param {Object} store    `blockEditorStore` selectors.
 * @param {Object} entities `coreDataStore` selectors.
 * @param {string} theme    Current theme's stylesheet, for part IDs.
 * @param {string} position `before` or `after` the sections.
 * @return {string} `position|clientId|name|area|id`, `area` and `id` being
 *                  empty for anything other than a header or footer.
 */
function describeTemplateElement( clientId, store, entities, theme, position ) {
	const name = store.getBlockName( clientId );
	let area = '';
	let id = '';

	if ( name === 'core/template-part' ) {
		const attributes = store.getBlockAttributes( clientId ) || {};
		const partId = attributes.slug
			? `${ attributes.theme || theme }//${ attributes.slug }`
			: '';
		const record = partId
			? entities.getEditedEntityRecord(
					'postType',
					'wp_template_part',
					partId
				)
			: null;

		area = getSitePartArea( attributes, record ) || '';
		id = area ? partId : '';
	}

	return [ position, clientId, name, area, id ].join( '|' );
}

/**
 * @return {Object} `{ parts, rootClientId, sectionIds, templateElements }`.
 *                  `templateElements` are the blocks the template puts
 *                  around the sections, top to bottom, each `{ area,
 *                  clientId, id, name, position }`. `parts` are those that
 *                  are the header or footer, `id` being the template part's
 *                  record ID.
 */
export function useComposeStructure() {
	/*
	 * Kept to strings and the store's own arrays, so the selector returns the
	 * same value until something Compose shows has changed.
	 */
	const { elementsKey, rootClientId, sectionsKey } = useSelect(
		( select ) => {
			const store = unlock( select( blockEditorStore ) );
			const entities = select( coreDataStore );
			const theme = entities.getCurrentTheme()?.stylesheet;
			const root = store.getSectionRootClientId() || '';
			const before = [];
			const after = [];
			let sections;

			if ( root ) {
				sections = store.getBlockOrder( root );

				// Walk up from the sections to the template's root,
				// collecting the blocks beside them at each level.
				let pathId = root;
				let parentId = store.getBlockRootClientId( root ) || '';

				for (;;) {
					const siblings = store.getBlockOrder( parentId );
					const index = siblings.indexOf( pathId );

					before.unshift(
						...siblings
							.slice( 0, index )
							.map( ( clientId ) =>
								describeTemplateElement(
									clientId,
									store,
									entities,
									theme,
									'before'
								)
							)
					);
					after.push(
						...siblings
							.slice( index + 1 )
							.map( ( clientId ) =>
								describeTemplateElement(
									clientId,
									store,
									entities,
									theme,
									'after'
								)
							)
					);

					if ( ! parentId ) {
						break;
					}

					pathId = parentId;
					parentId = store.getBlockRootClientId( parentId ) || '';
				}
			} else {
				// No section root: the template's own blocks are the
				// sections, less its header and footer.
				const order = store.getBlockOrder( '' );
				const isPart = ( clientId ) =>
					store.getBlockName( clientId ) === 'core/template-part';
				const first = order.findIndex(
					( clientId ) => ! isPart( clientId )
				);

				sections = order.filter( ( clientId ) => ! isPart( clientId ) );
				order.forEach( ( clientId, index ) => {
					if ( isPart( clientId ) ) {
						( index < first || first === -1 ? before : after ).push(
							describeTemplateElement(
								clientId,
								store,
								entities,
								theme,
								index < first || first === -1
									? 'before'
									: 'after'
							)
						);
					}
				} );
			}

			return {
				elementsKey: [ ...before, ...after ].join( '\n' ),
				rootClientId: root,
				sectionsKey: sections.join( ' ' ),
			};
		},
		[]
	);

	return useMemo( () => {
		const templateElements = elementsKey
			? elementsKey.split( '\n' ).map( ( line ) => {
					const [ position, clientId, name, area, id ] =
						line.split( '|' );

					return {
						area: area || null,
						clientId,
						id: id || null,
						name,
						position,
					};
				} )
			: EMPTY_ARRAY;
		const parts = templateElements.filter( ( element ) => element.area );

		return {
			parts: parts.length ? parts : EMPTY_ARRAY,
			rootClientId,
			sectionIds: sectionsKey ? sectionsKey.split( ' ' ) : EMPTY_ARRAY,
			templateElements,
		};
	}, [ elementsKey, rootClientId, sectionsKey ] );
}
