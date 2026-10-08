/**
 * Asked before going from Edit to Preview with unsaved changes.
 *
 * The preview shows the saved site, so going back to it with changes waiting
 * would show the page without them, and read as the changes having been lost.
 * This makes the choice explicit: save, or discard. Copied from Big Sky's Easy
 * Mode.
 *
 * Not a `ConfirmDialog`: that puts Cancel on the left and its confirm on the
 * right, and both dismiss. Here the left button is itself destructive, so the
 * two are ordinary buttons and only the modal's own close (Escape, the X, the
 * overlay) means "stay and keep editing".
 */

/**
 * Internal dependencies
 */
import { __, Button, el, Modal } from '../wordpress-packages';

export function UnsavedChangesDialog( {
	isSaving,
	onCancel,
	onDiscard,
	onSave,
} ) {
	return el(
		Modal,
		{
			className: 'cnl-site-canvas__unsaved-dialog',
			onRequestClose: onCancel,
			// Dismissing stays available while saving, so a save that hangs
			// doesn't trap the user in the dialog.
			shouldCloseOnClickOutside: true,
			size: 'small',
			title: __( 'Save your changes?' ),
		},
		el(
			'p',
			{ className: 'cnl-site-canvas__unsaved-dialog-description' },
			__(
				'The preview shows your saved site, so unsaved changes won’t appear there.'
			)
		),
		el(
			'div',
			{ className: 'cnl-site-canvas__unsaved-dialog-actions' },
			el(
				Button,
				{
					accessibleWhenDisabled: true,
					disabled: isSaving,
					onClick: onDiscard,
					variant: 'secondary',
				},
				__( 'Discard' )
			),
			el(
				Button,
				{
					accessibleWhenDisabled: true,
					disabled: isSaving,
					isBusy: isSaving,
					onClick: onSave,
					variant: 'primary',
				},
				__( 'Save' )
			)
		)
	);
}
