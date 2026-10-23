/**
 * Edit design, in the bar over the section: the bar's buttons give way to
 * the section's design choices, Layout, Colour, Width and More control, and
 * picking one drills into its options in the same bar, Back leading out
 * again. Colours and widths
 * sit in the bar's row; layouts, each drawn with the section's own content,
 * open in a tray under it. A header or footer offers its designs as its
 * layouts, and its colours. The last colour, Custom, opens a tray under
 * the colours with the section's own background, text and button colours,
 * so they are there for people who look for them without being offered
 * up front.
 *
 * Picking an option changes the section underneath at once, and that is it:
 * there is nothing to confirm. Back, Escape or a click anywhere else steps
 * out, the change kept, and undo takes it back like any other edit. More
 * control hands the section to core's own block tools.
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
import {
	alignNone as alignNoneIcon,
	color as colorIcon,
	layout as layoutIcon,
	settings as moreControlIcon,
	stretchFullWidth as stretchFullWidthIcon,
	stretchWide as stretchWideIcon,
} from '@wordpress/icons';

/**
 * Internal dependencies
 */
import {
	__,
	blockEditorStore,
	Button,
	cautionIcon,
	chevronLeftIcon,
	chevronRightIcon,
	cloneBlock,
	ColorIndicator,
	coreDataStore,
	Icon,
	isRTL,
	serialize,
	sprintf,
	UiIconButton,
	useDispatch,
	useSelect,
} from '../../wordpress-packages';
import { GlobalNote } from '../../global-scope';
import ColorWell from '../../pickers/color-well';
import { getSitewideText } from './section-chrome';
import {
	usePartColors,
	usePartDesigns,
	useSectionVariations,
} from './use-variations';
import {
	CUSTOM_COLOR,
	getAttributeUpdate,
	getButtonTextValue,
	withCustomColors,
	withSectionColor,
} from '../compose/section-colors';
import {
	getContrast,
	MIN_TEXT_CONTRAST,
	parseColor,
} from '../compose/palette-colors';
import { resolveColor } from '../../pickers/resolve-color';
import { getPartColorBlocks } from '../compose/section-styles';
import {
	useSectionWidth,
	WIDTH_FULL,
	WIDTH_NARROW,
	WIDTH_WIDE,
} from '../../pickers/section-width';

export const VIEW_LAYOUT = 'layout';
export const VIEW_COLOR = 'color';
export const VIEW_WIDTH = 'width';
export const VIEW_CUSTOM_COLOR = 'custom-color';

// Below this, a button would be lost against the section's background.
const MIN_BUTTON_CONTRAST = 3;

/**
 * The level Escape steps out to from a design choice: from the custom
 * colours' tray to the colours, and from a choice to the choices.
 *
 * @param {?string} view The choice drilled into.
 * @return {?string} The choice above it, or null for the choices.
 */
export function getParentView( view ) {
	return view === VIEW_CUSTOM_COLOR ? VIEW_COLOR : null;
}

// The most layouts the carousel shows at once.
export const MAX_PER_SLIDE = 4;

/**
 * @return {Object} The design choices' names, by view.
 */
function getViewLabels() {
	return {
		[ VIEW_LAYOUT ]: __( 'Layout' ),
		[ VIEW_COLOR ]: __( 'Colour' ),
		[ VIEW_WIDTH ]: __( 'Width' ),
	};
}

const VIEW_ICONS = {
	[ VIEW_LAYOUT ]: layoutIcon,
	[ VIEW_COLOR ]: colorIcon,
	[ VIEW_WIDTH ]: stretchWideIcon,
};

function Preview( { blocks } ) {
	return (
		<span aria-hidden className="cnl-section-modes__preview" inert="">
			<BlockPreview.Async>
				<BlockPreview blocks={ blocks } viewportWidth={ 1200 } />
			</BlockPreview.Async>
		</span>
	);
}

// How many layouts the carousel shows at once, set by the bar.
const PerSlideContext = createContext( MAX_PER_SLIDE );

/**
 * Layouts as a carousel, so the tray stays one row tall however many there
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
 * @param {string} width A width.
 * @return {string} What it is called.
 */
function getWidthLabel( width ) {
	return {
		[ WIDTH_NARROW ]: __( 'Narrow' ),
		[ WIDTH_WIDE ]: __( 'Wide' ),
		[ WIDTH_FULL ]: __( 'Full width' ),
	}[ width ];
}

