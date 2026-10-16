/**
 * What Edit design offers a section: its layouts and colours, or a header's
 * or footer's designs, each with the blocks to draw it with.
 */

/**
 * Internal dependencies
 */
import { getSectionArrangements } from '../../layouts/variants';
import {
	__,
	blockEditorStore,
	blocksStore,
	cloneBlock,
	coreDataStore,
	parseBlocks,
	serialize,
	useMemo,
	useSelect,
} from '../../wordpress-packages';
import {
	getActiveSectionStyle,
	getSectionStyles,
	withSectionStyle,
} from '../compose/section-styles';

const EMPTY_ARRAY = [];

/**
 * A section's layouts and colours, each as it would look.
 *
 * @param {string} clientId The section's client ID.
 * @return {Object} `{ block, colors, layouts }`. `colors` and `layouts` are
 *                  `{ current, options }`, or null when there are none.
 */
export function useSectionVariations( clientId ) {
	const { block, blockStyles, themeVariations } = useSelect(
		( select ) => {
			const section = select( blockEditorStore ).getBlock( clientId );

			return {
				block: section,
				blockStyles: section
					? select( blocksStore ).getBlockStyles( section.name )
					: EMPTY_ARRAY,
				themeVariations: section
					? select(
							coreDataStore
						).__experimentalGetCurrentThemeBaseGlobalStyles()
							?.styles?.blocks?.[ section.name ]?.variations
					: undefined,
			};
		},
		[ clientId ]
	);

	const layouts = useMemo( () => {
		const arrangements = block && getSectionArrangements( block );

		return arrangements
			? {
					current: arrangements.current,
					options: arrangements.options.map( ( option ) => ( {
						blocks: [ option.block ],
						block: option.block,
						label: option.label,
						name: option.name,
					} ) ),
				}
			: null;
	}, [ block ] );

	const colors = useMemo( () => {
		const styles = getSectionStyles( blockStyles, themeVariations );

		if ( ! block || ! styles.length ) {
			return null;
		}

		const className = block.attributes.className;
		const withStyle = ( name ) =>
			cloneBlock( block, {
				className: withSectionStyle( className, name ),
			} );

		return {
			current: getActiveSectionStyle( className, styles ),
			options: [
				{
					blocks: [ withStyle( null ) ],
					label: __( 'None' ),
					name: null,
				},
				...styles.map( ( style ) => ( {
					blocks: [ withStyle( style.name ) ],
					label: style.label,
					name: style.name,
				} ) ),
			],
		};
	}, [ block, blockStyles, themeVariations ] );

	return { block, colors, layouts };
}

/**
 * The designs a header or footer can take, each as it would look.
 *
 * Core's template part block offers the same in its Design panel: the
 * patterns made for the part's area. They are read from the site's patterns
 * rather than the block editor's, which leaves out any that can't be inserted
 * where the part is, and nothing can be inserted in the template around a
 * page.
 *
 * @param {Object} part `{ area, clientId, id }`.
 * @return {Object} `{ current, options }`.
 */
export function usePartDesigns( part ) {
	const { patterns, partBlocks } = useSelect(
		( select ) => ( {
			partBlocks: select( coreDataStore ).getEditedEntityRecord(
				'postType',
				'wp_template_part',
				part.id
			)?.blocks,
			patterns: select( coreDataStore ).getBlockPatterns(),
		} ),
		[ part.id ]
	);

	return useMemo( () => {
		const blockType = `core/template-part/${ part.area }`;
		const markup = partBlocks ? serialize( partBlocks ) : '';
		const options = ( patterns || EMPTY_ARRAY )
			.filter( ( pattern ) =>
				( pattern.blockTypes || EMPTY_ARRAY ).includes( blockType )
			)
			.map( ( pattern ) => ( {
				blocks: parseBlocks( pattern.content ),
				label: pattern.title,
				name: pattern.name,
			} ) );

		return {
			current:
				options.find(
					( option ) =>
						markup && serialize( option.blocks ) === markup
				)?.name ?? null,
			options,
		};
	}, [ part.area, partBlocks, patterns ] );
}
