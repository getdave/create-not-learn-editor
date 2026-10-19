/**
 * Edit design's panel: the section's layouts, each drawn with the section's
 * own content, and its colours below, as Design's colour palettes are
 * shown. A header or footer offers its designs instead. Picking one changes
 * the section underneath at once.
 *
 * Freeform hands the section to core's own block tools, Reset puts back how
 * the section was when the panel opened, and Done closes it.
 *
 * Dark and see-through, so it stands apart from the page under it: the
 * design system's own dark theme, from a dark background seed, so its words,
 * edges and buttons all follow. Its buttons are the design system's, which
 * read the theme, where core's keep their light colours.
 */

/**
 * WordPress dependencies
 */
import { BlockPreview } from '@wordpress/block-editor';
import {
	createContext,
	forwardRef,
	useContext,
	useState,
} from '@wordpress/element';

/**
 * Internal dependencies
 */
import {
	__,
	blockEditorStore,
	Button,
	chevronLeftIcon,
	chevronRightIcon,
	cloneBlock,
	ColorIndicator,
	coreDataStore,
	isRTL,
	serialize,
	sprintf,
	ThemeProvider,
	UiButton,
	UiIconButton,
	useDispatch,
	useSelect,
} from '../../wordpress-packages';
import { GlobalNote } from '../../global-scope';
import { getSitewideText } from './section-chrome';
import { usePartDesigns, useSectionVariations } from './use-variations';
import { withSectionStyle } from '../compose/section-styles';

const EMPTY_ARRAY = [];

// The panel's dark theme seed, the editor's own dark grey.
const PANEL_THEME = { color: { background: '#1e1e1e' } };

// The most layouts the carousel shows at once.
export const MAX_PER_SLIDE = 4;

/**
 * A colour from a theme's styles, as CSS: a preset's slug resolved against
 * the palette, anything else as it is.
 *
 * @param {?string}  value   The colour, like `var:preset|color|accent`.
 * @param {Object[]} palette `{ slug, color }` for each colour of the theme.
 * @return {?string} The colour.
 */
function resolveColor( value, palette ) {
	if ( typeof value !== 'string' ) {
		return null;
	}

	const slug =
		value.match( /^var:preset\|color\|(.+)$/ )?.[ 1 ] ||
		value.match( /^var\(--wp--preset--color--([^)]+)\)$/ )?.[ 1 ];

	if ( slug ) {
		return palette.find( ( item ) => item.slug === slug )?.color || null;
	}

	return value;
}

/**
 * A section style's background, words and accent, for its swatch.
 *
 * @param {?Object}  styles  The style's styles, from the theme.
 * @param {Object[]} palette The theme's colours.
 * @return {string[]} Up to three colours.
 */
function getSwatch( styles, palette ) {
	const elements = styles?.elements || {};

	return [
		styles?.color?.background || styles?.color?.gradient,
		styles?.color?.text,
		elements.button?.color?.background ||
			elements.link?.color?.text ||
			elements.heading?.color?.text,
	]
		.map( ( value ) => resolveColor( value, palette ) )
		.filter( Boolean );
}

/**
 * The theme's colours, and its styles for each section style of a block.
 *
 * @param {?string} blockName The section's block type.
 * @return {Object} `{ palette, variations }`.
 */
function useStyleColors( blockName ) {
	return useSelect(
		( select ) => {
			const settings = select( blockEditorStore ).getSettings();
			const features = settings.__experimentalFeatures?.color?.palette;

			return {
				palette: [
					...( features?.theme || EMPTY_ARRAY ),
					...( features?.default || EMPTY_ARRAY ),
					...( settings.colors || EMPTY_ARRAY ),
				],
				variations: blockName
					? select(
							coreDataStore
						).__experimentalGetCurrentThemeBaseGlobalStyles()
							?.styles?.blocks?.[ blockName ]?.variations
					: undefined,
			};
		},
		[ blockName ]
	);
}