const WIDTH_ICONS = {
	[ WIDTH_NARROW ]: alignNoneIcon,
	[ WIDTH_WIDE ]: stretchWideIcon,
	[ WIDTH_FULL ]: stretchFullWidthIcon,
};

/**
 * How wide the section's content runs, in the bar's row.
 *
 * @param {Object} props
 * @param {Object} props.width `{ current, options, onSelect }`.
 * @return {Element} The options.
 */
function WidthOptions( { width } ) {
	return (
		<div
			aria-label={ __( 'Width' ) }
			className="cnl-section-modes__swatches"
			role="group"
		>
			{ width.options.map( ( option ) => (
				<Button
					aria-pressed={ option === width.current }
					className="cnl-section-modes__swatch cnl-section-modes__width"
					icon={ WIDTH_ICONS[ option ] }
					key={ option }
					onClick={ () =>
						option !== width.current && width.onSelect( option )
					}
					size="compact"
				>
					{ getWidthLabel( option ) }
				</Button>
			) ) }
		</div>
	);
}

/**
 * A section's colours, in the bar's row, as Design's colour palettes are
 * shown: the theme's default, then the others it can take. The default is
 * a swatch of the page's own colours, named "Default" in its place while
 * pointed at or focused, as it has no name of its own to show in a tooltip.
 *
 * Custom comes last, a swatch like the others: a colour wheel, or the
 * section's own colours once it has them. It picks nothing by itself; it
 * opens and closes the tray of custom colours.
 *
 * @param {Object}    props
 * @param {Object}    props.colors       `{ current, options, onSelect,
 *                                       swatch }`; `swatch` is the custom
 *                                       colours'.
 * @param {boolean}   props.isCustomOpen Whether the custom colours' tray is
 *                                       open.
 * @param {?Function} props.onCustom     Opens or closes the tray, when
 *                                       custom colours are offered.
 * @return {Element} The swatches.
 */
function ColorOptions( { colors, isCustomOpen, onCustom } ) {
	const isCustom = colors.current === CUSTOM_COLOR;

	return (
		<div
			aria-label={ __( 'Colour' ) }
			className="cnl-section-modes__swatches"
			role="group"
		>
			{ colors.options.map( ( option ) => {
				const isDefault = ! option.name;

				return (
					<Button
						aria-pressed={ option.name === colors.current }
						className={ `cnl-section-modes__swatch${
							isDefault ? ' is-default' : ''
						}` }
						key={ option.name ?? 'none' }
						label={ option.label }
						onClick={ () =>
							option.name !== colors.current &&
							colors.onSelect( option.name )
						}
						showTooltip={ ! isDefault }
						tooltipPosition="bottom"
					>
						{ option.swatch?.length > 0 && (
							<span
								aria-hidden
								className="cnl-section-modes__swatch-colors"
							>
								{ option.swatch.map( ( color, index ) => (
									<ColorIndicator
										colorValue={ color }
										key={ index }
									/>
								) ) }
							</span>
						) }
						{ isDefault && (
							<span
								aria-hidden
								className="cnl-section-modes__swatch-default"
							>
								{ option.label }
							</span>
						) }
					</Button>
				);
			} ) }
			{ onCustom && (
				<Button
					aria-expanded={ isCustomOpen }
					aria-pressed={ isCustom }
					className="cnl-section-modes__swatch cnl-section-modes__custom"
					label={ __( 'Custom' ) }
					onClick={ onCustom }
					showTooltip
					tooltipPosition="bottom"
				>
					<span
						aria-hidden
						className="cnl-section-modes__swatch-colors"
					>
						{ isCustom ? (
							colors.swatch.map( ( color, index ) => (
								<ColorIndicator
									colorValue={ color }
									key={ index }
								/>
							) )
						) : (
							<span className="cnl-section-modes__swatch-wheel" />
						) }
					</span>
				</Button>
			) }
		</div>
	);
}

/**
 * Whether two colours stand apart enough, or true when either can't be
 * read, so nothing is flagged that can't be checked.
 *
 * @param {?string} a   A CSS colour.
 * @param {?string} b   Another.
 * @param {number}  min The contrast they need.
 * @return {boolean} Whether they do.
 */
function hasContrast( a, b, min ) {
	const first = parseColor( a );
	const second = parseColor( b );

	return ! first || ! second || getContrast( first, second ) >= min;
}

