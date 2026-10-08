/**
 * The shell the "Add a page" and "Add a section" modals share, so picking a
 * design looks and feels the same whatever is being added: a heading with a
 * line of help, controls on the right, a list of kinds down the left, and the
 * designs to the right of it.
 */

/**
 * WordPress dependencies
 */
import { Button, Modal } from '@wordpress/components';
import { createElement as el, useId } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
	chevronLeft as chevronLeftIcon,
	chevronRight as chevronRightIcon,
	closeSmall as closeSmallIcon,
	plus as plusIcon,
} from '@wordpress/icons';
import { Icon, Text } from '@wordpress/ui';

/**
 * The modal.
 *
 * @param {Object}   props               Component props.
 * @param {string}   props.title         Heading.
 * @param {string}   props.subtitle      Line of help under the heading.
 * @param {Element}  props.belowHeading  Controls under the line of help.
 * @param {Element}  props.actions       Controls beside the close button.
 * @param {Element}  props.nav           The list of kinds, if there is one.
 * @param {Element}  props.children      The designs, or whatever the step
 *                                       shows.
 * @param {string}   props.className     Extra class for the modal.
 * @param {string}   props.mainClassName Extra class for the main area.
 * @param {Object}   props.mainRef       Ref to the main area, which scrolls.
 * @param {Function} props.onClose       Called to close.
 * @return {Element} The modal.
 */
export function DesignPicker( {
	title,
	subtitle,
	belowHeading,
	actions,
	nav,
	children,
	className,
	mainClassName,
	mainRef,
	onClose,
} ) {
	const titleId = useId();

	return el(
		Modal,
		{
			__experimentalHideHeader: true,
			aria: { labelledby: titleId },
			className: [ 'cnl-design-picker', className ]
				.filter( Boolean )
				.join( ' ' ),
			focusOnMount: 'firstContentElement',
			onRequestClose: onClose,
			size: 'fill',
		},
		el(
			'div',
			{
				className: `cnl-design-picker__layout${
					nav ? '' : ' has-no-nav'
				}`,
			},
			el(
				'header',
				{ className: 'cnl-design-picker__header' },
				el(
					'div',
					{ className: 'cnl-design-picker__heading' },
					el(
						Text,
						{
							className: 'cnl-design-picker__title',
							id: titleId,
							render: el( 'h2' ),
							variant: 'heading-xl',
						},
						title
					),
					subtitle &&
						el(
							Text,
							{
								className: 'cnl-design-picker__subtitle',
								render: el( 'p' ),
								variant: 'body-md',
							},
							subtitle
						),
					belowHeading
				),
				el(
					'div',
					{ className: 'cnl-design-picker__header-actions' },
					actions,
					el( Button, {
						icon: closeSmallIcon,
						label: __( 'Close' ),
						onClick: onClose,
					} )
				)
			),
			nav,
			el(
				'div',
				{
					className: [ 'cnl-design-picker__main', mainClassName ]
						.filter( Boolean )
						.join( ' ' ),
					ref: mainRef,
				},
				children
			)
		)
	);
}

/**
 * The list of kinds down the left.
 *
 * @param {Object}   props            Component props.
 * @param {string}   props.label      Accessible name of the list.
 * @param {Object[]} props.items      `{ value, label }` for each kind.
 * @param {string}   props.current    Value of the kind showing.
 * @param {boolean}  props.isDisabled Whether picking a kind is off.
 * @param {Function} props.onSelect   Called with the value picked.
 * @param {Element}  props.children   Shown instead of the items, such as
 *                                    while they load.
 * @return {Element} The list.
 */
