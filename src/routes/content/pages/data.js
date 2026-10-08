/**
 * Data for the Pages screen: the pages themselves, a page's sections, and the
 * sections that can be added to one.
 */

/**
 * Internal dependencies
 */
import { getTitleText } from '../../../records';
import {
	getPatternContent,
	getPatternTitle,
	isPageLayoutPattern,
} from '../page-layouts';
import {
	__,
	blockEditorStore,
	blocksStore,
	coreDataStore,
	parseBlocks,
	select as selectFromRegistry,
	serialize,
	useCallback,
	useDispatch,
	useEffect,
	useMemo,
	useSelect,
} from '../../../wordpress-packages';

const EMPTY_ARRAY = [];

export const PAGES_QUERY = {
	context: 'edit',
	order: 'asc',
	orderby: 'menu_order',
	per_page: 100,
	status: 'publish,draft,pending,private,future',
	_fields: 'id,title,status,parent,menu_order,link,modified,slug,template',
};

/**
 * A page's title as plain text.
 *
 * @param {Object} page Page record.
 * @return {string} Title, or a placeholder for an untitled page.
 */
export function getPageTitle( page ) {
	return getTitleText( page?.title ) || __( '(no title)' );
}

/**
 * Every page on the site, with the pages the site treats specially.
 *
 * @return {Object} Pages, loading state, and the homepage and blog page IDs.
 */
export function usePages() {
	return useSelect( ( select ) => {
		const store = select( coreDataStore );
		const args = [ 'postType', 'page', PAGES_QUERY ];
		const site = store.getEntityRecord( 'root', 'site' );
		const isStaticFront = site?.show_on_front === 'page';

		return {
			frontPageId: isStaticFront ? Number( site?.page_on_front ) || 0 : 0,
			isLoading: ! store.hasFinishedResolution(
				'getEntityRecords',
				args
			),
			pages: store.getEntityRecords( ...args ) || EMPTY_ARRAY,
			postsPageId: isStaticFront
				? Number( site?.page_for_posts ) || 0
				: 0,
		};
	}, [] );
}

/**
 * A page's sections, which are its top-level blocks, and a way to change them.
 *
 * The blocks live on the page entity as an edit, which is what the editor in
 * the canvas renders from, so a change here shows in the preview straight away
 * and is saved with the page. Until something has parsed the page, this parses
 * it once and stores the result as a transient edit, so the sidebar and the
 * preview share the same block client IDs and neither marks the page changed.
 *
 * @param {number} pageId Page ID.
 * @return {Object} `{ blocks, isReady, setBlocks }`.
 */
export function usePageSections( pageId ) {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const { content, editedBlocks, hasBlockTypes, hasRecord } = useSelect(
		( select ) => {
			if ( ! pageId ) {
				return {};
			}

			const store = select( coreDataStore );
			const record = store.getEntityRecord( 'postType', 'page', pageId );
			const edited = store.getEditedEntityRecord(
				'postType',
				'page',
				pageId
			);

			return {
				content: edited?.content,
				editedBlocks: edited?.blocks,
				// Parsing before the block types are registered loses blocks.
				hasBlockTypes:
					!! select( blocksStore ).getBlockType( 'core/group' ),
				hasRecord: !! record,
			};
		},
		[ pageId ]
	);

	useEffect( () => {
		if (
			! pageId ||
			! hasRecord ||
			! hasBlockTypes ||
			editedBlocks ||
			typeof content !== 'string'
		) {
			return;
		}

		editEntityRecord(
			'postType',
			'page',
			pageId,
			{ blocks: parseBlocks( content ) },
			{ undoIgnore: true }
		);
	}, [
		content,
		editEntityRecord,
		editedBlocks,
		hasBlockTypes,
		hasRecord,
		pageId,
	] );

	const setBlocks = useCallback(
		( blocks ) =>
			editEntityRecord( 'postType', 'page', pageId, {
				blocks,
				// A new function on every edit, as the editor does, so each
				// change makes the page dirty and gets its own undo level.
				content: ( { blocks: blocksToSerialize = [] } ) =>
					serialize( blocksToSerialize ),
			} ),
		[ editEntityRecord, pageId ]
	);

	return {
		blocks: editedBlocks || EMPTY_ARRAY,
		isReady: !! editedBlocks,
		setBlocks,
	};
}

const SITE_PART_AREAS = [ 'header', 'footer' ];

