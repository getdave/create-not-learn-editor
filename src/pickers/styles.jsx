/**
 * The site look, colour and font pickers.
 *
 * Shared by the Design, Colors and Fonts screens and the chat, so a choice
 * looks and works the same wherever it is made. Each picker edits the user's
 * global styles as an unsaved change, which the canvas shows straight away,
 * and calls `onPick` with the title of what was picked.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * because the chat loads them from app init. See `src/editor-layer/index.jsx`.
 */

/**
 * WordPress dependencies
 */
import { Button, ColorIndicator } from '@wordpress/components';
import { store as coreDataStore } from '@wordpress/core-data';
import { useDispatch, useSelect } from '@wordpress/data';
import { useMemo, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { check as checkIcon } from '@wordpress/icons';
import { Icon, Spinner, Text } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import {
	COLOR_PROPERTIES,
	TYPOGRAPHY_PROPERTIES,
	applyPreset,
	areStyleConfigsEqual,
	findActiveLook,
	findActivePreset,
	getStyleConfig,
	getVariationFontFamilies,
	getVariationPalette,
	getVariationTitle,
	groupStyleVariations,
} from '../routes/static/style-variations';
import { settings as appSettings } from '../settings';
import {
	getContrast,
	MIN_TEXT_CONTRAST,
	parseColor,
} from '../site-canvas/compose/palette-colors';
import ColorWell from './color-well';
import { resolveColor } from './resolve-color';
import {
	getSiteColors,
	getSitePalette,
	SITE_COLOR_KEYS,
	withSiteColor,
} from './site-colors';

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

/**
 * Turn a theme.json font family reference into a CSS font-family for swatches.
 *
 * @param {string}   value        A font-family, `var:preset|font-family|slug`, or CSS variable.
 * @param {Object[]} fontFamilies Font families to look the slug up in.
 * @return {string|undefined} A CSS font-family.
 */
function resolveFontFamily( value, fontFamilies ) {
	if ( typeof value !== 'string' ) {
		return undefined;
	}

	const slug =
		value.match( /^var:preset\|font-family\|(.+)$/ )?.[ 1 ] ||
		value.match( /^var\(--wp--preset--font-family--([^)]+)\)$/ )?.[ 1 ];

	if ( ! slug ) {
		return value;
	}

	return fontFamilies.find( ( font ) => font.slug === slug )?.fontFamily;
}

function getBodyFontFamily( variation, fontFamilies ) {
	return (
		resolveFontFamily(
			variation?.styles?.typography?.fontFamily,
			fontFamilies
		) || 'inherit'
	);
}

function getHeadingFontFamily( variation, fontFamilies ) {
	return (
		resolveFontFamily(
			variation?.styles?.elements?.heading?.typography?.fontFamily,
			fontFamilies
		) || getBodyFontFamily( variation, fontFamilies )
	);
}

/**
 * Turn a theme.json font family reference into its display name.
 *
 * @param {string}   value        A font-family, `var:preset|font-family|slug`, or CSS variable.
 * @param {Object[]} fontFamilies Font families to look the slug up in.
 * @return {string|undefined} The preset's display name.
 */
function resolveFontName( value, fontFamilies ) {
	if ( typeof value !== 'string' ) {
		return undefined;
	}

	const slug =
		value.match( /^var:preset\|font-family\|(.+)$/ )?.[ 1 ] ||
		value.match( /^var\(--wp--preset--font-family--([^)]+)\)$/ )?.[ 1 ];

	return fontFamilies.find( ( font ) => font.slug === slug )?.name;
}

function getBodyFontName( variation, fontFamilies ) {
	return (
		resolveFontName(
			variation?.styles?.typography?.fontFamily,
			fontFamilies
		) || __( 'Body' )
	);
}

function getHeadingFontName( variation, fontFamilies ) {
	return (
		resolveFontName(
			variation?.styles?.elements?.heading?.typography?.fontFamily,
			fontFamilies
		) || getBodyFontName( variation, fontFamilies )
	);
}

function getSwatches( palette, count = 4 ) {
	const seen = new Set();

	return palette
		.map( ( color ) => color.color )
		.filter( ( color ) => {
			if ( ! color || seen.has( color ) ) {
				return false;
			}

			seen.add( color );
			return true;
		} )
		.slice( 0, count );
}

