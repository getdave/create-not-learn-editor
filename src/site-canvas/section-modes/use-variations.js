/**
 * What Edit design offers a section: its layouts and colours, or a header's
 * or footer's designs, each with the blocks to draw it with.
 */

/**
 * Internal dependencies
 */
import { getSectionArrangements } from '../../layouts/variants';
import {
	getCurrentPatternName,
	getSitePartPatterns,
} from '../../routes/site-part/layouts';
import {
	blockEditorStore,
	blocksStore,
	coreDataStore,
	getBlockType,
	parseBlocks,
	serialize,
	useMemo,
	useSelect,
} from '../../wordpress-packages';
import {
	getColorOptions,
	getReadableOptions,
	getSectionColor,
	withPartColor,
} from '../compose/section-colors';
import { getPartColorBlocks } from '../compose/section-styles';

const EMPTY_ARRAY = [];
const NO_COLOR_DATA = {};
const NO_COLORS = { colors: EMPTY_ARRAY, options: EMPTY_ARRAY };

/**
 * A section's colours for the panel, or null when it has none to offer:
 * colours set on its own block, or no other its text can be read on.
 *
 * @param {Object[]} blocks  The blocks that take the colour together.
 * @param {Object}   choices Result of `useColorOptions`.
 * @return {?Object} `{ current, options }`.
 */
function getOffer( blocks, choices ) {
	const { colors, options } = choices;

	if (
		! blocks.length ||
		! options.length ||
		blocks.some(
			( block ) => getSectionColor( block, options ) === undefined
		)
	) {
		return null;
	}

	const readable = blocks.reduce( ( list, block ) => {
		const names = getReadableOptions( block, options, colors ).map(
			( option ) => option.name
		);

		return list.filter( ( option ) => names.includes( option.name ) );
	}, options );

	// Something to change to, besides the colour it has.
	return readable.length > 1
		? {
				current: getSectionColor( blocks[ 0 ], options ),
				options: readable,
			}
		: null;
}

/**
 * The colours a type of block can take on this site: the theme's section
 * styles, or sets made from its palette.
 *
 * @param {?string} blockName The block type.
 * @return {Object} `{ colors, options }`: every colour presets can name, and
 *                  the result of `getColorOptions`.
 */
function useColorOptions( blockName ) {
	const { baseStyles, blockStyles, palettes, userStyles } = useSelect(
		( select ) => {
			if ( ! blockName ) {
				return NO_COLOR_DATA;
			}

			const core = select( coreDataStore );
			const globalStylesId =
				core.__experimentalGetCurrentGlobalStylesId();

			return {
				baseStyles:
					core.__experimentalGetCurrentThemeBaseGlobalStyles()
						?.styles,
				blockStyles: select( blocksStore ).getBlockStyles( blockName ),
				palettes:
					select( blockEditorStore ).getSettings()
						.__experimentalFeatures?.color?.palette,
				userStyles: globalStylesId
					? core.getEditedEntityRecord(
							'root',
							'globalStyles',
							globalStylesId
						)?.styles
					: undefined,
			};
		},
		[ blockName ]
	);

	return useMemo( () => {
		if ( ! blockName ) {
			return NO_COLORS;
		}

		const theme = palettes?.theme || EMPTY_ARRAY;
		const fallback = palettes?.default || EMPTY_ARRAY;
		const color = getBlockType( blockName )?.supports?.color;
		const colors = [
			...theme,
			...fallback,
			...( palettes?.custom || EMPTY_ARRAY ),
		];

		const options = getColorOptions( {
			blockStyles,
			colors,
			palette: theme.length ? theme : fallback,
			// The site's own choices over the theme's.
			styles: {
				color: { ...baseStyles?.color, ...userStyles?.color },
				elements: {
					button: {
						color: {
							...baseStyles?.elements?.button?.color,
							...userStyles?.elements?.button?.color,
						},
					},
				},
			},
			supports: {
				background: !! color && color.background !== false,
				button: !! color?.button,
				heading: !! color?.heading,
				link: !! color?.link,
				text: !! color && color.text !== false,
			},
			variations: baseStyles?.blocks?.[ blockName ]?.variations,
		} );

		return { colors, options };
	}, [ baseStyles, blockName, blockStyles, palettes, userStyles ] );
}

/**
 * A section's layouts and colours, each as it would look.
 *
 * A section with colours of its own is offered no colours, as a picked one
 * couldn't win over them and they are never taken away.
 *
 * @param {string} clientId The section's client ID.
 * @return {Object} `{ block, colors, layouts }`. `colors` and `layouts` are
 *                  `{ current, options }`, or null when there are none.
 */
export function useSectionVariations( clientId ) {
	const block = useSelect(
		( select ) => select( blockEditorStore ).getBlock( clientId ),
		[ clientId ]
	);
	const choices = useColorOptions( block?.name );

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

	const colors = useMemo(
		() => ( block ? getOffer( [ block ], choices ) : null ),
		[ block, choices ]
	);

	return { block, colors, layouts };
}

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
		() => getOffer( getPartColorBlocks( partBlocks ), choices ),
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
 * @param {?Object} color `{ blockName, name, choices }`: the block type that
 *                        takes the part's colour, the colour, and the
 *                        result of `useColorOptions`, or null when it takes
 *                        none.
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
	const choices = color?.choices;

	return useMemo( () => {
		const layouts = getSitePartPatterns( patterns, part.area );
		const options = layouts.map( ( pattern ) => {
			const blocks = parseBlocks( pattern.content );

			return {
				blocks: choices
					? withPartColor(
							blocks,
							colorBlockName,
							choices.options,
							choices.colors,
							colorName
						)
					: blocks,
				label: pattern.title,
				name: pattern.name,
			};
		} );

		return {
			current: getCurrentPatternName(
				partBlocks ? serialize( partBlocks ) : '',
				layouts
			),
			options,
		};
	}, [
		colorBlockName,
		colorName,
		choices,
		part.area,
		partBlocks,
		patterns,
	] );
}
