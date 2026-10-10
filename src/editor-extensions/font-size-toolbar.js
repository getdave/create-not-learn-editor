/**
 * A font size dropdown in the block toolbar of text blocks.
 *
 * Core only offers font sizes in the block inspector, a panel away from the
 * text being changed. This puts the theme's preset sizes in the toolbar beside
 * it, by name. Custom sizes stay in the inspector, for editing in more detail.
 *
 * It writes the same attributes as core's own font size control, so the two
 * stay in step. Like core's style controls, it is offered only where the block
 * can be styled, so not in content-only or locked blocks.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * for the same reason as `template-part-editing.js`.
 */

/**
 * WordPress dependencies
 */
import {
	BlockControls,
	useBlockEditingMode,
	useSettings,
} from '@wordpress/block-editor';
import { hasBlockSupport } from '@wordpress/blocks';
import {
	MenuGroup,
	MenuItem,
	ToolbarDropdownMenu,
} from '@wordpress/components';
import { createElement as el, Fragment } from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';
import { typography } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import {
	getActiveFontSizeSlug,
	getFontSizeAttributes,
	getFontSizeHint,
	TEXT_BLOCKS,
} from './font-size-details';

/**
 * The toolbar's font size dropdown.
 *
 * @param {Object}   props               Component props.
 * @param {Object}   props.attributes    Block attributes.
 * @param {Function} props.setAttributes Block attribute setter.
 * @return {?Element} The dropdown.
 */
function FontSizeToolbar( { attributes, setAttributes } ) {
	const [ fontSizes ] = useSettings( 'typography.fontSizes' );
	const blockEditingMode = useBlockEditingMode();

	if ( blockEditingMode !== 'default' || ! fontSizes?.length ) {
		return null;
	}

	const activeSlug = getActiveFontSizeSlug( fontSizes, attributes );
	const choose = ( slug ) =>
		setAttributes( getFontSizeAttributes( attributes, slug ) );

	const choices = [
		{
			key: 'default',
			label: __( 'Default' ),
			isSelected:
				! activeSlug && ! attributes.style?.typography?.fontSize,
			slug: null,
		},
		...fontSizes.map( ( fontSize ) => ( {
			key: fontSize.slug,
			label: fontSize.name || fontSize.slug,
			hint: getFontSizeHint( fontSize ),
			isSelected: fontSize.slug === activeSlug,
			slug: fontSize.slug,
		} ) ),
	];

	return el(
		BlockControls,
		{ group: 'block' },
		el(
			ToolbarDropdownMenu,
			{ icon: typography, label: __( 'Font size' ) },
			( { onClose } ) =>
				el(
					MenuGroup,
					null,
					choices.map( ( { key, label, hint, isSelected, slug } ) =>
						el(
							MenuItem,
							{
								key,
								role: 'menuitemradio',
								isSelected,
								suffix:
									hint &&
									el(
										'span',
										{ className: 'cnl-font-size-hint' },
										hint
									),
								onClick: () => {
									choose( slug );
									onClose();
								},
							},
							label
						)
					)
				)
		)
	);
}

function withFontSizeToolbar( BlockEdit ) {
	return function FontSizeToolbarBlockEdit( props ) {
		if (
			! props.isSelected ||
			! TEXT_BLOCKS.has( props.name ) ||
			! hasBlockSupport( props.name, 'typography.fontSize' )
		) {
			return el( BlockEdit, props );
		}

		return el(
			Fragment,
			null,
			el( BlockEdit, props ),
			el( FontSizeToolbar, {
				attributes: props.attributes,
				setAttributes: props.setAttributes,
			} )
		);
	};
}

/**
 * Register the font size toolbar with the editor.
 */
export function registerFontSizeToolbar() {
	addFilter(
		'editor.BlockEdit',
		'create-not-learn-editor/font-size-toolbar',
		withFontSizeToolbar
	);
}
