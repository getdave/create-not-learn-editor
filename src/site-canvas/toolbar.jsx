/**
 * The site canvas toolbar's controls: Browse or Edit, Compose, undo and redo
 * while editing, stepping through pages visited in Browse, the preview's
 * device, and the way out to the full-screen editor.
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
	coreDataStore,
	desktopIcon,
	displayShortcut,
	externalIcon,
	fullscreenIcon,
	isRTL,
	mobileIcon,
	DropdownMenu,
	MenuGroup,
	MenuItem,
	moreVerticalIcon,
	redoIcon,
	ToggleGroupControl,
	ToggleGroupControlOption,
	ToggleGroupControlOptionIcon,
	undoIcon,
	useDispatch,
	useSelect,
} from '../wordpress-packages';
import { zoomOutIcon } from './icons';
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
	return (
		<ToggleGroupControl
			__nextHasNoMarginBottom
			className="cnl-site-canvas__mode-toggle"
			hideLabelFromVision
			label={ __( 'Mode' ) }
			onChange={ onChange }
			value={ mode === MODE_BROWSE ? MODE_BROWSE : MODE_EDIT }
		>
			{ /* A word or two on what each does, beyond its name. */ }
			<ComponentsTooltip
				placement="bottom"
				text={ __( 'View your site' ) }
			>
				<ToggleGroupControlOption
					label={ __( 'Browse' ) }
					value={ MODE_BROWSE }
				/>
			</ComponentsTooltip>
			<ComponentsTooltip
				placement="bottom"
				text={ __( 'Change this page' ) }
			>
				<ToggleGroupControlOption
					disabled={ ! canEdit }
					label={ __( 'Edit' ) }
					value={ MODE_EDIT }
				/>
			</ComponentsTooltip>
		</ToggleGroupControl>
	);
}

/**
 * Step back from the page to work on its sections, and back again. Offered
 * while editing. Named for what it does to the page, Compose being our word
 * for it, not one people would look for.
 *
 * @param {Object}   props
 * @param {boolean}  props.isComposing Whether Compose is on.
 * @param {Function} props.onToggle    Turns Compose on or off.
 * @return {Element} The button.
 */
export function ComposeButton( { isComposing, onToggle } ) {
	return (
		<ComponentsTooltip placement="bottom" text={ __( 'Arrange sections' ) }>
			<Button
				__next40pxDefaultSize
				className="cnl-site-canvas__compose-button"
				icon={ zoomOutIcon }
				isPressed={ isComposing }
				onClick={ onToggle }
			>
				{ __( 'Zoom out' ) }
			</Button>
		</ComponentsTooltip>
	);
}

/**
 * Undo and redo, as in the editor's own header. The history is core's, so
 * changes made in Edit and in Compose are stepped through alike.
 *
 * @return {Element} The buttons.
 */
export function EditHistory() {
	const { hasRedo, hasUndo } = useSelect(
		( select ) => ( {
			hasRedo: select( coreDataStore ).hasRedo(),
			hasUndo: select( coreDataStore ).hasUndo(),
		} ),
		[]
	);
	const { redo, undo } = useDispatch( coreDataStore );

	return (
		<HistoryGroup
			label={ __( 'Edit history' ) }
			back={ {
				disabled: ! hasUndo,
				icon: isRTL() ? redoIcon : undoIcon,
				label: __( 'Undo' ),
				onClick: undo,
				shortcut: displayShortcut.primary( 'z' ),
			} }
			forward={ {
				disabled: ! hasRedo,
				icon: isRTL() ? undoIcon : redoIcon,
				label: __( 'Redo' ),
				onClick: redo,
				shortcut: displayShortcut.primaryShift( 'z' ),
			} }
		/>
	);
}

export function DeviceSwitcher( { device, onChange } ) {
	return (
		<div className="cnl-editor-preview-canvas__device-switcher cnl-editor-homepage-device-switcher">
			<ToggleGroupControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				className="cnl-editor-homepage-device-switcher__control"
				hideLabelFromVision
				label={ __( 'Preview device' ) }
				onChange={ onChange }
				value={ device }
			>
				{ getDeviceOptions().map( ( option ) => (
					<ToggleGroupControlOptionIcon
						icon={ option.icon }
						key={ option.value }
						label={ option.label }
						value={ option.value }
					/>
				) ) }
			</ToggleGroupControl>
		</div>
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
	return (
		<DropdownMenu
			className="cnl-site-canvas__more-menu"
			icon={ moreVerticalIcon }
			label={ __( 'More options' ) }
			popoverProps={ { placement: 'bottom-end' } }
			toggleProps={ {
				className: 'cnl-site-canvas__more-menu-toggle',
				showTooltip: true,
			} }
		>
			{ ( { onClose } ) => (
				<MenuGroup>
					<MenuItem
						disabled={ ! onOpenEditor }
						icon={ fullscreenIcon }
						onClick={ () => {
							onClose();
							onOpenEditor();
						} }
					>
						{ __( 'Open in full editor' ) }
					</MenuItem>
					<MenuItem
						disabled={ ! liveUrl }
						href={ liveUrl || undefined }
						icon={ externalIcon }
						onClick={ onClose }
						rel="noreferrer"
						target="_blank"
					>
						{ __( 'Open in a new tab' ) }
					</MenuItem>
				</MenuGroup>
			) }
		</DropdownMenu>
	);
}

function HistoryGroup( { label, back, forward } ) {
	return (
		<div
			aria-label={ label }
			className="cnl-editor-homepage-toolbar__history"
			role="group"
		>
			{ [ back, forward ].map( ( button ) => (
				<Button
					accessibleWhenDisabled
					className="cnl-editor-homepage-toolbar__history-button"
					disabled={ button.disabled }
					icon={ button.icon }
					key={ button.label }
					label={ button.label }
					onClick={ button.onClick }
					shortcut={ button.shortcut }
					showTooltip
					variant="tertiary"
				/>
			) ) }
		</div>
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
	return (
		<HistoryGroup
			label={ __( 'Preview history' ) }
			back={ {
				disabled: ! history.canGoBack,
				icon: chevronLeftIcon,
				label: __( 'Back in preview' ),
				onClick: () => onMove( 'back' ),
			} }
			forward={ {
				disabled: ! history.canGoForward,
				icon: chevronRightIcon,
				label: __( 'Forward in preview' ),
				onClick: () => onMove( 'forward' ),
			} }
		/>
	);
}
