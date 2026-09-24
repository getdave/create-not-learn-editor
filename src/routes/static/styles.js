/**
 * Internal dependencies
 */
import { settings as appSettings } from '../../settings';
import SitePreviewCanvas from './site-preview';
import {
	COLOR_PROPERTIES,
	TYPOGRAPHY_PROPERTIES,
	applyPreset,
	areStyleConfigsEqual,
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
	Collapsible,
	Icon,
	Link,
	Spinner,
	Stack,
	Text,
	__,
	chevronRightIcon,
	coreDataStore,
	el,
	sprintf,
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

function LookCard( {
	basePalette,
	baseFontFamilies,
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

	return el(
		Button,
		{
			'aria-pressed': isSelected,
			className: `routes-styles__look${
				isSelected ? ' is-selected' : ''
			}`,
			onClick: onSelect,
		},
		el(
			'span',
			{
				'aria-hidden': true,
				className: 'routes-styles__look-preview',
				style: { background, color: text },
			},
			el(
				'span',
				{
					className: 'routes-styles__look-sample',
					style: { fontFamily },
				},
				'Aa'
			),
			el(
				'span',
				{ className: 'routes-styles__look-swatches' },
				swatches.map( ( color ) =>
					el( 'span', {
						className: 'routes-styles__look-swatch',
						key: color,
						style: { background: color },
					} )
				)
			)
		),
		el( 'span', { className: 'routes-styles__look-title' }, title )
	);
}

function PaletteOption( { colors, isSelected, onSelect, title } ) {
	return el(
		Button,
		{
			'aria-pressed': isSelected,
			className: `routes-styles__palette${
				isSelected ? ' is-selected' : ''
			}`,
			label: title,
			onClick: onSelect,
			showTooltip: true,
		},
		colors.length
			? el(
					'span',
					{
						'aria-hidden': true,
						className: 'routes-styles__palette-colors',
					},
					colors.map( ( color ) =>
						el( ColorIndicator, { colorValue: color, key: color } )
					)
				)
			: el(
					'span',
					{
						'aria-hidden': true,
						className: 'routes-styles__palette-default',
					},
					__( 'Theme' )
				)
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
	return el(
		Button,
		{
			'aria-pressed': isSelected,
			className: `routes-styles__font${
				isSelected ? ' is-selected' : ''
			}`,
			label: title,
			onClick: onSelect,
			showTooltip: true,
		},
		el(
			'span',
			{ 'aria-hidden': true, className: 'routes-styles__font-preview' },
			el(
				'span',
				{
					className: 'routes-styles__font-heading',
					style: { fontFamily: headingFont },
				},
				headingFontName
			),
			el(
				'span',
				{
					className: 'routes-styles__font-body',
					style: { fontFamily: bodyFont },
				},
				bodyFontName
			)
		)
	);
}

function SectionHeading( { title, description, variant = 'heading-sm' } ) {
	return el(
		Stack,
		{ direction: 'column', gap: 'xs' },
		el(
			Text,
			{
				render: el( 'h2' ),
				variant,
			},
			title
		),
		description &&
			el(
				Text,
				{ className: 'routes-styles__muted', variant: 'body-sm' },
				description
			)
	);
}

export function StylesStage() {
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
	const baseFontFamilies = getVariationFontFamilies( baseStyles );
	const activeColors = findActivePreset(
		userConfig,
		groups.colors,
		COLOR_PROPERTIES
	);
	const activeFonts = findActivePreset(
		userConfig,
		groups.fonts,
		TYPOGRAPHY_PROPERTIES
	);

	return el(
		'div',
		{ className: 'cnl-editor-stage routes-styles' },
		el(
			Stack,
			{ direction: 'column', gap: 'xs' },
			el(
				Text,
				{ render: el( 'h1' ), variant: 'heading-lg' },
				__( 'Colors & fonts' )
			),
			el(
				Text,
				{ className: 'routes-styles__muted', variant: 'body-md' },
				themeName
					? sprintf(
							/* translators: %s: Theme name. */
							__(
								'Changes the whole site at once. Your theme, %s, provides these options.'
							),
							themeName
						)
					: __( 'Changes the whole site at once.' )
			)
		),
		isLoading &&
			el( 'div', { className: 'cnl-editor-spinner' }, el( Spinner ) ),
		! isLoading &&
			el(
				'section',
				{ className: 'routes-styles__section' },
				el( SectionHeading, {
					description: __(
						'Each look sets colors, fonts, and spacing together.'
					),
					title: __( 'Pick a look' ),
					variant: 'heading-md',
				} ),
				el(
					'div',
					{ className: 'routes-styles__looks' },
					el( LookCard, {
						basePalette,
						baseFontFamilies,
						isSelected: areStyleConfigsEqual( userConfig, {} ),
						onSelect: () => setConfig( {} ),
						title: __( 'Theme default' ),
						variation: baseStyles,
					} ),
					groups.looks.map( ( variation, index ) =>
						el( LookCard, {
							basePalette,
							baseFontFamilies,
							isSelected: areStyleConfigsEqual(
								userConfig,
								variation
							),
							key: `${ getVariationTitle( variation ) }-${ index }`,
							onSelect: () => setConfig( variation ),
							title: getVariationTitle(
								variation,
								sprintf(
									/* translators: %d: Style number. */
									__( 'Look %d' ),
									index + 1
								)
							),
							variation,
						} )
					)
				)
			),
		! isLoading &&
			( groups.colors.length > 0 || groups.fonts.length > 0 ) &&
			el(
				Collapsible.Root,
				{ className: 'routes-styles__customize' },
				el(
					Collapsible.Trigger,
					{ className: 'routes-styles__customize-trigger' },
					el( Icon, {
						className: 'routes-styles__customize-icon',
						icon: chevronRightIcon,
					} ),
					el(
						Stack,
						{ direction: 'column', gap: '3xs' },
						el(
							Text,
							{ render: el( 'span' ), variant: 'heading-sm' },
							__( 'Customize colors and fonts' )
						),
						el(
							Text,
							{
								className: 'routes-styles__muted',
								variant: 'body-sm',
							},
							__( 'Optional. Fine-tune beyond the preset looks.' )
						)
					)
				),
				el(
					Collapsible.Panel,
					{ className: 'routes-styles__customize-panel' },
					groups.colors.length > 0 &&
						el(
							'div',
							{ className: 'routes-styles__field' },
							el(
								Text,
								{
									className: 'routes-styles__sublabel',
									variant: 'body-sm',
								},
								__( 'Colors' )
							),
							el(
								'div',
								{ className: 'routes-styles__palettes' },
								el( PaletteOption, {
									colors: getSwatches( basePalette ),
									isSelected: ! activeColors,
									onSelect: () =>
										setConfig(
											applyPreset(
												userConfig,
												null,
												COLOR_PROPERTIES
											)
										),
									title: __( 'Theme colors' ),
								} ),
								groups.colors.map( ( preset ) =>
									el( PaletteOption, {
										colors: getSwatches(
											getVariationPalette( preset )
										),
										isSelected: activeColors === preset,
										key: getVariationTitle( preset ),
										onSelect: () =>
											setConfig(
												applyPreset(
													userConfig,
													preset,
													COLOR_PROPERTIES
												)
											),
										title: getVariationTitle( preset ),
									} )
								)
							)
						),
					groups.fonts.length > 0 &&
						el(
							'div',
							{ className: 'routes-styles__field' },
							el(
								Text,
								{
									className: 'routes-styles__sublabel',
									variant: 'body-sm',
								},
								__( 'Fonts' )
							),
							el(
								'div',
								{ className: 'routes-styles__fonts' },
								el( FontCard, {
									bodyFont: getBodyFontFamily(
										baseStyles,
										baseFontFamilies
									),
									bodyFontName: getBodyFontName(
										baseStyles,
										baseFontFamilies
									),
									headingFont: getHeadingFontFamily(
										baseStyles,
										baseFontFamilies
									),
									headingFontName: getHeadingFontName(
										baseStyles,
										baseFontFamilies
									),
									isSelected: ! activeFonts,
									onSelect: () =>
										setConfig(
											applyPreset(
												userConfig,
												null,
												TYPOGRAPHY_PROPERTIES
											)
										),
									title: __( 'Theme fonts' ),
								} ),
								groups.fonts.map( ( preset ) => {
									const fontFamilies =
										getVariationFontFamilies( preset )
											.length
											? getVariationFontFamilies( preset )
											: baseFontFamilies;

									return el( FontCard, {
										bodyFont: getBodyFontFamily(
											preset,
											fontFamilies
										),
										bodyFontName: getBodyFontName(
											preset,
											fontFamilies
										),
										headingFont: getHeadingFontFamily(
											preset,
											fontFamilies
										),
										headingFontName: getHeadingFontName(
											preset,
											fontFamilies
										),
										isSelected: activeFonts === preset,
										key: getVariationTitle( preset ),
										onSelect: () =>
											setConfig(
												applyPreset(
													userConfig,
													preset,
													TYPOGRAPHY_PROPERTIES
												)
											),
										title: getVariationTitle( preset ),
									} );
								} )
							)
						)
				)
			),
		! isLoading &&
			el(
				Text,
				{ className: 'routes-styles__muted', variant: 'body-sm' },
				__( 'Want more control? Every style setting is in the' ),
				' ',
				el(
					Link,
					{
						href: `${ appSettings.adminUrl }site-editor.php?p=%2Fstyles`,
					},
					__( 'full Styles editor' )
				),
				'.'
			)
	);
}

export function StylesCanvas() {
	return el( SitePreviewCanvas, {
		description: __(
			'Your homepage, with the changes you are trying out.'
		),
		title: __( 'Live preview' ),
	} );
}
