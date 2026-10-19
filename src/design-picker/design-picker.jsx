/**
 * The shell the "Add a page" and "Add a section" modals share, so picking a
 * design looks and feels the same whatever is being added: a heading with a
 * line of help, controls on the right, a list of kinds down the left, and the
 * designs to the right of it.
 */

/**
 * WordPress dependencies
 */
import { Button, Modal } from '@wordpress/components';
import { useId } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
	chevronLeft as chevronLeftIcon,
	chevronRight as chevronRightIcon,
	closeSmall as closeSmallIcon,
	plus as plusIcon,
} from '@wordpress/icons';
import { Icon, Text } from '@wordpress/ui';

/**
 * The modal.
 *
 * @param {Object}   props               Component props.
 * @param {string}   props.title         Heading.
 * @param {string}   props.subtitle      Line of help under the heading.
 * @param {Element}  props.belowHeading  Controls under the line of help.
 * @param {Element}  props.actions       Controls beside the close button.
 * @param {Element}  props.nav           The list of kinds, if there is one.
 * @param {Element}  props.children      The designs, or whatever the step
 *                                       shows.
 * @param {string}   props.className     Extra class for the modal.
 * @param {string}   props.mainClassName Extra class for the main area.
 * @param {Object}   props.mainRef       Ref to the main area, which scrolls.
 * @param {Function} props.onClose       Called to close.
 * @return {Element} The modal.
 */
export function DesignPicker( {
	title,
	subtitle,
	belowHeading,
	actions,
	nav,
	children,
	className,
	mainClassName,
	mainRef,
	onClose,
} ) {
	const titleId = useId();

	return (
		<Modal
			__experimentalHideHeader
			aria={ { labelledby: titleId } }
			className={ [ 'cnl-design-picker', className ]
				.filter( Boolean )
				.join( ' ' ) }
			focusOnMount="firstContentElement"
			onRequestClose={ onClose }
			size="fill"
		>
			<div
				className={ `cnl-design-picker__layout${ nav ? '' : ' has-no-nav' }` }
			>
				<header className="cnl-design-picker__header">
					<div className="cnl-design-picker__heading">
						<Text
							className="cnl-design-picker__title"
							id={ titleId }
							render={ <h2 /> }
							variant="heading-xl"
						>
							{ title }
						</Text>
						{ subtitle && (
							<Text
								className="cnl-design-picker__subtitle"
								render={ <p /> }
								variant="body-md"
							>
								{ subtitle }
							</Text>
						) }
						{ belowHeading }
					</div>
					<div className="cnl-design-picker__header-actions">
						{ actions }
						<Button
							icon={ closeSmallIcon }
							label={ __( 'Close' ) }
							onClick={ onClose }
						/>
					</div>
				</header>
				{ nav }
				<div
					className={ [ 'cnl-design-picker__main', mainClassName ]
						.filter( Boolean )
						.join( ' ' ) }
					ref={ mainRef }
				>
					{ children }
				</div>
			</div>
		</Modal>
	);
}

/**
 * The list of kinds down the left.
 *
 * @param {Object}   props            Component props.
 * @param {string}   props.label      Accessible name of the list.
 * @param {Object[]} props.items      `{ value, label }` for each kind.
 * @param {string}   props.current    Value of the kind showing.
 * @param {boolean}  props.isDisabled Whether picking a kind is off.
 * @param {Function} props.onSelect   Called with the value picked.
 * @param {Element}  props.children   Shown instead of the items, such as
 *                                    while they load.
 * @return {Element} The list.
 */
export function DesignPickerNav( {
	label,
	items,
	current,
	isDisabled,
	onSelect,
	children,
} ) {
	return (
		<nav
			aria-label={ label }
			className={ `cnl-design-picker__nav${ isDisabled ? ' is-disabled' : '' }` }
		>
			{ children || (
				<ul className="cnl-design-picker__nav-list" role="list">
					{ items.map( ( item ) => (
						<li key={ item.value }>
							<button
								aria-current={
									! isDisabled && current === item.value
										? 'true'
										: undefined
								}
								className="cnl-design-picker__nav-item"
								disabled={ isDisabled }
								onClick={ () => onSelect( item.value ) }
								type="button"
							>
								{ item.label }
							</button>
						</li>
					) ) }
				</ul>
			) }
		</nav>
	);
}

