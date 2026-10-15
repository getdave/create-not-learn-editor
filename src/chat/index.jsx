/**
 * The chat: ask for a change in your own words, and pick it with the same
 * controls the screens use, without leaving the page you're on.
 *
 * It sits in the stage, in place of the screen, with the site on the canvas
 * beside it, or docked to the right of the canvas; both are being tried, and
 * a button in its header swaps them. It answers from a script rather than a
 * language model: see `engine.js` for how requests are understood, and
 * `skills.jsx` for what it can do.
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
import { subscribe } from '@wordpress/data';
import {
	createRoot,
	useEffect,
	useLayoutEffect,
	useRef,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
	closeSmall as closeIcon,
	drawerLeft as drawerLeftIcon,
	drawerRight as drawerRightIcon,
	plus as plusIcon,
} from '@wordpress/icons';
import { ThemeProvider } from '@wordpress/theme';
import { Icon, Text } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { startNewChat } from './conversation';
import { Composer } from './composer';
import { sparkleIcon } from './icons';
import { Message, Suggestions } from './message';
import {
	PLACEMENT_DOCK,
	PLACEMENT_STAGE,
	STORE_NAME,
	chatActions,
	getChat,
	savePlacement,
	useChat,
} from './store';

// Set on the page while the chat is open, so the canvas makes room for it.
const OPEN_CLASS = 'cnl-chat-is-open';
// Set while the chat sits in the stage, which then shows it alone.
const IN_STAGE_CLASS = 'cnl-chat-in-stage';

const LAYOUT = '#create-not-learn-editor-app [class*="__layout"]';
const SURFACES = `${ LAYOUT } > [class*="__surfaces"]`;
const STAGE = `${ SURFACES } > [class*="__wrapper"] > [class*="__stage"]`;

function setPlacement( placement ) {
	savePlacement( placement );
	chatActions().setPlacement( placement );
}

/*
 * Swap between the stage and the dock, while both are being tried.
 */
function PlacementToggle( { placement } ) {
	const isInStage = placement === PLACEMENT_STAGE;

	return (
		<Button
			icon={ isInStage ? drawerRightIcon : drawerLeftIcon }
			label={
				isInStage
					? __( 'Move to the right of the site' )
					: __( 'Move to the left of the site' )
			}
			onClick={ () =>
				setPlacement( isInStage ? PLACEMENT_DOCK : PLACEMENT_STAGE )
			}
			showTooltip
			size="compact"
		/>
	);
}

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
	const { isOpen, messages, pending, placement } = useChat();
	const scrollRef = useRef();
	const lastMessage = messages[ messages.length - 1 ];

	useEffect( () => {
		document.body.classList.toggle( OPEN_CLASS, isOpen );
		document.body.classList.toggle(
			IN_STAGE_CLASS,
			placement === PLACEMENT_STAGE
		);
	}, [ isOpen, placement ] );

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
						<PlacementToggle placement={ placement } />
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
 * Add the chat to boot's layout: into the stage, or beside the canvas.
 *
 * In the stage, the chat is added to boot's stage element, and the screen
 * already there is hidden while the chat is open, so closing the chat finds
 * the screen as it was. Docked, it is added after boot's surfaces, which lie
 * in a row with the sidebar, so they narrow to make room. Boot can remount
 * either, so the chat is put back whenever it goes missing, as the top bar
 * is.
 */
export function mountChat() {
	const container = document.createElement( 'div' );
	container.className = 'cnl-chat-host';
	createRoot( container ).render( <ChatPanel /> );

	let isScheduled = false;
	const place = () => {
		isScheduled = false;

		const stage =
			getChat().getPlacement() === PLACEMENT_STAGE &&
			document.querySelector( STAGE );

		if ( stage ) {
			if ( container.parentElement !== stage ) {
				stage.append( container );
			}

			return;
		}

		// Docked, or no stage on this screen to sit in.
		const surfaces = document.querySelector( SURFACES );

		if ( surfaces && surfaces.nextElementSibling !== container ) {
			surfaces.after( container );
		}
	};
	const schedule = () => {
		if ( ! isScheduled ) {
			isScheduled = true;
			window.requestAnimationFrame( place );
		}
	};

	new window.MutationObserver( schedule ).observe( document.body, {
		childList: true,
		subtree: true,
	} );
	subscribe( schedule, STORE_NAME );

	place();
}
