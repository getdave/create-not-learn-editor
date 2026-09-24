/**
 * Save controls: how many changes are waiting, and one button to save them.
 *
 * Changes made across the editor are held back until the user saves them,
 * so this says how many are waiting and offers a single Save changes button.
 * The button opens a review of every waiting change, where the user picks
 * which ones to save. It replaces boot's save button at the foot of the
 * sidebar, which `style.scss` hides wherever the top bar is shown.
 */

/**
 * WordPress dependencies
 */
import { Button, Modal } from '@wordpress/components';
import { store as coreStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import {
	EntitiesSavedStates,
	useEntitiesSavedStatesIsDirty,
} from '@wordpress/editor';
import { createElement as el, useEffect, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { check } from '@wordpress/icons';
import { displayShortcut, rawShortcut } from '@wordpress/keycodes';
import { Icon } from '@wordpress/ui';

export function SaveControls() {
	const [ isReviewOpen, setIsReviewOpen ] = useState( false );
	const [ hasSaved, setHasSaved ] = useState( false );
	/*
	 * Counted the way the review counts them, so the two agree: each edited
	 * site setting is a change of its own, and every other record is one.
	 */
	const changeCount =
		useEntitiesSavedStatesIsDirty().dirtyEntityRecords.length;
	const isSaving = useSelect( ( select ) => {
		const { __experimentalGetDirtyEntityRecords, isSavingEntityRecord } =
			select( coreStore );

		return __experimentalGetDirtyEntityRecords().some(
			( { kind, name, key } ) => isSavingEntityRecord( kind, name, key )
		);
	}, [] );
	const hasChanges = changeCount > 0;

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
				isSaving ? __( 'Saving…' ) : __( 'Save changes' )
			),
		isReviewOpen &&
			el(
				Modal,
				{
					title: __( 'Save changes' ),
					onRequestClose: () => setIsReviewOpen( false ),
					size: 'small',
				},
				el( EntitiesSavedStates, {
					close: () => setIsReviewOpen( false ),
					variant: 'inline',
				} )
			)
	);
}
