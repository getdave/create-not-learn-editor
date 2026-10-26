/**
 * A block's text and background colours, in its options menu: a flyout of
 * the theme's colours, then pure black and white, as Word offers its theme
 * colours, and Custom, which opens core's colour picker by the options
 * button for any colour.
 *
 * Offered for any block whose colour support has them, so one button, or
 * one card, can be a different colour from the rest. Colours that would
 * make the block's text hard to read say so, but can still be picked.
 */

/**
 * WordPress dependencies
 */
import { useSettings } from '@wordpress/block-editor';
import { getBlockSupport, hasBlockSupport } from '@wordpress/blocks';
import { ColorPicker, Popover } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { caution as cautionIcon } from '@wordpress/icons';
import { Icon, Menu, Text } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import {
	CUSTOM,
	getActiveColor,
	getBackdropColor,
	getColor,
	getColorAttributes,
	getColorChoiceValue,
	isHardToRead,
} from '../editor-extensions/color-details';
import { withBlackAndWhite } from '../pickers/color-well';
import { NONE } from './alignment';
import { useLeaveFocus } from './toolbar-menu';

const LABELS = {
	text: __( 'Text color' ),
	background: __( 'Background color' ),
};

/**
 * Blocks whose colours are drawn on an element inside them rather than on
 * the block's own, and so are measured there.
 */
const COLORED_ELEMENTS = {
	'core/button': '.wp-block-button__link',
};

/**
 * Colours from the theme and the site's own, each once, with the default
 * palette only when there are neither.
 *
 * @param {...?Object[]} palettes Palettes by origin, the first winning.
 * @return {Object[]} The colours.
 */
function mergePalettes( ...palettes ) {
	const seen = new Set();

	return palettes
		.flat()
		.filter( Boolean )
		.filter( ( { slug } ) => ! seen.has( slug ) && seen.add( slug ) );
}

/**
 * Whether a block's colour support takes a kind of colour, and the site
 * allows it.
 *
 * @param {string}  name    Block name.
 * @param {string}  kind    `text` or `background`.
 * @param {boolean} allowed The site's setting for it.
 * @return {boolean} Whether it does.
 */
function supportsColor( name, kind, allowed ) {
	return (
		allowed !== false &&
		hasBlockSupport( name, 'color' ) &&
		getBlockSupport( name, `color.${ kind }` ) !== false
	);
}

/**
 * The colours a block can have, and what they can be.
 *
 * @param {string} name Block name.
 * @return {?Object} `{ kinds, choices, canCustom }`, with `kinds` the
 *                   colours it takes, `text` and `background`, or null when
 *                   it takes none.
 */
export function useBlockColors( name ) {
	const [
		theme,
		custom,
		defaults,
		hasDefaultPalette,
		canColorText,
		canColorBackground,
		canCustom,
	] = useSettings(
		'color.palette.theme',
		'color.palette.custom',
		'color.palette.default',
		'color.defaultPalette',
		'color.text',
		'color.background',
		'color.custom'
	);

	const kinds = [
		supportsColor( name, 'text', canColorText ) && 'text',
		supportsColor( name, 'background', canColorBackground ) && 'background',
	].filter( Boolean );

	if ( ! kinds.length ) {
		return null;
	}

	const palette = mergePalettes( theme, custom );
	const choices = withBlackAndWhite(
		palette.length || ! hasDefaultPalette
			? palette
			: mergePalettes( defaults )
	);

	return { kinds, choices, canCustom: canCustom !== false };
}

/**
 * The block's element on the canvas, which may be in the editor's iframe.
 *
 * @param {string} clientId Block client ID.
 * @return {?Element} The element.
 */
function findBlockElement( clientId ) {
	const documents = [
		document,
		...Array.from(
			document.querySelectorAll( 'iframe' ),
			( frame ) => frame.contentDocument
		),
	];

	for ( const doc of documents ) {
		const element = doc?.getElementById( `block-${ clientId }` );

		if ( element ) {
			return element;
		}
	}

	return null;
}

