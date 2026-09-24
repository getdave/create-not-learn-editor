/**
 * Review changes: every change waiting to be saved, each of which can be
 * discarded, with Save and Discard all for the lot.
 *
 * Discarding everything is asked about first, in the same dialog, because it
 * cannot be undone.
 */

/**
 * WordPress dependencies
 */
import { Button, Modal } from '@wordpress/components';
import { useDispatch } from '@wordpress/data';
import {
	createElement as el,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';
import { Stack, Text } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { useChanges } from './use-changes';

/*
 * A discarded change's row goes, and its button with it, so focus moves to
 * the Discard button now in the same place, or the last one if it was last.
 */
function ChangeList( { changes, onDiscard } ) {
	const listRef = useRef();
	const discardedIndex = useRef( null );

	useLayoutEffect( () => {
		if ( discardedIndex.current === null ) {
			return;
		}

		const buttons = listRef.current?.querySelectorAll( 'button' ) ?? [];
		buttons[
			Math.min( discardedIndex.current, buttons.length - 1 )
		]?.focus();
		discardedIndex.current = null;
	}, [ changes.length ] );

	return el(
		'ul',
		{ className: 'cnl-review-changes__list', ref: listRef },
		changes.map( ( change, index ) =>
			el(
				'li',
				{ key: change.id, className: 'cnl-review-changes__item' },
				el(
					'div',
					{ className: 'cnl-review-changes__text' },
					el(
						Text,
						{ className: 'cnl-review-changes__label' },
						change.label
					),
					el(
						Text,
						{
							className: 'cnl-review-changes__detail',
							variant: 'body-sm',
						},
						change.detail
					)
				),
				el(
					Button,
					{
						variant: 'tertiary',
						size: 'compact',
						onClick: () => {
							discardedIndex.current = index;
							onDiscard( change );
						},
						'aria-label': sprintf(
							/* translators: %s: What was changed, like "Site name". */
							__( 'Discard change to %s' ),
							change.label
						),
					},
					__( 'Discard' )
				)
			)
		)
	);
}

/**
 * @param {Object}   props
 * @param {Function} props.onClose Close the dialog.
 * @return {Element} The dialog.
 */
export function ReviewChanges( { onClose } ) {
	const { changes, isSaving, save, discard, discardAll } = useChanges();
	const [ isConfirmingDiscard, setIsConfirmingDiscard ] = useState( false );
	const { createSuccessNotice } = useDispatch( noticesStore );
	const count = changes.length;

	// Nothing left to review, whether saved, discarded or undone elsewhere.
	useEffect( () => {
		if ( ! count ) {
			onClose();
		}
	}, [ count, onClose ] );

	if ( ! count ) {
		return null;
	}

	const onSave = () => {
		save();
		onClose();
	};

	const onDiscardAll = () => {
		discardAll();
		createSuccessNotice( __( 'Changes discarded.' ), {
			type: 'snackbar',
		} );
	};

	if ( isConfirmingDiscard ) {
		return el(
			Modal,
			{
				// A new dialog for each step, so focus moves into it: here
				// onto Keep changes, the safe choice.
				key: 'discard',
				title: __( 'Discard changes?' ),
				onRequestClose: onClose,
				size: 'small',
				className: 'cnl-review-changes',
				focusOnMount: 'firstContentElement',
			},
			el(
				Stack,
				{ direction: 'column', gap: 'xl' },
				el(
					Text,
					null,
					sprintf(
						/* translators: %d: Number of changes waiting to be saved. */
						_n(
							'Your %d unsaved change will be lost, and your site goes back to how visitors see it now. This can’t be undone.',
							'All %d unsaved changes will be lost, and your site goes back to how visitors see it now. This can’t be undone.',
							count
						),
						count
					)
				),
				el(
					'div',
					{ className: 'cnl-review-changes__footer' },
					el(
						'div',
						{ className: 'cnl-review-changes__footer-end' },
						el(
							Button,
							{
								__next40pxDefaultSize: true,
								variant: 'tertiary',
								onClick: () => setIsConfirmingDiscard( false ),
							},
							__( 'Keep changes' )
						),
						el(
							Button,
							{
								__next40pxDefaultSize: true,
								variant: 'primary',
								isDestructive: true,
								onClick: onDiscardAll,
							},
							__( 'Discard changes' )
						)
					)
				)
			)
		);
	}

	return el(
		Modal,
		{
			key: 'review',
			title: __( 'Review changes' ),
			onRequestClose: onClose,
			size: 'medium',
			className: 'cnl-review-changes',
		},
		el(
			Stack,
			{ direction: 'column', gap: 'xl' },
			el(
				Text,
				{ className: 'cnl-review-changes__intro' },
				__(
					'Visitors see these once you save them. Discard any you don’t want to keep.'
				)
			),
			el( ChangeList, { changes, onDiscard: discard } ),
			el(
				'div',
				{ className: 'cnl-review-changes__footer' },
				el(
					Button,
					{
						__next40pxDefaultSize: true,
						variant: 'tertiary',
						isDestructive: true,
						onClick: () => setIsConfirmingDiscard( true ),
						disabled: isSaving,
						accessibleWhenDisabled: true,
					},
					__( 'Discard all' )
				),
				el(
					'div',
					{ className: 'cnl-review-changes__footer-end' },
					el(
						Button,
						{
							__next40pxDefaultSize: true,
							variant: 'tertiary',
							onClick: onClose,
						},
						__( 'Cancel' )
					),
					el(
						Button,
						{
							__next40pxDefaultSize: true,
							variant: 'primary',
							onClick: onSave,
							isBusy: isSaving,
							disabled: isSaving,
							accessibleWhenDisabled: true,
						},
						sprintf(
							/* translators: %d: Number of changes to save. */
							_n( 'Save %d change', 'Save %d changes', count ),
							count
						)
					)
				)
			)
		)
	);
}
