/**
 * One message in the conversation.
 */

/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
	check as checkIcon,
	color as colorIcon,
	footer as footerIcon,
	header as headerIcon,
	page as pageIcon,
	plus as plusIcon,
	siteLogo as siteLogoIcon,
	styles as stylesIcon,
	typography as typographyIcon,
	undo as undoIcon,
} from '@wordpress/icons';
import { Icon } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import {
	finishStreaming,
	pick,
	prepareWidget,
	retrySave,
	runAction,
	sendMessage,
	undoChange,
} from './conversation';
import { sparkleIcon } from './icons';
import { SKILLS, SUGGESTIONS } from './skills';
import { StreamingText } from './streaming-text';

const SUGGESTION_ICONS = {
	color: colorIcon,
	footer: footerIcon,
	header: headerIcon,
	page: pageIcon,
	section: plusIcon,
	siteLogo: siteLogoIcon,
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
	return (
		<div
			className={ `cnl-chat-suggestions${ isLarge ? ' is-large' : '' }` }
		>
			{ SUGGESTIONS.map( ( suggestion ) => (
				<button
					className="cnl-chat-suggestions__item"
					key={ suggestion.text }
					onClick={ () => sendMessage( suggestion.text ) }
					type="button"
				>
					<Icon
						icon={ SUGGESTION_ICONS[ suggestion.icon ] }
						size={ 20 }
					/>
					{ suggestion.text }
				</button>
			) ) }
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
	const needsSnapshot = !! skill.keys;
	const isReady = ! needsSnapshot || !! message.snapshot;

	useEffect( () => {
		prepareWidget( message, entity );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ entity ] );

	return (
		<div className="cnl-chat-widget">
			{ isReady ? (
				<skill.Widget
					entity={ entity }
					message={ message }
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
	);
}

function AssistantMessage( { message, scrollRef } ) {
	const isStreaming = message.status === 'streaming';
	const isSettled = ! [ 'thinking', 'streaming', 'saving' ].includes(
		message.status
	);

	return (
		<div
			className={ `cnl-chat-message is-assistant is-${ message.status }` }
			data-message-id={ message.id }
		>
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
				{ message.hasWidget && message.status === 'ready' && (
					<Widget message={ message } scrollRef={ scrollRef } />
				) }
				{ message.status === 'committed' && message.summary && (
					<div className="cnl-chat-message__summary">
						<Icon icon={ checkIcon } size={ 16 } />
						{ message.summary }
					</div>
				) }
				{ isSettled && message.suggestions && <Suggestions /> }
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
				{ message.status === 'error' && message.retry && (
					<div className="cnl-chat-message__actions">
						<Button
							onClick={ () => retrySave( message.id ) }
							size="compact"
							variant="secondary"
						>
							{ __( 'Try again' ) }
						</Button>
					</div>
				) }
			</div>
		</div>
	);
}

export function Message( { message, scrollRef } ) {
	return message.role === 'user' ? (
		<UserMessage message={ message } />
	) : (
		<AssistantMessage message={ message } scrollRef={ scrollRef } />
	);
}
