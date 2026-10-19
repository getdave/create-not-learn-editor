/**
 * What changes more than the page on show, like the header and footer, which
 * every page shares, is marked out in purple with a globe. What changes only
 * the page on show isn't marked at all.
 *
 * The purple is core's own colour for synced blocks and template parts
 * (`--wp-block-synced-color`), so ours matches the outlines core draws on them
 * in the canvas. It is given to the design system as the primary colour, so
 * every brand token, and the admin colour core's older components read, turns
 * purple inside the scope.
 *
 * Imported package by package, as the chat and pickers use it too. See
 * AGENTS.md.
 */

/**
 * WordPress dependencies
 */
import { globe as globeIcon } from '@wordpress/icons';
import { ThemeProvider } from '@wordpress/theme';
import { Icon } from '@wordpress/ui';

// Core's `--wp-block-synced-color`. The design system only takes a colour,
// not a custom property, as its seed. `$cnl-global` in `src/_colors.scss`
// is the same colour for stylesheets.
export const GLOBAL_COLOR = '#7a00df';

const GLOBAL_THEME_COLOR = { primary: GLOBAL_COLOR };

/*
 * The admin colour, and its darker shades as the design system works them
 * out, for an editor's canvas while what is edited in it is shared. The
 * canvas is a document of its own, which `GlobalScope` can't reach, and core
 * outlines and selects blocks in it in the admin colour.
 */
export const GLOBAL_CANVAS_CSS = `body {
	--wp-admin-theme-color: ${ GLOBAL_COLOR } !important;
	--wp-admin-theme-color--rgb: 122, 0, 223 !important;
	--wp-admin-theme-color-darker-10: #6c00c6 !important;
	--wp-admin-theme-color-darker-10--rgb: 108, 0, 198 !important;
	--wp-admin-theme-color-darker-20: #5e00ac !important;
	--wp-admin-theme-color-darker-20--rgb: 94, 0, 172 !important;
}`;

/**
 * Turns the design system purple for what it wraps.
 *
 * @param {Object}  props
 * @param {Element} props.children What edits something every page shares.
 * @return {Element} The children, in purple.
 */
export function GlobalScope( { children } ) {
	return (
		<ThemeProvider color={ GLOBAL_THEME_COLOR }>{ children }</ThemeProvider>
	);
}

/**
 * Says where a change will show, with a globe: a purple-tinted pill.
 *
 * @param {Object} props
 * @param {string} props.children  The words.
 * @param {string} props.className Extra classes.
 * @return {Element} The note.
 */
export function GlobalNote( { children, className = '' } ) {
	return (
		<GlobalScope>
			<span className={ `cnl-global-note ${ className }`.trim() }>
				<Icon
					className="cnl-global-note__icon"
					icon={ globeIcon }
					size={ 16 }
				/>
				<span className="cnl-global-note__text">{ children }</span>
			</span>
		</GlobalScope>
	);
}
