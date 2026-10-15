/**
 * Where a message is typed, with the pick waiting to be sent above it.
 */

/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { store as coreDataStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import {
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
	arrowUp as arrowUpIcon,
	closeSmall as closeIcon,
} from '@wordpress/icons';
import { Icon } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import {
	cancelPending,
	dropStalePending,
	isBusy,
	sendMessage,
} from './conversation';
import { PickChip } from './message';
import { SKILLS } from './skills';
import { STORE_NAME } from './store';

// The tallest the box grows before it scrolls.
const MAX_HEIGHT = 200;

/*
 * When the top bar saves or discards the change a pick made, there is nothing
 * left to send, so the pick goes.
 */
function useDropStalePending( pending ) {
	const isDirty = useSelect(
		( select ) =>
			pending?.entity
				? select( coreDataStore ).hasEditsForEntityRecord(
						...pending.entity
					)
				: true,
		[ pending ]
	);

	useEffect( () => {
		if ( ! isDirty ) {
			dropStalePending();
		}
	}, [ isDirty ] );
}

export function Composer( { pending } ) {
	const [ text, setText ] = useState( '' );
	const textareaRef = useRef();
	const busy = useSelect(
		( select ) => isBusy( select( STORE_NAME ).getMessages() ),
		[]
	);
	const canSend = ! busy && ( !! text.trim() || !! pending );

	useDropStalePending( pending );

	// Grow with what is typed.
	useLayoutEffect( () => {
		const node = textareaRef.current;

		// Nothing to measure while the panel is still opening.
		if ( node?.offsetParent ) {
			node.style.height = 'auto';
			node.style.height = `${ Math.min(
				node.scrollHeight,
				MAX_HEIGHT
			) }px`;
		}
	}, [ text ] );

	const send = () => {
		if ( ! canSend ) {
			return;
		}

		sendMessage( text );
		setText( '' );
	};

	return (
		<form
			className="cnl-chat-composer"
			onSubmit={ ( event ) => {
				event.preventDefault();
				send();
			} }
		>
			<div className="cnl-chat-composer__box">
				{ pending && (
					<div className="cnl-chat-composer__pending">
						<PickChip
							label={ SKILLS[ pending.skillId ].chip( pending ) }
						>
							<button
								aria-label={ __( 'Cancel this change' ) }
								className="cnl-chat-chip__remove"
								onClick={ cancelPending }
								type="button"
							>
								<Icon icon={ closeIcon } size={ 16 } />
							</button>
						</PickChip>
					</div>
				) }
				<textarea
					aria-label={ __( 'Message' ) }
					className="cnl-chat-composer__input"
					onChange={ ( event ) => setText( event.target.value ) }
					onKeyDown={ ( event ) => {
						if (
							event.key === 'Enter' &&
							! event.shiftKey &&
							! event.nativeEvent.isComposing
						) {
							event.preventDefault();
							send();
						}
					} }
					placeholder={
						pending
							? __( 'Press send to keep this change' )
							: __( 'Ask for a change to your site…' )
					}
					ref={ textareaRef }
					rows={ 1 }
					value={ text }
				/>
				<Button
					accessibleWhenDisabled
					className="cnl-chat-composer__send"
					disabled={ ! canSend }
					icon={ arrowUpIcon }
					label={
						pending
							? __( 'Send and keep this change' )
							: __( 'Send' )
					}
					type="submit"
				/>
			</div>
			<p className="cnl-chat-composer__hint">
				{ __(
					'You see each change on your site as you pick it. Send keeps it.'
				) }
			</p>
		</form>
	);
}
