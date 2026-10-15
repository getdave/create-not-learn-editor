/**
 * The Pages screen's list: every page as a tree, to reorder, nest and trash.
 */

/**
 * WordPress dependencies
 */
import { useNavigate, useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getErrorMessage } from '../../../records';
import { getPageTitle, usePages } from './data';
import {
	buildPageTree,
	countPageTree,
	filterPageTree,
	getPageDropTarget,
	getPageKeyboardTarget,
	getPageMoveChanges,
} from './page-tree';
import { getPageIcon, getPageRole, getStatusBadge } from './page-labels';
import {
	__,
	_n,
	Badge,
	Button,
	chevronDownSmallIcon,
	chevronRightSmallIcon,
	coreDataStore,
	EmptyState,
	Icon,
	Modal,
	noticesStore,
	pageIcon,
	pencilIcon,
	searchIcon,
	Skeleton,
	sprintf,
	Stack,
	Text,
	trashIcon,
	UiButton,
	useCallback,
	useDispatch,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from '../../../wordpress-packages';

/*
 * ---------------------------------------------------------------------------
 * The page tree.
 * ---------------------------------------------------------------------------
 */

export const LIST_PATH = '/types/page/list/all';

const PAGE_DRAG_TYPE = 'application/x-cnl-page';

function PageTreeRow( {
	collapsed,
	depth,
	dnd,
	node,
	onDelete,
	onEdit,
	onPreview,
	onToggle,
	previewedId,
	roles,
} ) {
	const { page, children } = node;
	const id = Number( page.id );
	const isCollapsed = collapsed.has( id );
	const status = getStatusBadge( page.status );
	const role = getPageRole( page, roles );
	const title = getPageTitle( page );
	const dropPosition = dnd.drop?.id === id ? dnd.drop.position : null;
	// Dropped just below an open parent, a page goes first among its sub-pages.
	const dropDepth =
		dropPosition === 'after' && children.length && ! isCollapsed
			? depth + 1
			: depth;
	const className = [
		'cnl-pages-tree__row',
		previewedId === id && 'is-previewed',
		dnd.dragId === id && 'is-dragging',
		dropPosition && `is-drop-${ dropPosition }`,
	]
		.filter( Boolean )
		.join( ' ' );

	return (
		<li className="cnl-pages-tree__item" data-page-id={ id }>
			<div
				className={ className }
				draggable={ dnd.isEnabled }
				onDragEnd={ dnd.onDragEnd }
				onDragOver={ ( event ) => dnd.onDragOver( event, id ) }
				onDragStart={ ( event ) => dnd.onDragStart( event, id ) }
				onDrop={ ( event ) => dnd.onDrop( event, id ) }
				style={ {
					'--cnl-pages-tree-depth': depth,
					'--cnl-pages-tree-drop-depth': dropDepth,
				} }
			>
				{ children.length ? (
					<Button
						aria-expanded={ ! isCollapsed }
						className="cnl-pages-tree__toggle"
						icon={
							isCollapsed
								? chevronRightSmallIcon
								: chevronDownSmallIcon
						}
						label={
							isCollapsed
								? sprintf(
										/* translators: %s: page title. */
										__( 'Show pages under %s' ),
										title
									)
								: sprintf(
										/* translators: %s: page title. */
										__( 'Hide pages under %s' ),
										title
									)
						}
						onClick={ () => onToggle( id ) }
						size="small"
					/>
				) : (
					<span
						aria-hidden
						className="cnl-pages-tree__toggle-spacer"
					/>
				) }
				{ /* eslint-disable-next-line jsx-a11y/role-supports-aria-props -- aria-description is a global attribute in ARIA 1.3. */ }
				<button
					aria-description={
						dnd.isEnabled
							? __(
									'Press Alt and an arrow key to move this page. Left and right move it out of, or under, another page.'
								)
							: undefined
					}
					aria-current={ previewedId === id ? 'page' : undefined }
					className="cnl-pages-tree__link"
					onClick={ () => onPreview( id ) }
					onKeyDown={ ( event ) => dnd.onKeyDown( event, id ) }
					type="button"
				>
					<Icon
						className="cnl-pages-tree__icon"
						icon={ getPageIcon( page, roles ) }
					/>
					<span className="cnl-pages-tree__title">{ title }</span>
					{ role && (
						<span className="cnl-pages-tree__role">{ role }</span>
					) }
					{ status && (
						<Badge
							className="cnl-pages-tree__status"
							intent={ status.intent }
						>
							{ status.label }
						</Badge>
					) }
				</button>
				<div className="cnl-pages-tree__actions">
					<Button
						className="cnl-pages-tree__edit"
						icon={ pencilIcon }
						label={ sprintf(
							/* translators: %s: page title. */
							__( 'Edit %s' ),
							title
						) }
						onClick={ () => onEdit( id ) }
						size="compact"
					/>
					<Button
						className="cnl-pages-tree__delete"
						icon={ trashIcon }
						label={ sprintf(
							/* translators: %s: page title. */
							__( 'Delete %s' ),
							title
						) }
						onClick={ () => onDelete( id ) }
						size="compact"
					/>
				</div>
			</div>
			{ children.length > 0 && ! isCollapsed && (
				<ul className="cnl-pages-tree__children" role="list">
					{ children.map( ( child ) => (
						<PageTreeRow
							collapsed={ collapsed }
							depth={ depth + 1 }
							dnd={ dnd }
							key={ child.page.id }
							node={ child }
							onDelete={ onDelete }
							onEdit={ onEdit }
							onPreview={ onPreview }
							onToggle={ onToggle }
							previewedId={ previewedId }
							roles={ roles }
						/>
					) ) }
				</ul>
			) }
		</li>
	);
}

function getDropPosition( event ) {
	const rect = event.currentTarget.getBoundingClientRect();
	const ratio = ( event.clientY - rect.top ) / rect.height;

	if ( ratio < 0.25 ) {
		return 'before';
	}

	return ratio > 0.75 ? 'after' : 'inside';
}

/**
 * Moving a page to the Trash, after asking. Its sub-pages move up a level
 * rather than vanishing with it.
 *
 * @param {Object}   args             Arguments.
 * @param {Object[]} args.pages       Every page.
 * @param {number}   args.previewedId The page in the preview.
 * @return {Object} `{ modal, requestDelete }`: the confirmation to render, and
 *                  a callback taking the page ID to delete and, optionally,
 *                  what to do once it is deleted.
 */
export function usePageTrash( { pages: effectivePages, previewedId } ) {
	const navigate = useNavigate();
	const searchParams = useSearch( { strict: false } );
	const { deleteEntityRecord, saveEntityRecord } =
		useDispatch( coreDataStore );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );
	const [ deleteId, setDeleteId ] = useState( null );
	const [ isDeleting, setIsDeleting ] = useState( false );
	const onDeleted = useRef();
	const requestDelete = useCallback( ( pageId, afterDelete ) => {
		onDeleted.current = afterDelete;
		setDeleteId( pageId );
	}, [] );

	const closeDeleteModal = () => {
		if ( ! isDeleting ) {
			setDeleteId( null );
		}
	};

	const deletePage = async () => {
		const page = effectivePages.find(
			( item ) => Number( item.id ) === deleteId
		);

		if ( ! page ) {
			setDeleteId( null );

			return;
		}

		const title = getPageTitle( page );
		const parent = Number( page.parent ) || 0;
		// Its children move up a level rather than vanishing with it.
		const children = effectivePages.filter(
			( item ) => ( Number( item.parent ) || 0 ) === deleteId
		);

		setIsDeleting( true );

		try {
			await Promise.all(
				children.map( ( child ) =>
					saveEntityRecord(
						'postType',
						'page',
						{ id: child.id, parent },
						{ throwOnError: true }
					)
				)
			);
			await deleteEntityRecord(
				'postType',
				'page',
				deleteId,
				{},
				{ throwOnError: true }
			);

			if ( previewedId === deleteId ) {
				navigate( {
					search: { ...searchParams, previewId: parent || undefined },
					to: LIST_PATH,
				} );
			}

			onDeleted.current?.( deleteId );
			createSuccessNotice(
				sprintf(
					/* translators: %s: page title. */
					__( '“%s” moved to Trash.' ),
					title
				),
				{ type: 'snackbar' }
			);
			setDeleteId( null );
		} catch ( error ) {
			createErrorNotice(
				sprintf(
					/* translators: 1: page title, 2: error message. */
					__( 'Unable to delete “%1$s” (%2$s).' ),
					title,
					getErrorMessage( error )
				),
				{ type: 'snackbar' }
			);
		} finally {
			setIsDeleting( false );
		}
	};

	return {
		modal: deleteId && (
			<Modal
				className="routes-navigation-edit__item-modal"
				onRequestClose={ closeDeleteModal }
				title={ __( 'Delete page' ) }
			>
				<p>
					{ sprintf(
						/* translators: %s: page title. */
						__(
							'Are you sure you want to delete “%s”? It will be moved to the Trash.'
						),
						getPageTitle(
							effectivePages.find(
								( item ) => Number( item.id ) === deleteId
							) || {}
						)
					) }
				</p>
				<div className="routes-navigation-edit__modal-actions">
					<Button
						disabled={ isDeleting }
						onClick={ closeDeleteModal }
						variant="tertiary"
					>
						{ __( 'Cancel' ) }
					</Button>
					<Button
						disabled={ isDeleting }
						isBusy={ isDeleting }
						isDestructive
						onClick={ deletePage }
						variant="primary"
					>
						{ __( 'Move to Trash' ) }
					</Button>
				</div>
			</Modal>
		),
		requestDelete,
	};
}

