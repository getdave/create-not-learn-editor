/**
 * Internal dependencies
 */
import { settings as appSettings } from '../../settings';
import { DesignScreenHeading } from './design-heading';
import SitePreviewCanvas from './site-preview';
import ScreenLinks from '../../screen-links';
import {
	FontPicker,
	LookPicker,
	PalettePicker,
	useStylesData,
} from '../../pickers/styles';
import {
	Link,
	Spinner,
	Text,
	__,
	colorIcon,
	siteLogoIcon,
	sprintf,
	typographyIcon,
} from '../../wordpress-packages';

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
		<div className="cnl-editor-stage routes-styles">
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

export function DesignStage() {
	const { isLoading } = useStylesData();

	return (
		<StylesScreen
			description={ __( 'How your whole site looks.' ) }
			isLoading={ isLoading }
			isTopLevel
			title={ __( 'Design' ) }
		>
			<LookPicker />
			<ScreenLinks
				label={ __( 'More design options' ) }
				links={ DESIGN_LINKS }
			/>
		</StylesScreen>
	);
}

function getThemeDescription( themeName, template ) {
	return themeName
		? sprintf( template, themeName )
		: __( 'Changes the whole site at once.' );
}

export function ColorsStage() {
	const { isLoading, themeName } = useStylesData();

	return (
		<StylesScreen
			description={ getThemeDescription(
				themeName,
				/* translators: %s: Theme name. */
				__(
					'Changes the whole site at once. Your theme, %s, provides these palettes.'
				)
			) }
			isLoading={ isLoading }
			title={ __( 'Colors' ) }
		>
			<PalettePicker />
		</StylesScreen>
	);
}

export function FontsStage() {
	const { isLoading, themeName } = useStylesData();

	return (
		<StylesScreen
			description={ getThemeDescription(
				themeName,
				/* translators: %s: Theme name. */
				__(
					'Changes the whole site at once. Your theme, %s, provides these pairings.'
				)
			) }
			isLoading={ isLoading }
			title={ __( 'Fonts' ) }
		>
			<FontPicker />
		</StylesScreen>
	);
}

export function StylesCanvas() {
	return <SitePreviewCanvas />;
}