/**
 * How the block's colours look on the canvas.
 *
 * Read as the flyout or picker renders, so the canvas is looked at as they
 * open rather than with every change to the block.
 *
 * @param {string} clientId   Block client ID.
 * @param {string} name       Block name.
 * @param {Object} attributes Block attributes.
 * @param {string} kind       `text` or `background`.
 * @return {Object} CSS colours, or null where they can't be told:
 *                  `text` and `background`, the block's text and what is
 *                  behind it now, and `initial`, the colour of this kind it
 *                  has by default.
 */
function readCanvas( clientId, name, attributes, kind ) {
	const block = findBlockElement( clientId );
	const element =
		( COLORED_ELEMENTS[ name ] &&
			block?.querySelector( COLORED_ELEMENTS[ name ] ) ) ||
		block;
	const read = ( node ) =>
		node?.ownerDocument.defaultView.getComputedStyle( node );
	const text = read( element )?.color ?? null;
	const background = getBackdropColor( element );
	const isSet = !! getColor( [], attributes, kind );

	/*
	 * Unset, the block's own colour is its default. Set, the default is what
	 * it would take from around it, unless it is drawn on an element of its
	 * own with colours of its own, like a button's.
	 */
	let initial = kind === 'text' ? text : background;

	if ( isSet ) {
		const parent = COLORED_ELEMENTS[ name ] ? null : block?.parentElement;

		initial =
			kind === 'text'
				? ( read( parent )?.color ?? null )
				: parent && getBackdropColor( parent );
	}

	return { text, background, initial };
}

/**
 * Whether a choice of colour would leave the block's text hard to read.
 *
 * @param {string}  kind   `text` or `background`.
 * @param {?string} color  The choice, as CSS.
 * @param {Object}  canvas What `readCanvas()` read.
 * @return {boolean} Whether it would.
 */
function isChoiceHardToRead( kind, color, canvas ) {
	return kind === 'text'
		? isHardToRead( color, canvas.background )
		: isHardToRead( canvas.text, color );
}

/**
 * A round swatch of a colour, in place of an item's icon. Without one, a
 * swatch struck through, as core draws no colour.
 *
 * @param {Object}  props
 * @param {?string} props.color The colour, as CSS.
 * @return {Element} The swatch.
 */
function Swatch( { color } ) {
	return (
		<span
			className={
				color
					? 'cnl-block-options__swatch'
					: 'cnl-block-options__swatch is-unknown'
			}
			style={ { background: color ?? undefined } }
			aria-hidden="true"
		/>
	);
}

/**
 * A colour flyout, Text color or Background color.
 *
 * @param {Object}   props
 * @param {string}   props.kind          `text` or `background`.
 * @param {string}   props.clientId      Block client ID.
 * @param {string}   props.name          Block name.
 * @param {Object}   props.attributes    Block attributes.
 * @param {Function} props.setAttributes Block attribute setter.
 * @param {Object[]} props.choices       The colours offered.
 * @param {boolean}  props.canCustom     Whether any colour can be picked.
 * @param {Function} props.onCustom      Opens the colour picker, with the kind.
 * @return {Element} The flyout.
 */
