/**
 * The site canvas toolbar's controls: Browse or Edit, Compose, stepping through
 * pages visited in Browse, the preview's device, and the way out to the
 * full-screen editor.
 */

/**
 * WordPress dependencies
 */
import { Tooltip as ComponentsTooltip } from '@wordpress/components';

/**
 * Internal dependencies
 */
import {
	__,
	Button,
	chevronLeftIcon,
	chevronRightIcon,
	desktopIcon,
	el,
	externalIcon,
	fullscreenIcon,
	mobileIcon,
	DropdownMenu,
	MenuGroup,
	MenuItem,
	moreVerticalIcon,
	squareIcon,
	ToggleGroupControl,
	ToggleGroupControlOption,
	ToggleGroupControlOptionIcon,
} from '../wordpress-packages';
import { MODE_BROWSE, MODE_EDIT } from './mode';

function getDeviceOptions() {
	return [
		{ icon: desktopIcon, label: __( 'Desktop view' ), value: 'desktop' },
		{ icon: mobileIcon, label: __( 'Mobile view' ), value: 'mobile' },
	];
}

/**
 * Look at the site or change it: Browse or Edit.
 *
 * Compose is editing from further away, so it isn't a choice here; while it
 * is on, the toggle stays on Edit. Controlled, so a switch the canvas holds
 * back, to ask about unsaved changes first, leaves it where it was.
 *
 * @param {Object}   props
 * @param {boolean}  props.canEdit  Whether what is on show can be edited.
 * @param {string}   props.mode     The current mode.
 * @param {Function} props.onChange Called with the mode picked.
 * @return {Element} The toggle.
 */
export function ModeToggle( { canEdit, mode, onChange } ) {
	return el(
		ToggleGroupControl,
		{
			__nextHasNoMarginBottom: true,
			className: 'cnl-site-canvas__mode-toggle',
			hideLabelFromVision: true,
			label: __( 'Mode' ),
			onChange,
			value: mode === MODE_BROWSE ? MODE_BROWSE : MODE_EDIT,
		},
		// A word or two on what each does, beyond its name.
		el(
			ComponentsTooltip,
			{ placement: 'bottom', text: __( 'View your site' ) },
			el( ToggleGroupControlOption, {
				label: __( 'Browse' ),
				value: MODE_BROWSE,
			} )
		),
		el(
			ComponentsTooltip,
			{ placement: 'bottom', text: __( 'Change this page' ) },
			el( ToggleGroupControlOption, {
				disabled: ! canEdit,
				label: __( 'Edit' ),
				value: MODE_EDIT,
			} )
		)
	);
}

/**
 * Step back from the page to work on its sections, and back again. Offered
 * while editing.
 *
 * @param {Object}   props
 * @param {boolean}  props.isComposing Whether Compose is on.
 * @param {Function} props.onToggle    Turns Compose on or off.
 * @return {Element} The button.
 */
export function ComposeButton( { isComposing, onToggle } ) {
	return el(
		ComponentsTooltip,
		{ placement: 'bottom', text: __( 'Arrange sections' ) },
		el( Button, {
			__next40pxDefaultSize: true,
			className: 'cnl-site-canvas__compose-button',
			// The editor's own zoom-out icon, for what is a zoomed-out view.
			icon: squareIcon,
			isPressed: isComposing,
			label: __( 'Compose' ),
			onClick: onToggle,
			// The short hint above takes the tooltip's place.
			showTooltip: false,
		} )
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
 * Less common ways to view the canvas, tucked behind a menu so the toolbar's
 * everyday controls keep the room.
 *
 * @param {Object}    props
 * @param {string}    props.liveUrl      The live site's URL, to open in a new
 *                                       tab. Empty when there isn't one.
 * @param {?Function} props.onOpenEditor Opens the page on show in the
 *                                       full-screen editor, for changes the
 *                                       canvas doesn't suit. Missing when
 *                                       there is nothing to open.
 * @return {Element} The menu.
 */
export function CanvasMoreMenu( { liveUrl, onOpenEditor } ) {
	return el(
		DropdownMenu,
		{
			className: 'cnl-site-canvas__more-menu',
			icon: moreVerticalIcon,
			label: __( 'More options' ),
			popoverProps: { placement: 'bottom-end' },
			toggleProps: {
				className: 'cnl-site-canvas__more-menu-toggle',
				showTooltip: true,
			},
		},
		( { onClose } ) =>
			el(
				MenuGroup,
				null,
				el(
					MenuItem,
					{
						disabled: ! onOpenEditor,
						icon: fullscreenIcon,
						onClick: () => {
							onClose();
							onOpenEditor();
						},
					},
					__( 'Open in full editor' )
				),
				el(
					MenuItem,
					{
						disabled: ! liveUrl,
						href: liveUrl || undefined,
						icon: externalIcon,
						onClick: onClose,
						rel: 'noreferrer',
						target: '_blank',
					},
					__( 'Open in a new tab' )
				)
			)
	);
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