function getSitePartArea( attributes, theme ) {
	const id = `${ attributes.theme || theme }//${ attributes.slug }`;
	const area =
		attributes.area ||
		selectFromRegistry( coreDataStore ).getEditedEntityRecord(
			'postType',
			'wp_template_part',
			id
		)?.area;

	if ( SITE_PART_AREAS.includes( area ) ) {
		return area;
	}

	return SITE_PART_AREAS.find( ( name ) =>
		String( attributes.slug || '' ).includes( name )
	);
}

/**
 * Describe one block the template puts around the page: its header or
 * footer, or anything else, like a title or featured image the layout adds.
 *
 * @param {string} clientId Block's client ID in the preview.
 * @param {Object} store    `blockEditorStore` selectors, bound to the preview.
 * @param {string} theme    Current theme's stylesheet, for template part IDs.
 * @return {Object} `{ area, clientId, id }` for a site part, or
 *                  `{ clientId, name }` for anything else.
 */
function describeTemplateElement( clientId, store, theme ) {
	const name = store.getBlockName( clientId );

	if ( name === 'core/template-part' ) {
		const attributes = store.getBlockAttributes( clientId ) || {};
		const area = getSitePartArea( attributes, theme );

		if ( area ) {
			return {
				area,
				clientId,
				id: `${ attributes.theme || theme }//${ attributes.slug }`,
			};
		}
	}

	return { clientId, name };
}

/**
 * How the page is laid out in the preview editor: the template's own blocks
 * around it - its header and footer, and anything else the layout adds, like
 * a title or featured image - and where each of the page's own sections is
 * rendered.
 *
 * The preview renders the page inside its template, and gives the page's
 * blocks client IDs of its own there, so sections are matched to the preview
 * by position inside the Post Content block rather than by ID.
 *
 * @return {Object} `{ after, before, sectionIds }`. `after` and `before` are
 *                  the template's elements in the order they appear around
 *                  the page's content.
 */
export function usePreviewStructure() {
	const { postContentId, sectionIds, theme } = useSelect( ( select ) => {
		const store = select( blockEditorStore );
		const [ contentId ] = store.getBlocksByName( 'core/post-content' );

		return {
			postContentId: contentId,
			sectionIds: store.getBlockOrder( contentId || '' ),
			theme: select( coreDataStore ).getCurrentTheme()?.stylesheet,
		};
	}, [] );

	return useMemo( () => {
		if ( ! postContentId ) {
			return { after: EMPTY_ARRAY, before: EMPTY_ARRAY, sectionIds };
		}

		const store = selectFromRegistry( blockEditorStore );
		const before = [];
		const after = [];
		let pathId = postContentId;
		let parentId = store.getBlockRootClientId( postContentId ) || '';

		// Walk up from the page's content to the template's root, collecting
		// the blocks beside it at each level - the closer to the content, the
		// closer to it in the list.
		for (;;) {
			const siblings = store.getBlockOrder( parentId );
			const pathIndex = siblings.indexOf( pathId );

			before.unshift(
				...siblings
					.slice( 0, pathIndex )
					.map( ( clientId ) =>
						describeTemplateElement( clientId, store, theme )
					)
			);
			after.push(
				...siblings
					.slice( pathIndex + 1 )
					.map( ( clientId ) =>
						describeTemplateElement( clientId, store, theme )
					)
			);

			if ( ! parentId ) {
				break;
			}

			pathId = parentId;
			parentId = store.getBlockRootClientId( parentId ) || '';
		}

		return { after, before, sectionIds };
	}, [ postContentId, sectionIds, theme ] );
}

const PAGE_TEMPLATES_QUERY = { per_page: -1, post_type: 'page' };

/**
 * The layouts a page can use: the one it gets by default, and the theme's
 * and site's custom page templates.
 *
 * A homepage shown by a `front-page` template always uses it, whatever the
 * page asks for, so that one is reported separately. Patterns come too, to
 * look inside any a template uses.
 *
 * @param {string}  slug        Page slug.
 * @param {boolean} isFrontPage Whether the page is the site's homepage.
 * @return {Object} `{ custom, defaultTemplate, frontPageTemplate, isLoading,
 *                  patterns }`.
 */
export function usePageLayouts( slug, isFrontPage ) {
	return useSelect(
		( select ) => {
			const store = select( coreDataStore );
			const custom = store.getEntityRecords(
				'postType',
				'wp_template',
				PAGE_TEMPLATES_QUERY
			);
			const defaultId = store.getDefaultTemplateId( {
				slug: slug ? `page-${ slug }` : 'page',
			} );
			const frontId = isFrontPage
				? store.getDefaultTemplateId( { slug: 'front-page' } )
				: undefined;
			const defaultTemplate = defaultId
				? store.getEntityRecord( 'postType', 'wp_template', defaultId )
				: undefined;
			const frontTemplate = frontId
				? store.getEntityRecord( 'postType', 'wp_template', frontId )
				: undefined;

			return {
				custom: custom || EMPTY_ARRAY,
				defaultTemplate,
				frontPageTemplate:
					frontTemplate?.slug === 'front-page' ? frontTemplate : null,
				isLoading: ! custom || ! defaultTemplate,
				patterns: store.getBlockPatterns?.() || EMPTY_ARRAY,
			};
		},
		[ isFrontPage, slug ]
	);
}

