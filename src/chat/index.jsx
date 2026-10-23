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
 * Only the ways in to the chat, the panel's frame and where it sits load with
 * the page. The panel's body, the conversation and the skills and pickers
 * behind it, comes from the app-init-deferred module, fetched once the page
 * has settled. See `src/app-init-deferred.js` and `panel.jsx`.
 *
 * Imported package by package rather than through `src/wordpress-packages`.
 * That barrel reaches `@wordpress/lazy-editor`, and this module is mounted from
 * app init, so going through it would make the editor a static dependency of
 * page boot and stop it loading lazily. See `src/editor-layer/index.jsx`.
 */

/**
 * WordPress dependencies
 */
import { Button, Spinner, VisuallyHidden } from '@wordpress/components';
import { subscribe } from '@wordpress/data';
import { createRoot, useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
	closeSmall as closeIcon,
	drawerLeft as drawerLeftIcon,
	drawerRight as drawerRightIcon,
	plus as plusIcon,
} from '@wordpress/icons';
import { ThemeProvider } from '@wordpress/theme';
import { Icon } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { preloadDeferred, useDeferred } from '../app-init-deferred';
import { sparkleIcon } from './icons';
import {
	PLACEMENT_DOCK,
	PLACEMENT_STAGE,
	STORE_NAME,
	chatActions,
	getChat,
	savePlacement,
	useChat,
	useIsChatOpen,
} from './store';

// How long the prompt at the foot of a screen shows the chat starting up.
const OPENING_MS = 650;

// Set on the page while the chat is open, so the canvas makes room for it.
const OPEN_CLASS = 'cnl-chat-is-open';
// Set while the chat sits in the stage, which then shows it alone.
const IN_STAGE_CLASS = 'cnl-chat-in-stage';

const LAYOUT = '#create-not-learn-editor-app [class*="__layout"]';
const SURFACES = `${ LAYOUT } > [class*="__surfaces"]`;
const STAGE = `${ SURFACES } > [class*="__wrapper"] > [class*="__stage"]`;

/*
 * Pointing at or tabbing to a way in to the chat fetches the panel's body,
 * in case the page hasn't yet.
 */
const PRELOAD_PROPS = {
	onFocus: preloadDeferred,
	onPointerEnter: preloadDeferred,
};

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

/*
 * Stands in for the panel's body while it loads, which it rarely has to, and
 * says so if it didn't load.
 */
function ChatBodyFallback( { error, retry } ) {
	if ( error ) {
		return (
			<div className="cnl-chat-loading" role="alert">
				<p>{ __( 'The assistant didn’t load.' ) }</p>
				<Button onClick={ retry } size="compact" variant="secondary">
					{ __( 'Try again' ) }
				</Button>
			</div>
		);
	}

	return (
		<div className="cnl-chat-loading" role="status">
			<Spinner />
			<VisuallyHidden>{ __( 'Loading the assistant…' ) }</VisuallyHidden>
		</div>
	);
}

/*
 * The open panel: its header here, and its body from the app-init-deferred
 * module.
 */
function OpenChatPanel( { hasMessages, placement } ) {
	const { deferred, error, retry } = useDeferred();

	return (
		<ThemeProvider color={ getSurfaceColors() }>
			<aside aria-label={ __( 'Assistant' ) } className="cnl-chat">
				<header className="cnl-chat__header">
					<span className="cnl-chat__title">
						<Icon icon={ sparkleIcon } size={ 20 } />
						{ __( 'Assistant' ) }
					</span>
					<div className="cnl-chat__header-actions">
						{ hasMessages && deferred && (
							<Button
								icon={ plusIcon }
								onClick={ deferred.startNewChat }
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
				{ deferred ? (
					<deferred.ChatBody />
				) : (
					<ChatBodyFallback error={ error } retry={ retry } />
				) }
			</aside>
		</ThemeProvider>
	);
}

function ChatPanel() {
	const { isOpen, messages, placement } = useChat();

	useEffect( () => {
		document.body.classList.toggle( OPEN_CLASS, isOpen );
		document.body.classList.toggle(
			IN_STAGE_CLASS,
			placement === PLACEMENT_STAGE
		);
	}, [ isOpen, placement ] );

	if ( ! isOpen ) {
		return null;
	}

	return (
		<OpenChatPanel
			hasMessages={ messages.length > 0 }
			placement={ placement }
		/>
	);
}

/**
 * The top bar's button that opens and closes the chat.
 *
 * @return {Element} The button.
 */
export function ChatToggle() {
	const isOpen = useIsChatOpen();

	return (
		<Button
			{ ...PRELOAD_PROPS }
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
 * A quiet way in to the chat at the foot of each screen, for those who
 * haven't spotted the button in the top bar. Hidden while the chat is open.
 *
 * @return {?Element} The prompt.
 */
function StageHelp() {
	const isOpen = useIsChatOpen();
	const [ isOpening, setIsOpening ] = useState( false );

	// Ready to open again once the chat has been closed.
	useEffect( () => {
		if ( ! isOpen ) {
			setIsOpening( false );
		}
	}, [ isOpen ] );

	if ( isOpen ) {
		return null;
	}

	/*
	 * A moment of starting up before the chat opens, so the click reads as
	 * the assistant getting ready rather than a panel swapping in. The
	 * panel's body loads meanwhile, if it hasn't.
	 */
	const open = () => {
		if ( isOpening ) {
			return;
		}

		setIsOpening( true );
		preloadDeferred();
		window.setTimeout( () => chatActions().setOpen( true ), OPENING_MS );
	};

	return (
		<ThemeProvider color={ getSurfaceColors() }>
			<button
				{ ...PRELOAD_PROPS }
				aria-busy={ isOpening || undefined }
				className={ `cnl-stage-help${
					isOpening ? ' is-opening' : ''
				}` }
				onClick={ open }
				type="button"
			>
				<span aria-hidden className="cnl-stage-help__icon">
					<Icon icon={ sparkleIcon } size={ 16 } />
				</span>
				<span className="cnl-stage-help__text" role="status">
					{ isOpening ? (
						__( 'Opening the assistant…' )
					) : (
						<>
							<span className="cnl-stage-help__title">
								{ __( 'Need help?' ) }
							</span>{ ' ' }
							{ __( 'Try the assistant for common tasks.' ) }
						</>
					) }
				</span>
			</button>
		</ThemeProvider>
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

	const help = document.createElement( 'div' );
	help.className = 'cnl-stage-help-host';
	createRoot( help ).render( <StageHelp /> );

	let isScheduled = false;
	const place = () => {
		isScheduled = false;

		const anyStage = document.querySelector( STAGE );

		// The way in to the chat, at the foot of every screen.
		if ( anyStage && help.parentElement !== anyStage ) {
			anyStage.append( help );
		}

		const stage = getChat().getPlacement() === PLACEMENT_STAGE && anyStage;

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