/**
 * A section's own colours, in the bar's row: its background, its text,
 * headings and links taking that too, and its buttons, whose words take
 * whichever of the other two reads on them. Each opens core's palette,
 * and each change shows at once.
 *
 * @param {Object} props
 * @param {Object} props.colors `{ palette, values, onChange }`.
 * @return {Element} The colours.
 */
function CustomColors( { colors } ) {
	const { onChange, palette, values } = colors;
	const resolved = Object.fromEntries(
		Object.entries( values ).map( ( [ key, value ] ) => [
			key,
			resolveColor( value, palette ),
		] )
	);
	const isTextReadable = hasContrast(
		resolved.text,
		resolved.background,
		MIN_TEXT_CONTRAST
	);
	const textNote =
		! isTextReadable &&
		__( 'Text may be hard to read on this background.' );
	const buttonNote =
		( ! hasContrast(
			resolved.button,
			resolved.background,
			MIN_BUTTON_CONTRAST
		) &&
			__( 'Buttons may not stand out from the background.' ) ) ||
		( ! hasContrast(
			resolved.button,
			resolveColor( getButtonTextValue( values, palette ), palette ),
			MIN_TEXT_CONTRAST
		) &&
			__( 'Words on buttons may be hard to read in this colour.' ) );
	const wells = [
		{ key: 'background', label: __( 'Background' ), note: textNote },
		{ key: 'text', label: __( 'Text' ), note: textNote },
		{ key: 'button', label: __( 'Button' ), note: buttonNote },
	];

	return (
		<div
			aria-label={ __( 'Custom colours' ) }
			className="cnl-section-modes__swatches"
			role="group"
		>
			{ wells.map( ( { key, label, note } ) => (
				<ColorWell
					className="cnl-section-modes__swatch cnl-section-modes__well"
					key={ key }
					label={ label }
					note={ note }
					onChange={ ( value ) =>
						onChange( { ...values, [ key ]: value } )
					}
					palette={ palette }
					value={ values[ key ] }
				>
					{ note && (
						<Icon
							className="cnl-section-modes__well-alert"
							icon={ cautionIcon }
							size={ 16 }
						/>
					) }
				</ColorWell>
			) ) }
		</div>
	);
}

/**
 * Puts a colour on blocks in the editor, or the theme's, in one change.
 *
 * @return {Function} Called with the blocks, the colour's name, or null for
 *                    the theme's, and the colours there are.
 */
function useUpdateColors() {
	const { updateBlockAttributes } = useDispatch( blockEditorStore );

	return ( blocks, name, options ) => {
		const changes = Object.fromEntries(
			blocks.map( ( block ) => [
				block.clientId,
				getAttributeUpdate(
					block.attributes,
					withSectionColor( block.attributes, options, name )
				),
			] )
		);

		updateBlockAttributes( Object.keys( changes ), changes, {
			uniqueByBlock: true,
		} );
	};
}

/**
 * Puts custom colours on blocks in the editor, in one change.
 *
 * @return {Function} Called with the blocks, the colours, as
 *                    `withCustomColors` takes them, and the result of
 *                    `useColorOptions`.
 */
function useUpdateCustomColors() {
	const { updateBlockAttributes } = useDispatch( blockEditorStore );

	return ( blocks, values, choices ) => {
		const changes = Object.fromEntries(
			blocks.map( ( block ) => [
				block.clientId,
				getAttributeUpdate(
					block.attributes,
					withCustomColors(
						block.attributes,
						choices.options,
						values,
						{
							colors: choices.colors,
							supports: choices.supports,
						}
					)
				),
			] )
		);

		updateBlockAttributes( Object.keys( changes ), changes, {
			uniqueByBlock: true,
		} );
	};
}

/**
 * A colour offer with what Custom needs: the swatch it shows while it is
 * the one in use, and how to change its colours.
 *
 * @param {?Object}  colors   From `getColorOffer`.
 * @param {Object}   choices  Result of `useColorOptions`.
 * @param {Function} onSelect Called with the option picked.
 * @param {Function} onCustom Called with the custom colours.
 * @return {?Object} `{ current, options, onSelect, custom }`.
 */
function withCustom( colors, choices, onSelect, onCustom ) {
	if ( ! colors ) {
		return null;
	}

	return {
		...colors,
		custom: {
			onChange: onCustom,
			palette: choices.colors,
			values: colors.values,
		},
		onSelect,
		swatch: [ 'background', 'text', 'button' ]
			.map( ( key ) =>
				resolveColor( colors.values[ key ], choices.colors )
			)
			.filter( Boolean ),
	};
}

