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

	return (
		<ul className="cnl-review-changes__list" ref={ listRef }>
			{ changes.map( ( change, index ) => (
				<li key={ change.id } className="cnl-review-changes__item">
					<div className="cnl-review-changes__text">
						<Text className="cnl-review-changes__label">
							{ change.label }
						</Text>
						<Text
							className="cnl-review-changes__detail"
							variant="body-sm"
						>
							{ change.detail }
						</Text>
					</div>
					<Button
						variant="tertiary"
						size="compact"
						onClick={ () => {
							discardedIndex.current = index;
							onDiscard( change );
						} }
						aria-label={ sprintf(
							/* translators: %s: What was changed, like "Site name". */
							__( 'Discard change to %s' ),
							change.label
						) }
					>
						{ __( 'Discard' ) }
					</Button>
				</li>
			) ) }
		</ul>
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
		return (
			<Modal
				// A new dialog for each step, so focus moves into it: here
				// onto Keep changes, the safe choice.
				key="discard"
				title={ __( 'Discard changes?' ) }
				onRequestClose={ onClose }
				size="small"
				className="cnl-review-changes"
				focusOnMount="firstContentElement"
			>
				<Stack direction="column" gap="xl">
					<Text>
						{ sprintf(
							/* translators: %d: Number of changes waiting to be saved. */
							_n(
								'Your %d unsaved change will be lost, and your site goes back to how visitors see it now. This can’t be undone.',
								'All %d unsaved changes will be lost, and your site goes back to how visitors see it now. This can’t be undone.',
								count
							),
							count
						) }
					</Text>
					<div className="cnl-review-changes__footer">
						<div className="cnl-review-changes__footer-end">
							<Button
								__next40pxDefaultSize
								variant="tertiary"
								onClick={ () =>
									setIsConfirmingDiscard( false )
								}
							>
								{ __( 'Keep changes' ) }
							</Button>
							<Button
								__next40pxDefaultSize
								variant="primary"
								isDestructive
								onClick={ onDiscardAll }
							>
								{ __( 'Discard changes' ) }
							</Button>
						</div>
					</div>
				</Stack>
			</Modal>
		);
	}

	return (
		<Modal
			key="review"
			title={ __( 'Review changes' ) }
			onRequestClose={ onClose }
			size="medium"
			className="cnl-review-changes"
		>
			<Stack direction="column" gap="xl">
				<Text className="cnl-review-changes__intro">
					{ __(
						'Visitors see these once you save them. Discard any you don’t want to keep.'
					) }
				</Text>
				<ChangeList changes={ changes } onDiscard={ discard } />
				<div className="cnl-review-changes__footer">
					<Button
						__next40pxDefaultSize
						variant="tertiary"
						isDestructive
						onClick={ () => setIsConfirmingDiscard( true ) }
						disabled={ isSaving }
						accessibleWhenDisabled
					>
						{ __( 'Discard all' ) }
					</Button>
					<div className="cnl-review-changes__footer-end">
						<Button
							__next40pxDefaultSize
							variant="tertiary"
							onClick={ onClose }
						>
							{ __( 'Cancel' ) }
						</Button>
						<Button
							__next40pxDefaultSize
							variant="primary"
							onClick={ onSave }
							isBusy={ isSaving }
							disabled={ isSaving }
							accessibleWhenDisabled
						>
							{ sprintf(
								/* translators: %d: Number of changes to save. */
								_n(
									'Save %d change',
									'Save %d changes',
									count
								),
								count
							) }
						</Button>
					</div>
				</div>
			</Stack>
		</Modal>
	);
}
