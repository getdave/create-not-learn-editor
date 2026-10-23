/**
 * The controls Edit lays over a section: its name, the bar over it while it
 * is pointed at or picked, with Add, Edit design (and Edit header or Edit
 * footer) and its own moves, and the small bar on a header or footer being
 * edited, or a section in Freeform.
 */

/**
 * WordPress dependencies
 */
import { Tooltip } from '@wordpress/components';
import { forwardRef } from '@wordpress/element';
import {
	arrowDown as arrowDownIcon,
	arrowUp as arrowUpIcon,
	button as buttonIcon,
	copy as copyIcon,
	globe as globeIcon,
	heading as headingIcon,
	image as imageIcon,
	paragraph as paragraphIcon,
	pencil as pencilIcon,
	plus as plusIcon,
	styles as designIcon,
	trash as trashIcon,
} from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { GlobalNote } from '../../global-scope';
import {
	__,
	Button,
	Dropdown,
	LegacyIcon,
	MenuGroup,
	MenuItem,
	sprintf,
} from '../../wordpress-packages';
import { getAddableTypes } from './items';

export const MODE_DESIGN = 'design';
export const MODE_CONTENT = 'content';
// Part of Edit design, reached from its panel.
export const MODE_FREEFORM = 'free';

const ADD_ICONS = {
	button: buttonIcon,
	heading: headingIcon,
	image: imageIcon,
	paragraph: paragraphIcon,
};

/**
 * The ways to edit a section, on the bar over it. A section's words and
 * pictures are changed by clicking into it, so it has Edit design only. A
 * header or footer shows on every page, so it is opened on purpose, with
 * Edit header or Edit footer.
 *
 * @param {boolean} isPart Whether it is the header or footer.
 * @param {string}  title  Its name, like Header.
 * @return {Object[]} `{ mode, label, description, icon }` for each.
 */
export function getModes( isPart = false, title = '' ) {
	const modes = [
		{
			description: __( 'Change the layout, colour and width' ),
			icon: designIcon,
			label: __( 'Edit design' ),
			mode: MODE_DESIGN,
		},
	];

	if ( isPart ) {
		modes.push( {
			description: getSitewideText( title ),
			icon: pencilIcon,
			label:
				title === __( 'Footer' )
					? __( 'Edit footer' )
					: __( 'Edit header' ),
			mode: MODE_CONTENT,
		} );
	}

	return modes;
}

/**
 * The words for editing a header or footer, which every page shares.
 *
 * @param {string} title The part's name, like Header.
 * @return {string} The words.
 */
export function getSitewideText( title ) {
	return sprintf(
		/* translators: %s: header or footer, lowercase. */
		__( 'Changes to the %s show on every page of your site' ),
		title.toLowerCase()
	);
}

/**
 * The section's name, in a tab on its outline.
 *
 * @param {Object}  props
 * @param {string}  props.title    The name.
 * @param {boolean} props.isPart   Whether it is the header or footer.
 * @param {boolean} props.isInside Whether the tab sits inside the top edge,
 *                                 when there is no room above it.
 * @param {boolean} props.isBelow  Whether the tab hangs under the bottom
 *                                 edge, for the section at the page's top.
 * @param {Object}  props.style    Where it sits.
 * @return {Element} The tab.
 */
export function SectionTab( { isBelow, isInside, isPart, style, title } ) {
	return (
		<span
			aria-hidden
			title={ title }
			className={ `cnl-section-modes__tab${
				isInside ? ' is-inside' : ''
			}${ isBelow ? ' is-below' : '' }` }
			style={ style }
		>
			{ isPart && <LegacyIcon icon={ globeIcon } size={ 14 } /> }
			<span className="cnl-section-modes__tab-title">{ title }</span>
			{ isPart && (
				<span className="cnl-section-modes__tab-note">
					{ __( 'shown on every page' ) }
				</span>
			) }
		</span>
	);
}

