/**
 * What Edit design offers a section: its layouts and colours, or a header's
 * or footer's designs and colours, each with the blocks to draw it with.
 */

/**
 * Internal dependencies
 */
import { getColorOffer, useColorOptions } from '../../pickers/section-design';
import {
	getCurrentPatternName,
	getSitePartPatterns,
} from '../../routes/site-part/layouts';
import {
	blockEditorStore,
	coreDataStore,
	parseBlocks,
	serialize,
	useMemo,
	useSelect,
} from '../../wordpress-packages';
import { withPartColor } from '../compose/section-colors';
import { getPartColorBlocks } from '../compose/section-styles';

// A section's layouts and colours, shared with the chat's picker.
export { useSectionVariations } from '../../pickers/section-design';

/**
 * A header's or footer's colours, offered as a section's are and put on its
 * outermost blocks, so they show on every page and stay put when its design
 * changes.
 *
 * @param {Object} part `{ area, clientId, id }`.
 * @return {Object} `{ blockName, choices, colors }`. `choices` is the
 *                  result of `useColorOptions`; `colors` is `{ current,
 *                  options }`, or null when there are none.
 */
export function usePartColors( part ) {
	const partBlocks = useSelect(
		( select ) => select( blockEditorStore ).getBlocks( part.clientId ),
		[ part.clientId ]
	);
	const blockName = partBlocks[ 0 ]?.name;
	const choices = useColorOptions( blockName );

	const colors = useMemo(
		() =>
			getColorOffer( getPartColorBlocks( partBlocks ), choices, {
				allowCustom: true,
			} ),
		[ choices, partBlocks ]
	);

	return { blockName, choices, colors };
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
 * Each is shown, and goes in, with the part's colour as it is now, as a
 * section's layouts keep its colour. A part with colours of its own, and a
 * design with colours of its own, are left as they are. The one in use is
 * found as the Header and Footer screens find it, whatever its colours.
 *
 * @param {Object}  part  `{ area, clientId, id }`.
 * @param {?Object} color `{ blockName, name, choices, values }`: the block
 *                        type that takes the part's colour, the colour, the
 *                        result of `useColorOptions`, and its colours, for
 *                        custom colours; or null when it takes none.
 * @return {Object} `{ current, options }`.
 */
export function usePartDesigns( part, color ) {
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
	const colorBlockName = color?.blockName;
	const colorName = color?.name;
	const colorValues = color?.values;
	const choices = color?.choices;

	// Parsed once, rather than again with every change to the part. Options
	// are cloned as they go in, so the same blocks can be offered again.
	const layouts = useMemo(
		() =>
			getSitePartPatterns( patterns, part.area ).map( ( pattern ) => ( {
				blocks: parseBlocks( pattern.content ),
				pattern,
			} ) ),
		[ part.area, patterns ]
	);
	const options = useMemo(
		() =>
			layouts.map( ( { blocks, pattern } ) => ( {
				blocks: choices
					? withPartColor(
							blocks,
							colorBlockName,
							choices.options,
							choices.colors,
							colorName,
							{ supports: choices.supports, values: colorValues }
						)
					: blocks,
				label: pattern.title,
				name: pattern.name,
			} ) ),
		[ choices, colorBlockName, colorName, colorValues, layouts ]
	);
	const current = useMemo(
		() =>
			getCurrentPatternName(
				partBlocks ? serialize( partBlocks ) : '',
				layouts.map( ( { pattern } ) => pattern )
			),
		[ layouts, partBlocks ]
	);

	return useMemo( () => ( { current, options } ), [ current, options ] );
}
