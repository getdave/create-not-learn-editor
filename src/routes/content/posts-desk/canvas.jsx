/**
 * The canvas beside the Posts desk: the post picked in the list, open to
 * write in the site canvas, so the list stays beside the writing. It is always
 * in Edit, with no Browse | Edit toggle, as a post is picked to be written.
 * Instead, its toolbar starts with a button that widens the editor to the
 * whole screen, putting the places and the list away, and brings them back.
 *
 * Every other canvas starts in Browse, so leaving the desk goes back to it.
 */

/**
 * Internal dependencies
 */
import { settings } from '../../../settings';
import { getTitleText } from '../../../records';
import { DocumentTitle, SiteCanvas, useSiteCanvas } from '../../../site-canvas';
import {
	MODE_BROWSE,
	MODE_EDIT,
	setCanvasMode,
	useCanvasMode,
} from '../../../site-canvas/mode';
import { getStatusLabel } from '../helpers';
import { getPagePreviewUrl } from '../pages/preview-url';
import useContentRecords from '../use-content-records';
import {
	__,
	Button,
	coreDataStore,
	EmptyState,
	fullscreenExitIcon,
	fullscreenIcon,
	Icon,
	postIcon,
	postListIcon,
	useEffect,
	useMemo,
	useSelect,
	useState,
} from '../../../wordpress-packages';

// On the body, so the stage beside the canvas can be put away with CSS.
const EXPANDED_CLASS = 'cnl-posts-desk-is-expanded';

function ExpandButton( { isExpanded, onToggle } ) {
	return (
		<Button
			__next40pxDefaultSize
			icon={ isExpanded ? fullscreenExitIcon : fullscreenIcon }
			isPressed={ isExpanded }
			label={
				isExpanded ? __( 'Show your posts' ) : __( 'Expand the editor' )
			}
			onClick={ onToggle }
			showTooltip
		/>
	);
}

function PostDocument( { postId } ) {
	const { status, title } = useSelect(
		( select ) => {
			const record = select( coreDataStore ).getEditedEntityRecord(
				'postType',
				'post',
				postId
			);

			return { status: record?.status, title: record?.title };
		},
		[ postId ]
	);

	return (
		<div className="cnl-editor-homepage-document">
			<div className="cnl-editor-homepage-document__text">
				<div className="cnl-editor-homepage-document__heading">
					<Icon
						className="cnl-editor-homepage-document__icon"
						icon={ postIcon }
					/>
					<DocumentTitle
						title={ getTitleText( title ) || __( '(no title)' ) }
					/>
				</div>
				<p className="cnl-editor-homepage-document__meta">
					{ [ __( 'Post' ), status && getStatusLabel( status ) ]
						.filter( Boolean )
						.join( ' · ' ) }
				</p>
			</div>
		</div>
	);
}

function DeskCanvas( { isExpanded, onToggleExpanded, post } ) {
	const postId = post.id;
	const pinnedEntity = useMemo(
		() => ( { postId, postType: 'post' } ),
		[ postId ]
	);
	const canvas = useSiteCanvas( {
		pinnedEntity,
		url: getPagePreviewUrl( {
			homeUrl: settings.homeUrl,
			page: post,
			savedStatus: post.status,
		} ),
	} );

	return (
		<SiteCanvas
			canvas={ canvas }
			className="cnl-posts-desk-canvas"
			document={ <PostDocument postId={ postId } /> }
			hasModeToggle={ false }
			toolbarStart={
				<ExpandButton
					isExpanded={ isExpanded }
					onToggle={ onToggleExpanded }
				/>
			}
		/>
	);
}

export default function PostsDeskCanvas() {
	const { isLoading, selectedPost } = useContentRecords();
	const mode = useCanvasMode();
	const [ isExpanded, setIsExpanded ] = useState( false );
	const canWrite = !! selectedPost && selectedPost.status !== 'trash';
	const isShownExpanded = isExpanded && canWrite;

	// Always writing, whichever mode the last canvas was in.
	useEffect( () => {
		if ( mode === MODE_BROWSE ) {
			setCanvasMode( MODE_EDIT );
		}
	}, [ mode ] );

	useEffect( () => () => setCanvasMode( MODE_BROWSE ), [] );

	useEffect( () => {
		document.body.classList.toggle( EXPANDED_CLASS, isShownExpanded );

		return () => document.body.classList.remove( EXPANDED_CLASS );
	}, [ isShownExpanded ] );

	if ( canWrite ) {
		return (
			<DeskCanvas
				isExpanded={ isShownExpanded }
				onToggleExpanded={ () => setIsExpanded( ! isExpanded ) }
				post={ selectedPost }
			/>
		);
	}

	if ( isLoading ) {
		return null;
	}

	return (
		<section className="cnl-posts-desk-canvas cnl-posts-desk-canvas--empty">
			<EmptyState.Root>
				<EmptyState.Icon icon={ postListIcon } />
				<EmptyState.Title>
					{ selectedPost
						? __( 'This post is in the trash' )
						: __( 'Your post will show here' ) }
				</EmptyState.Title>
				<EmptyState.Description>
					{ selectedPost
						? __( 'Restore it to read or change it again.' )
						: __(
								'Pick a post from the list, or write a new one.'
							) }
				</EmptyState.Description>
			</EmptyState.Root>
		</section>
	);
}
