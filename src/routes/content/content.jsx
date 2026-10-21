import { useNavigate, useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { withCanvasRecovery } from '../../canvas-recovery';
import { withScreenKey } from '../../screen-key';
import { getCurrentEditorPath } from '../static/screens';
import { withUiTheme } from '../../theme';
import { useSiteTrail } from '../../site-trail';
import { getTemplateAuthorText } from '../../records';
import { EMPTY_ARRAY } from './page-layouts';
import { requestDistractionFreeEntry } from '../../editor-layer/distraction-free';
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
} from './content-fields';
import { getStatusLabel, getTemplateTitle } from './helpers';
import PagesTable from './pages-table';
import useContentRecords from './use-content-records';
import { useDataViews } from '../../use-dataviews';
import {
	Breadcrumbs,
	Button,
	coreDataStore,
	DropdownMenu,
	EmptyState,
	Icon,
	infoIcon,
	MenuGroup,
	MenuItem,
	Popover,
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
	useMemo,
	useSelect,
	useState,
} from '../../wordpress-packages';

function getTemplateIcon( template ) {
	if ( template?.slug === 'home' ) {
		return postListIcon;
	}

	if ( template?.slug === 'single' ) {
		return postFeaturedImageIcon;
	}

	return layoutIcon;
}

function getTemplateDescription( template ) {
	return template?.description || '';
}

function TemplateDescriptionInfo( { authorText, description } ) {
	const [ isOpen, setIsOpen ] = useState( false );

	if ( ! description && ! authorText ) {
		return null;
	}

	return (
		<span className="routes-post-list__template-card-info">
			<Button
				aria-expanded={ isOpen }
				icon={ infoIcon }
				label={ __( 'Template description' ) }
				onClick={ ( event ) => {
					event.stopPropagation();
					setIsOpen( ( open ) => ! open );
				} }
				size="small"
			/>
			{ isOpen && (
				<Popover
					className="routes-post-list__template-card-info-popover"
					focusOnMount="container"
					onClose={ () => setIsOpen( false ) }
					placement="right-start"
					resize={ false }
					shift
				>
					<span className="routes-post-list__template-card-info-content">
						{ description && (
							<span className="routes-post-list__template-card-info-description">
								{ description }
							</span>
						) }
						{ authorText && (
							<span className="routes-post-list__template-card-info-author">
								{ sprintf(
									/* translators: %s: template author name. */
									__( 'Author: %s' ),
									authorText
								) }
							</span>
						) }
					</span>
				</Popover>
			) }
		</span>
	);
}

function getTemplateStatusLabel( template ) {
	if ( template?.slug === 'page' || template?.slug === 'front-page' ) {
		return __( 'Default' );
	}

	if ( template?.status === 'publish' ) {
		return __( 'Active' );
	}

	return getStatusLabel( template?.status );
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
	// Where a page being added goes: in the menu, out of it, or the user picks.
	const [ addingPage, setAddingPage ] = useState( null );
	const {
		activeTab,
		contentView,
		error,
		isLoading,
		posts,
		previewTemplates,
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
	// Pages lists its pages in menu groups; every other type in DataViews.
	const dataViews = useDataViews( !! type && ! isPages );
	const contentFields = useMemo(
		() =>
			getContentFields( {
				frontPageId,
				isPages,
				menuPages: mainMenu.menuPages,
				postsPageId,
			} ),
		[ frontPageId, isPages, mainMenu.menuPages, postsPageId ]
	);
	const contentActions = useMemo(
		() => ( type ? getContentActions( navigate, type ) : [] ),
		[ navigate, type ]
	);
	const previewTemplatesKey = useMemo(
		() =>
			previewTemplates
				.map( ( template ) => `${ template.id }:${ template.slug }` )
				.join( '|' ),
		[ previewTemplates ]
	);

	if ( ! type ) {
		return null;
	}

	const listPath = `/types/${ type.name }/list/all`;
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
	const addLabel = sprintf(
		/* translators: %s: post type singular label. */
		__( 'Add %s' ),
		type.singular || type.name
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
					label={ __( 'Page Options' ) }
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
	const contentEmpty = (
		<div className="cnl-editor-empty-state">
			<EmptyState.Root>
				<EmptyState.Icon
					icon={ type.name === 'page' ? pageIcon : postListIcon }
				/>
				<EmptyState.Title>
					{ sprintf(
						/* translators: %s: post type plural label. */
						__( 'No %s yet' ),
						type.label || type.name
					) }
				</EmptyState.Title>
				<EmptyState.Description>
					{ sprintf(
						/* translators: %s: post type singular label. */
						__(
							'Create your first %s to start adding content here.'
						),
						type.singular || type.name
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

	if ( ! isPages && ! dataViews ) {
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
				onClickItem={ ( item ) =>
					type.blockEditor
						? openEditor( item.id )
						: selectPost( item.id )
				}
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
	const isPageLayouts = isPages && showTemplates;
	// Layouts and the table of all pages are steps down from Pages.
	let subScreenLabel = null;

	if ( isPageLayouts ) {
		subScreenLabel = __( 'Layouts' );
	} else if ( isPagesTable ) {
		subScreenLabel = __( 'All pages' );
	}

	const title = type.menuName || type.label;
	// Opened from the "Your site" screen, or the Header or Footer screen,
	// Pages leads back there.
	const siteCrumbs = isPages ? siteTrail : [];
	const pageHeader = subScreenLabel
		? {
				ariaLabel: subScreenLabel,
				breadcrumbs: (
					<Breadcrumbs
						items={ [
							...siteCrumbs,
							{ label: title, to: listPath },
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
				className: 'cnl-editor-stage cnl-editor-content-page',
				subTitle:
					( type.name === 'page' &&
						__(
							'Every page on your site. Pick one to see it, or edit it to change what is on it.'
						) ) ||
					( type.name === 'post' &&
						__( 'Your blog posts, newest first.' ) ) ||
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
					{ ! isLoading &&
						templates.map( ( template ) => {
							const isSelected =
								String( selectedTemplateId ) ===
								String( template.id );

							return (
								<div
									key={ template.id }
									className="routes-post-list__template-card-wrapper"
								>
									<button
										aria-pressed={ isSelected }
										className={ `routes-post-list__template-card${
											isSelected ? ' is-selected' : ''
										}` }
										onClick={ () =>
											selectTemplate( template.id )
										}
										type="button"
									>
										<span
											aria-hidden
											className="routes-post-list__template-card-icon"
										>
											<Icon
												icon={ getTemplateIcon(
													template
												) }
											/>
										</span>
										<span className="routes-post-list__template-card-content">
											<span className="routes-post-list__template-card-title">
												{ getTemplateTitle( template ) }
											</span>
											<span className="routes-post-list__template-badge">
												{ getTemplateStatusLabel(
													template
												) }
											</span>
										</span>
									</button>
									<TemplateDescriptionInfo
										authorText={ getTemplateAuthorText(
											template
										) }
										description={ getTemplateDescription(
											template
										) }
									/>
								</div>
							);
						} ) }
					{ ! isLoading && templates.length === 0 && templateEmpty }
				</div>
			) : (
				contentList
			) }
			{ showTemplates && templates.length > 0 && (
				<div className="routes-post-list__template-footer">
					<span>
						{ __(
							'Other parts of your site have layouts too.'
						) }{ ' ' }
					</span>
					<Button
						onClick={ () => navigate( { to: '/templates' } ) }
						variant="link"
					>
						{ __( 'See all layouts.' ) }
					</Button>
				</div>
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
