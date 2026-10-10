/**
 * The site canvas toolbar's controls: switching between Preview and Edit,
 * stepping through pages visited in Preview, the preview's device, and the
 * way out to the full-screen editor.
 */

/**
 * Internal dependencies
 */
import {
	__,
	Button,
	chevronLeftIcon,
	chevronRightIcon,
	desktopIcon,
	drawerLeftIcon,
	el,
	fullscreenIcon,
	mobileIcon,
	tabletIcon,
	ToggleGroupControlOption,
	ToggleGroupControl,
	ToggleGroupControlOptionIcon,
} from '../wordpress-packages';
import { SURFACE_EDIT, SURFACE_PREVIEW } from './constants';

function getDeviceOptions() {
	return [
		{ icon: desktopIcon, label: __( 'Desktop view' ), value: 'desktop' },
		{ icon: tabletIcon, label: __( 'Tablet view' ), value: 'tablet' },
		{ icon: mobileIcon, label: __( 'Mobile view' ), value: 'mobile' },
	];
}

/**
 * Show the stage beside Edit, or hide it again so Edit has its room.
 *
 * @param {Object}   props
 * @param {boolean}  props.isShown  Whether the stage is on show.
 * @param {Function} props.onToggle Shows or hides the stage.
 * @return {Element} The toggle.
 */
export function StageToggle( { isShown, onToggle } ) {
	return el( Button, {
		'aria-expanded': isShown,
		className: 'cnl-site-canvas__stage-toggle',
		icon: drawerLeftIcon,
		isPressed: isShown,
		label: isShown ? __( 'Hide panel' ) : __( 'Show panel' ),
		onClick: onToggle,
		showTooltip: true,
		size: 'compact',
	} );
}

/**
 * Switch the canvas between Preview, the saved site as visitors see it, and
 * Edit, where the page can be changed in place.
 *
 * A segmented control, outlined as a block so the two options read as one
 * control and the selected one stands out. Controlled, so a switch the canvas
 * holds back, to ask about unsaved changes first, leaves it where it was.
 *
 * @param {Object}   props
 * @param {boolean}  props.canEdit  Whether what is on show can be edited.
 * @param {string}   props.surface  `SURFACE_PREVIEW` or `SURFACE_EDIT`.
 * @param {Function} props.onChange Called with the surface asked for.
 * @return {Element} The toggle.
 */
export function SurfaceToggle( { canEdit, surface, onChange } ) {
	return el(
		'div',
		{ className: 'cnl-site-canvas__surface-toggle' },
		el(
			ToggleGroupControl,
			{
				__next40pxDefaultSize: true,
				__nextHasNoMarginBottom: true,
				hideLabelFromVision: true,
				isBlock: true,
				label: __( 'Mode' ),
				onChange,
				value: surface,
			},
			el( ToggleGroupControlOption, {
				label: __( 'Preview' ),
				value: SURFACE_PREVIEW,
			} ),
			el( ToggleGroupControlOption, {
				disabled: ! canEdit,
				label: __( 'Edit' ),
				value: SURFACE_EDIT,
			} )
		)
	);
}

export function DeviceSwitcher( { device, onChange } ) {
	return el(
		'div',
		{
			className:
				'cnl-editor-preview-canvas__device-switcher cnl-editor-homepage-device-switcher',
		},
		el(
			ToggleGroupControl,
			{
				__next40pxDefaultSize: true,
				__nextHasNoMarginBottom: true,
				className: 'cnl-editor-homepage-device-switcher__control',
				hideLabelFromVision: true,
				label: __( 'Preview device' ),
				onChange,
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
	);
}

/**
 * Open what is on the canvas in the full-screen editor.
 *
 * @param {Object}   props
 * @param {boolean}  props.disabled Whether there is nothing to open.
 * @param {Function} props.onClick  Opens the editor.
 * @return {Element} The button.
 */
export function FullEditorButton( { disabled, onClick } ) {
	return el( Button, {
		accessibleWhenDisabled: true,
		className: 'cnl-site-canvas__full-editor-button',
		disabled,
		icon: fullscreenIcon,
		label: __( 'Edit in full screen' ),
		onClick,
		showTooltip: true,
		variant: 'tertiary',
	} );
}

function HistoryGroup( { label, back, forward } ) {
	return el(
		'div',
		{
			'aria-label': label,
			className: 'cnl-editor-homepage-toolbar__history',
			role: 'group',
		},
		[ back, forward ].map( ( button ) =>
			el( Button, {
				accessibleWhenDisabled: true,
				className: 'cnl-editor-homepage-toolbar__history-button',
				disabled: button.disabled,
				icon: button.icon,
				key: button.label,
				label: button.label,
				onClick: button.onClick,
				showTooltip: true,
				variant: 'tertiary',
			} )
		)
	);
}

/**
 * Step back and forward through the pages visited in the preview.
 *
 * @param {Object}   props
 * @param {Object}   props.history `{ canGoBack, canGoForward }`.
 * @param {Function} props.onMove  Called with `back` or `forward`.
 * @return {Element} The buttons.
 */
export function PreviewHistory( { history, onMove } ) {
	return el( HistoryGroup, {
		label: __( 'Preview history' ),
		back: {
			disabled: ! history.canGoBack,
			icon: chevronLeftIcon,
			label: __( 'Back in preview' ),
			onClick: () => onMove( 'back' ),
		},
		forward: {
			disabled: ! history.canGoForward,
			icon: chevronRightIcon,
			label: __( 'Forward in preview' ),
			onClick: () => onMove( 'forward' ),
		},
	} );
}
