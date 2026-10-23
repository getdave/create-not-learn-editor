/**
 * The chat panel's body: the conversation, and the composer below it.
 *
 * Loaded with the app-init-deferred module rather than with the page, as it
 * reaches the skills and every picker they show, and none of that is needed
 * until the chat opens. The panel's frame, its header, and the ways in to the
 * chat stay in app init: see `index.jsx`.
 */

/**
 * WordPress dependencies
 */
import { useEffect, useLayoutEffect, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Icon, Text } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { Composer, canType } from './composer';
import { sparkleIcon } from './icons';
import { Message, Suggestions } from './message';
import { useChat } from './store';

function EmptyConversation() {
	return (
		<div className="cnl-chat-empty">
			<span aria-hidden className="cnl-chat-empty__icon">
				<Icon icon={ sparkleIcon } size={ 24 } />
			</span>
			<Text
				className="cnl-chat-empty__title"
				render={ <h2 /> }
				variant="heading-lg"
			>
				{ __( 'What would you like to change?' ) }
			</Text>
			<Text className="cnl-chat-empty__description" variant="body-md">
				{ canType()
					? __(
							'Ask in your own words. I’ll show you the options, and you’ll see each one on your site before you keep it.'
						)
					: __(
							'Pick something to change. I’ll show you the options, and you’ll see each one on your site before you keep it.'
						) }
			</Text>
			<Suggestions isLarge />
		</div>
	);
}

/**
 * The conversation and the composer, while the chat is open.
 *
 * @return {Element} The panel's body.
 */
export function ChatBody() {
	const { messages, pending } = useChat();
	const scrollRef = useRef();
	const logRef = useRef();
	// Whether the view follows the end of the conversation.
	const isPinnedRef = useRef( true );
	const hasMessages = messages.length > 0;

	const scrollToEnd = () => {
		const node = scrollRef.current;

		if ( node ) {
			// At once, not smoothly, so a scroll never lags behind growth.
			node.scrollTop = node.scrollHeight;
		}
	};

	/*
	 * Always show the latest: opening the chat or a new message brings the
	 * view to the end, and while it is there it stays there as replies
	 * stream in and pickers load their previews. Scrolling up to read leaves
	 * it be until the next message.
	 */
	useLayoutEffect( () => {
		isPinnedRef.current = true;
		scrollToEnd();
	}, [ messages.length ] );

	useEffect( () => {
		const log = logRef.current;

		if ( ! log || typeof window.ResizeObserver === 'undefined' ) {
			return undefined;
		}

		const observer = new window.ResizeObserver( () => {
			if ( isPinnedRef.current ) {
				scrollToEnd();
			}
		} );

		observer.observe( log );

		return () => observer.disconnect();
	}, [ hasMessages ] );

	const onScroll = () => {
		const node = scrollRef.current;

		isPinnedRef.current =
			node.scrollHeight - node.scrollTop - node.clientHeight < 48;
	};

	return (
		<>
			<div
				className="cnl-chat__messages"
				onScroll={ onScroll }
				ref={ scrollRef }
			>
				{ hasMessages ? (
					<div
						aria-live="polite"
						className="cnl-chat__log"
						ref={ logRef }
					>
						{ messages.map( ( message, index ) => (
							<Message
								isLast={ index === messages.length - 1 }
								key={ message.id }
								message={ message }
								scrollRef={ scrollRef }
							/>
						) ) }
					</div>
				) : (
					<EmptyConversation />
				) }
			</div>
			<Composer pending={ pending } />
		</>
	);
}
