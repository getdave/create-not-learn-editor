/**
 * Internal dependencies
 */
import { settings as appSettings } from '../../settings';
import { DesignScreenHeading } from './design-heading';
import SitePreviewCanvas from './site-preview';
import ScreenLinks from '../../screen-links';
import {
	COLOR_PROPERTIES,
	TYPOGRAPHY_PROPERTIES,
	applyPreset,
	findActiveLook,
	findActivePreset,
	getStyleConfig,
	getVariationFontFamilies,
	getVariationPalette,
	getVariationTitle,
	groupStyleVariations,
} from './style-variations';
import {
	Button,
	ColorIndicator,
	Icon,
	Link,
	Spinner,
	Text,
	__,
	checkIcon,
	colorIcon,
	coreDataStore,
	siteLogoIcon,
	sprintf,
	typographyIcon,
	useDispatch,
	useMemo,
	useSelect,
} from '../../wordpress-packages';

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

/**
 * Turn a theme.json color reference into a CSS color for swatches.
 *
 * @param {string}   value   A color, `var:preset|color|slug`, or CSS variable.
 * @param {Object[]} palette Palette to look the slug up in.
 * @return {string|undefined} A CSS color.
 */
function resolveColor( value, palette ) {
	if ( typeof value !== 'string' ) {
		return undefined;
	}

	const slug =
		value.match( /^var:preset\|color\|(.+)$/ )?.[ 1 ] ||
		value.match( /^var\(--wp--preset--color--([^)]+)\)$/ )?.[ 1 ];

	if ( ! slug ) {
		return value;
	}

	return palette.find( ( color ) => color.slug === slug )?.color;
}

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

