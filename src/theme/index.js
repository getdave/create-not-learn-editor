/**
 * Visual themes layered on top of the WordPress Design System.
 *
 * The active theme comes from the PHP `CNL_EDITOR_UI_THEME` constant, passed
 * through as `settings.uiTheme`. Each theme is a set of `ThemeProvider`
 * settings, so it changes design token values through the design system's
 * own API. Styles for components that do not read tokens yet live alongside
 * in `modern.scss`.
 */

/**
 * Internal dependencies
 */
import { settings } from '../settings';
import { ThemeProvider, el } from '../wordpress-packages';

const UI_THEMES = {
	modern: {
		cornerRadius: 'moderate',
	},
};

/**
 * Wrap a route's stage or canvas in the active theme.
 *
 * With the default theme the component is returned untouched.
 *
 * @param {Function} Component Route stage or canvas component.
 * @return {Function} The themed component.
 */
export function withUiTheme( Component ) {
	const theme = UI_THEMES[ settings.uiTheme ];

	if ( ! theme || ! Component ) {
		return Component;
	}

	function ThemedRouteSurface( props ) {
		return el( ThemeProvider, theme, el( Component, props ) );
	}

	ThemedRouteSurface.displayName = `withUiTheme(${
		Component.displayName || Component.name || 'Component'
	})`;

	return ThemedRouteSurface;
}
