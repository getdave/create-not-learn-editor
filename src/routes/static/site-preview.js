/**
 * WordPress dependencies
 */
import { Editor as LazyEditor } from '@wordpress/lazy-editor';

/**
 * Internal dependencies
 */
import {
	ToggleGroupControl,
	ToggleGroupControlOptionIcon,
	__,
	desktopIcon,
	el,
	mobileIcon,
	tabletIcon,
	useState,
} from '../../wordpress-packages';

const SITE_PREVIEW_EDITOR_SETTINGS = { isPreviewMode: true };

function getDeviceOptions() {
	return [
		{ icon: desktopIcon, label: __( 'Desktop view' ), value: 'Desktop' },
		{ icon: tabletIcon, label: __( 'Tablet view' ), value: 'Tablet' },
		{ icon: mobileIcon, label: __( 'Mobile view' ), value: 'Mobile' },
	];
}

/**
 * The site's front page rendered by the block editor, read-only.
 *
 * Unlike an iframe of the live site, this reads unsaved edits from the
 * editor's data store, so changes to styles, the site name, or the logo show
 * up before they are saved.
 *
 * @param {Object} props             Component props.
 * @param {string} props.title       Canvas heading.
 * @param {string} props.description Text under the heading.
 * @return {Element} The preview canvas.
 */
export default function SitePreviewCanvas( { description, title } ) {
	const [ device, setDevice ] = useState( 'Desktop' );

	return el(
		'section',
		{ className: 'cnl-editor-canvas routes-navigation-canvas' },
		el(
			'header',
			{
				className:
					'cnl-editor-canvas__toolbar routes-navigation-canvas-toolbar',
			},
			el(
				'div',
				{ className: 'routes-navigation-canvas-toolbar__document' },
				el(
					'h2',
					{ className: 'routes-navigation-canvas-toolbar__title' },
					title
				),
				description &&
					el(
						'p',
						{ className: 'routes-navigation-canvas-toolbar__meta' },
						description
					)
			),
			el(
				'div',
				{ className: 'routes-navigation-canvas-toolbar__actions' },
				el(
					ToggleGroupControl,
					{
						__next40pxDefaultSize: true,
						__nextHasNoMarginBottom: true,
						hideLabelFromVision: true,
						label: __( 'Preview device' ),
						onChange: setDevice,
						value: device,
					},
					getDeviceOptions().map( ( option ) =>
						el( ToggleGroupControlOptionIcon, {
							icon: option.icon,
							key: option.value,
							label: option.label,
							value: option.value,
						} )
					)
				)
			)
		),
		el(
			'div',
			{
				className: 'routes-navigation-canvas__preview',
				// Nothing in a preview is reachable by pointer or keyboard.
				inert: 'true',
			},
			el( LazyEditor, {
				initialViewport: device,
				key: device,
				settings: SITE_PREVIEW_EDITOR_SETTINGS,
			} )
		)
	);
}
