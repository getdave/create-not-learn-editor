/**
 * Internal dependencies
 */
import { getErrorMessage } from '../../records';
import { settings as appSettings } from '../../settings';
import SitePreviewCanvas from './site-preview';
import {
	COLOR_PROPERTIES,
	TYPOGRAPHY_PROPERTIES,
	applyPreset,
	areStyleConfigsEqual,
	findActivePreset,
	getStyleConfig,
	getValueAtPath,
	getVariationPalette,
	getVariationTitle,
	groupStyleVariations,
	setValueAtPath,
} from './style-variations';
import {
	Button,
	ColorIndicator,
	Link,
	Notice,
	SelectControl,
	Spinner,
	Stack,
	Text,
	ToggleGroupControl,
	ToggleGroupControlOption,
	__,
	coreDataStore,
	el,
	sprintf,
	useDispatch,
	useMemo,
	useSelect,
	useState,
} from '../../wordpress-packages';

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};
const DEFAULT_OPTION = 'theme';
const ACCENT_PATHS = [
	[ 'styles', 'elements', 'button', 'color', 'background' ],
	[ 'styles', 'elements', 'link', 'color', 'text' ],
];
const CORNER_PATH = [ 'styles', 'elements', 'button', 'border', 'radius' ];
const SPACING_PATH = [ 'styles', 'spacing', 'blockGap' ];

function getCornerOptions() {
	return [
		{ label: __( 'Theme' ), value: DEFAULT_OPTION },
		{ label: __( 'Square' ), value: '0px' },
		{ label: __( 'Rounded' ), value: '8px' },
		{ label: __( 'Pill' ), value: '9999px' },
	];
}

function getSpacingOptions() {
	return [
		{ label: __( 'Tight' ), value: '0.75rem' },
		{ label: __( 'Theme' ), value: DEFAULT_OPTION },
		{ label: __( 'Airy' ), value: '2.5rem' },
	];
}

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
	const { editEntityRecord, saveEditedEntityRecord } =
		useDispatch( coreDataStore );
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
			hasEdits: args ? store.hasEditsForEntityRecord( ...args ) : false,
			isLoading:
				! globalStylesId ||
				! store.hasFinishedResolution(
					'__experimentalGetCurrentThemeGlobalStylesVariations',
					[]
				) ||
				( args && ! store.getEntityRecord( ...args ) ),
			isSaving: args ? store.isSavingEntityRecord( ...args ) : false,
			savedConfig: args ? store.getEntityRecord( ...args ) : null,
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
	const [ error, setError ] = useState( '' );

	const setConfig = ( nextConfig ) => {
		if ( ! data.globalStylesId ) {
			return;
		}

		setError( '' );
		editEntityRecord(
			'root',
			'globalStyles',
			data.globalStylesId,
			getStyleConfig( nextConfig )
		);
	};

	const save = () => {
		setError( '' );
		saveEditedEntityRecord( 'root', 'globalStyles', data.globalStylesId, {
			throwOnError: true,
		} ).catch( ( saveError ) => setError( getErrorMessage( saveError ) ) );
	};

	const discard = () => setConfig( data.savedConfig );

	return { ...data, discard, error, save, setConfig };
}

