/**
 * WordPress dependencies
 */
import { Editor as LazyEditor } from '@wordpress/lazy-editor';

/**
 * Internal dependencies
 */
import { el, Notice, __ } from '../../wordpress-packages';

const SITE_PREVIEW_EDITOR_SETTINGS = { isPreviewMode: true };

/**
 * The site's front page in the editor canvas, as a read-only preview.
 *
 * Passing no post leaves the editor to resolve whatever is set to show at the
 * site's root, and to compose it with the template that renders it, so a menu
 * appears in the header or footer it was assigned to.
 *
 * @param {Object} props          Component props.
 * @param {string} [props.device] Device type the canvas opens at.
 * @return {Element} The preview canvas.
 */
export function NavigationSitePreview( { device } = {} ) {
	return el(
		'div',
		{
			className: 'routes-navigation-canvas__preview',
			// Nothing in a preview is reachable by pointer or keyboard.
			inert: 'true',
		},
		el( LazyEditor, {
			initialViewport: device,
			settings: SITE_PREVIEW_EDITOR_SETTINGS,
		} )
	);
}

export function NavigationSitePreviewNotice( { onChooseLocation } ) {
	return el(
		Notice,
		{
			actions: [
				{
					label: __( 'Choose location' ),
					onClick: onChooseLocation,
					variant: 'link',
				},
			],
			className: 'cnl-editor-preview-canvas__notice',
			isDismissible: false,
			status: 'warning',
		},
		__(
			'This menu is not shown anywhere on your site yet, so it does not appear in the preview.'
		)
	);
}