export function ColorSubmenu( {
	kind,
	clientId,
	name,
	attributes,
	setAttributes,
	choices,
	canCustom,
	onCustom,
} ) {
	const leaveFocus = useLeaveFocus();
	const canvas = readCanvas( clientId, name, attributes, kind );
	const value = getActiveColor( choices, attributes, kind ) ?? NONE;
	const color = getColor( choices, attributes, kind );
	const options = [
		{ value: NONE, label: __( 'Default' ), color: canvas.initial },
		...choices.map( ( choice ) => ( {
			value: getColorChoiceValue( choice ),
			label: choice.name || choice.slug || choice.color,
			color: choice.color,
			choice,
		} ) ),
	];

	return (
		<Menu.SubmenuRoot>
			<Menu.SubmenuTrigger
				prefix={ <Swatch color={ color ?? canvas.initial } /> }
				suffix={
					value === CUSTOM
						? __( 'Custom' )
						: options.find( ( option ) => option.value === value )
								?.label
				}
			>
				<Menu.ItemLabel>{ LABELS[ kind ] }</Menu.ItemLabel>
			</Menu.SubmenuTrigger>
			<Menu.Popup className="cnl-block-options__colors">
				<Menu.RadioGroup
					value={ value }
					onValueChange={ ( next ) =>
						setAttributes(
							getColorAttributes(
								attributes,
								kind,
								options.find(
									( option ) => option.value === next
								)?.choice ?? null
							)
						)
					}
				>
					{ options.map( ( option ) => (
						<Menu.RadioItem
							key={ option.value }
							value={ option.value }
							closeOnClick
							prefix={ <Swatch color={ option.color } /> }
							suffix={
								option.choice &&
								isChoiceHardToRead( kind, option.color, canvas )
									? __( 'Hard to read' )
									: undefined
							}
						>
							<Menu.ItemLabel>{ option.label }</Menu.ItemLabel>
						</Menu.RadioItem>
					) ) }
				</Menu.RadioGroup>
				{ canCustom && (
					<>
						<Menu.Separator />
						<Menu.Item
							prefix={
								<span
									className="cnl-block-options__swatch is-wheel"
									aria-hidden="true"
								/>
							}
							suffix={
								value === CUSTOM ? (
									<Swatch color={ color } />
								) : undefined
							}
							onClick={ () => {
								leaveFocus();
								onCustom( kind );
							} }
						>
							<Menu.ItemLabel>{ __( 'Custom…' ) }</Menu.ItemLabel>
						</Menu.Item>
					</>
				) }
			</Menu.Popup>
		</Menu.SubmenuRoot>
	);
}

/**
 * Core's colour picker for any colour, by the options button once Custom is
 * picked. A change shows on the block straight away.
 *
 * @param {Object}   props
 * @param {string}   props.kind          `text` or `background`.
 * @param {Element}  props.anchor        The options button.
 * @param {string}   props.clientId      Block client ID.
 * @param {string}   props.name          Block name.
 * @param {Object}   props.attributes    Block attributes.
 * @param {Function} props.setAttributes Block attribute setter.
 * @param {Object[]} props.choices       The colours offered.
 * @param {Function} props.onClose       Closes it.
 * @return {Element} The picker.
 */
export function ColorPickerPopover( {
	kind,
	anchor,
	clientId,
	name,
	attributes,
	setAttributes,
	choices,
	onClose,
} ) {
	const canvas = readCanvas( clientId, name, attributes, kind );
	const color = getColor( choices, attributes, kind ) ?? canvas.initial;

	return (
		<Popover
			anchor={ anchor }
			className="cnl-block-options__color-picker"
			placement="bottom-start"
			offset={ 8 }
			focusOnMount="firstElement"
			onClose={ () => {
				onClose();
				anchor?.focus();
			} }
			onFocusOutside={ onClose }
		>
			<div className="cnl-block-options__color-picker-content">
				<Text render={ <h2 /> } variant="heading-sm">
					{ LABELS[ kind ] }
				</Text>
				<ColorPicker
					color={ color ?? undefined }
					onChange={ ( next ) =>
						setAttributes(
							getColorAttributes( attributes, kind, {
								color: next,
							} )
						)
					}
				/>
				{ isChoiceHardToRead( kind, color, canvas ) && (
					<Text
						className="cnl-color-well__note"
						render={ <p /> }
						variant="body-sm"
					>
						<Icon icon={ cautionIcon } size={ 20 } />
						{ kind === 'text'
							? __(
									'This color may be hard to read on the background.'
								)
							: __( 'Text may be hard to read on this color.' ) }
					</Text>
				) }
			</div>
		</Popover>
	);
}