export function useStylesData() {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const data = useSelect( ( select ) => {
		const store = select( coreDataStore );
		const globalStylesId = store.__experimentalGetCurrentGlobalStylesId?.();
		const args = globalStylesId
			? [ 'root', 'globalStyles', globalStylesId ]
			: null;

		return {
			baseStyles:
				store.__experimentalGetCurrentThemeBaseGlobalStyles?.() ||
				EMPTY_OBJECT,
			globalStylesId,
			isLoading:
				! globalStylesId ||
				! store.hasFinishedResolution(
					'__experimentalGetCurrentThemeGlobalStylesVariations',
					[]
				) ||
				( args && ! store.getEntityRecord( ...args ) ),
			themeName:
				store.getCurrentTheme?.()?.name?.rendered ||
				appSettings.themeName,
			userConfig: args
				? store.getEditedEntityRecord( ...args )
				: EMPTY_OBJECT,
			variations:
				store.__experimentalGetCurrentThemeGlobalStylesVariations?.() ||
				EMPTY_ARRAY,
		};
	}, [] );

	const setConfig = ( nextConfig ) => {
		if ( ! data.globalStylesId ) {
			return;
		}

		editEntityRecord(
			'root',
			'globalStyles',
			data.globalStylesId,
			getStyleConfig( nextConfig )
		);
	};

	return { ...data, setConfig };
}

/**
 * The tick in the corner of the option in use.
 *
 * @return {Element} The tick.
 */
function SelectedCheck() {
	return (
		<span aria-hidden className="routes-styles__check">
			<Icon icon={ checkIcon } size={ 16 } />
		</span>
	);
}

function LookCard( {
	basePalette,
	baseFontFamilies,
	isChanged,
	isSelected,
	onSelect,
	title,
	variation,
} ) {
	const palette = getVariationPalette( variation ).length
		? getVariationPalette( variation )
		: basePalette;
	const fontFamilies = getVariationFontFamilies( variation ).length
		? getVariationFontFamilies( variation )
		: baseFontFamilies;
	const background =
		resolveColor( variation?.styles?.color?.background, palette ) ||
		resolveColor( 'var:preset|color|base', palette ) ||
		'#fff';
	const text =
		resolveColor( variation?.styles?.color?.text, palette ) ||
		resolveColor( 'var:preset|color|contrast', palette ) ||
		'#1e1e1e';
	const fontFamily = getHeadingFontFamily( variation, fontFamilies );
	const swatches = getSwatches(
		palette.filter(
			( color ) => color.color !== background && color.color !== text
		),
		3
	);

	return (
		<Button
			aria-pressed={ isSelected }
			className={ `routes-styles__look${ isSelected ? ' is-selected' : '' }` }
			// Picking the look in use changes nothing, unless its colors or
			// fonts were changed since: then it puts them back.
			onClick={ () => ( ! isSelected || isChanged ) && onSelect() }
		>
			<span
				aria-hidden
				className="routes-styles__look-preview"
				style={ {
					'--cnl-look-background': background,
					background,
					color: text,
				} }
			>
				<span
					className="routes-styles__look-sample"
					style={ { fontFamily } }
				>
					Aa
				</span>
				<span className="routes-styles__look-swatches">
					{ swatches.map( ( color ) => (
						<span
							className="routes-styles__look-swatch"
							key={ color }
							style={ { background: color } }
						/>
					) ) }
				</span>
			</span>
			{ isSelected && <SelectedCheck /> }
			<span className="routes-styles__look-title">{ title }</span>
		</Button>
	);
}

function PaletteOption( {
	children,
	colors,
	isExpanded,
	isSelected,
	isTitleShown,
	onSelect,
	title,
} ) {
	return (
		<Button
			aria-expanded={ isExpanded }
			aria-pressed={ isSelected }
			className={ `routes-styles__palette${
				isSelected ? ' is-selected' : ''
			}` }
			label={ title }
			// Picking what is already in use changes nothing, but a toggle,
			// like Custom, always toggles.
			onClick={ () =>
				( ! isSelected || isExpanded !== undefined ) && onSelect()
			}
			// No tooltip to repeat a name that is already on the button.
			showTooltip={ ! isTitleShown }
		>
			{ children }
			{ ! children && colors.length > 0 && (
				<span aria-hidden className="routes-styles__palette-colors">
					{ colors.map( ( color ) => (
						<ColorIndicator colorValue={ color } key={ color } />
					) ) }
				</span>
			) }
			{ ! children && ! colors.length && (
				<span aria-hidden className="routes-styles__palette-default">
					{ __( 'Theme' ) }
				</span>
			) }
			{ isSelected && <SelectedCheck /> }
		</Button>
	);
}

