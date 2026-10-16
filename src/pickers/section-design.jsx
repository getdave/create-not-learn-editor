/**
 * A section's layouts and colours.
 *
 * Shared by Compose's section toolbar, Edit's and the chat, so a section offers
 * the same choices wherever it is changed:
 *
 * - Its layouts are arrangements of the same content, for sections built from
 *   our layouts. See `src/layouts/variants.js`.
 * - Its colours are the theme's section styles. See
 *   `src/site-canvas/compose/section-styles.js`.
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
import { cloneBlock, serialize, store as blocksStore } from '@wordpress/blocks';
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
	getActiveSectionStyle,
	getSectionStyleColors,
	getSectionStyles,
	withSectionStyle,
} from '../site-canvas/compose/section-styles';

const EMPTY_ARRAY = [];

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
	const { base, block, blockStyles, user } = useSelect(
		( select ) => {
			const section = clientId
				? select( blockEditorStore ).getBlock( clientId )
				: null;

			return {
				block: section,
				blockStyles: section
					? select( blocksStore ).getBlockStyles( section.name )
					: EMPTY_ARRAY,
				// Flattened, so the result stays equal while nothing changes.
				...( section ? getSiteStyles( select ) : NO_SITE_STYLES ),
			};
		},
		[ clientId ]
	);
	const themeVariations = base?.styles?.blocks?.[ block?.name ]?.variations;

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

		const site = getSiteColors( { base, user } );
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
					colors: getSectionStyleColors( site.styles, site.palette ),
					label: __( 'None' ),
					name: null,
				},
				...styles.map( ( style ) => ( {
					blocks: [ withStyle( style.name ) ],
					colors: getSectionStyleColors(
						themeVariations?.[ style.name ],
						site.palette
					),
					label: style.label,
					name: style.name,
				} ) ),
			],
		};
	}, [ base, block, blockStyles, themeVariations, user ] );

	return { block, colors, layouts };
}

function LayoutCard( { isCurrent, onSelect, option, Preview } ) {
	const content = useMemo(
		() => serialize( option.blocks ),
		[ option.blocks ]
	);

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
					<Preview content={ content } description={ option.label } />
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