/**
 * Every page, nested under its parent, for the Pages screen's list.
 *
 * Pages can be dragged to reorder them, or dropped onto another page to go
 * under it. A move is saved straight away, with a way to undo it, as the tree
 * is the site's structure rather than a draft of one page.
 *
 * @param {Object}   props           Component props.
 * @param {Function} props.onAddPage Opens the add page flow.
 * @param {boolean}  props.canCreate Whether the user can add pages.
 * @return {Element} The page tree.
 */
export function PagesTree( { canCreate, onAddPage } ) {
	const navigate = useNavigate();
	const searchParams = useSearch( { strict: false } );
	const { frontPageId, isLoading, pages, postsPageId } = usePages();
	const { saveEntityRecord } = useDispatch( coreDataStore );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );
	const [ search, setSearch ] = useState( '' );
	const searchId = useId();
	const [ collapsed, setCollapsed ] = useState( () => new Set() );
	const [ dragId, setDragId ] = useState( null );
	const [ drop, setDrop ] = useState( null );
	// Moves shown before the saved pages come back, keyed by page ID.
	const [ overrides, setOverrides ] = useState( {} );
	const [ focusId, setFocusId ] = useState( null );
	const listRef = useRef();
	const effectivePages = useMemo(
		() =>
			pages.map( ( page ) =>
				overrides[ page.id ]
					? { ...page, ...overrides[ page.id ] }
					: page
			),
		[ overrides, pages ]
	);
	const roles = useMemo(
		() => ( { frontPageId, postsPageId } ),
		[ frontPageId, postsPageId ]
	);
	const tree = useMemo(
		() => buildPageTree( effectivePages, { frontPageId } ),
		[ effectivePages, frontPageId ]
	);
	const visibleTree = useMemo(
		() => filterPageTree( tree, search, getPageTitle ),
		[ search, tree ]
	);
	const previewedId =
		Number( searchParams.previewId ) ||
		frontPageId ||
		Number( tree[ 0 ]?.page.id ) ||
		0;
	const canMove = ! search.trim();

	// Forget a move once the saved page reflects it.
	useEffect( () => {
		setOverrides( ( current ) => {
			const pending = Object.entries( current ).filter(
				( [ id, override ] ) => {
					const page = pages.find(
						( item ) => Number( item.id ) === Number( id )
					);

					return (
						page &&
						( ( Number( page.parent ) || 0 ) !== override.parent ||
							( Number( page.menu_order ) || 0 ) !==
								override.menu_order )
					);
				}
			);

			return pending.length === Object.keys( current ).length
				? current
				: Object.fromEntries( pending );
		} );
	}, [ pages ] );

	// Keep focus on a page moved with the keyboard, wherever it lands.
	useEffect( () => {
		if ( ! focusId ) {
			return;
		}

		listRef.current
			?.querySelector(
				`[data-page-id="${ focusId }"] > .cnl-pages-tree__row .cnl-pages-tree__link`
			)
			?.focus();
		setFocusId( null );
	}, [ focusId, tree ] );

	const previewPage = ( pageId ) =>
		navigate( {
			search: { ...searchParams, previewId: pageId },
			to: LIST_PATH,
		} );
	const editPage = ( pageId ) =>
		navigate( {
			search: { ...searchParams, postId: pageId, previewId: pageId },
			to: LIST_PATH,
		} );
	const toggle = ( pageId ) =>
		setCollapsed( ( current ) => {
			const next = new Set( current );

			if ( next.has( pageId ) ) {
				next.delete( pageId );
			} else {
				next.add( pageId );
			}

			return next;
		} );

	const saveChanges = async ( changes ) => {
		setOverrides( ( current ) => {
			const next = { ...current };

			changes.forEach( ( change ) => {
				next[ change.id ] = {
					menu_order: change.menu_order,
					parent: change.parent,
				};
			} );

			return next;
		} );

		try {
			await Promise.all(
				changes.map( ( change ) =>
					saveEntityRecord(
						'postType',
						'page',
						{
							id: change.id,
							menu_order: change.menu_order,
							parent: change.parent,
						},
						{ throwOnError: true }
					)
				)
			);

			return true;
		} catch ( error ) {
			setOverrides( ( current ) => {
				const next = { ...current };

				changes.forEach( ( change ) => delete next[ change.id ] );

				return next;
			} );
			createErrorNotice( getErrorMessage( error ), { type: 'snackbar' } );

			return false;
		}
	};

	const movePage = async ( pageId, target ) => {
		const changes = getPageMoveChanges( tree, pageId, target );

		if ( ! changes.length ) {
			return;
		}

		const byId = new Map(
			effectivePages.map( ( page ) => [ Number( page.id ), page ] )
		);
		const previous = changes.map( ( change ) => ( {
			id: change.id,
			menu_order: Number( byId.get( change.id )?.menu_order ) || 0,
			parent: Number( byId.get( change.id )?.parent ) || 0,
		} ) );
		const title = getPageTitle( byId.get( pageId ) );
		const wasParent = Number( byId.get( pageId )?.parent ) || 0;
		let message = sprintf(
			/* translators: %s: page title. */
			__( 'Moved “%s”.' ),
			title
		);

		if ( target.parent && target.parent !== wasParent ) {
			message = sprintf(
				/* translators: 1: page title, 2: parent page title. */
				__( 'Moved “%1$s” under “%2$s”.' ),
				title,
				getPageTitle( byId.get( target.parent ) )
			);
		} else if ( ! target.parent && wasParent ) {
			message = sprintf(
				/* translators: %s: page title. */
				__( 'Moved “%s” out to the top level.' ),
				title
			);
		}

		// Show where the page went.
		if ( target.parent ) {
			setCollapsed( ( current ) => {
				const next = new Set( current );
				next.delete( target.parent );

				return next;
			} );
		}

		if ( await saveChanges( changes ) ) {
			createSuccessNotice( message, {
				actions: [
					{
						label: __( 'Undo' ),
						onClick: () => saveChanges( previous ),
					},
				],
				id: 'cnl-page-moved',
				type: 'snackbar',
			} );
		}
	};

	const trash = usePageTrash( { pages: effectivePages, previewedId } );

	const dnd = {
		drop,
		dragId,
		isEnabled: canMove,
		onDragEnd: () => {
			setDragId( null );
			setDrop( null );
		},
		onDragOver: ( event, overId ) => {
			if ( ! dragId ) {
				return;
			}

			const position = getDropPosition( event );

			if ( ! getPageDropTarget( tree, dragId, overId, position ) ) {
				if ( drop ) {
					setDrop( null );
				}

				return;
			}

			event.preventDefault();
			event.dataTransfer.dropEffect = 'move';

			if ( drop?.id !== overId || drop?.position !== position ) {
				setDrop( { id: overId, position } );
			}
		},
		onDragStart: ( event, pageId ) => {
			event.stopPropagation();
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData( PAGE_DRAG_TYPE, String( pageId ) );
			setDragId( pageId );
		},
		onDrop: ( event, overId ) => {
			event.preventDefault();

			const target =
				dragId &&
				drop &&
				getPageDropTarget(
					tree,
					dragId,
					overId,
					drop.position,
					! collapsed.has( overId )
				);

			if ( target ) {
				movePage( dragId, target );
			}

			setDragId( null );
			setDrop( null );
		},
		onKeyDown: ( event, pageId ) => {
			if ( ! canMove || ! event.altKey ) {
				return;
			}

			const target = getPageKeyboardTarget( tree, pageId, event.key );

			if ( target ) {
				event.preventDefault();
				setFocusId( pageId );
				movePage( pageId, target );
			}
		},
	};

	if ( isLoading && ! pages.length ) {
		return (
			<Stack
				aria-hidden
				className="cnl-pages-tree cnl-pages-tree--loading"
				direction="column"
				gap="md"
			>
				{ [ 62, 48, 70, 40, 56 ].map( ( width, index ) => (
					<Skeleton
						key={ index }
						style={ { height: 16, width: `${ width }%` } }
					/>
				) ) }
			</Stack>
		);
	}

	if ( ! pages.length ) {
		return (
			<EmptyState.Root className="cnl-pages-tree__empty">
				<EmptyState.Icon icon={ pageIcon } />
				<EmptyState.Title>{ __( 'No pages yet' ) }</EmptyState.Title>
				<EmptyState.Description>
					{ __( 'Add your first page to start building your site.' ) }
				</EmptyState.Description>
				{ canCreate && (
					<EmptyState.Actions>
						<UiButton onClick={ onAddPage }>
							{ __( 'Add page' ) }
						</UiButton>
					</EmptyState.Actions>
				) }
			</EmptyState.Root>
		);
	}

	return (
		<div className="cnl-pages-tree" ref={ listRef }>
			{ pages.length > 8 && (
				<label className="cnl-pages-tree__search" htmlFor={ searchId }>
					<Icon icon={ searchIcon } />
					<input
						aria-label={ __( 'Find a page' ) }
						id={ searchId }
						onChange={ ( event ) =>
							setSearch( event.target.value )
						}
						placeholder={ __( 'Find a page' ) }
						type="search"
						value={ search }
					/>
				</label>
			) }
			<ul
				aria-label={ __( 'Pages' ) }
				className={ `cnl-pages-tree__list${
					dragId ? ' is-dragging' : ''
				}` }
				role="list"
			>
				{ visibleTree.map( ( node ) => (
					<PageTreeRow
						collapsed={ collapsed }
						depth={ 0 }
						dnd={ dnd }
						key={ node.page.id }
						node={ node }
						onDelete={ trash.requestDelete }
						onEdit={ editPage }
						onPreview={ previewPage }
						onToggle={ toggle }
						previewedId={ previewedId }
						roles={ roles }
					/>
				) ) }
			</ul>
			{ ! visibleTree.length && (
				<Text className="cnl-pages-tree__no-results" variant="body-sm">
					{ __( 'No pages match your search.' ) }
				</Text>
			) }
			<Text className="cnl-pages-tree__footer" variant="body-sm">
				{ sprintf(
					/* translators: %d: number of pages. */
					_n( '%d page', '%d pages', countPageTree( tree ) ),
					countPageTree( tree )
				) }
				{ ' · ' }
				{ canMove
					? __(
							'Pick a page to see it, or use the pencil to change what is on it. Drag pages to reorder them, or onto another page to put them under it.'
						)
					: __(
							'Pick a page to see it, or use the pencil to change what is on it.'
						) }
			</Text>
			{ trash.modal }
		</div>
	);
}