function FontCard( {
	bodyFont,
	bodyFontName,
	headingFont,
	headingFontName,
	isSelected,
	onSelect,
	title,
} ) {
	return (
		<Button
			aria-pressed={ isSelected }
			className={ `routes-styles__font${ isSelected ? ' is-selected' : '' }` }
			label={ title }
			// Picking what is already in use changes nothing.
			onClick={ () => ! isSelected && onSelect() }
			showTooltip
		>
			<span aria-hidden className="routes-styles__font-preview">
				<span
					className="routes-styles__font-heading"
					style={ { fontFamily: headingFont } }
				>
					{ headingFontName }
				</span>
				{ /* One font for both is named once. */ }
				{ bodyFontName !== headingFontName && (
					<span
						className="routes-styles__font-body"
						style={ { fontFamily: bodyFont } }
					>
						{ bodyFontName }
					</span>
				) }
			</span>
			{ isSelected && <SelectedCheck /> }
		</Button>
	);
}

function EmptyNote( { children } ) {
	return (
		<Text className="routes-styles__muted" variant="body-sm">
			{ children }
		</Text>
	);
}

// The theme's own look, as an empty user config.
const THEME_DEFAULT_LOOK = {};

function getLookTitle( look, index ) {
	return look === THEME_DEFAULT_LOOK
		? __( 'Theme default' )
		: getVariationTitle(
				look,
				sprintf(
					/* translators: %d: Style number. */
					__( 'Look %d' ),
					index
				)
			);
}

function Loading() {
	return (
		<div className="cnl-editor-spinner">
			<Spinner />
		</div>
	);
}

/**
 * The theme's full looks, its own first. Picking one replaces everything
 * about how the site looks.
 *
 * @param {Object}   props        Component props.
 * @param {Function} props.onPick Called with the look's title once applied.
 * @return {Element} The looks.
 */
export function LookPicker( { onPick } ) {
	const { baseStyles, isLoading, setConfig, userConfig, variations } =
		useStylesData();
	const groups = useMemo(
		() => groupStyleVariations( variations ),
		[ variations ]
	);
	const looks = useMemo(
		() => [ THEME_DEFAULT_LOOK, ...groups.looks ],
		[ groups ]
	);
	const active = useMemo(
		() => findActiveLook( userConfig, looks ),
		[ userConfig, looks ]
	);
	const isChanged = Boolean(
		active && ( active.hasColorChanges || active.hasFontChanges )
	);
	const basePalette = getVariationPalette( baseStyles );
	const baseFontFamilies = getVariationFontFamilies( baseStyles );

	if ( isLoading ) {
		return <Loading />;
	}

	return (
		<section
			aria-label={ __( 'Site look' ) }
			className="routes-styles__section"
		>
			<div className="routes-styles__looks">
				{ looks.map( ( look, index ) => {
					const isSelected = active?.look === look;
					const title = getLookTitle( look, index );

					return (
						<LookCard
							basePalette={ basePalette }
							baseFontFamilies={ baseFontFamilies }
							isChanged={ isSelected && isChanged }
							isSelected={ isSelected }
							key={ `${ title }-${ index }` }
							onSelect={ () => {
								setConfig( look );
								onPick?.( title );
							} }
							title={ title }
							variation={
								look === THEME_DEFAULT_LOOK ? baseStyles : look
							}
						/>
					);
				} ) }
			</div>
			{ ! groups.looks.length && (
				<EmptyNote>
					{ __( 'Your theme only offers its default look.' ) }
				</EmptyNote>
			) }
		</section>
	);
}

/**
 * The theme's colour palettes, its own first. Picking one changes only the
 * site's colours.
 *
 * With `allowCustom`, Custom comes last, a palette like the others: a
 * colour wheel, or the site's own colours once it has them. It picks
 * nothing by itself; it shows and hides the site's own colours under the
 * palettes, so they are there for people who look for them without being
 * offered up front.
 *
 * @param {Object}   props             Component props.
 * @param {boolean}  props.allowCustom Whether to offer custom colours.
 * @param {Function} props.onPick      Called with the palette's title once
 *                                     applied.
 * @return {Element} The palettes.
 */
