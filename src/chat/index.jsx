/**
 * The chat: ask for a change in your own words, and pick it with the same
 * controls the screens use, without leaving the page you're on.
 *
 * Docked to the right of the canvas, beside every screen. It answers from a
 * script rather than a language model: see `engine.js` for how requests are
 * understood, and `skills.jsx` for what it can do.
 *
 * Imported package by package rather than through `src/wordpress-packages`.
 * That barrel reaches `@wordpress/lazy-editor`, and this module is mounted from
 * app init, so going through it would make the editor a static dependency of
 * page boot and stop it loading lazily. See `src/editor-layer/index.jsx`.
 */

/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import {
	createRoot,
	useEffect,
	useLayoutEffect,
	useRef,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { closeSmall as closeIcon, plus as plusIcon } from '@wordpress/icons';
import { ThemeProvider } from '@wordpress/theme';
import { Icon, Text } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { startNewChat } from './conversation';
import { Composer } from './composer';
import { sparkleIcon } from './icons';
import { Message, Suggestions } from './message';
import { chatActions, useChat } from './store';

// Set on the page while the chat is open, so the canvas makes room for it.
const OPEN_CLASS = 'cnl-chat-is-open';

/*
 * The light surface boot gives its stage and canvas. The chat sits outside
 * them, in boot's dark frame, so it asks for the same.
 */
function getSurfaceColors() {
	const primary = window
		.getComputedStyle( document.body )
		.getPropertyValue( '--wp-admin-theme-color' )
		.trim();

	return {
		background: '#fcfcfc',
		...( primary ? { primary } : {} ),
	};
}

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
				{ __(
					'Ask in your own words. I’ll show you the options, and you’ll see each one on your site before you keep it.'
				) }
			</Text>
			<Suggestions isLarge />
		</div>
	);
}

function ChatPanel() {
	const { isOpen, messages, pending } = useChat();
	const scrollRef = useRef();
	const lastMessage = messages[ messages.length - 1 ];

	useEffect( () => {
		document.body.classList.toggle( OPEN_CLASS, isOpen );
	}, [ isOpen ] );

	/*
	 * Keep the newest message in view as it arrives and grows. A reply with a
	 * picker is scrolled to its top instead, so its words are read first and
	 * as much of the picker as fits shows under them.
	 */
	useLayoutEffect( () => {
		const node = scrollRef.current;

		if ( ! node ) {
			return;
		}

		const reply =
			lastMessage?.hasWidget &&
			lastMessage.status === 'ready' &&
			node.querySelector( `[data-message-id="${ lastMessage.id }"]` );
		const top = reply
			? node.scrollTop +
				reply.getBoundingClientRect().top -
				node.getBoundingClientRect().top -
				16
			: node.scrollHeight;

		node.scrollTo( { top, behavior: 'smooth' } );
	}, [
		messages.length,
		lastMessage?.id,
		lastMessage?.status,
		lastMessage?.hasWidget,
	] );

	if ( ! isOpen ) {
		return null;
	}

	return (
		<ThemeProvider color={ getSurfaceColors() }>
			<aside aria-label={ __( 'Assistant' ) } className="cnl-chat">
				<header className="cnl-chat__header">
					<span className="cnl-chat__title">
						<Icon icon={ sparkleIcon } size={ 20 } />
						{ __( 'Assistant' ) }
					</span>
					<div className="cnl-chat__header-actions">
						{ messages.length > 0 && (
							<Button
								icon={ plusIcon }
								onClick={ startNewChat }
								size="compact"
							>
								{ __( 'New chat' ) }
							</Button>
						) }
						<Button
							icon={ closeIcon }
							label={ __( 'Close' ) }
							onClick={ () => chatActions().setOpen( false ) }
							size="compact"
						/>
					</div>
				</header>
				<div className="cnl-chat__messages" ref={ scrollRef }>
					{ messages.length ? (
						<div aria-live="polite" className="cnl-chat__log">
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
			</aside>
		</ThemeProvider>
	);
}

/**
 * The top bar's button that opens and closes the chat.
 *
 * @return {Element} The button.
 */
export function ChatToggle() {
	const { isOpen } = useChat();

	return (
		<Button
			aria-expanded={ isOpen }
			className="cnl-chat-toggle"
			icon={ sparkleIcon }
			isPressed={ isOpen }
			label={
				isOpen ? __( 'Close assistant' ) : __( 'Ask the assistant' )
			}
			onClick={ () => chatActions().setOpen( ! isOpen ) }
			showTooltip
		/>
	);
}

/**
 * Add the chat to boot's layout, beside the canvas.
 *
 * Boot lays its sidebar and surfaces out in a row, so the chat is added to
 * the end of the row, and the surfaces narrow to make room while it is open.
 * The layout can remount, so the chat is put back whenever it goes missing,
 * as the top bar is.
 */
export function mountChat() {
	const container = document.createElement( 'div' );
	container.className = 'cnl-chat-host';
	createRoot( container ).render( <ChatPanel /> );

	let isScheduled = false;
	const place = () => {
		isScheduled = false;

		if ( container.isConnected ) {
			return;
		}

		const surfaces = document.querySelector(
			'#create-not-learn-editor-app [class*="__layout"] > [class*="__surfaces"]'
		);

		if ( surfaces ) {
			surfaces.after( container );
		}
	};

	new window.MutationObserver( () => {
		if ( ! isScheduled ) {
			isScheduled = true;
			window.requestAnimationFrame( place );
		}
	} ).observe( document.body, { childList: true, subtree: true } );

	place();
}
