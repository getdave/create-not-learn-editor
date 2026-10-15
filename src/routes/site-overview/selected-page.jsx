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
import {
	Badge,
	Icon,
	Link,
	Stack,
	Text,
	UiButton,
	__,
	sprintf,
} from '../../wordpress-packages';

/**
 * What the selected page is, and ways to edit or visit it, floating over the
 * canvas.
 *
 * @param {Object}   props         Component props.
 * @param {Object}   props.group   Content type the page belongs to.
 * @param {Object}   props.node    Selected page.
 * @param {Function} props.onClose Clears the selection.
 * @param {Function} props.onOpen  Opens the page's editor.
 * @return {Element} Panel.
 */
export function SelectedPage( { group, node, onClose, onOpen } ) {
	const isDynamic = isDynamicNode( node );
	const details = [
		node.description,
		node.kind === 'single' && node.previewOf
			? sprintf(
					/* translators: %s: Title of the item shown in the preview. */
					__( 'Previewed with “%s”, the latest one.' ),
					node.previewOf
				)
			: '',
		node.layout
			? sprintf(
					/* translators: %s: Layout (template) name. */
					__( 'Uses the “%s” layout.' ),
					node.layout
				)
			: '',
	].filter( Boolean );

	return (
		// eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Escape closes the panel from anywhere inside it.
		<aside
			aria-label={ __( 'Selected page' ) }
			className="cnl-site-overview__selected"
			onKeyDown={ ( event ) => {
				if ( event.key === 'Escape' ) {
					event.stopPropagation();
					onClose();
				}
			} }
		>
			<Stack align="center" gap="sm">
				<Icon icon={ getNodeIcon( node ) } size={ 24 } />
				<Text
					className="cnl-site-overview__selected-title"
					render={ <h2 /> }
					variant="heading-md"
				>
					{ node.title }
				</Text>
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
			<Stack align="center" gap="sm" wrap="wrap">
				<UiButton
					disabled={ ! node.editLink }
					onClick={ () => onOpen( node ) }
				>
					{ isDynamic ? __( 'Edit layout' ) : __( 'Edit page' ) }
				</UiButton>
				{ node.url && (
					<Link href={ node.url } openInNewTab>
						{ __( 'View' ) }
					</Link>
				) }
				<UiButton onClick={ onClose } variant="minimal">
					{ __( 'Close' ) }
				</UiButton>
			</Stack>
		</aside>
	);
}
