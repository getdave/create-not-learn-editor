/**
 * A section's layouts and colours.
 *
 * Shared by Compose's section toolbar, Edit's and the chat, so a section offers
 * the same choices wherever it is changed:
 *
 * - Its layouts are arrangements of the same content, for sections built from
 *   our layouts. See `src/layouts/variants.js`.
 * - Its colours are the theme's section styles, or sets made from its palette
 *   for a theme without any, offered only where they can show and be read.
 *   See `src/site-canvas/compose/section-colors.js`.
 *
 * The toolbars show them in dropdowns. The chat shows the layouts as cards,
 * each a preview of the section laid out that way, and the colours as
 * swatches.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * because the chat loads it from app init. See `src/editor-layer/index.jsx`.
 */

/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import {
	cloneBlock,
	getBlockType,
	serialize,
	store as blocksStore,
} from '@wordpress/blocks';
import { store as coreDataStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { check as checkIcon } from '@wordpress/icons';
import { Icon } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { getSectionArrangements } from '../layouts/variants';
import { getVariationPalette } from '../routes/static/style-variations';
import {
	getAttributeUpdate,
	getColorOptions,
	getReadableOptions,
	getSectionColor,
	withSectionColor,
} from '../site-canvas/compose/section-colors';
import { usePreviewBlocks } from './preview-blocks';

const EMPTY_ARRAY = [];
const NO_COLORS = { colors: EMPTY_ARRAY, options: EMPTY_ARRAY };

const NO_SITE_STYLES = { base: null, user: null };

/**
 * The site's global styles as they stand, with any unsaved changes, and the
 * theme's: what section styles' colours are looked up in, and what a section
 * with none takes.
 *
 * @param {Function} select Registry `select`.
 * @return {Object} `{ base, user }`.
 */
function getSiteStyles( select ) {
	const store = select( coreDataStore );
	const id = store.__experimentalGetCurrentGlobalStylesId?.();

	return {
		base: store.__experimentalGetCurrentThemeBaseGlobalStyles(),
		user: id
			? store.getEditedEntityRecord( 'root', 'globalStyles', id )
			: null,
	};
}

/**
 * @param {Object} site From `getSiteStyles`.
 * @return {Object} `{ palette, styles }`: the palette, and the colours a
 *                  section with no style of its own takes.
 */
function getSiteColors( site ) {
	const { base, user } = site;
	const userPalette = getVariationPalette( user );

	return {
		palette: userPalette.length ? userPalette : getVariationPalette( base ),
		styles: {
			color: { ...base?.styles?.color, ...user?.styles?.color },
			elements: {
				button: {
					color: {
						...base?.styles?.elements?.button?.color,
						...user?.styles?.elements?.button?.color,
					},
				},
				heading: {
					color: {
						...base?.styles?.elements?.heading?.color,
						...user?.styles?.elements?.heading?.color,
					},
				},
			},
		},
	};
}

/**
 * The colours a type of block can take on this site.
 *
 * @param {Object} site      `{ base, blockStyles, user }`: the site's
 *                           styles and the block type's block styles.
 * @param {string} blockName The block type.
 * @return {Object} `{ colors, options }`: the palette, and the result of
 *                  `getColorOptions`.
 */
function buildColorChoices( site, blockName ) {
	const { palette, styles } = getSiteColors( site );
	const color = getBlockType( blockName )?.supports?.color;

	return {
		colors: palette,
		options: getColorOptions( {
			blockStyles: site.blockStyles,
			colors: palette,
			palette,
			styles,
			supports: {
				background: !! color && color.background !== false,
				button: !! color?.button,
				heading: !! color?.heading,
				link: !! color?.link,
				text: !! color && color.text !== false,
			},
			variations: site.base?.styles?.blocks?.[ blockName ]?.variations,
		} ),
	};
}

/**
 * The colours a type of block can take on this site, read now, for code
 * outside a component.
 *
 * @param {Function} select    Registry `select`.
 * @param {string}   blockName The block type.
 * @return {Object} As `useColorOptions`.
 */
export function getColorChoices( select, blockName ) {
	return buildColorChoices(
		{
			blockStyles: select( blocksStore ).getBlockStyles( blockName ),
			...getSiteStyles( select ),
		},
		blockName
	);
}

/**
 * The colours a type of block can take on this site: the theme's section
 * styles, or sets made from its palette.
 *
 * @param {?string} blockName The block type.
 * @return {Object} `{ colors, options }`: the palette, and the result of
 *                  `getColorOptions`.
 */
export function useColorOptions( blockName ) {
	const { base, blockStyles, user } = useSelect(
		( select ) =>
			blockName
				? {
						blockStyles:
							select( blocksStore ).getBlockStyles( blockName ),
						// Flattened, so the result stays equal while nothing
						// changes.
						...getSiteStyles( select ),
					}
				: NO_SITE_STYLES,
		[ blockName ]
	);

	return useMemo(
		() =>
			blockName
				? buildColorChoices( { base, blockStyles, user }, blockName )
				: NO_COLORS,
		[ base, blockName, blockStyles, user ]
	);
}

/**
 * The colours to offer blocks that take a colour together, like a section,
 * or a header's outermost blocks, or null when there are none to offer:
 * colours set on the blocks themselves, which win over any picked, or no
 * other colour their text can be read on.
 *
 * @param {Object[]} blocks  The blocks.
 * @param {Object}   choices Result of `useColorOptions`.
 * @return {?Object} `{ current, options }`.
 */
export function getColorOffer( blocks, choices ) {
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
 * What to give `updateBlockAttributes` to put a colour on a block.
 *
 * @param {Object}   block   The block.
 * @param {Object[]} options The colours there are.
 * @param {?string}  name    The colour, or null for the theme's.
 * @return {Object} The attributes.
 */
export function getColorUpdate( block, options, name ) {
	return getAttributeUpdate(
		block.attributes,
		withSectionColor( block.attributes, options, name )
	);
}

/**
 * A section's layouts and colours, each as it would look.
 *
 * @param {?string} clientId The section's client ID.
 * @return {Object} `{ block, colors, layouts }`. `colors` and `layouts` are
 *                  `{ current, options }`, or null when there are none.
 *                  Each option is `{ blocks, label, name }`, `blocks` being
 *                  how the section looks with it; a layout's has the
 *                  rearranged `block`, and a colour's its swatch `colors`.
 */
export function useSectionVariations( clientId ) {
	const block = useSelect(
		( select ) =>
			clientId ? select( blockEditorStore ).getBlock( clientId ) : null,
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

	const colors = useMemo( () => {
		const offer = block && getColorOffer( [ block ], choices );

		return (
			offer && {
				...offer,
				options: offer.options.map( ( option ) => ( {
					...option,
					blocks: [
						cloneBlock( {
							...block,
							attributes: withSectionColor(
								block.attributes,
								choices.options,
								option.name
							),
						} ),
					],
				} ) ),
			}
		);
	}, [ block, choices ] );

	return { block, colors, layouts };
}

function LayoutCard( { isCurrent, onSelect, option, Preview } ) {
	// Serialized and parsed again, so the preview's blocks are its own.
	const content = useMemo(
		() => serialize( option.blocks ),
		[ option.blocks ]
	);
	const previewBlocks = usePreviewBlocks( content );

	return (
		<li>
			<button
				aria-pressed={ isCurrent }
				className={ `cnl-section-design__layout${
					isCurrent ? ' is-current' : ''
				}` }
				onClick={ () => ! isCurrent && onSelect( option ) }
				type="button"
			>
				<span aria-hidden className="cnl-section-design__preview">
					<Preview
						blocks={ previewBlocks }
						description={ option.label }
					/>
				</span>
				<span className="cnl-section-design__layout-footer">
					<span className="cnl-section-design__label">
						{ option.label }
					</span>
					{ isCurrent && (
						<span className="cnl-section-design__current">
							<Icon icon={ checkIcon } size={ 16 } />
							{ __( 'Current' ) }
						</span>
					) }
				</span>
			</button>
		</li>
	);
}

/**
 * A section's layouts, as cards showing the section laid out each way.
 *
 * @param {Object}   props          Component props.
 * @param {Object}   props.layouts  From `useSectionVariations`.
 * @param {Function} props.onSelect Called with the layout picked.
 * @param {Function} props.Preview  Renders markup, from `{ content,
 *                                  description }`.
 * @return {Element} The layouts, as one list.
 */
export function SectionLayouts( { layouts, onSelect, Preview } ) {
	return (
		<ul
			aria-label={ __( 'Layouts' ) }
			className="cnl-section-design__layouts"
		>
			{ layouts.options.map( ( option ) => (
				<LayoutCard
					isCurrent={ option.name === layouts.current }
					key={ option.name }
					onSelect={ onSelect }
					option={ option }
					Preview={ Preview }
				/>
			) ) }
		</ul>
	);
}

/**
 * A section's colours, as small swatches: each style's background, with
 * "Aa" in its heading colour.
 *
 * @param {Object}   props          Component props.
 * @param {Object}   props.colors   From `useSectionVariations`.
 * @param {Function} props.onSelect Called with the colour picked.
 * @return {Element} The swatches.
 */
export function SectionColorSwatches( { colors, onSelect } ) {
	return (
		<ul
			aria-label={ __( 'Colors' ) }
			className="cnl-section-design__swatches"
		>
			{ colors.options.map( ( option ) => {
				const isCurrent = option.name === colors.current;

				return (
					<li key={ option.name ?? 'none' }>
						<button
							aria-pressed={ isCurrent }
							className={ `cnl-section-design__swatch${
								isCurrent ? ' is-current' : ''
							}${ option.name ? '' : ' is-none' }` }
							onClick={ () => ! isCurrent && onSelect( option ) }
							type="button"
						>
							<span
								aria-hidden
								className="cnl-section-design__swatch-color"
								style={ {
									background: option.colors.background,
									color:
										option.colors.heading ||
										option.colors.text,
								} }
							>
								{ __( 'Aa' ) }
							</span>
							<span className="cnl-section-design__label">
								{ option.label }
							</span>
						</button>
					</li>
				);
			} ) }
		</ul>
	);
}