/**
 * A button on the bar over a section: core's compact button, its name in a
 * tooltip when it is only an icon, or what it does when it has words. The
 * tooltip goes below, clear of "Add section" on the section's top edge.
 *
 * @param {Object}  props
 * @param {string}  props.label     Its name, or what it does, with words.
 * @param {?string} props.text      Its words, if it has any.
 * @param {string}  props.className Extra classes.
 * @param {Object}  props.icon      Its icon.
 * @return {Element} The button.
 */
function BarButton( { className = '', icon, label, text, ...props } ) {
	if ( ! text ) {
		return (
			<Button
				accessibleWhenDisabled
				className={ `cnl-section-modes__bar-button ${ className }` }
				icon={ icon }
				label={ label }
				showTooltip
				size="compact"
				tooltipPosition="bottom"
				{ ...props }
			/>
		);
	}

	return (
		<Tooltip placement="bottom" text={ label }>
			<Button
				className={ `cnl-section-modes__bar-button ${ className }` }
				description={ label }
				icon={ icon }
				size="compact"
				{ ...props }
			>
				{ text }
			</Button>
		</Tooltip>
	);
}

/**
 * The Add menu, of things that suit a section.
 *
 * @param {Object}   props
 * @param {string}   props.title    The section's name.
 * @param {Function} props.onAdd    Called with the type picked.
 * @param {Function} props.onToggle Called with whether the menu is open.
 * @return {Element} The menu.
 */
function AddMenu( { onAdd, onToggle, title } ) {
	return (
		<Dropdown
			className="cnl-section-modes__add"
			contentClassName="cnl-section-modes__add-menu"
			onToggle={ onToggle }
			popoverProps={ { placement: 'bottom-start' } }
			renderContent={ ( { onClose } ) => (
				<MenuGroup
					label={ sprintf(
						/* translators: %s: section name. */
						__( 'Add to %s' ),
						title
					) }
				>
					{ getAddableTypes().map( ( { label, type } ) => (
						<MenuItem
							icon={ ADD_ICONS[ type ] }
							iconPosition="left"
							key={ type }
							onClick={ () => {
								onClose();
								onAdd( type );
							} }
						>
							{ label }
						</MenuItem>
					) ) }
				</MenuGroup>
			) }
			renderToggle={ ( { isOpen, onToggle: toggle } ) => (
				<div className="cnl-section-modes__group">
					<Button
						aria-expanded={ isOpen }
						aria-haspopup="menu"
						className="cnl-section-modes__bar-button"
						icon={ plusIcon }
						isPressed={ isOpen }
						onClick={ toggle }
						size="compact"
					>
						{ __( 'Add' ) }
					</Button>
				</div>
			) }
		/>
	);
}

/**
 * The bar over a section while it is pointed at.
 *
 * @param {Object}   props
 * @param {string}   props.title        The section's name.
 * @param {boolean}  props.isPart       Whether it is the header or footer,
 *                                      which stay where they are.
 * @param {boolean}  props.isNarrow     Whether the modes go on a row of
 *                                      their own, for a narrow section.
 * @param {boolean}  props.isCompact    Whether the modes are icons only,
 *                                      for a short section.
 * @param {boolean}  props.canMoveUp    Whether it can move up.
 * @param {boolean}  props.canMoveDown  Whether it can move down.
 * @param {Object}   props.style        Where the bar sits.
 * @param {Function} props.onAdd        Adds an item, called with its type.
 * @param {Function} props.onMenuToggle Called with whether Add is open.
 * @param {Function} props.onMode       Called with the mode picked.
 * @param {Function} props.onMove       Called with -1 or 1.
 * @param {Function} props.onDuplicate  Duplicates the section.
 * @param {Function} props.onDelete     Deletes the section.
 * @return {Element} The bar.
 */