function useStylesData() {
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

function PaletteOption( { colors, isSelected, onSelect, title } ) {
	return (
		<Button
			aria-pressed={ isSelected }
			className={ `routes-styles__palette${
				isSelected ? ' is-selected' : ''
			}` }
			label={ title }
			// Picking what is already in use changes nothing.
			onClick={ () => ! isSelected && onSelect() }
			showTooltip
		>
			{ colors.length ? (
				<span aria-hidden className="routes-styles__palette-colors">
					{ colors.map( ( color ) => (
						<ColorIndicator colorValue={ color } key={ color } />
					) ) }
				</span>
			) : (
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
				<span
					className="routes-styles__font-body"
					style={ { fontFamily: bodyFont } }
				>
					{ bodyFontName }
				</span>
			</span>
			{ isSelected && <SelectedCheck /> }
		</Button>
	);
}

/*
 * Design leads with the site look, the one choice that changes everything at
 * once, and links on to the screens for the finer choices.
 */
const DESIGN_LINKS = [
	{
		description: __( 'Pick the colors your whole site uses.' ),
		icon: colorIcon,
		title: __( 'Colors' ),
		to: '/design/colors',
	},
	{
		description: __( 'Pick the fonts your whole site uses.' ),
		icon: typographyIcon,
		title: __( 'Fonts' ),
		to: '/design/fonts',
	},
	{
		description: __( 'Name your site and add a logo.' ),
		icon: siteLogoIcon,
		title: __( 'Name & logo' ),
		to: '/design/identity',
	},
];

/**
 * The shell every styles screen shares: its title, the live-preview layout,
 * and the way out to the full Styles editor.
 *
 * @param {Object}  props             Component props.
 * @param {Node}    props.children    The screen's options, once loaded.
 * @param {string}  props.description Sentence under the title.
 * @param {boolean} props.isLoading   Whether the theme's styles are still loading.
 * @param {boolean} props.isTopLevel  Whether this is the Design screen itself.
 * @param {string}  props.title       Screen title.
 * @return {Node} The screen.
 */
function StylesScreen( {
	children,
	description,
	isLoading,
	isTopLevel,
	title,
} ) {
	return (
		<div
			// Choosing colors, fonts and so on is a task, so the sidebar
			// steps back to an icon strip, as it does for a page or menu.
			className={ `cnl-editor-stage routes-styles${
				isTopLevel ? '' : ' cnl-drilldown-stage'
			}` }
		>
			<DesignScreenHeading
				description={ description }
				isTopLevel={ isTopLevel }
				title={ title }
			/>
			{ isLoading && (
				<div className="cnl-editor-spinner">
					<Spinner />
				</div>
			) }
			{ ! isLoading && children }
			{ ! isLoading && (
				<Text className="routes-styles__muted" variant="body-sm">
					{ __( 'Want more control? Every style setting is in the' ) }{ ' ' }
					<Link
						href={ `${ appSettings.adminUrl }site-editor.php?p=%2Fstyles` }
					>
						{ __( 'full Styles editor' ) }
					</Link>
					.
				</Text>
			) }
		</div>
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

export function DesignStage() {
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

	return (
		<StylesScreen
			description={ __( 'How your whole site looks.' ) }
			isLoading={ isLoading }
			isTopLevel
			title={ __( 'Design' ) }
		>
			<section
				aria-label={ __( 'Site look' ) }
				className="routes-styles__section"
			>
				<div className="routes-styles__looks">
					{ looks.map( ( look, index ) => {
						const isSelected = active?.look === look;

						return (
							<LookCard
								basePalette={ basePalette }
								baseFontFamilies={ baseFontFamilies }
								isChanged={ isSelected && isChanged }
								isSelected={ isSelected }
								key={ `${ getLookTitle( look, index ) }-${ index }` }
								onSelect={ () => setConfig( look ) }
								title={ getLookTitle( look, index ) }
								variation={
									look === THEME_DEFAULT_LOOK
										? baseStyles
										: look
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
			<ScreenLinks
				label={ __( 'More design options' ) }
				links={ DESIGN_LINKS }
			/>
		</StylesScreen>
	);
}

export function ColorsStage() {
	const {
		baseStyles,
		isLoading,
		setConfig,
		themeName,
		userConfig,
		variations,
	} = useStylesData();
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

	return (
		<StylesScreen
			description={
				themeName
					? sprintf(
							/* translators: %s: Theme name. */
							__(
								'Changes the whole site at once. Your theme, %s, provides these palettes.'
							),
							themeName
						)
					: __( 'Changes the whole site at once.' )
			}
			isLoading={ isLoading }
			title={ __( 'Colors' ) }
		>
			<div className="routes-styles__palettes">
				<PaletteOption
					colors={ getSwatches( basePalette ) }
					isSelected={ ! activeColors }
					onSelect={ () =>
						setConfig(
							applyPreset( userConfig, null, COLOR_PROPERTIES )
						)
					}
					title={ __( 'Theme colors' ) }
				/>
				{ groups.colors.map( ( preset ) => (
					<PaletteOption
						colors={ getSwatches( getVariationPalette( preset ) ) }
						isSelected={ activeColors === preset }
						key={ getVariationTitle( preset ) }
						onSelect={ () =>
							setConfig(
								applyPreset(
									userConfig,
									preset,
									COLOR_PROPERTIES
								)
							)
						}
						title={ getVariationTitle( preset ) }
					/>
				) ) }
			</div>
			{ ! groups.colors.length && (
				<EmptyNote>
					{ __( 'Your theme only offers its own palette.' ) }
				</EmptyNote>
			) }
		</StylesScreen>
	);
}

export function FontsStage() {
	const {
		baseStyles,
		isLoading,
		setConfig,
		themeName,
		userConfig,
		variations,
	} = useStylesData();
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

	return (
		<StylesScreen
			description={
				themeName
					? sprintf(
							/* translators: %s: Theme name. */
							__(
								'Changes the whole site at once. Your theme, %s, provides these pairings.'
							),
							themeName
						)
					: __( 'Changes the whole site at once.' )
			}
			isLoading={ isLoading }
			title={ __( 'Fonts' ) }
		>
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
					onSelect={ () =>
						setConfig(
							applyPreset(
								userConfig,
								null,
								TYPOGRAPHY_PROPERTIES
							)
						)
					}
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
								setConfig(
									applyPreset(
										userConfig,
										preset,
										TYPOGRAPHY_PROPERTIES
									)
								)
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
		</StylesScreen>
	);
}

export function StylesCanvas() {
	return <SitePreviewCanvas />;
}
