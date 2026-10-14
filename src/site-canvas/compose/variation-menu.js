/**
 * A dropdown of a section's variations, each drawn as it would look, for
 * Compose's section toolbar: its layouts, its colours, or a header's designs.
 */

/**
 * WordPress dependencies
 */
import { BlockPreview } from '@wordpress/block-editor';
import { ToolbarItem } from '@wordpress/components';

/**
 * Internal dependencies
 */
import {
	Button,
	checkIcon,
	Dropdown,
	el,
	LegacyIcon,
} from '../../wordpress-packages';

/**
 * @param {Object}   props
 * @param {Object}   props.option    `{ blocks, label, name }`.
 * @param {boolean}  props.isCurrent Whether the section has it now.
 * @param {Function} props.onSelect  Called when picked.
 * @return {Element} The option.
 */
function VariationOption( { option, isCurrent, onSelect } ) {
	return el(
		'button',
		{
			'aria-pressed': isCurrent,
			className: `cnl-compose-variations__option${
				isCurrent ? ' is-current' : ''
			}`,
			onClick: onSelect,
			type: 'button',
		},
		el(
			'span',
			{
				className: 'cnl-compose-variations__preview',
				'aria-hidden': true,
			},
			el(
				BlockPreview.Async,
				null,
				el( BlockPreview, {
					blocks: option.blocks,
					viewportWidth: 1200,
				} )
			)
		),
		el(
			'span',
			{ className: 'cnl-compose-variations__label' },
			option.label,
			isCurrent &&
				el( LegacyIcon, {
					className: 'cnl-compose-variations__check',
					icon: checkIcon,
					size: 20,
				} )
		)
	);
}

/**
 * @param {Object}   props
 * @param {Object}   props.icon     The toggle's icon.
 * @param {string}   props.label    What is being picked, like "Layout", for
 *                                  the toggle's tooltip.
 * @param {Object[]} props.options  `{ blocks, label, name }` for each
 *                                  variation, `blocks` being how it looks.
 * @param {?string}  props.current  The variation the section has now.
 * @param {Function} props.onSelect Called with the variation picked.
 * @return {Element} The dropdown, as an item of a toolbar.
 */
export function VariationMenu( { icon, label, options, current, onSelect } ) {
	return el( ToolbarItem, null, ( toggleProps ) =>
		el( Dropdown, {
			className: 'cnl-compose-variations',
			contentClassName: 'cnl-compose-variations__content',
			popoverProps: { placement: 'bottom-start' },
			renderToggle: ( { isOpen, onToggle } ) =>
				el( Button, {
					...toggleProps,
					'aria-expanded': isOpen,
					'aria-haspopup': 'true',
					icon,
					label,
					onClick: onToggle,
					showTooltip: true,
				} ),
			renderContent: ( { onClose } ) =>
				el(
					'div',
					{
						'aria-label': label,
						className: 'cnl-compose-variations__list',
						role: 'group',
					},
					options.map( ( option ) =>
						el( VariationOption, {
							isCurrent: option.name === current,
							key: option.name ?? 'none',
							onSelect: () => {
								onClose();

								if ( option.name !== current ) {
									onSelect( option );
								}
							},
							option,
						} )
					)
				),
		} )
	);
}
