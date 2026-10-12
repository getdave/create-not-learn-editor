/**
 * The site canvas toolbar's controls: the canvas's mode, stepping through
 * pages visited in Browse, the preview's device, and the way out to the
 * full-screen editor.
 */

/**
 * Internal dependencies
 */
import {
	__,
	Button,
	checkIcon,
	chevronDownIcon,
	chevronLeftIcon,
	chevronRightIcon,
	desktopIcon,
	el,
	externalIcon,
	fullscreenIcon,
	LegacyIcon,
	mobileIcon,
	DropdownMenu,
	MenuGroup,
	MenuItem,
	moreVerticalIcon,
	pencilIcon,
	sprintf,
	ToggleGroupControl,
	ToggleGroupControlOptionIcon,
} from '../wordpress-packages';
import { browseIcon, composeIcon } from './icons';
import { MODE_BROWSE, MODE_COMPOSE, MODE_EDIT } from './mode';

function getDeviceOptions() {
	return [
		{ icon: desktopIcon, label: __( 'Desktop view' ), value: 'desktop' },
		{ icon: mobileIcon, label: __( 'Mobile view' ), value: 'mobile' },
	];
}

function getModes() {
	return [
		{
			description: __( 'See your site as visitors do.' ),
			icon: browseIcon,
			label: __( 'Browse' ),
			value: MODE_BROWSE,
		},
		{
			description: __( 'Change anything on the page.' ),
			icon: pencilIcon,
			label: __( 'Edit' ),
			value: MODE_EDIT,
		},
		{
			description: __( 'Step back to add, move and style sections.' ),
			icon: composeIcon,
			label: __( 'Compose' ),
			value: MODE_COMPOSE,
		},
	];
}

/**
 * Pick the canvas's mode: Browse, Edit or Compose.
 *
 * Controlled, so a switch the canvas holds back, to ask about unsaved changes
 * first, leaves it where it was.
 *
 * @param {Object}   props
 * @param {boolean}  props.canEdit  Whether what is on show can be edited, and
 *                                  so whether Edit and Compose are offered.
 * @param {string}   props.mode     The current mode.
 * @param {Function} props.onChange Called with the mode picked.
 * @return {Element} The menu.
 */
export function ModeMenu( { canEdit, mode, onChange } ) {
	const modes = getModes();
	const current = modes.find( ( option ) => option.value === mode );

	return el(
		DropdownMenu,
		{
			className: 'cnl-site-canvas__mode-menu',
			// The toggle says the mode in words; icons are for the menu.
			icon: null,
			label: sprintf(
				/* translators: %s: the canvas's current mode, like Browse. */
				__( 'Mode: %s' ),
				current.label
			),
			popoverProps: { placement: 'bottom-start' },
			text: current.label,
			toggleProps: {
				__next40pxDefaultSize: true,
				children: el( LegacyIcon, {
					className: 'cnl-site-canvas__mode-chevron',
					icon: chevronDownIcon,
					size: 18,
				} ),
				className: 'cnl-site-canvas__mode-toggle',
				showTooltip: false,
				variant: 'secondary',
			},
		},
		( { onClose } ) =>
			el(
				MenuGroup,
				null,
				modes.map( ( option ) =>
					el(
						MenuItem,
						{
							disabled: option.value !== MODE_BROWSE && ! canEdit,
							icon: option.icon,
							iconPosition: 'left',
							info: option.description,
							isSelected: option.value === mode,
							key: option.value,
							onClick: () => {
								onClose();
								onChange( option.value );
							},
							role: 'menuitemradio',
							suffix:
								option.value === mode &&
								el( LegacyIcon, { icon: checkIcon } ),
						},
						option.label
					)
				)
			)
	);
}

/**
 * Open the page on show in the full-screen editor. Offered in Edit only, as
 * a way out for changes the canvas doesn't suit.
 *
 * @param {Object}   props
 * @param {Function} props.onOpen Opens the full-screen editor.
 * @return {Element} The button.
 */
export function FullEditorButton( { onOpen } ) {
	return el( Button, {
		__next40pxDefaultSize: true,
		className: 'cnl-site-canvas__full-editor-button',
		icon: fullscreenIcon,
		label: __( 'Open in full editor' ),
		onClick: onOpen,
		showTooltip: true,
	} );
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
 * @param {Object} props
 * @param {string} props.liveUrl The live site's URL, to open in a new tab.
 *                               Empty when there isn't one.
 * @return {Element} The menu.
 */
export function CanvasMoreMenu( { liveUrl } ) {
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
