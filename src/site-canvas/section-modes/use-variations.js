/**
 * What Edit design offers a section: its layouts and colours, or a header's
 * or footer's designs, each with the blocks to draw it with.
 */

/**
 * Internal dependencies
 */
import {
	coreDataStore,
	parseBlocks,
	serialize,
	useMemo,
	useSelect,
} from '../../wordpress-packages';

const EMPTY_ARRAY = [];

// A section's layouts and colours, shared with the chat's picker.
export { useSectionVariations } from '../../pickers/section-design';

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