function Preview( { blocks } ) {
	return (
		<span aria-hidden className="cnl-section-modes__preview" inert="">
			<BlockPreview.Async>
				<BlockPreview blocks={ blocks } viewportWidth={ 1200 } />
			</BlockPreview.Async>
		</span>
	);
}

// How many layouts the carousel shows at once, set by the panel.
const PerSlideContext = createContext( MAX_PER_SLIDE );

/**
 * Layouts as a carousel, so the panel stays one row tall however many there
 * are. It shows a full row at a time and moves along one layout at a time,
 * so no layout is ever left on its own. It opens with the one in use in view.
 *
 * @param {Object}   props
 * @param {?string}  props.current  The layout in use.
 * @param {Function} props.onSelect Called with the layout picked.
 * @param {Object[]} props.options  `{ blocks, label, name }` for each.
 * @return {Element} The carousel.
 */
function LayoutOptions( { current, onSelect, options } ) {
	const perSlide = useContext( PerSlideContext );
	const visible = Math.min( perSlide, options.length );
	const lastStart = options.length - visible;
	const currentIndex = Math.max(
		0,
		options.findIndex( ( option ) => option.name === current )
	);
	const [ start, setStart ] = useState( () =>
		Math.min( currentIndex, lastStart )
	);
	const shown = Math.min( start, lastStart );
	const hasMore = lastStart > 0;
	const direction = isRTL() ? 1 : -1;

	return (
		<div
			aria-roledescription={ hasMore ? __( 'carousel' ) : undefined }
			className="cnl-section-modes__carousel"
			role="group"
			style={ {
				'--cnl-layouts-per-slide': visible,
				'--cnl-layouts-offset': direction * shown,
			} }
		>
			<div className="cnl-section-modes__carousel-row">
				{ hasMore && (
					<UiIconButton
						className="cnl-section-modes__carousel-arrow"
						disabled={ shown === 0 }
						icon={ isRTL() ? chevronRightIcon : chevronLeftIcon }
						label={ __( 'Previous layout' ) }
						onClick={ () => setStart( shown - 1 ) }
						size="compact"
						tone="neutral"
						variant="outline"
					/>
				) }
				<div className="cnl-section-modes__carousel-viewport">
					<div className="cnl-section-modes__options">
						{ options.map( ( option, index ) => {
							const isHidden =
								index < shown || index >= shown + visible;

							return (
								<button
									aria-hidden={ isHidden || undefined }
									aria-pressed={ option.name === current }
									className="cnl-section-modes__option"
									inert={ isHidden ? '' : undefined }
									key={ option.name ?? 'none' }
									onClick={ () =>
										option.name !== current &&
										onSelect( option )
									}
									title={ option.label }
									type="button"
								>
									<Preview blocks={ option.blocks } />
									<span>{ option.label }</span>
								</button>
							);
						} ) }
					</div>
				</div>
				{ hasMore && (
					<UiIconButton
						className="cnl-section-modes__carousel-arrow"
						disabled={ shown === lastStart }
						icon={ isRTL() ? chevronLeftIcon : chevronRightIcon }
						label={ __( 'Next layout' ) }
						onClick={ () => setStart( shown + 1 ) }
						size="compact"
						tone="neutral"
						variant="outline"
					/>
				) }
			</div>
			{ hasMore && (
				<div className="cnl-section-modes__carousel-dots">
					{ Array.from( { length: lastStart + 1 }, ( _, index ) => (
						<button
							aria-current={ index === shown }
							aria-label={ sprintf(
								/* translators: 1: first layout shown, 2: last layout shown, 3: number of layouts. */
								__( 'Show layouts %1$d to %2$d of %3$d' ),
								index + 1,
								index + visible,
								options.length
							) }
							className="cnl-section-modes__carousel-dot"
							key={ index }
							onClick={ () => setStart( index ) }
							type="button"
						/>
					) ) }
				</div>
			) }
		</div>
	);
}

