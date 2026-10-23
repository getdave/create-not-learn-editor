/**
 * Where a message is typed. Only for typing: a change picked in a reply is
 * kept with the button under its picker.
 *
 * The assistant answers from a script, so there is no box until a language
 * model is connected, and people pick from its choices instead. See
 * `cnl_editor_assistant_can_type()`.
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
import { arrowUp as arrowUpIcon } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { settings } from '../settings';
import { dropStalePending, isBusy, sendMessage } from './conversation';
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

/**
 * Whether people can type to the assistant.
 *
 * @return {boolean} Whether the message box shows.
 */
export function canType() {
	return !! settings.assistantCanType;
}

export function Composer( { pending } ) {
	useDropStalePending( pending );

	return canType() ? <MessageBox /> : null;
}

function MessageBox() {
	const [ text, setText ] = useState( '' );
	const textareaRef = useRef();
	const busy = useSelect(
		( select ) => isBusy( select( STORE_NAME ).getMessages() ),
		[]
	);
	const canSend = ! busy && !! text.trim();

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
					placeholder={ __( 'Ask for a change to your site…' ) }
					ref={ textareaRef }
					rows={ 1 }
					value={ text }
				/>
				<Button
					accessibleWhenDisabled
					className="cnl-chat-composer__send"
					disabled={ ! canSend }
					icon={ arrowUpIcon }
					label={ __( 'Send' ) }
					type="submit"
				/>
			</div>
			<p className="cnl-chat-composer__hint">
				{ __( 'Changes show on your site as you pick them.' ) }
			</p>
		</form>
	);
}