function LookCard( { basePalette, isSelected, onSelect, title, variation } ) {
	const palette = getVariationPalette( variation ).length
		? getVariationPalette( variation )
		: basePalette;
	const background =
		resolveColor( variation?.styles?.color?.background, palette ) ||
		resolveColor( 'var:preset|color|base', palette ) ||
		'#fff';
	const text =
		resolveColor( variation?.styles?.color?.text, palette ) ||
		resolveColor( 'var:preset|color|contrast', palette ) ||
		'#1e1e1e';
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
			el( 'span', { className: 'routes-styles__look-sample' }, 'Aa' ),
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

function SegmentedControl( { label, onChange, options, value } ) {
	return el(
		ToggleGroupControl,
		{
			__next40pxDefaultSize: true,
			__nextHasNoMarginBottom: true,
			isBlock: true,
			label,
			onChange,
			value,
		},
		options.map( ( option ) =>
			el( ToggleGroupControlOption, {
				key: option.value,
				label: option.label,
				value: option.value,
			} )
		)
	);
}

function StepHeading( { number, title, description } ) {
	return el(
		Stack,
		{ direction: 'column', gap: 'xs' },
		el(
			Text,
			{
				className: 'routes-styles__step-heading',
				render: el( 'h2' ),
				variant: 'heading-sm',
			},
			el(
				'span',
				{
					'aria-hidden': true,
					className: 'routes-styles__step-number',
				},
				number
			),
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
		discard,
		error,
		hasEdits,
		isLoading,
		isSaving,
		save,
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
	const currentPalette = getVariationPalette( userConfig ).length
		? getVariationPalette( userConfig )
		: basePalette;
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
	const accentValue = getValueAtPath( userConfig, ACCENT_PATHS[ 0 ] );
	const cornerValue = getValueAtPath( userConfig, CORNER_PATH );
	const spacingValue = getValueAtPath( userConfig, SPACING_PATH );
	const setValue = ( path, value ) =>
		setConfig(
			setValueAtPath(
				userConfig,
				path,
				value === DEFAULT_OPTION ? undefined : value
			)
		);
	const setAccent = ( slug ) => {
		const value = slug ? `var:preset|color|${ slug }` : undefined;

		setConfig(
			ACCENT_PATHS.reduce(
				( config, path ) => setValueAtPath( config, path, value ),
				userConfig
			)
		);
	};
	const accentColors = currentPalette.filter(
		( color ) => ! [ 'base', 'contrast' ].includes( color.slug )
	);

	return el(
		'div',
		{ className: 'cnl-editor-stage routes-styles' },
		el(
			Stack,
			{ direction: 'column', gap: 'xs' },
			el(
				Text,
				{ render: el( 'h1' ), variant: 'heading-xl' },
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
		error &&
			el(
				Notice,
				{
					className: 'cnl-editor-panel__notice',
					isDismissible: false,
					status: 'error',
				},
				error
			),
		isLoading &&
			el( 'div', { className: 'cnl-editor-spinner' }, el( Spinner ) ),
		! isLoading &&
			el(
				'section',
				{ className: 'routes-styles__section' },
				el( StepHeading, {
					description: __(
						'Each look sets colors, fonts, and spacing together.'
					),
					number: '1',
					title: __( 'Pick a look' ),
				} ),
				el(
					'div',
					{ className: 'routes-styles__looks' },
					el( LookCard, {
						basePalette,
						isSelected: areStyleConfigsEqual( userConfig, {} ),
						onSelect: () => setConfig( {} ),
						title: __( 'Theme default' ),
						variation: baseStyles,
					} ),
					groups.looks.map( ( variation, index ) =>
						el( LookCard, {
							basePalette,
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
			el(
				'section',
				{ className: 'routes-styles__section' },
				el( StepHeading, {
					description: __(
						'Adjust one thing at a time. The preview updates as you go.'
					),
					number: '2',
					title: __( 'Fine-tune' ),
				} ),
				groups.colors.length > 0 &&
					el(
						'div',
						{
							className: 'routes-styles__field',
							role: 'group',
							'aria-label': __( 'Color palette' ),
						},
						el(
							Text,
							{
								className: 'routes-styles__label',
								variant: 'body-sm',
							},
							__( 'Color palette' )
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
				accentColors.length > 0 &&
					el(
						'div',
						{
							className: 'routes-styles__field',
							role: 'group',
							'aria-label': __( 'Main color' ),
						},
						el(
							Text,
							{
								className: 'routes-styles__label',
								variant: 'body-sm',
							},
							__( 'Main color' )
						),
						el(
							Text,
							{
								className: 'routes-styles__muted',
								variant: 'body-sm',
							},
							__( 'Used for buttons and links.' )
						),
						el(
							'div',
							{ className: 'routes-styles__accents' },
							el( PaletteOption, {
								colors: [],
								isSelected: ! accentValue,
								onSelect: () => setAccent( undefined ),
								title: __( 'Theme default' ),
							} ),
							accentColors.map( ( color ) =>
								el( PaletteOption, {
									colors: [ color.color ],
									isSelected:
										accentValue ===
										`var:preset|color|${ color.slug }`,
									key: color.slug,
									onSelect: () => setAccent( color.slug ),
									title: color.name || color.slug,
								} )
							)
						)
					),
				groups.fonts.length > 0 &&
					el( SelectControl, {
						__next40pxDefaultSize: true,
						__nextHasNoMarginBottom: true,
						help: __(
							'A heading font and a body font that suit each other.'
						),
						label: __( 'Fonts' ),
						onChange: ( value ) =>
							setConfig(
								applyPreset(
									userConfig,
									groups.fonts.find(
										( preset ) =>
											getVariationTitle( preset ) ===
											value
									) || null,
									TYPOGRAPHY_PROPERTIES
								)
							),
						options: [
							{
								label: __( 'Theme fonts' ),
								value: DEFAULT_OPTION,
							},
							...groups.fonts.map( ( preset ) => ( {
								label: getVariationTitle( preset ),
								value: getVariationTitle( preset ),
							} ) ),
						],
						value: activeFonts
							? getVariationTitle( activeFonts )
							: DEFAULT_OPTION,
					} ),
				el( SegmentedControl, {
					label: __( 'Button corners' ),
					onChange: ( value ) => setValue( CORNER_PATH, value ),
					options: getCornerOptions(),
					value: cornerValue || DEFAULT_OPTION,
				} ),
				el( SegmentedControl, {
					label: __( 'Spacing' ),
					onChange: ( value ) => setValue( SPACING_PATH, value ),
					options: getSpacingOptions(),
					value: spacingValue || DEFAULT_OPTION,
				} )
			),
		! isLoading &&
			hasEdits &&
			el(
				'div',
				{ className: 'routes-styles__save' },
				el(
					Text,
					{ className: 'routes-styles__muted', variant: 'body-sm' },
					__(
						'You are previewing changes. Visitors see them once you save.'
					)
				),
				el(
					Stack,
					{ gap: 'sm' },
					el(
						Button,
						{
							__next40pxDefaultSize: true,
							isBusy: isSaving,
							onClick: save,
							variant: 'primary',
						},
						__( 'Save changes' )
					),
					el(
						Button,
						{
							__next40pxDefaultSize: true,
							disabled: isSaving,
							onClick: discard,
							variant: 'tertiary',
						},
						__( 'Undo changes' )
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