const HIDDEN_CATEGORIES = [ 'header', 'footer', 'query' ];

/**
 * Whether a pattern is a section of a page, rather than a whole page, a site
 * part, or something for a particular template.
 *
 * @param {Object} pattern Block pattern.
 * @return {boolean} Whether it can be added as a section.
 */
export function isSectionPattern( pattern ) {
	const categories = pattern?.categories || EMPTY_ARRAY;
	const blockTypes = pattern?.blockTypes || EMPTY_ARRAY;

	if (
		! pattern ||
		pattern.inserter === false ||
		pattern.templateTypes?.length ||
		isPageLayoutPattern( pattern )
	) {
		return false;
	}

	if (
		blockTypes.some(
			( blockType ) =>
				blockType.startsWith( 'core/template-part' ) ||
				blockType === 'core/post-content'
		)
	) {
		return false;
	}

	return categories.some(
		( category ) =>
			! HIDDEN_CATEGORIES.includes( category ) &&
			! category.endsWith( '_post-format' ) &&
			! category.endsWith( '_page' )
	);
}

/**
 * Group section patterns by category, in the order the categories are
 * registered, leading with the theme's featured picks.
 *
 * @param {Object[]} patterns   Section patterns.
 * @param {Object[]} categories Registered pattern categories.
 * @return {Object[]} `{ name, label, patterns }` groups.
 */
export function groupSectionPatterns( patterns, categories ) {
	const groups = new Map();
	const labels = new Map(
		( categories || EMPTY_ARRAY ).map( ( category ) => [
			category.name,
			category.label,
		] )
	);
	const order = ( categories || EMPTY_ARRAY ).map(
		( category ) => category.name
	);

	patterns.forEach( ( pattern ) => {
		( pattern.categories || EMPTY_ARRAY ).forEach( ( name ) => {
			if (
				HIDDEN_CATEGORIES.includes( name ) ||
				name.endsWith( '_post-format' ) ||
				name.endsWith( '_page' )
			) {
				return;
			}

			if ( ! groups.has( name ) ) {
				groups.set( name, {
					label:
						name === 'featured'
							? __( 'Suggested' )
							: labels.get( name ) || name,
					name,
					patterns: [],
				} );
			}

			groups.get( name ).patterns.push( pattern );
		} );
	} );

	const rank = ( name ) => {
		if ( name === 'featured' ) {
			return -1;
		}

		const index = order.indexOf( name );

		return index === -1 ? order.length : index;
	};

	return [ ...groups.values() ].sort(
		( a, b ) => rank( a.name ) - rank( b.name )
	);
}

/**
 * The patterns that can be added to a page as sections, grouped by category.
 *
 * @return {Object} `{ groups, isLoading }`.
 */
export function useSectionPatterns() {
	const { categories, isLoading, patterns } = useSelect( ( select ) => {
		const store = select( coreDataStore );

		return {
			categories: store.getBlockPatternCategories?.() || EMPTY_ARRAY,
			isLoading: ! store.hasFinishedResolution( 'getBlockPatterns' ),
			patterns: store.getBlockPatterns?.() || EMPTY_ARRAY,
		};
	}, [] );
	const groups = useMemo(
		() =>
			groupSectionPatterns(
				patterns.filter( isSectionPattern ),
				categories
			),
		[ categories, patterns ]
	);

	return { groups, isLoading };
}

/**
 * The blocks a pattern adds, named after the pattern so the new section shows
 * up in the list under the name it was picked by.
 *
 * @param {Object} pattern Block pattern.
 * @return {Object[]} Blocks.
 */
export function getPatternSectionBlocks( pattern ) {
	const blocks = parseBlocks( getPatternContent( pattern ) );

	if ( blocks.length !== 1 ) {
		return blocks;
	}

	const [ block ] = blocks;

	return [
		{
			...block,
			attributes: {
				...block.attributes,
				metadata: {
					...block.attributes?.metadata,
					name:
						block.attributes?.metadata?.name ||
						getPatternTitle( pattern ),
					patternName: pattern.name,
				},
			},
		},
	];
}