export function PalettePicker( { allowCustom = false, onPick } ) {
	const [ isCustomOpen, setIsCustomOpen ] = useState( false );
	const { baseStyles, isLoading, setConfig, userConfig, variations } =
		useStylesData();
	const groups = useMemo(
		() => groupStyleVariations( variations ),
		[ variations ]
	);
	const basePalette = getVariationPalette( baseStyles );
	const activeColors = findActivePreset(
		userConfig,
		groups.colors,
		COLOR_PROPERTIES
	);
	// Colours changed by hand, rather than the theme's, a palette's or a
	// look's: none of the palettes is the one in use.
	const isCustom =
		! activeColors &&
		! findActivePreset( userConfig, variations, COLOR_PROPERTIES ) &&
		hasColors( userConfig );
	const pick = ( preset, title ) => {
		setConfig( applyPreset( userConfig, preset, COLOR_PROPERTIES ) );
		setIsCustomOpen( false );
		onPick?.( title );
	};

	if ( isLoading ) {
		return <Loading />;
	}

	const customPalette = getSitePalette( userConfig, baseStyles );
	const customValues = getSiteColors( userConfig, baseStyles );

	return (
		<>
			<div className="routes-styles__palettes">
				<PaletteOption
					colors={ getSwatches( basePalette ) }
					isSelected={ ! activeColors && ! isCustom }
					onSelect={ () => pick( null, __( 'Theme colors' ) ) }
					title={ __( 'Theme colors' ) }
				/>
				{ groups.colors.map( ( preset ) => (
					<PaletteOption
						colors={ getSwatches( getVariationPalette( preset ) ) }
						isSelected={ activeColors === preset }
						key={ getVariationTitle( preset ) }
						onSelect={ () =>
							pick( preset, getVariationTitle( preset ) )
						}
						title={ getVariationTitle( preset ) }
					/>
				) ) }
				{ allowCustom && (
					<PaletteOption
						isExpanded={ isCustomOpen }
						isSelected={ isCustom }
						isTitleShown={ ! isCustom }
						onSelect={ () => setIsCustomOpen( ! isCustomOpen ) }
						title={ __( 'Custom' ) }
					>
						<span
							aria-hidden
							className="routes-styles__palette-colors"
						>
							{ isCustom ? (
								SITE_COLOR_KEYS.map( ( key ) => (
									<ColorIndicator
										colorValue={ resolveColor(
											customValues[ key ],
											customPalette
										) }
										key={ key }
									/>
								) )
							) : (
								<>
									<span className="routes-styles__palette-wheel" />
									<span className="routes-styles__palette-custom-label">
										{ __( 'Custom' ) }
									</span>
								</>
							) }
						</span>
					</PaletteOption>
				) }
			</div>
			{ ! groups.colors.length && ! allowCustom && (
				<EmptyNote>
					{ __( 'Your theme only offers its own palette.' ) }
				</EmptyNote>
			) }
			{ allowCustom && isCustomOpen && (
				<CustomColors
					baseStyles={ baseStyles }
					setConfig={ setConfig }
					userConfig={ userConfig }
				/>
			) }
		</>
	);
}

/**
 * Whether a config has colours of its own.
 *
 * @param {Object} config User global styles config.
 * @return {boolean} Whether it does.
 */
function hasColors( config ) {
	return ! areStyleConfigsEqual(
		applyPreset( config, null, COLOR_PROPERTIES ),
		config
	);
}

/**
 * Whether two colours stand apart enough to read, or true when either
 * can't be checked.
 *
 * @param {?string} a A CSS colour.
 * @param {?string} b Another.
 * @return {boolean} Whether they do.
 */
function canRead( a, b ) {
	const first = parseColor( a );
	const second = parseColor( b );

	return (
		! first || ! second || getContrast( first, second ) >= MIN_TEXT_CONTRAST
	);
}

/**
 * The site's background, text and button colours, starting from the
 * palette in use, for people who want their own. Each changes the palette
 * colour behind it, so the whole site follows. See `site-colors.js`.
 *
 * @param {Object}   props            Component props.
 * @param {Object}   props.baseStyles The theme's global styles.
 * @param {Function} props.setConfig  Saves the user's global styles.
 * @param {Object}   props.userConfig The user's global styles.
 * @return {Element} The colours.
 */