export function HoverBar( {
	canMoveDown,
	canMoveUp,
	isCompact,
	isNarrow,
	isPart,
	onAdd,
	onDelete,
	onDuplicate,
	onMenuToggle,
	onMode,
	onMove,
	style,
	title,
} ) {
	return (
		<div
			className={ `cnl-section-modes__bar${
				isNarrow ? ' is-narrow' : ''
			}` }
			style={ style }
		>
			<div className="cnl-section-modes__bar-start">
				{ ! isPart && (
					<AddMenu
						onAdd={ onAdd }
						onToggle={ onMenuToggle }
						title={ title }
					/>
				) }
			</div>
			<div
				aria-label={ sprintf(
					/* translators: %s: section name. */
					__( 'Edit %s' ),
					title
				) }
				className="cnl-section-modes__group"
				role="group"
			>
				{ getModes( isPart, title ).map(
					( { description, icon, label, mode } ) => (
						<BarButton
							icon={ icon }
							key={ mode }
							label={ isCompact ? label : description }
							onClick={ () => onMode( mode ) }
							text={ isCompact ? null : label }
						/>
					)
				) }
			</div>
			<div className="cnl-section-modes__bar-end">
				{ ! isPart && (
					<div
						aria-label={ __( 'Section' ) }
						className="cnl-section-modes__group"
						role="group"
					>
						<BarButton
							disabled={ ! canMoveUp }
							icon={ arrowUpIcon }
							label={ __( 'Move section up' ) }
							onClick={ () => onMove( -1 ) }
						/>
						<BarButton
							disabled={ ! canMoveDown }
							icon={ arrowDownIcon }
							label={ __( 'Move section down' ) }
							onClick={ () => onMove( 1 ) }
						/>
						<BarButton
							icon={ copyIcon }
							label={ __( 'Duplicate section' ) }
							onClick={ onDuplicate }
						/>
						<BarButton
							className="is-delete"
							icon={ trashIcon }
							label={ __( 'Delete section' ) }
							onClick={ onDelete }
						/>
					</div>
				) }
			</div>
		</div>
	);
}

/**
 * The bar on a section in Edit content or Freeform: Done, and Restore when
 * there is something to restore. The mode is its name for assistive
 * technology only; the section's outline and name say enough on screen. The size of the bar over a section pointed at, or
 * smaller, for a small section, where it sits outside it.
 *
 * @param {Object}   props
 * @param {boolean}  props.isSmall      Whether it is the smaller bar.
 * @param {string}   props.label        The mode's name.
 * @param {?string}  props.sitewide     Words for a header or footer.
 * @param {number}   props.removedCount How many items were taken out.
 * @param {Object}   props.style        Where it sits.
 * @param {Function} props.onRestore    Puts back what was taken out.
 * @param {Function} props.onDone       Leaves the mode.
 * @param {Object}   ref                Takes the bar's node, to measure it.
 * @return {Element} The bar.
 */
export const ModeBar = forwardRef( function UnforwardedModeBar(
	{ isSmall, label, onDone, onRestore, removedCount, sitewide, style },
	ref
) {
	return (
		<div
			aria-label={ label }
			className={ `cnl-section-modes__mode-bar${
				isSmall ? ' is-small' : ''
			}` }
			ref={ ref }
			role="group"
			style={ style }
		>
			{ sitewide && (
				<GlobalNote className="cnl-section-modes__sitewide">
					{ sitewide }
				</GlobalNote>
			) }
			{ removedCount > 0 && (
				<Button
					className="cnl-section-modes__text-button"
					description={ __( 'Bring back removed items' ) }
					onClick={ onRestore }
					size="compact"
					variant="secondary"
				>
					{ sprintf(
						/* translators: %d: number of items removed. */
						__( 'Restore (%d)' ),
						removedCount
					) }
				</Button>
			) }
			<Button
				className="cnl-section-modes__done"
				onClick={ onDone }
				size="compact"
				variant="primary"
			>
				{ __( 'Done editing' ) }
			</Button>
		</div>
	);
} );
