/**
 * One colour of a custom set, like a section's background: a swatch with
 * its name that opens core's colour palette, the theme's colours first,
 * then pure black and white, which every palette offers, and any colour
 * after.
 *
 * Shared by Edit design's custom section colours and Design's custom site
 * colours, so both look and work the same.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * as the other pickers are.
 */

/**
 * WordPress dependencies
 */
import {
	Button,
	ColorIndicator,
	ColorPalette,
	Dropdown,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { caution as cautionIcon } from '@wordpress/icons';
import { Icon, Text } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { parseColor } from '../site-canvas/compose/palette-colors';
import { resolveColor } from './resolve-color';

/**
 * The palette with pure black and white after it, unless it has them. They
 * have no slug, so they are saved as CSS.
 *
 * @param {Object[]} palette `{ slug, name, color }` for each colour.
 * @return {Object[]} The colours to offer.
 */
export function withBlackAndWhite( palette ) {
	const has = ( hex ) =>
		palette.some(
			( item ) =>
				parseColor( item.color )?.join() === parseColor( hex ).join()
		);

	return [
		...palette,
		...[
			{ color: '#000000', name: __( 'Black' ) },
			{ color: '#ffffff', name: __( 'White' ) },
		].filter( ( item ) => ! has( item.color ) ),
	];
}

/**
 * A colour's preset slug, from either way a theme writes one.
 *
 * @param {?string} value The colour.
 * @return {?string} The slug.
 */
function getSlug( value ) {
	if ( typeof value !== 'string' ) {
		return null;
	}

	return (
		value.match( /^var:preset\|color\|(.+)$/ )?.[ 1 ] ||
		value.match( /^var\(--wp--preset--color--([^)]+)\)$/ )?.[ 1 ] ||
		null
	);
}

/**
 * @param {Object}   props
 * @param {string}   props.className Class for the toggle, which the place
 *                                   it sits in styles.
 * @param {string}   props.label     The colour's name, like "Background".
 * @param {?string}  props.note      A warning to show under the palette,
 *                                   like text that won't read.
 * @param {Function} props.onChange  Called with the colour picked: a
 *                                   palette colour as a preset
 *                                   (`var:preset|color|slug`) when
 *                                   `asPreset`, otherwise as CSS.
 * @param {Object[]} props.palette   `{ slug, name, color }` for each of
 *                                   the theme's colours.
 * @param {?string}  props.value     The colour, as a preset or CSS.
 * @param {boolean}  props.asPreset  Whether palette colours are given as
 *                                   presets.
 * @param {?Element} props.children  Shown in the toggle after the label.
 * @return {Element} The well.
 */
export default function ColorWell( {
	asPreset = true,
	children,
	className,
	label,
	note,
	onChange,
	palette,
	value,
} ) {
	const color = resolveColor( value, palette );
	const choices = withBlackAndWhite( palette );

	return (
		<Dropdown
			className="cnl-color-well"
			contentClassName="cnl-color-well__popover"
			popoverProps={ { placement: 'bottom', offset: 8 } }
			renderToggle={ ( { isOpen, onToggle } ) => (
				<Button
					aria-expanded={ isOpen }
					className={ className }
					onClick={ onToggle }
					size="compact"
				>
					<ColorIndicator colorValue={ color } />
					<span className="cnl-color-well__label">{ label }</span>
					{ children }
				</Button>
			) }
			renderContent={ () => (
				<div className="cnl-color-well__content">
					<ColorPalette
						aria-label={ label }
						clearable={ false }
						colors={ choices }
						onChange={ ( next, index, slug ) => {
							const entry =
								choices.find(
									( item ) => slug && item.slug === slug
								) ?? choices[ index ];

							if ( ! next ) {
								return;
							}

							onChange(
								asPreset && entry?.slug && entry.color === next
									? `var:preset|color|${ entry.slug }`
									: next
							);
						} }
						selectedSlug={ getSlug( value ) || undefined }
						value={ color }
					/>
					{ note && (
						<Text
							className="cnl-color-well__note"
							render={ <p /> }
							variant="body-sm"
						>
							<Icon icon={ cautionIcon } size={ 20 } />
							{ note }
						</Text>
					) }
				</div>
			) }
		/>
	);
}
