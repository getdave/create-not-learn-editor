/**
 * Save controls: how many changes are waiting, and a way to review them.
 *
 * Changes made across the editor are held back until the user saves them,
 * so this says how many are waiting, with Review changes to open the review,
 * where they are saved or discarded. It replaces boot's save button
 * at the foot of the sidebar, which `style.scss` hides wherever the top bar
 * is shown.
 */

/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import {
	createElement as el,
	useCallback,
	useEffect,
	useState,
} from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { check } from '@wordpress/icons';
import { displayShortcut, rawShortcut } from '@wordpress/keycodes';
import { Icon } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { ReviewChanges } from './review-changes';
import { useChanges } from './use-changes';

export function SaveControls() {
	const [ isReviewOpen, setIsReviewOpen ] = useState( false );
	const [ hasSaved, setHasSaved ] = useState( false );
	const { changes, isSaving } = useChanges();
	const changeCount = changes.length;
	const hasChanges = changeCount > 0;
	const closeReview = useCallback( () => setIsReviewOpen( false ), [] );

	/*
	 * "All changes saved" is shown once a save has cleared every change, and
	 * stays until something new is changed. A save that fails leaves the
	 * changes in place, so the bar goes back to counting them.
	 */
	useEffect( () => {
		if ( isSaving ) {
			setHasSaved( true );
		} else if ( hasChanges ) {
			setHasSaved( false );
		}
	}, [ isSaving, hasChanges ] );

	let status = null;

	if ( hasChanges ) {
		status = el(
			'span',
			{ className: 'cnl-save-controls__changes' },
			el( 'span', {
				className: 'cnl-save-controls__indicator',
				'aria-hidden': true,
			} ),
			sprintf(
				/* translators: %d: Number of changes waiting to be saved. */
				_n( '%d unsaved change', '%d unsaved changes', changeCount ),
				changeCount
			)
		);
	} else if ( hasSaved ) {
		status = el(
			'span',
			{ className: 'cnl-save-controls__saved' },
			el( Icon, { icon: check, size: 20 } ),
			__( 'All changes saved' )
		);
	}

	return el(
		'div',
		{ className: 'cnl-save-controls' },
		el(
			'div',
			{ className: 'cnl-save-controls__status', role: 'status' },
			status
		),
		hasChanges &&
			el(
				Button,
				{
					variant: 'primary',
					size: 'compact',
					className: 'cnl-save-controls__button',
					onClick: () => setIsReviewOpen( true ),
					disabled: isSaving,
					accessibleWhenDisabled: true,
					isBusy: isSaving,
					shortcut: displayShortcut.primary( 's' ),
					'aria-keyshortcuts': rawShortcut.primary( 's' ),
				},
				isSaving ? __( 'Saving…' ) : __( 'Review changes' )
			),
		isReviewOpen && el( ReviewChanges, { onClose: closeReview } )
	);
}
