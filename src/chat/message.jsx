/**
 * One message in the conversation.
 */

/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { store as coreDataStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { useEffect, useLayoutEffect, useRef } from '@wordpress/element';
import { __, isRTL } from '@wordpress/i18n';
import {
	arrowLeft as arrowLeftIcon,
	arrowRight as arrowRightIcon,
	check as checkIcon,
	color as colorIcon,
	footer as footerIcon,
	header as headerIcon,
	navigation as navigationIcon,
	page as pageIcon,
	plus as plusIcon,
	siteLogo as siteLogoIcon,
	title as titleIcon,
	styles as stylesIcon,
	typography as typographyIcon,
	undo as undoIcon,
} from '@wordpress/icons';
import { Icon, Spinner } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import {
	cancelPending,
	choosePage,
	commitPending,
	finishStreaming,
	openScreen,
	pick,
	prepareWidget,
	runAction,
	sendMessage,
	undoChange,
} from './conversation';
import { sparkleIcon } from './icons';
import { SKILLS, SUGGESTIONS } from './skills';
import { STORE_NAME } from './store';
import { StreamingText } from './streaming-text';

const SUGGESTION_ICONS = {
	color: colorIcon,
	footer: footerIcon,
	header: headerIcon,
	navigation: navigationIcon,
	page: pageIcon,
	section: plusIcon,
	siteLogo: siteLogoIcon,
	siteTitle: titleIcon,
	styles: stylesIcon,
	typography: typographyIcon,
};

const ACTION_LABELS = {
	'open-pages': __( 'Go to Pages' ),
};

/**
 * Things to ask for, as buttons that ask.
 *
 * @param {Object}  props         Component props.
 * @param {boolean} props.isLarge Whether to show them as a list, as the
 *                                empty conversation does.
 * @return {Element} The suggestions.
 */
export function Suggestions( { isLarge = false } ) {
	// Some suggestions depend on the site, like adding or changing a logo.
	useSelect(
		( select ) =>
			select( coreDataStore ).getEntityRecord( 'root', 'site' )
				?.site_logo,
		[]
	);

	return (
		<div
			className={ `cnl-chat-suggestions${ isLarge ? ' is-large' : '' }` }
		>
			{ SUGGESTIONS.map( ( suggestion ) => {
				const text =
					typeof suggestion.text === 'function'
						? suggestion.text()
						: suggestion.text;

				return (
					<button
						className="cnl-chat-suggestions__item"
						key={ suggestion.icon }
						onClick={ () => sendMessage( text ) }
						type="button"
					>
						<Icon
							icon={ SUGGESTION_ICONS[ suggestion.icon ] }
							size={ 20 }
						/>
						{ text }
					</button>
				);
			} ) }
		</div>
	);
}

/**
 * A pick, as it shows in the composer and in the message that sent it.
 *
 * @param {Object}  props          Component props.
 * @param {string}  props.label    What was picked.
 * @param {Element} props.children Anything after the label, like a remove
 *                                 button.
 * @return {Element} The chip.
 */
export function PickChip( { label, children } ) {
	return (
		<span className="cnl-chat-chip">
			<span aria-hidden className="cnl-chat-chip__icon">
				<Icon icon={ checkIcon } size={ 16 } />
			</span>
			<span className="cnl-chat-chip__label">{ label }</span>
			{ children }
		</span>
	);
}

function UserMessage( { message } ) {
	return (
		<div className="cnl-chat-message is-user">
			<div className="cnl-chat-message__bubble">
				{ message.chip && <PickChip label={ message.chip } /> }
				{ message.text && (
					<span className="cnl-chat-message__text">
						{ message.text }
					</span>
				) }
			</div>
		</div>
	);
}

function Thinking() {
	return (
		<span className="cnl-chat-thinking" role="status">
			<span className="screen-reader-text">{ __( 'Thinking…' ) }</span>
			<span aria-hidden className="cnl-chat-thinking__dot" />
			<span aria-hidden className="cnl-chat-thinking__dot" />
			<span aria-hidden className="cnl-chat-thinking__dot" />
		</span>
	);
}

/*
 * The skill's picker, once the record it changes is known and noted, so a
 * pick can be taken back.
 */
function Widget( { message, scrollRef } ) {
	const skill = SKILLS[ message.skillId ];
	const entity = skill.useEntity?.( message.params ) || null;
	// Pickers that report their record themselves can be used straight away.
	const needsRecord =
		skill.needsRecord?.( message.params ) ?? !! skill.useEntity;
	const isReady = ! needsRecord || !! message.snapshot;

	useEffect( () => {
		prepareWidget( message.id, entity );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ entity ] );

	const widgetRef = useRef();

	/*
	 * Once saved, the picker folds away: from its height to none, which CSS
	 * animates.
	 */
	useLayoutEffect( () => {
		const node = widgetRef.current;

		if ( node && message.saveState === 'closing' ) {
			node.style.maxHeight = `${ node.offsetHeight }px`;
			// Read layout so the change below animates from that height.
			node.getBoundingClientRect();
			node.style.maxHeight = '0px';
		}
	}, [ message.saveState ] );

	return (
		<div
			className={ `cnl-chat-widget${
				message.saveState === 'closing' ? ' is-closing' : ''
			}` }
			ref={ widgetRef }
		>
			<div className="cnl-chat-widget__body">
				{ isReady ? (
					<skill.Widget
						entity={ entity }
						message={ message }
						onChoosePage={ ( page ) =>
							choosePage( message.id, page )
						}
						onEntity={ ( reported ) =>
							prepareWidget( message.id, reported )
						}
						onPick={ ( label, payload ) =>
							pick( message.id, label, payload )
						}
						scrollRef={ scrollRef }
					/>
				) : (
					<div className="cnl-chat-widget__loading">
						<Thinking />
					</div>
				) }
			</div>
			{ isReady && ( skill.hasFooter?.( message.params ) ?? true ) && (
				<WidgetFooter message={ message } skill={ skill } />
			) }
		</div>
	);
}

/*
 * Under a picker: the button that keeps a pick, and a way on to the screen
 * with the same controls and more. The button shows from the start, waiting,
 * so the way to keep a pick is clear before one is made. Keeping it, the
 * button says it is saving, then saved, before the picker folds away.
 */
function WidgetFooter( { message, skill } ) {
	const pending = useSelect(
		( select ) => select( STORE_NAME ).getPending(),
		[]
	);
	const { saveError, saveState } = message;
	const isPicked = pending?.messageId === message.id;
	const isSaving = saveState === 'saving';
	const isSaved = saveState === 'saved' || saveState === 'closing';
	const screen = skill.screen?.( message );
	let status = null;
	let label = isPicked ? skill.action( pending ) : skill.action();

	if ( isSaving ) {
		status = __( 'Saving your change…' );
		label = (
			<>
				<Spinner className="cnl-chat-widget__spinner" />
				{ __( 'Saving…' ) }
			</>
		);
	} else if ( isSaved ) {
		status = __( 'Saved to your site.' );
		label = (
			<>
				<Icon icon={ checkIcon } size={ 20 } />
				{ __( 'Saved' ) }
			</>
		);
	} else if ( saveState === 'error' ) {
		status = saveError;
		label = __( 'Try again' );
	}

	return (
		<div
			className={ `cnl-chat-widget__footer${
				saveState ? ` is-${ saveState }` : ''
			}` }
		>
			<span className="cnl-chat-widget__status" role="status">
				{ status }
			</span>
			{ ! status && screen && (
				<Button
					className="cnl-chat-widget__open"
					onClick={ () => openScreen( screen ) }
					variant="link"
				>
					{ screen.label }
					<Icon
						icon={ isRTL() ? arrowLeftIcon : arrowRightIcon }
						size={ 16 }
					/>
				</Button>
			) }
			<div className="cnl-chat-widget__buttons">
				{ isPicked && ! saveState && (
					<Button
						__next40pxDefaultSize
						onClick={ cancelPending }
						variant="tertiary"
					>
						{ __( 'Cancel' ) }
					</Button>
				) }
				<Button
					__next40pxDefaultSize
					accessibleWhenDisabled
					className="cnl-chat-widget__keep"
					disabled={
						( ! isPicked && ! saveState ) || isSaving || isSaved
					}
					onClick={ commitPending }
					variant="primary"
				>
					{ label }
				</Button>
			</div>
		</div>
	);
}

function AssistantMessage( { isLast, message, scrollRef } ) {
	const isStreaming = message.status === 'streaming';
	const isSettled = ! [ 'thinking', 'streaming', 'saving' ].includes(
		message.status
	);

	return (
		<div
			className={ `cnl-chat-message is-assistant is-${ message.status }` }
			data-message-id={ message.id }
		>
			<div className="cnl-chat-message__row">
				<span aria-hidden className="cnl-chat-message__avatar">
					<Icon icon={ sparkleIcon } size={ 16 } />
				</span>
				<div className="cnl-chat-message__body">
					{ message.status === 'thinking' ? (
						<Thinking />
					) : (
						<StreamingText
							isStreaming={ isStreaming }
							onDone={ () => finishStreaming( message.id ) }
							text={ message.text }
						/>
					) }
					{ message.isNotKept && (
						<div className="cnl-chat-message__summary is-not-kept">
							{ __( 'Not kept. Your site is back as it was.' ) }
						</div>
					) }
					{ message.status === 'committed' && message.summary && (
						<div className="cnl-chat-message__summary">
							<Icon icon={ checkIcon } size={ 16 } />
							{ message.summary }
						</div>
					) }
					{ isSettled && message.actions?.length > 0 && (
						<div className="cnl-chat-message__actions">
							{ message.actions.map( ( action ) => (
								<Button
									key={ action }
									onClick={ () => runAction( action ) }
									size="compact"
									variant="secondary"
								>
									{ ACTION_LABELS[ action ] }
								</Button>
							) ) }
						</div>
					) }
					{ isSettled && message.undo && (
						<div className="cnl-chat-message__actions">
							{ message.undoState === 'undone' ? (
								<span className="cnl-chat-message__undone">
									{ __( 'Undone' ) }
								</span>
							) : (
								<Button
									disabled={ message.undoState === 'undoing' }
									icon={ undoIcon }
									onClick={ () => undoChange( message.id ) }
									size="compact"
									variant="tertiary"
								>
									{ __( 'Undo' ) }
								</Button>
							) }
						</div>
					) }
				</div>
			</div>
			{ message.hasWidget && message.status === 'ready' && (
				<Widget message={ message } scrollRef={ scrollRef } />
			) }
			{ isSettled && message.suggestions && <Suggestions /> }
			{ isSettled && isLast && message.offersNext && (
				<div className="cnl-chat-message__next">
					<span className="cnl-chat-message__next-label">
						{ __( 'What would you like to do next?' ) }
					</span>
					<Suggestions />
				</div>
			) }
		</div>
	);
}

export function Message( { isLast, message, scrollRef } ) {
	return message.role === 'user' ? (
		<UserMessage message={ message } />
	) : (
		<AssistantMessage
			isLast={ isLast }
			message={ message }
			scrollRef={ scrollRef }
		/>
	);
}
