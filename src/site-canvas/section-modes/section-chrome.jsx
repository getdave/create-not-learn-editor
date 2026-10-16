/**
 * The controls Edit lays over a section: its name, the bar over it while it
 * is pointed at, with Add, the two ways to edit it and its own moves, and
 * the small bar that names the mode it is in.
 */

/**
 * WordPress dependencies
 */
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
import {
	__,
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
 * The two ways to edit a section, on the bar over it.
 *
 * @return {Object[]} `{ mode, label, description, icon }` for each.
 */
export function getModes() {
	return [
		{
			description: __(
				'Pick a layout and colours, remove items, or move things freely'
			),
			icon: designIcon,
			label: __( 'Edit design' ),
			mode: MODE_DESIGN,
		},
		{
			description: __( 'Change text and images; positions stay put' ),
			icon: pencilIcon,
			label: __( 'Edit content' ),
			mode: MODE_CONTENT,
		},
	];
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
		__( 'You’re editing the %s on every page of your site' ),
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
 * @param {Object}  props.style    Where it sits.
 * @return {Element} The tab.
 */
export function SectionTab( { isInside, isPart, style, title } ) {
	return (
		<span
			aria-hidden
			title={ title }
			className={ `cnl-section-modes__tab${
				isInside ? ' is-inside' : ''
			}` }
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

function BarButton( { className = '', icon, label, text, ...props } ) {
	return (
		<button
			aria-label={ text ? undefined : label }
			className={ `cnl-section-modes__bar-button ${ className }` }
			title={ label }
			type="button"
			{ ...props }
		>
			<LegacyIcon icon={ icon } size={ text ? 20 : 18 } />
			{ text && <span>{ text }</span> }
		</button>
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
				<button
					aria-expanded={ isOpen }
					aria-haspopup="menu"
					className="cnl-section-modes__add-toggle"
					onClick={ toggle }
					type="button"
				>
					<LegacyIcon icon={ plusIcon } size={ 18 } />
					{ __( 'Add' ) }
				</button>
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
				{ getModes().map( ( { description, icon, label, mode } ) => (
					<BarButton
						icon={ icon }
						key={ mode }
						label={ isCompact ? label : description }
						onClick={ () => onMode( mode ) }
						text={ isCompact ? null : label }
					/>
				) ) }
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
							className="is-destructive"
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
 * The small bar that names the mode a section is in, in Edit content and
 * Freeform.
 *
 * @param {Object}    props
 * @param {string}    props.label        The mode's name.
 * @param {?Function} props.onBack       Goes back to Edit design's panel,
 *                                       from Freeform.
 * @param {string}    props.hint         How the mode works.
 * @param {?string}   props.sitewide     Words for a header or footer.
 * @param {number}    props.removedCount How many items were taken out.
 * @param {Object}    props.style        Where it sits.
 * @param {Function}  props.onRestore    Puts back what was taken out.
 * @param {Function}  props.onDone       Leaves the mode.
 * @return {Element} The bar.
 */
export function ModeBar( {
	hint,
	label,
	onBack,
	onDone,
	onRestore,
	removedCount,
	sitewide,
	style,
} ) {
	return (
		<div className="cnl-section-modes__mode-bar" style={ style }>
			<span className="cnl-section-modes__mode-label" title={ hint }>
				{ label }
			</span>
			{ sitewide && (
				<span className="cnl-section-modes__sitewide">
					<LegacyIcon icon={ globeIcon } size={ 16 } />
					{ sitewide }
				</span>
			) }
			{ removedCount > 0 && (
				<button
					className="cnl-section-modes__text-button"
					onClick={ onRestore }
					title={ __( 'Bring back removed items' ) }
					type="button"
				>
					{ sprintf(
						/* translators: %d: number of items removed. */
						__( 'Restore (%d)' ),
						removedCount
					) }
				</button>
			) }
			{ onBack && (
				<button
					className="cnl-section-modes__text-button"
					onClick={ onBack }
					title={ __( 'Back to Edit design' ) }
					type="button"
				>
					{ __( 'Back' ) }
				</button>
			) }
			<button
				className="cnl-section-modes__done"
				onClick={ onDone }
				type="button"
			>
				{ __( 'Done' ) }
			</button>
		</div>
	);
}