/**
 * The strip above the designs for starting with nothing.
 *
 * @param {Object}   props             Component props.
 * @param {string}   props.description What starting from scratch gives you.
 * @param {boolean}  props.isSelected  Whether it is the choice made, where
 *                                     the choice waits to be confirmed.
 * @param {Function} props.onClick     Called when picked.
 * @return {Element} The strip.
 */
export function StartFromScratch( {
	description,
	isSelected = false,
	onClick,
} ) {
	return (
		<button
			aria-pressed={ isSelected || undefined }
			className={ `cnl-design-picker__scratch${
				isSelected ? ' is-selected' : ''
			}` }
			onClick={ onClick }
			type="button"
		>
			<span aria-hidden className="cnl-design-picker__scratch-icon">
				<Icon icon={ plusIcon } />
			</span>
			<span className="cnl-design-picker__scratch-text">
				<span className="cnl-design-picker__scratch-title">
					{ __( 'Start from scratch' ) }
				</span>
				<span className="cnl-design-picker__scratch-description">
					{ description }
				</span>
			</span>
			<Icon
				className="cnl-design-picker__scratch-chevron"
				icon={
					document.documentElement.dir === 'rtl'
						? chevronLeftIcon
						: chevronRightIcon
				}
			/>
		</button>
	);
}

/**
 * A group's heading: its name, a few words on what it is for, and anything
 * that belongs on the right, such as paging.
 *
 * @param {Object}  props             Component props.
 * @param {string}  props.id          Element ID.
 * @param {string}  props.label       Group name.
 * @param {string}  props.description What the group is for.
 * @param {Element} props.children    Shown on the right.
 * @return {Element} The heading row.
 */
export function GroupHeading( { id, label, description, children } ) {
	const heading = (
		<h3 className="cnl-design-picker__group-heading" id={ id }>
			<span className="cnl-design-picker__group-label">{ label }</span>
			{ description && (
				<span className="cnl-design-picker__group-description">
					{ description }
				</span>
			) }
		</h3>
	);

	if ( ! children ) {
		return heading;
	}

	return (
		<div className="cnl-design-picker__group-header">
			{ heading }
			{ children }
		</div>
	);
}

/**
 * A grid shape drawn as an icon, for choosing how many designs show at once.
 * Drawn here rather than pulled from `@wordpress/icons` so every option shares
 * one style and mirrors its own grid. The cells are solid: outlines this small
 * blur into rings once there are three to a row.
 *
 * @param {Object} props         Component props.
 * @param {number} props.columns Columns drawn.
 * @param {number} props.rows    Rows drawn.
 * @return {Element} The icon.
 */
export function GridShapeIcon( { columns, rows } ) {
	const size = 14;
	const gap = 2;
	const width = ( size - gap * ( columns - 1 ) ) / columns;
	const height = ( size - gap * ( rows - 1 ) ) / rows;
	const cells = [];

	for ( let row = 0; row < rows; row++ ) {
		for ( let column = 0; column < columns; column++ ) {
			cells.push( { column, row } );
		}
	}

	return (
		<svg
			aria-hidden
			fill="currentColor"
			focusable={ false }
			height={ 24 }
			viewBox="0 0 24 24"
			width={ 24 }
			xmlns="http://www.w3.org/2000/svg"
		>
			{ cells.map( ( { column, row } ) => (
				<rect
					height={ height }
					key={ `${ row }-${ column }` }
					rx={ 1 }
					width={ width }
					x={ 5 + column * ( width + gap ) }
					y={ 5 + row * ( height + gap ) }
				/>
			) ) }
		</svg>
	);
}