/**
 * The way to Freeform, under the layouts.
 *
 * @param {Object}   props
 * @param {Function} props.onFreeform Hands the section to core's own block
 *                                    tools.
 * @return {Element} The row.
 */
function FreeformRow( { onFreeform } ) {
	return (
		<div className="cnl-section-modes__freeform">
			{ __( 'Need more control?' ) }{ ' ' }
			<Button
				className="cnl-section-modes__link"
				description={ __(
					'Move, resize and restyle the blocks in this section'
				) }
				onClick={ onFreeform }
				variant="link"
			>
				{ __( 'Edit freeform' ) }
			</Button>
		</div>
	);
}

/**
 * The only layout there is, as it is now, picked.
 *
 * @param {Object}   props
 * @param {Object[]} props.blocks How it looks.
 * @param {string}   props.label  Its name.
 * @return {Element} The option.
 */
function OnlyLayout( { blocks, label } ) {
	return (
		<LayoutOptions
			current="current"
			onSelect={ () => {} }
			options={ [ { blocks, label, name: 'current' } ] }
		/>
	);
}

/**
 * A section's arrangements and colours.
 *
 * @param {Object}   props
 * @param {string}   props.clientId   The section.
 * @param {Function} props.onFreeform See `FreeformRow`.
 * @param {Function} props.onReplace  Called with the block that takes the
 *                                    section's place when its layout
 *                                    changes.
 * @return {Element} The panel's options.
 */
function SectionOptions( { clientId, onFreeform, onReplace } ) {
	const { replaceBlock, updateBlockAttributes } =
		useDispatch( blockEditorStore );
	const { block, colors, layouts } = useSectionVariations( clientId );
	const { palette, variations } = useStyleColors( block?.name );

	return (
		<>
			{ layouts ? (
				<LayoutOptions
					current={ layouts.current }
					onSelect={ ( option ) => {
						const next = cloneBlock( option.block );

						replaceBlock( clientId, next );
						onReplace( next );
					} }
					options={ layouts.options }
				/>
			) : (
				block && (
					<OnlyLayout
						blocks={ [ block ] }
						label={ __( 'Current layout' ) }
					/>
				)
			) }
			<FreeformRow onFreeform={ onFreeform } />
			{ colors && (
				<div className="cnl-section-modes__colors">
					<span className="cnl-section-modes__panel-heading">
						{ __( 'Colours' ) }
					</span>
					<div
						aria-label={ __( 'Colours' ) }
						className="cnl-section-modes__swatches"
						role="group"
					>
						{ colors.options.map( ( option ) => {
							const swatch = option.name
								? getSwatch(
										variations?.[ option.name ],
										palette
									)
								: EMPTY_ARRAY;

							return (
								<Button
									aria-pressed={
										option.name === colors.current
									}
									className="cnl-section-modes__swatch"
									key={ option.name ?? 'none' }
									label={
										option.name
											? option.label
											: __( 'Theme' )
									}
									onClick={ () =>
										option.name !== colors.current &&
										updateBlockAttributes( clientId, {
											className: withSectionStyle(
												block.attributes.className,
												option.name
											),
										} )
									}
									showTooltip
								>
									{ swatch.length ? (
										<span
											aria-hidden
											className="cnl-section-modes__swatch-colors"
										>
											{ swatch.map( ( color, index ) => (
												<ColorIndicator
													colorValue={ color }
													key={ index }
												/>
											) ) }
										</span>
									) : (
										<span
											aria-hidden
											className="cnl-section-modes__swatch-default"
										>
											{ __( 'Theme' ) }
										</span>
									) }
								</Button>
							);
						} ) }
					</div>
				</div>
			) }
		</>
	);
}

/**
 * A header's or footer's designs.
 *
 * @param {Object}   props
 * @param {Object}   props.part       `{ area, clientId, id }`.
 * @param {Function} props.onFreeform See `FreeformRow`.
 * @return {Element} The panel's options.
 */
