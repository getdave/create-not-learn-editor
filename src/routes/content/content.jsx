import { useNavigate, useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { withCanvasRecovery } from '../../canvas-recovery';
import { withScreenKey } from '../../screen-key';
import { getCurrentEditorPath } from '../static/screens';
import { withUiTheme } from '../../theme';
import { useSiteTrail } from '../../site-trail';
import { usePostsTrip } from '../../site-canvas/mode';
import { getTemplateDisplayDescription } from '../../records';
import { EMPTY_ARRAY } from './page-layouts';
import { requestDistractionFreeEntry } from '../../editor-layer/distraction-free';
import { getActiveWorkspace } from '../../workspaces/presets';
import useMainMenu from './use-main-menu';
import { PageDetailStage } from './pages/stage';
import { parseTarget, useHomepageState } from './pages/homepage';
import { HOMEPAGE } from './pages/homepage-state';
import HomepageStage from './pages/homepage-stage';
import PagesMenuGroups from './pages/menu-groups';
import AddPageFlow from './add-page-flow';
import Canvas from './canvas';
import {
	DEFAULT_CONTENT_LAYOUTS,
	PostListDataViewsLayout,
	getContentActions,
	getContentFields,
	usePostAuthors,
} from './content-fields';
import { getPostViewEmpty } from './post-views';
import PostsDesk from './posts-desk';
import useCoreTrashActions from './use-core-trash-actions';
import PostKindPicker from '../../pickers/post-kinds';
import { isAskingPostKind } from '../../post-kinds-base';
import { getTemplateTitle } from './helpers';
import PagesTable from './pages-table';
import useContentRecords from './use-content-records';
import { useDataViews } from '../../use-dataviews';
import {
	Breadcrumbs,
	Button,
	checkIcon,
	coreDataStore,
	createInterpolateElement,
	draftsIcon,
	lockIcon,
	pendingIcon,
	publishedIcon,
	scheduledIcon,
	searchIcon,
	trashIcon,
	DropdownMenu,
	EmptyState,
	Icon,
	MenuGroup,
	MenuItem,
	Spinner,
	Tabs,
	__,
	layoutIcon,
	LegacyIcon,
	moreVerticalIcon,
	pageIcon,
	postFeaturedImageIcon,
	postListIcon,
	Page,
	sprintf,
	useEffect,
	useMemo,
	useSelect,
	useState,
} from '../../wordpress-packages';

// The icon an empty status tab shows, by its slug.
const EMPTY_TAB_ICONS = {
	drafts: draftsIcon,
	future: scheduledIcon,
	pending: pendingIcon,
	private: lockIcon,
	published: publishedIcon,
	trash: trashIcon,
};

function getTemplateIcon( template ) {
	if ( template?.slug === 'home' ) {
		return postListIcon;
	}

	if ( template?.slug === 'single' ) {
		return postFeaturedImageIcon;
	}

	return layoutIcon;
}

function TabLabel( { icon, label } ) {
	return (
		<span className="routes-post-list__tab-label">
			{ icon && (
				<LegacyIcon
					className="routes-post-list__tab-icon"
					icon={ icon.replace( /^dashicons-/, '' ) }
					size={ 20 }
				/>
			) }
			{ label }
		</span>
	);
}

function Stage() {
	const navigate = useNavigate();
	const searchParams = useSearch( { strict: false } );
	const siteTrail = useSiteTrail();
	const postsTrip = usePostsTrip();
	// Where a page being added goes: in the menu, out of it, or the user picks.
	const [ addingPage, setAddingPage ] = useState( null );
	const [ isPickingPostKind, setIsPickingPostKind ] = useState( false );
	const {
		activeTab,
		statusView,
		contentView,
		error,
		isLoading,
		posts,
		previewTemplates,
		selectedPost,
		selectedTemplateId,
		setContentView,
		templates,
		type,
	} = useContentRecords();
	const mainMenu = useMainMenu();
	const homepage = useHomepageState();
	const { frontPageId, postsPageId } = useSelect( ( select ) => {
		const site = select( coreDataStore ).getEditedEntityRecord(
			'root',
			'site'
		);

		return {
			frontPageId:
				site?.show_on_front === 'page'
					? Number( site?.page_on_front ) || 0
					: 0,
			postsPageId:
				site?.show_on_front === 'page'
					? Number( site?.page_for_posts ) || 0
					: 0,
		};
	}, [] );
	const isPages = type?.name === 'page';
	// Posts are listed, worded and written as the workspace says.
	const workspace = useSelect( getActiveWorkspace, [] );
	const isAskingKind = useSelect(
		( select ) => isAskingPostKind( select, workspace ),
		[ workspace ]
	);
	const postsSettings = type?.name === 'post' ? workspace.posts : null;
	// Lists by status move posts to and from the trash with core's own
	// actions.
	const trashActions = useCoreTrashActions( statusView ? type?.name : null );
	// Pages lists its pages in menu groups; every other type in DataViews.
	const dataViews = useDataViews(
		!! type && ! isPages && type.name !== 'post'
	);
	const authors = usePostAuthors( isPages ? EMPTY_ARRAY : posts );
	const contentFields = useMemo(
		() =>
			getContentFields(
				{
					frontPageId,
					isListedByStatus: !! statusView,
					isPages,
					menuPages: mainMenu.menuPages,
					postsPageId,
				},
				authors
			),
		[
			authors,
			frontPageId,
			isPages,
			mainMenu.menuPages,
			postsPageId,
			statusView,
		]
	);
	const contentActions = useMemo( () => {
		if ( ! type ) {
			return [];
		}

		const actions = getContentActions( navigate, type );

		if ( ! statusView ) {
			return actions;
		}

		// A post in the trash can only be restored or deleted for good.
		return [
			...actions.map( ( action ) => ( {
				...action,
				isEligible: ( item ) =>
					item.status !== 'trash' &&
					( action.isEligible?.( item ) ?? true ),
			} ) ),
			...trashActions,
		];
	}, [ navigate, statusView, trashActions, type ] );
	const previewTemplatesKey = useMemo(
		() =>
			previewTemplates
				.map( ( template ) => `${ template.id }:${ template.slug }` )
				.join( '|' ),
		[ previewTemplates ]
	);

	// Asked to add one from outside the list, like the admin bar's New page.
	const isAddRequested = !! searchParams.add && !! type;
	useEffect( () => {
		if ( ! isAddRequested ) {
			return;
		}

		navigate( {
			replace: true,
			search: { ...searchParams, add: undefined },
		} );

		if ( type.name === 'page' ) {
			setAddingPage( {} );
		} else if ( type.name === 'post' && isAskingKind ) {
			setIsPickingPostKind( true );
		} else {
			navigate( { to: `/types/${ type.name }/new` } );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ isAddRequested ] );

	if ( ! type ) {
		return null;
	}

	const listPath = `/types/${ type.name }/list/${ statusView?.slug || 'all' }`;
	const showTemplates = activeTab === 'templates';
	const drilled =
		isPages && ! showTemplates ? parseTarget( searchParams.postId ) : 0;

	// The homepage's page opens as the homepage, however it was reached.
	if ( drilled === HOMEPAGE || ( drilled && drilled === homepage.pageId ) ) {
		return (
			<>
				<HomepageStage
					onStartNewPage={ () =>
						setAddingPage( { menuPlacement: 'homepage' } )
					}
				/>
				{ addingPage && (
					<AddPageFlow
						mainMenu={ mainMenu }
						menuPlacement={ addingPage.menuPlacement }
						onClose={ () => setAddingPage( null ) }
						templates={ templates }
					/>
				) }
			</>
		);
	}

	if ( drilled ) {
		return <PageDetailStage key={ drilled } pageId={ drilled } />;
	}
	const onChangeContentView = ( nextView ) => {
		setContentView( nextView );
		navigate( {
			search: {
				...searchParams,
				content: undefined,
				page:
					nextView.page && nextView.page > 1
						? nextView.page
						: undefined,
				search: nextView.search || undefined,
			},
			to: listPath,
		} );
	};
	const selectPost = ( postId ) =>
		navigate( {
			search: {
				...searchParams,
				postIds: postId ? [ String( postId ) ] : undefined,
			},
			to: listPath,
		} );
	const openEditor = ( postId ) => {
		requestDistractionFreeEntry();
		navigate( {
			to: `/types/${ type.name }/edit/${ postId }`,
		} );
	};
	const selectTemplate = ( templateId ) =>
		navigate( {
			search: {
				...searchParams,
				content: 'templates',
				postIds: templateId ? [ String( templateId ) ] : undefined,
				templateId: undefined,
				templateIds: undefined,
			},
			to: listPath,
		} );
	const handleContentTabChange = ( nextTab ) => {
		navigate( {
			search: {
				...searchParams,
				content: [ 'all', 'templates' ].includes( nextTab )
					? nextTab
					: undefined,
				page: undefined,
				postId: undefined,
				postIds: undefined,
				search: undefined,
				templateId: undefined,
				templateIds: undefined,
			},
			to: listPath,
		} );
	};
	const manageHomepage = () =>
		navigate( {
			search: { postId: HOMEPAGE, previewId: HOMEPAGE },
			to: listPath,
		} );
	const totalPages = Math.max(
		1,
		Math.ceil( posts.length / ( contentView.perPage || 20 ) )
	);
	const addLabel =
		postsSettings?.addLabel ||
		sprintf(
			/* translators: %s: post type singular label. */
			__( 'Add %s' ),
			( type.singular || type.name ).toLowerCase()
		);
	const openCreateFlow = ( menuPlacement ) => {
		if ( type.name === 'page' ) {
			setAddingPage( {
				menuPlacement:
					typeof menuPlacement === 'string'
						? menuPlacement
						: undefined,
			} );
			return;
		}

		if ( ! type.blockEditor ) {
			if ( type.newUrl ) {
				window.open( type.newUrl, '_blank', 'noopener,noreferrer' );
			}
			return;
		}

		// Asked what kind of post it is first, unless they'd rather not be.
		if ( type.name === 'post' && isAskingKind ) {
			setIsPickingPostKind( true );
			return;
		}

		if ( type.name === 'post' && workspace.writeInFocus ) {
			requestDistractionFreeEntry();
		}

		navigate( {
			to: `/types/${ type.name }/new`,
		} );
	};
	const pageActions = (
		<div className="routes-post-list__page-actions">
			{ type.canCreate && (
				<Button
					__next40pxDefaultSize
					onClick={ openCreateFlow }
					variant="primary"
				>
					{ addLabel }
				</Button>
			) }
			{ type.name === 'page' && (
				<DropdownMenu
					className="routes-post-list__more-options"
					icon={ moreVerticalIcon }
					label={ __( 'Page options' ) }
					popoverProps={ { placement: 'bottom-end' } }
					toggleProps={ {
						__next40pxDefaultSize: true,
						variant: 'tertiary',
					} }
				>
					{ ( { onClose } ) => (
						<MenuGroup>
							<MenuItem
								onClick={ () => {
									handleContentTabChange( 'all' );
									onClose();
								} }
							>
								{ __( 'Manage pages' ) }
							</MenuItem>
							<MenuItem
								onClick={ () => {
									handleContentTabChange( 'templates' );
									onClose();
								} }
							>
								{ __( 'Manage layouts' ) }
							</MenuItem>
							<MenuItem
								onClick={ () => {
									manageHomepage();
									onClose();
								} }
							>
								{ __( 'Manage homepage' ) }
							</MenuItem>
						</MenuGroup>
					) }
				</DropdownMenu>
			) }
		</div>
	);
	// A status says what it would hold, not to write a first post.
	const tabEmpty =
		statusView && getPostViewEmpty( statusView, contentView.search );
	let emptyIcon = type.name === 'page' ? pageIcon : postListIcon;

	if ( tabEmpty ) {
		emptyIcon = contentView.search
			? searchIcon
			: EMPTY_TAB_ICONS[ statusView.slug ] || emptyIcon;
	}

	const contentEmpty = tabEmpty ? (
		<div className="cnl-editor-empty-state">
			<EmptyState.Root>
				<EmptyState.Icon icon={ emptyIcon } />
				<EmptyState.Title>{ tabEmpty.title }</EmptyState.Title>
				<EmptyState.Description>
					{ tabEmpty.description }
				</EmptyState.Description>
				{ tabEmpty.canWrite && type.canCreate && (
					<EmptyState.Actions>
						<Button
							__next40pxDefaultSize
							onClick={ openCreateFlow }
							variant="primary"
						>
							{ addLabel }
						</Button>
					</EmptyState.Actions>
				) }
			</EmptyState.Root>
		</div>
	) : (
		<div className="cnl-editor-empty-state">
			<EmptyState.Root>
				<EmptyState.Icon
					icon={ type.name === 'page' ? pageIcon : postListIcon }
				/>
				<EmptyState.Title>
					{ sprintf(
						/* translators: %s: post type plural label. */
						__( 'No %s yet' ),
						( type.label || type.name ).toLowerCase()
					) }
				</EmptyState.Title>
				<EmptyState.Description>
					{ sprintf(
						/* translators: %s: post type singular label. */
						__(
							'Create your first %s to start adding content here.'
						),
						( type.singular || type.name ).toLowerCase()
					) }
				</EmptyState.Description>
				{ type.canCreate && (
					<EmptyState.Actions>
						<Button
							__next40pxDefaultSize
							onClick={ openCreateFlow }
							variant="primary"
						>
							{ addLabel }
						</Button>
					</EmptyState.Actions>
				) }
			</EmptyState.Root>
		</div>
	);
	const templateEmpty = (
		<div className="cnl-editor-empty-state">
			<EmptyState.Root>
				<EmptyState.Icon icon={ layoutIcon } />
				<EmptyState.Title>
					{ __( 'No templates found' ) }
				</EmptyState.Title>
				<EmptyState.Description>
					{ sprintf(
						/* translators: %s: post type label. */
						__( 'No templates are currently available for %s.' ),
						( type.label || type.name ).toLowerCase()
					) }
				</EmptyState.Description>
			</EmptyState.Root>
		</div>
	);

	const isPagesTable = isPages && searchParams.content === 'all';
	let pagesList = null;

	if ( isPages ) {
		pagesList = isPagesTable ? (
			<PagesTable listPath={ listPath } mainMenu={ mainMenu } />
		) : (
			<PagesMenuGroups
				canCreate={ type.canCreate }
				onAddPage={ openCreateFlow }
			/>
		);
	}

	let contentList = pagesList;

	if ( type.name === 'post' ) {
		contentList = (
			<PostsDesk
				empty={ contentEmpty }
				isLoading={ isLoading }
				onChangeView={ onChangeContentView }
				onSelect={ selectPost }
				posts={ posts }
				selectedPost={ selectedPost }
				statusSlug={ statusView?.slug }
				totalPages={ totalPages }
				trashActions={ trashActions }
				view={ contentView }
			/>
		);
	} else if ( ! isPages && ! dataViews ) {
		contentList = (
			<div className="cnl-editor-spinner">
				<Spinner />
			</div>
		);
	} else if ( ! isPages ) {
		const { DataViews } = dataViews;

		contentList = (
			<DataViews
				actions={ contentActions }
				data={ posts }
				defaultLayouts={ DEFAULT_CONTENT_LAYOUTS }
				empty={ contentEmpty }
				fields={ contentFields }
				getItemId={ ( item ) => String( item.id ) }
				isLoading={ isLoading }
				key={ `${ previewTemplatesKey }|${ frontPageId }|${ postsPageId }|${
					mainMenu.menuPages ? 'menu' : 'no-menu'
				}` }
				onChangeSelection={ () => {} }
				onChangeView={ onChangeContentView }
				onClickItem={ ( item ) => {
					if ( item.status === 'trash' ) {
						return;
					}

					if ( type.blockEditor ) {
						openEditor( item.id );
					} else {
						selectPost( item.id );
					}
				} }
				paginationInfo={ {
					totalItems: posts.length,
					totalPages,
				} }
				selection={ EMPTY_ARRAY }
				view={ contentView }
			>
				<PostListDataViewsLayout />
			</DataViews>
		);
	}

	// Pages has no tabs: its layouts open from the options menu, as a step
	// down from Pages with a way back.
	const isLayoutsStep = showTemplates && isPages;
	// Layouts and the table of all pages are steps down from Pages.
	let subScreenLabel = null;

	if ( isLayoutsStep ) {
		subScreenLabel = __( 'Layouts' );
	} else if ( isPagesTable ) {
		subScreenLabel = __( 'All pages' );
	}

	const title = type.menuName || type.label;
	// Opened from a section's Edit posts, the list leads back to its page.
	// Opened from the "Home" screen, or the Header or Footer screen,
	// Pages leads back there.
	let siteCrumbs = siteTrail;

	if ( postsTrip?.postType === type.name ) {
		siteCrumbs = [ { label: postsTrip.label, to: postsTrip.to } ];
	}
	const pageHeader = subScreenLabel
		? {
				ariaLabel: subScreenLabel,
				breadcrumbs: (
					<Breadcrumbs
						items={ [
							...siteCrumbs,
							{
								label: title,
								// Back up keeps the way back to where the
								// visit began.
								to: searchParams.from
									? `${ listPath }?${ new URLSearchParams( {
											from: searchParams.from,
										} ) }`
									: listPath,
							},
							{ label: subScreenLabel },
						] }
					/>
				),
				className: 'cnl-editor-stage cnl-editor-content-page',
			}
		: {
				actions: pageActions,
				ariaLabel: title,
				breadcrumbs:
					siteCrumbs.length > 0 ? (
						<Breadcrumbs
							items={ [ ...siteCrumbs, { label: title } ] }
						/>
					) : undefined,
				className: `cnl-editor-stage cnl-editor-content-page${
					type.name === 'post' && ! showTemplates
						? ' cnl-posts-desk-page'
						: ''
				}`,
				subTitle:
					( type.name === 'page' &&
						__(
							'Every page on your site. Pick one to see it, or edit it to change what is on it.'
						) ) ||
					postsSettings?.description ||
					type.description ||
					sprintf(
						/* translators: %s: post type label. */
						__( 'Browse, preview, and edit %s.' ),
						( type.label || type.name ).toLowerCase()
					),
				title: siteCrumbs.length > 0 ? undefined : title,
			};

	return (
		<Page { ...pageHeader } hasPadding={ false } headingLevel={ 2 }>
			{ ! isPages && (
				<div className="routes-post-list__tabs-wrapper">
					<Tabs.Root
						onValueChange={ handleContentTabChange }
						value={ showTemplates ? 'templates' : 'content' }
					>
						<Tabs.List>
							<Tabs.Tab value="content">
								<TabLabel
									icon={ type.menuIcon }
									label={ type.menuName || type.label }
								/>
							</Tabs.Tab>
							<Tabs.Tab value="templates">
								<TabLabel
									icon="dashicons-layout"
									label={ __( 'Layouts' ) }
								/>
							</Tabs.Tab>
						</Tabs.List>
					</Tabs.Root>
				</div>
			) }
			{ showTemplates && (
				<p className="cnl-editor-stage__description">
					{ sprintf(
						/* translators: %s: post type label. */
						__(
							'Layouts decide how your %s are arranged, like where the title and image go. WordPress calls these templates. Changing a layout changes every page that uses it.'
						),
						( type.label || type.name ).toLowerCase()
					) }
				</p>
			) }
			{ error && <div className="cnl-editor-empty">{ error }</div> }
			{ showTemplates ? (
				<div className="cnl-editor-list routes-post-list__templates">
					{ isLoading && (
						<div className="cnl-editor-spinner">
							<Spinner />
						</div>
					) }
					{ ! isLoading && templates.length > 0 && (
						// Drawn as the homepage's choices are: picking a
						// layout shows it on the canvas.
						<ul
							aria-label={ __( 'Layouts' ) }
							className="cnl-homepage-shows__options"
							role="list"
						>
							{ templates.map( ( template ) => {
								const isSelected =
									String( selectedTemplateId ) ===
									String( template.id );
								const description =
									getTemplateDisplayDescription( template );

								return (
									<li key={ template.id }>
										<button
											aria-pressed={ isSelected }
											className="cnl-homepage-shows__option"
											onClick={ () =>
												selectTemplate( template.id )
											}
											type="button"
										>
											<Icon
												className="cnl-homepage-shows__icon"
												icon={ getTemplateIcon(
													template
												) }
											/>
											<span className="cnl-homepage-shows__text">
												<span className="cnl-homepage-shows__label">
													{ getTemplateTitle(
														template
													) }
												</span>
												{ description && (
													<span className="cnl-homepage-shows__description">
														{ description }
													</span>
												) }
											</span>
											{ isSelected && (
												<Icon
													className="cnl-homepage-shows__check"
													icon={ checkIcon }
													size={ 20 }
												/>
											) }
										</button>
									</li>
								);
							} ) }
						</ul>
					) }
					{ ! isLoading && templates.length === 0 && templateEmpty }
				</div>
			) : (
				contentList
			) }
			{ showTemplates && templates.length > 0 && (
				<p className="routes-post-list__template-footer">
					{ createInterpolateElement(
						sprintf(
							/* translators: %s: post type singular label, like "Post". */
							__(
								'For more advanced control <a>view all %s layouts</a>'
							),
							type.singular || type.name
						),
						{
							a: (
								<Button
									onClick={ () =>
										navigate( {
											// Keeps the way back to where the
											// visit began.
											search: searchParams.from
												? { from: searchParams.from }
												: undefined,
											to: '/templates',
										} )
									}
									variant="link"
								/>
							),
						}
					) }
				</p>
			) }
			{ isPickingPostKind && (
				<PostKindPicker
					isFocusedOpen={ workspace.writeInFocus }
					onClose={ () => setIsPickingPostKind( false ) }
				/>
			) }
			{ addingPage && type.name === 'page' && (
				<AddPageFlow
					mainMenu={ mainMenu }
					menuPlacement={ addingPage.menuPlacement }
					onClose={ () => setAddingPage( null ) }
					templates={ templates }
				/>
			) }
		</Page>
	);
}

export const stage = withUiTheme( Stage );
// A content type's own address and its lists had a module each.
export const canvas = withScreenKey(
	withCanvasRecovery( withUiTheme( Canvas ) ),
	() => ( /\/list\//.test( getCurrentEditorPath() ) ? 'list' : 'type' )
);