function CustomColors( { baseStyles, setConfig, userConfig } ) {
	const palette = getSitePalette( userConfig, baseStyles );
	const values = getSiteColors( userConfig, baseStyles );
	const resolved = Object.fromEntries(
		SITE_COLOR_KEYS.map( ( key ) => [
			key,
			resolveColor( values[ key ], palette ),
		] )
	);
	const textNote =
		! canRead( resolved.text, resolved.background ) &&
		__( 'Text may be hard to read on this background.' );
	const labels = {
		background: __( 'Background' ),
		button: __( 'Buttons' ),
		text: __( 'Text' ),
	};

	return (
		<section
			aria-label={ __( 'Custom colors' ) }
			className="routes-styles__custom-colors"
		>
			<Text className="routes-styles__muted" variant="body-sm">
				{ __(
					'Change the three colors your site is built on. Everything that uses them follows.'
				) }
			</Text>
			<div className="routes-styles__color-rows">
				{ SITE_COLOR_KEYS.map( ( key ) => (
					<ColorWell
						asPreset={ false }
						className="routes-styles__color-row"
						key={ key }
						label={ labels[ key ] }
						note={ key !== 'button' && textNote }
						onChange={ ( color ) =>
							setConfig(
								withSiteColor(
									userConfig,
									baseStyles,
									key,
									color
								)
							)
						}
						palette={ palette }
						value={ values[ key ] }
					>
						<span className="routes-styles__color-value">
							{ resolved[ key ] }
						</span>
					</ColorWell>
				) ) }
			</div>
		</section>
	);
}

/**
 * The theme's font pairings, its own first. Picking one changes only the
 * site's fonts.
 *
 * @param {Object}   props        Component props.
 * @param {Function} props.onPick Called with the pairing's title once applied.
 * @return {Element} The pairings.
 */
export function FontPicker( { onPick } ) {
	const { baseStyles, isLoading, setConfig, userConfig, variations } =
		useStylesData();
	const groups = useMemo(
		() => groupStyleVariations( variations ),
		[ variations ]
	);
	const baseFontFamilies = getVariationFontFamilies( baseStyles );
	const activeFonts = findActivePreset(
		userConfig,
		groups.fonts,
		TYPOGRAPHY_PROPERTIES
	);
	const pick = ( preset, title ) => {
		setConfig( applyPreset( userConfig, preset, TYPOGRAPHY_PROPERTIES ) );
		onPick?.( title );
	};

	if ( isLoading ) {
		return <Loading />;
	}

	return (
		<>
			<div className="routes-styles__fonts">
				<FontCard
					bodyFont={ getBodyFontFamily(
						baseStyles,
						baseFontFamilies
					) }
					bodyFontName={ getBodyFontName(
						baseStyles,
						baseFontFamilies
					) }
					headingFont={ getHeadingFontFamily(
						baseStyles,
						baseFontFamilies
					) }
					headingFontName={ getHeadingFontName(
						baseStyles,
						baseFontFamilies
					) }
					isSelected={ ! activeFonts }
					onSelect={ () => pick( null, __( 'Theme fonts' ) ) }
					title={ __( 'Theme fonts' ) }
				/>
				{ groups.fonts.map( ( preset ) => {
					const fontFamilies = getVariationFontFamilies( preset )
						.length
						? getVariationFontFamilies( preset )
						: baseFontFamilies;

					return (
						<FontCard
							bodyFont={ getBodyFontFamily(
								preset,
								fontFamilies
							) }
							bodyFontName={ getBodyFontName(
								preset,
								fontFamilies
							) }
							headingFont={ getHeadingFontFamily(
								preset,
								fontFamilies
							) }
							headingFontName={ getHeadingFontName(
								preset,
								fontFamilies
							) }
							isSelected={ activeFonts === preset }
							key={ getVariationTitle( preset ) }
							onSelect={ () =>
								pick( preset, getVariationTitle( preset ) )
							}
							title={ getVariationTitle( preset ) }
						/>
					);
				} ) }
			</div>
			{ ! groups.fonts.length && (
				<EmptyNote>
					{ __( 'Your theme only offers its own fonts.' ) }
				</EmptyNote>
			) }
		</>
	);
}
