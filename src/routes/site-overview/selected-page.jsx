/**
 * Internal dependencies
 */
import {
	getItemCountLabel,
	getNodeIcon,
	getNodeKindLabel,
	hasNotableStatus,
	isDynamicNode,
} from './data';
import { getPopoverPosition, getScreenRect } from './viewport';
import { useElementSize } from './hooks';
import {
	Badge,
	Button,
	Icon,
	Link,
	Stack,
	Text,
	UiButton,
	__,
	closeSmallIcon,
	sprintf,
	useRef,
} from '../../wordpress-packages';

/**
 * What the selected page is, and a way to edit it, in a card beside it on
 * the canvas. It moves with the canvas, staying on screen.
 *
 * @param {Object}   props             Component props.
 * @param {Object}   props.group       Content type the page belongs to.
 * @param {boolean}  props.isAnimating Whether the canvas is animating to a
 *                                     new view, which the card follows.
 * @param {Object}   props.node        Selected page.
 * @param {Function} props.onClose     Clears the selection.
 * @param {Function} props.onEdit      Opens the page in a site canvas, or
 *                                     undefined when it can't be edited.
 * @param {Object}   props.size        The canvas's size on screen.
 * @param {Object}   props.view        The canvas's view.
 * @return {Element} Popover.
 */
export function SelectedPage( {
	group,
	isAnimating,
	node,
	onClose,
	onEdit,
	size,
	view,
} ) {
	const ref = useRef();
	const popoverSize = useElementSize( ref );
	const card = getScreenRect( view, node );
	const isOffScreen =
		card.right < 0 ||
		card.bottom < 0 ||
		card.left > size.width ||
		card.top > size.height;
	const { left, top } = getPopoverPosition( card, popoverSize, size );
	const isDynamic = isDynamicNode( node );
	const details = [
		node.description,
		node.layout
			? sprintf(
					/* translators: %s: Layout (template) name. */
					__( 'Uses the “%s” layout.' ),
					node.layout
				)
			: '',
	].filter( Boolean );

	return (
		// eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape closes the popover from anywhere inside it.
		<aside
			aria-label={ node.title }
			className={ [
				'cnl-site-overview__selected',
				isAnimating && 'is-animating',
				// Measured before it is placed, so it doesn't flash in the corner.
				( ! popoverSize.width || isOffScreen ) && 'is-hidden',
			]
				.filter( Boolean )
				.join( ' ' ) }
			onKeyDown={ ( event ) => {
				if ( event.key === 'Escape' ) {
					event.stopPropagation();
					onClose();
				}
			} }
			ref={ ref }
			style={ { left, top } }
		>
			<Stack align="flex-start" gap="sm" justify="space-between">
				<Stack align="center" gap="sm">
					<Icon icon={ getNodeIcon( node ) } size={ 20 } />
					<Text
						className="cnl-site-overview__selected-title"
						render={ <h2 /> }
						variant="heading-md"
					>
						{ node.title }
					</Text>
				</Stack>
				<Button
					icon={ closeSmallIcon }
					label={ __( 'Close' ) }
					onClick={ onClose }
					size="small"
				/>
			</Stack>
			<Stack gap="xs" wrap="wrap">
				<Badge intent={ isDynamic ? 'informational' : 'none' }>
					{ isDynamic
						? sprintf(
								/* translators: %s: Kind of dynamic page, e.g. "Collection". */
								__( 'Dynamic · %s' ),
								getNodeKindLabel( node )
							)
						: getNodeKindLabel( node ) }
				</Badge>
				{ node.kind === 'single' && (
					<Badge>{ getItemCountLabel( node.count, group ) }</Badge>
				) }
				{ hasNotableStatus( node ) && (
					<Badge intent="draft">{ node.statusLabel }</Badge>
				) }
			</Stack>
			{ details.map( ( detail ) => (
				<Text
					className="cnl-site-overview__selected-detail"
					key={ detail }
					variant="body-sm"
				>
					{ detail }
				</Text>
			) ) }
			<Stack align="center" gap="md" wrap="wrap">
				<UiButton disabled={ ! onEdit } onClick={ onEdit }>
					{ __( 'Edit' ) }
				</UiButton>
				{ node.url && (
					<Link href={ node.url } openInNewTab>
						{ __( 'View' ) }
					</Link>
				) }
			</Stack>
		</aside>
	);
}