/**
 * How wide a section's, header's or footer's content runs, when that can
 * change.
 *
 * @param {string} clientId The section, header or footer.
 * @return {?Object} `{ current, options, onSelect }`.
 */
function useWidthChoice( clientId ) {
	const { setWidth, width } = useSectionWidth( clientId );

	if ( ! width || width.options.length < 2 ) {
		return null;
	}

	return { ...width, onSelect: setWidth };
}

/**
 * The bar itself, once its choices are known.
 *
 * @param {Object}   props
 * @param {Object}   props.choices    `{ colors, layouts, width }`, each
 *                                    `{ current, options, onSelect }`, or
 *                                    null when there is nothing to choose.
 * @param {boolean}  props.isPart     Whether it is a header or footer.
 * @param {string}   props.title      The section's name.
 * @param {?string}  props.view       The choice drilled into, if any.
 * @param {Function} props.onView     Called with the choice to drill into,
 *                                    or null to step back out.
 * @param {Function} props.onClose    Leaves Edit design.
 * @param {Function} props.onFreeform Hands the section to core's own block
 *                                    tools.
 * @param {Object}   props.style      Where the bar sits.
 * @param {Object}   ref              Ref to the bar.
 * @return {Element} The bar.
 */
const DesignBarView = forwardRef( function UnforwardedDesignBarView(
	{ choices, isPart, onClose, onFreeform, onView, style, title, view },
	ref
) {
	const labels = getViewLabels();
	const isColorView = view === VIEW_COLOR || view === VIEW_CUSTOM_COLOR;
	const views = [ VIEW_LAYOUT, VIEW_COLOR, VIEW_WIDTH ].filter(
		( name ) =>
			( name === VIEW_LAYOUT && choices.layouts ) ||
			( name === VIEW_COLOR && choices.colors ) ||
			( name === VIEW_WIDTH && choices.width )
	);

	return (
		<div
			aria-label={ sprintf(
				/* translators: %s: section name. */
				__( '%s design' ),
				title
			) }
			className="cnl-section-modes__design"
			ref={ ref }
			role="group"
			style={ style }
		>
			<div className="cnl-section-modes__design-row">
				{ view ? (
					<Button
						className="cnl-section-modes__bar-button"
						icon={ isRTL() ? chevronRightIcon : chevronLeftIcon }
						label={ __( 'Back to Edit design' ) }
						onClick={ () => onView( null ) }
						showTooltip
						size="compact"
						tooltipPosition="bottom"
					>
						{ __( 'Back' ) }
					</Button>
				) : (
					<>
						<Button
							className="cnl-section-modes__bar-button"
							icon={
								isRTL() ? chevronRightIcon : chevronLeftIcon
							}
							label={ __( 'Back' ) }
							onClick={ onClose }
							showTooltip
							size="compact"
							tooltipPosition="bottom"
						/>
						{ views.map( ( name ) => (
							<Button
								className="cnl-section-modes__bar-button"
								icon={ VIEW_ICONS[ name ] }
								key={ name }
								onClick={ () => onView( name ) }
								size="compact"
							>
								{ labels[ name ] }
							</Button>
						) ) }
						<Button
							className="cnl-section-modes__bar-button"
							description={ __(
								'Move, resize and restyle the blocks in this section'
							) }
							icon={ moreControlIcon }
							onClick={ onFreeform }
							size="compact"
						>
							{ __( 'More control' ) }
						</Button>
					</>
				) }
				{ isColorView && choices.colors && (
					<ColorOptions
						colors={ {
							...choices.colors,
							// Picking a colour closes the custom ones.
							onSelect: ( name ) => {
								choices.colors.onSelect( name );
								onView( VIEW_COLOR );
							},
						} }
						isCustomOpen={ view === VIEW_CUSTOM_COLOR }
						onCustom={
							choices.colors.custom &&
							( () =>
								onView(
									view === VIEW_CUSTOM_COLOR
										? VIEW_COLOR
										: VIEW_CUSTOM_COLOR
								) )
						}
					/>
				) }
				{ view === VIEW_WIDTH && choices.width && (
					<WidthOptions width={ choices.width } />
				) }
			</div>
			{ view === VIEW_LAYOUT && choices.layouts && (
				<div className="cnl-section-modes__design-tray">
					<LayoutOptions { ...choices.layouts } />
				</div>
			) }
			{ view === VIEW_CUSTOM_COLOR && choices.colors?.custom && (
				<div className="cnl-section-modes__design-tray">
					<CustomColors colors={ choices.colors.custom } />
				</div>
			) }
			{ isPart && (
				<GlobalNote className="cnl-section-modes__sitewide">
					{ getSitewideText( title ) }
				</GlobalNote>
			) }
		</div>
	);
} );