export function DesignPickerNav( {
	label,
	items,
	current,
	isDisabled,
	onSelect,
	children,
} ) {
	return el(
		'nav',
		{
			'aria-label': label,
			className: `cnl-design-picker__nav${
				isDisabled ? ' is-disabled' : ''
			}`,
		},
		children ||
			el(
				'ul',
				{ className: 'cnl-design-picker__nav-list', role: 'list' },
				items.map( ( item ) =>
					el(
						'li',
						{ key: item.value },
						el(
							'button',
							{
								'aria-current':
									! isDisabled && current === item.value
										? 'true'
										: undefined,
								className: 'cnl-design-picker__nav-item',
								disabled: isDisabled,
								onClick: () => onSelect( item.value ),
								type: 'button',
							},
							item.label
						)
					)
				)
			)
	);
}

/**
 * The strip above the designs for starting with nothing.
 *
 * @param {Object}   props             Component props.
 * @param {string}   props.description What starting from scratch gives you.
 * @param {Function} props.onClick     Called when picked.
 * @return {Element} The strip.
 */
export function StartFromScratch( { description, onClick } ) {
	return el(
		'button',
		{
			className: 'cnl-design-picker__scratch',
			onClick,
			type: 'button',
		},
		el(
			'span',
			{
				'aria-hidden': true,
				className: 'cnl-design-picker__scratch-icon',
			},
			el( Icon, { icon: plusIcon } )
		),
		el(
			'span',
			{ className: 'cnl-design-picker__scratch-text' },
			el(
				'span',
				{ className: 'cnl-design-picker__scratch-title' },
				__( 'Start from scratch' )
			),
			el(
				'span',
				{ className: 'cnl-design-picker__scratch-description' },
				description
			)
		),
		el( Icon, {
			className: 'cnl-design-picker__scratch-chevron',
			icon:
				document.documentElement.dir === 'rtl'
					? chevronLeftIcon
					: chevronRightIcon,
		} )
	);
}

/**
 * A group's heading: its name, a few words on what it is for, and anything
 * that belongs on the right, such as paging.
 *
 * @param {Object}  props             Component props.
 * @param {string}  props.id          Element ID.
 * @param {string}  props.label       Group name.
 * @param {string}  props.description What the group is for.
 * @param {Element} props.children    Shown on the right.
 * @return {Element} The heading row.
 */
export function GroupHeading( { id, label, description, children } ) {
	const heading = el(
		'h3',
		{ className: 'cnl-design-picker__group-heading', id },
		el( 'span', { className: 'cnl-design-picker__group-label' }, label ),
		description &&
			el(
				'span',
				{ className: 'cnl-design-picker__group-description' },
				description
			)
	);

	if ( ! children ) {
		return heading;
	}

	return el(
		'div',
		{ className: 'cnl-design-picker__group-header' },
		heading,
		children
	);
}

/**
 * A grid shape drawn as an icon, for choosing how many designs show at once.
 * Drawn here rather than pulled from `@wordpress/icons` so every option shares
 * one stroke style and mirrors its own grid.
 *
 * @param {Object} props         Component props.
 * @param {number} props.columns Columns drawn.
 * @param {number} props.rows    Rows drawn.
 * @return {Element} The icon.
 */
export function GridShapeIcon( { columns, rows } ) {
	const gap = 1.8;
	const width = ( 14 - gap * ( columns - 1 ) ) / columns;
	const height = ( 14 - gap * ( rows - 1 ) ) / rows;
	const cells = [];

	for ( let row = 0; row < rows; row++ ) {
		for ( let column = 0; column < columns; column++ ) {
			cells.push( { column, row } );
		}
	}

	return el(
		'svg',
		{
			'aria-hidden': true,
			focusable: false,
			height: 24,
			stroke: 'currentColor',
			strokeWidth: 1.5,
			style: { fill: 'none' },
			viewBox: '0 0 24 24',
			width: 24,
			xmlns: 'http://www.w3.org/2000/svg',
		},
		cells.map( ( { column, row } ) =>
			el( 'rect', {
				height,
				key: `${ row }-${ column }`,
				rx: Math.min( 1.5, width / 3, height / 3 ),
				width,
				x: 5 + column * ( width + gap ),
				y: 5 + row * ( height + gap ),
			} )
		)
	);
}
