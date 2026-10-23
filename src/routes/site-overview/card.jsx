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
	CARD_WIDTH,
	THUMBNAIL_VIEWPORT_HEIGHT,
	THUMBNAIL_VIEWPORT_WIDTH,
} from './layout';
import { useHasBeenVisible, useThumbnailTurn } from './hooks';
import {
	Badge,
	Icon,
	__,
	memo,
	useRef,
	useState,
} from '../../wordpress-packages';

const THUMBNAIL_SCALE = CARD_WIDTH / THUMBNAIL_VIEWPORT_WIDTH;

function getPlaceholderText( node ) {
	if ( node.kind === 'single' && ! node.count ) {
		return __( 'Nothing to show yet' );
	}

	if ( ! node.previewUrl ) {
		return __( 'Not on your site yet' );
	}

	return '';
}

/**
 * A small, live picture of the page: the real front end, scaled down.
 *
 * It only loads once it comes near the screen, so a big site doesn't load
 * every page at once, and it can't be clicked or focused.
 *
 * @param {Object} props         Component props.
 * @param {Object} props.node    Site Overview node.
 * @param {Object} props.rootRef The canvas's viewport.
 * @return {Element} Thumbnail.
 */
function Thumbnail( { node, rootRef } ) {
	const ref = useRef();
	const hasBeenVisible = useHasBeenVisible( ref, rootRef );
	const [ isLoaded, setIsLoaded ] = useState( false );
	const hasTurn = useThumbnailTurn(
		Boolean( node.previewUrl ) && hasBeenVisible,
		isLoaded
	);
	const placeholderText = getPlaceholderText( node );

	return (
		<div
			aria-hidden
			className={ `cnl-site-overview-card__thumbnail${
				isLoaded ? ' is-loaded' : ''
			}` }
			ref={ ref }
		>
			<div className="cnl-site-overview-card__placeholder">
				<Icon icon={ getNodeIcon( node ) } size={ 32 } />
				{ placeholderText && (
					<span className="cnl-site-overview-card__placeholder-text">
						{ placeholderText }
					</span>
				) }
			</div>
			{ node.previewUrl && hasTurn && (
				<iframe
					className="cnl-site-overview-card__frame"
					onLoad={ () => setIsLoaded( true ) }
					src={ node.previewUrl }
					style={ {
						height: THUMBNAIL_VIEWPORT_HEIGHT,
						transform: `scale(${ THUMBNAIL_SCALE })`,
						width: THUMBNAIL_VIEWPORT_WIDTH,
					} }
					tabIndex={ -1 }
					title={ node.title }
				/>
			) }
		</div>
	);
}

function SiteOverviewCard( {
	group,
	isActive,
	isRelated,
	isSelected,
	node,
	onFocusCard,
	onHover,
	onOpen,
	onSelect,
	rootRef,
} ) {
	const kindLabel = getNodeKindLabel( node );
	const className = [
		'cnl-site-overview-card',
		`is-${ node.kind }`,
		isDynamicNode( node ) && 'is-dynamic',
		hasNotableStatus( node ) && 'is-unpublished',
		isSelected && 'is-selected',
		isActive && 'is-active',
		isRelated && 'is-related',
	]
		.filter( Boolean )
		.join( ' ' );

	return (
		<div
			className={ className }
			data-node-id={ node.id }
			onDoubleClick={ () => onOpen( node ) }
			onMouseEnter={ () => onHover( node.id ) }
			onMouseLeave={ () => onHover( '' ) }
			style={ {
				height: node.height,
				left: node.x,
				top: node.y,
				width: node.width,
			} }
		>
			<Thumbnail node={ node } rootRef={ rootRef } />
			<div className="cnl-site-overview-card__caption">
				<button
					aria-current={ isSelected ? 'true' : undefined }
					className="cnl-site-overview-card__select"
					onClick={ () => onSelect( node.id ) }
					onFocus={ () => onFocusCard( node ) }
					type="button"
				>
					<span className="cnl-site-overview-card__title">
						{ node.title }
					</span>
					<span className="screen-reader-text">{ `, ${ kindLabel }` }</span>
				</button>
				<div aria-hidden className="cnl-site-overview-card__meta">
					<Icon icon={ getNodeIcon( node ) } size={ 16 } />
					<span>{ kindLabel }</span>
					{ node.kind === 'single' && (
						<span className="cnl-site-overview-card__count">
							{ getItemCountLabel( node.count, group ) }
						</span>
					) }
					{ hasNotableStatus( node ) && (
						<Badge intent="draft">{ node.statusLabel }</Badge>
					) }
				</div>
			</div>
		</div>
	);
}

/*
 * The map's contents only change with the layout, the selection and hover.
 * Memoised so that panning and zooming, which re-render the map on every
 * wheel or pointer event, only move the world rather than redraw it.
 */
export const MemoizedSiteOverviewCard = memo( SiteOverviewCard );