/**
 * A section's design choices.
 *
 * @param {Object}   props
 * @param {string}   props.clientId  The section.
 * @param {Function} props.onReplace Called with the block that takes the
 *                                   section's place when its layout changes.
 * @param {Object}   ref             Ref to the bar.
 * @return {Element} The bar.
 */
const SectionDesignBar = forwardRef( function UnforwardedSectionDesignBar(
	{ clientId, onReplace, ...props },
	ref
) {
	const { replaceBlock } = useDispatch( blockEditorStore );
	const updateColors = useUpdateColors();
	const updateCustomColors = useUpdateCustomColors();
	const { block, choices, colors, layouts } = useSectionVariations(
		clientId,
		{ allowCustom: true }
	);
	const width = useWidthChoice( clientId );

	return (
		<DesignBarView
			{ ...props }
			choices={ {
				colors: withCustom(
					colors,
					choices,
					( name ) => updateColors( [ block ], name, colors.options ),
					( values ) =>
						updateCustomColors( [ block ], values, choices )
				),
				layouts: layouts && {
					...layouts,
					onSelect: ( option ) => {
						const next = cloneBlock( option.block );

						replaceBlock( clientId, next );
						onReplace( next );
					},
				},
				width,
			} }
			ref={ ref }
		/>
	);
} );

/**
 * A header's or footer's design choices: its designs, as its layouts, and
 * its colours.
 *
 * @param {Object} props
 * @param {Object} props.part `{ area, clientId, id }`.
 * @param {Object} ref        Ref to the bar.
 * @return {Element} The bar.
 */
const PartDesignBar = forwardRef( function UnforwardedPartDesignBar(
	{ part, ...props },
	ref
) {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const updateColors = useUpdateColors();
	const updateCustomColors = useUpdateCustomColors();
	const { blockName, choices, colors } = usePartColors( part );
	const designs = usePartDesigns(
		part,
		colors && {
			blockName,
			choices,
			name: colors.current,
			values: colors.values,
		}
	);
	const partBlocks = useSelect(
		( select ) => select( blockEditorStore ).getBlocks( part.clientId ),
		[ part.clientId ]
	);
	const width = useWidthChoice( part.clientId );

	return (
		<DesignBarView
			{ ...props }
			choices={ {
				colors: withCustom(
					colors,
					choices,
					( name ) =>
						updateColors(
							getPartColorBlocks( partBlocks ),
							name,
							colors.options
						),
					( values ) =>
						updateCustomColors(
							getPartColorBlocks( partBlocks ),
							values,
							choices
						)
				),
				layouts:
					designs.options.length > 1
						? {
								...designs,
								onSelect: ( option ) => {
									const blocks = option.blocks.map(
										( item ) => cloneBlock( item )
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
								},
							}
						: null,
				width,
			} }
			isPart
			ref={ ref }
		/>
	);
} );

/**
 * @param {Object}   props
 * @param {?Object}  props.part       The header or footer, if it is one.
 * @param {string}   props.clientId   The section.
 * @param {string}   props.title      Its name.
 * @param {?string}  props.view       The choice drilled into, if any.
 * @param {number}   props.perSlide   How many layouts a slide holds.
 * @param {Object}   props.style      Where the bar sits.
 * @param {Function} props.onView     See `DesignBarView`.
 * @param {Function} props.onClose    Leaves Edit design.
 * @param {Function} props.onFreeform Hands the section to core's own block
 *                                    tools.
 * @param {Function} props.onReplace  See `SectionDesignBar`.
 * @param {Object}   ref              Ref to the bar.
 * @return {Element} The bar.
 */
function DesignBar(
	{ clientId, onReplace, part, perSlide = MAX_PER_SLIDE, ...props },
	ref
) {
	return (
		<PerSlideContext.Provider value={ perSlide }>
			{ part ? (
				<PartDesignBar { ...props } part={ part } ref={ ref } />
			) : (
				<SectionDesignBar
					{ ...props }
					clientId={ clientId }
					onReplace={ onReplace }
					ref={ ref }
				/>
			) }
		</PerSlideContext.Provider>
	);
}

export default forwardRef( DesignBar );
