/**
 * Manage posts, on the bar over a section that lists posts: one button,
 * named after what the section lists (Manage products for a shop's), that
 * opens a small menu of the few things worth changing about the list, each
 * a labelled dropdown: how many, which category and the order. Under them,
 * Manage all posts leads to the posts' own screen, where they are written.
 * Nothing else of the query loop's is offered.
 */

/**
 * WordPress dependencies
 */
import { postList as postListIcon } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import {
	__,
	Button,
	Dropdown,
	SelectControl,
	sprintf,
} from '../../wordpress-packages';
import { ORDER_NEWEST, ORDER_OLDEST, usePostsChoice } from './posts-section';

/**
 * The menu's controls, for the section's query loop.
 *
 * @param {Object}   props
 * @param {string}   props.clientId    The section.
 * @param {Function} props.onManageAll Leads to the posts' screen.
 * @return {Element} The controls.
 */
function PostsControls( { clientId, onManageAll } ) {
	const posts = usePostsChoice( clientId );

	if ( ! posts ) {
		return null;
	}

	const { counts, label, layout } = posts;
	const name = label.toLowerCase();
	// A category is only worth offering when there is more than one.
	const terms = posts.terms?.length > 1 ? posts.terms : null;
	const termId = layout.termIds.length === 1 ? layout.termIds[ 0 ] : 0;
	// The number in use, even when it isn't one offered.
	const countOptions = counts.includes( layout.perPage )
		? counts
		: [ ...counts, layout.perPage ].sort( ( a, b ) => a - b );

	return (
		<div className="cnl-section-modes__posts-menu">
			{ ! layout.inherit && (
				<>
					<SelectControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ __( 'How many to show' ) }
						onChange={ ( value ) =>
							posts.onCount( Number( value ) )
						}
						options={ countOptions.map( ( count ) => ( {
							label: sprintf(
								/* translators: 1: how many. 2: the posts' plural name, lowercase, like posts. */
								__( '%1$d %2$s' ),
								count,
								name
							),
							value: String( count ),
						} ) ) }
						value={ String( layout.perPage ) }
					/>
					{ terms && (
						<SelectControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							label={ sprintf(
								/* translators: %s: the posts' plural name, lowercase, like posts. */
								__( 'Show %s from' ),
								name
							) }
							onChange={ ( value ) =>
								posts.onTerm( Number( value ) || null )
							}
							options={ [
								{
									label: __( 'All categories' ),
									value: '0',
								},
								...terms.map( ( term ) => ( {
									label: term.name,
									value: String( term.id ),
								} ) ),
							] }
							value={ String( termId ) }
						/>
					) }
					<SelectControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label={ __( 'Order' ) }
						onChange={ posts.onOrder }
						options={ [
							{
								label: __( 'Newest first' ),
								value: ORDER_NEWEST,
							},
							{
								label: __( 'Oldest first' ),
								value: ORDER_OLDEST,
							},
						] }
						value={ layout.order }
					/>
				</>
			) }
			<Button
				__next40pxDefaultSize
				className="cnl-section-modes__posts-manage-all"
				onClick={ onManageAll }
				variant="secondary"
			>
				{ sprintf(
					/* translators: %s: the posts' plural name, lowercase, like posts. */
					__( 'Manage all %s' ),
					name
				) }
			</Button>
		</div>
	);
}

/**
 * @param {Object}   props
 * @param {string}   props.clientId    The section.
 * @param {Object}   props.posts       `{ label }`, from `usePostsSection`.
 * @param {boolean}  props.isCompact   Whether the button is an icon only.
 * @param {Function} props.onToggle    Called with whether the menu is open.
 * @param {Function} props.onManageAll Leads to the posts' screen.
 * @return {Element} The button and its menu.
 */
export default function PostsMenu( {
	clientId,
	isCompact,
	onManageAll,
	onToggle,
	posts,
} ) {
	const text = sprintf(
		/* translators: %s: the posts' plural name, lowercase, like posts. */
		__( 'Manage %s' ),
		posts.label.toLowerCase()
	);

	return (
		<Dropdown
			contentClassName="cnl-section-modes__posts-popover"
			onToggle={ onToggle }
			popoverProps={ { placement: 'bottom' } }
			renderContent={ ( { onClose } ) => (
				<PostsControls
					clientId={ clientId }
					onManageAll={ () => {
						onClose();
						onManageAll();
					} }
				/>
			) }
			renderToggle={ ( { isOpen, onToggle: toggle } ) => (
				<Button
					aria-expanded={ isOpen }
					aria-haspopup="dialog"
					className="cnl-section-modes__bar-button"
					icon={ postListIcon }
					isPressed={ isOpen }
					label={ isCompact ? text : undefined }
					onClick={ toggle }
					showTooltip={ isCompact }
					size="compact"
					tooltipPosition="bottom"
				>
					{ isCompact ? null : text }
				</Button>
			) }
		/>
	);
}