function PartOptions( { onFreeform, part } ) {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const designs = usePartDesigns( part );
	const partBlocks = useSelect(
		( select ) => select( blockEditorStore ).getBlocks( part.clientId ),
		[ part.clientId ]
	);

	return (
		<>
			{ designs.options.length ? (
				<LayoutOptions
					current={ designs.current }
					onSelect={ ( option ) => {
						const blocks = option.blocks.map( ( item ) =>
							cloneBlock( item )
						);

						editEntityRecord(
							'postType',
							'wp_template_part',
							part.id,
							{
								blocks,
								content: serialize( blocks ),
							}
						);
					} }
					options={ designs.options }
				/>
			) : (
				<OnlyLayout
					blocks={ partBlocks }
					label={ __( 'Current design' ) }
				/>
			) }
			<FreeformRow onFreeform={ onFreeform } />
		</>
	);
}

/**
 * @param {Object}   props
 * @param {?Object}  props.part         The header or footer, if it is one.
 * @param {string}   props.clientId     The section.
 * @param {string}   props.title        Its name.
 * @param {boolean}  props.canReset     Whether anything has changed since
 *                                      the panel opened.
 * @param {number}   props.removedCount How many items were taken out.
 * @param {Object}   props.style        Where the panel sits.
 * @param {Function} props.onDone       Closes the panel.
 * @param {number}   props.perSlide     How many layouts a slide holds.
 * @param {Function} props.onFreeform   Hands the section to core's own
 *                                      block tools.
 * @param {Function} props.onReplace    See `SectionOptions`.
 * @param {Function} props.onReset      Puts the section back.
 * @param {Function} props.onRestore    Puts back what was taken out.
 * @param {Object}   ref                Ref to the panel.
 * @return {Element} The panel.
 */
function LayoutsPanel(
	{
		canReset,
		clientId,
		onDone,
		onFreeform,
		onReplace,
		onReset,
		onRestore,
		part,
		perSlide = MAX_PER_SLIDE,
		removedCount,
		style,
		title,
	},
	ref
) {
	return (
		<ThemeProvider { ...PANEL_THEME }>
			<div
				aria-label={ sprintf(
					/* translators: %s: section name. */
					__( '%s design' ),
					title
				) }
				className="cnl-section-modes__panel"
				ref={ ref }
				role="group"
				style={ style }
			>
				<div className="cnl-section-modes__panel-head">
					<span className="cnl-section-modes__panel-heading">
						{ part ? __( 'Designs' ) : __( 'Layouts' ) }
					</span>
					<div className="cnl-section-modes__panel-actions">
						{ removedCount > 0 && (
							<UiButton
								className="cnl-section-modes__text-button"
								onClick={ onRestore }
								size="compact"
								tone="neutral"
								variant="outline"
							>
								{ sprintf(
									/* translators: %d: number of items removed. */
									__( 'Restore removed (%d)' ),
									removedCount
								) }
							</UiButton>
						) }
						<UiButton
							className="cnl-section-modes__text-button"
							disabled={ ! canReset }
							onClick={ onReset }
							size="compact"
							title={ __(
								'Undo changes since you opened Edit design'
							) }
							tone="neutral"
							variant="minimal"
						>
							{ __( 'Reset' ) }
						</UiButton>
						<UiButton
							className="cnl-section-modes__done"
							onClick={ onDone }
							size="compact"
						>
							{ __( 'Done editing' ) }
						</UiButton>
					</div>
				</div>
				{ part && (
					<GlobalNote className="cnl-section-modes__sitewide">
						{ getSitewideText( title ) }
					</GlobalNote>
				) }
				<PerSlideContext.Provider value={ perSlide }>
					{ part ? (
						<PartOptions onFreeform={ onFreeform } part={ part } />
					) : (
						<SectionOptions
							clientId={ clientId }
							onFreeform={ onFreeform }
							onReplace={ onReplace }
						/>
					) }
				</PerSlideContext.Provider>
			</div>
		</ThemeProvider>
	);
}

export default forwardRef( LayoutsPanel );
