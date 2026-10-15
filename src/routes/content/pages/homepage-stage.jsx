/**
 * The homepage, opened up on the Pages screen.
 *
 * It belongs to the homepage rather than to a page, so it is there whatever
 * the homepage shows, even when no page has ever been picked for it. What it
 * shows is chosen at the top. Below that is the page's own drilldown when it
 * shows a page, or a word about the latest posts when it lists them.
 */

/**
 * Internal dependencies
 */
import ScreenLinks from '../../../screen-links';
import { useSiteTrail } from '../../../site-trail';
import useMainMenu from '../use-main-menu';
import { getPageTitle, usePages } from './data';
import {
	useHomepageState,
	useSwitchHomepage,
	useUseAsHomepage,
} from './homepage';
import {
	findDefaultHomepagePage,
	isFrontPageTemplateId,
} from './homepage-state';
import { MemoizedPageLayouts } from './page-layout-picker';
import { PageDetailStage } from './stage';
import {
	__,
	Breadcrumbs,
	Button,
	checkIcon,
	DropdownMenu,
	Icon,
	layoutIcon,
	memo,
	MenuGroup,
	MenuItem,
	Modal,
	moreVerticalIcon,
	Notice,
	Page,
	pageIcon,
	postIcon,
	postListIcon,
	SelectControl,
	sprintf,
	Stack,
	Text,
	useCallback,
	useMemo,
	useState,
} from '../../../wordpress-packages';

const LIST_PATH = '/types/page/list/all';
const NEW_PAGE = 'new';

function getStatusSuffix( status ) {
	switch ( status ) {
		case 'draft':
		case 'auto-draft':
			return __( 'Draft, will be published' );
		case 'pending':
			return __( 'Pending review, will be published' );
		case 'future':
			return __( 'Scheduled, will be published now' );
		case 'private':
			return __( 'Private, will be published' );
		default:
			return '';
	}
}

/**
 * Pages to pick from, the one the homepage remembers first.
 *
 * @param {Object[]} pages        Every page.
 * @param {number}   rememberedId The page the homepage remembers, if any.
 * @return {Object[]} Options for the page picker.
 */
function getPageOptions( pages, rememberedId ) {
	return pages
		.slice()
		.sort( ( a, b ) => {
			if ( Number( a.id ) === rememberedId ) {
				return -1;
			}

			if ( Number( b.id ) === rememberedId ) {
				return 1;
			}

			return getPageTitle( a ).localeCompare( getPageTitle( b ) );
		} )
		.map( ( page ) => {
			const suffix = getStatusSuffix( page.status );

			return {
				label: suffix
					? sprintf(
							/* translators: 1: page title, 2: what happens to it. */
							__( '%1$s (%2$s)' ),
							getPageTitle( page ),
							suffix
						)
					: getPageTitle( page ),
				value: String( page.id ),
			};
		} );
}

/**
 * Pick another page for the homepage, or start a new one. Tucked away behind
 * "A page", as most sites never need it.
 *
 * @param {Object}   props                Component props.
 * @param {number}   props.currentId      The page the homepage shows.
 * @param {Function} props.onClose        Closes it.
 * @param {Function} props.onPick         Called with the page picked.
 * @param {Function} props.onStartNewPage Opens the add page flow for it.
 * @param {Object[]} props.pages          Every page.
 * @return {Element} The dialog.
 */
function ChangePageModal( {
	currentId,
	onClose,
	onPick,
	onStartNewPage,
	pages,
} ) {
	const [ value, setValue ] = useState( '' );
	const options = useMemo(
		() =>
			getPageOptions(
				pages.filter( ( page ) => Number( page.id ) !== currentId ),
				0
			),
		[ currentId, pages ]
	);
	const usePage = ( event ) => {
		event.preventDefault();

		if ( value === NEW_PAGE ) {
			onClose();
			onStartNewPage();
			return;
		}

		const page = pages.find( ( item ) => String( item.id ) === value );

		if ( page ) {
			onClose();
			onPick( page );
		}
	};

	return (
		<Modal
			className="routes-navigation-edit__item-modal"
			onRequestClose={ onClose }
			title={ __( 'Change your homepage’s page' ) }
		>
			<form onSubmit={ usePage }>
				<SelectControl
					__next40pxDefaultSize
					label={ __( 'Page' ) }
					onChange={ setValue }
					options={ [
						{ label: __( 'Choose a page' ), value: '' },
						...options,
						{ label: __( 'Start a new page…' ), value: NEW_PAGE },
					] }
					value={ value }
				/>
				<div className="routes-navigation-edit__modal-actions">
					<Button
						onClick={ onClose }
						type="button"
						variant="tertiary"
					>
						{ __( 'Cancel' ) }
					</Button>
					<Button
						accessibleWhenDisabled
						disabled={ ! value }
						type="submit"
						variant="primary"
					>
						{ __( 'Use this page' ) }
					</Button>
				</div>
			</form>
		</Modal>
	);
}

/**
 * What the homepage shows: a page, or the latest posts.
 *
 * "A page" goes back to the page the homepage showed last, or a page called
 * Home, and starts one when there's neither. Changing which page is offered,
 * but only from the options on "A page".
 *
 * @param {Object}   props                Component props.
 * @param {Object}   props.homepage       Result of `useHomepageState`.
 * @param {Function} props.onStartNewPage Opens the add page flow for it.
 * @return {Element} The choice.
 */
function HomepageChoice( { homepage, onStartNewPage } ) {
	const { menuId } = useMainMenu();
	const { pages } = usePages();
	const { showLatestPosts } = useSwitchHomepage( homepage );
	const useAsHomepage = useUseAsHomepage( homepage );
	const [ isChanging, setIsChanging ] = useState( false );
	const showsPage = homepage.shows === 'page';
	const choices = [
		{
			description: __( 'A page you build from sections' ),
			icon: pageIcon,
			isSelected: showsPage,
			label: __( 'A page' ),
			onSelect: () => {
				if ( showsPage ) {
					return;
				}

				const page = findDefaultHomepagePage( pages, {
					getTitle: getPageTitle,
					homeTitle: __( 'Home' ),
					rememberedId: homepage.rememberedId,
				} );

				if ( page ) {
					useAsHomepage.request( page );
				} else {
					onStartNewPage();
				}
			},
			options: showsPage && (
				<DropdownMenu
					className="cnl-homepage-shows__more"
					icon={ moreVerticalIcon }
					label={ __( 'More for a page' ) }
					popoverProps={ { placement: 'bottom-end' } }
					toggleProps={ { size: 'compact' } }
				>
					{ ( { onClose } ) => (
						<MenuGroup>
							<MenuItem
								onClick={ () => {
									onClose();
									setIsChanging( true );
								} }
							>
								{ __( 'Change page' ) }
							</MenuItem>
						</MenuGroup>
					) }
				</DropdownMenu>
			),
		},
		{
			description: __( 'Your newest blog posts, newest first' ),
			icon: postListIcon,
			isSelected: ! showsPage,
			label: __( 'Your latest posts' ),
			onSelect: () => {
				if ( showsPage ) {
					showLatestPosts( menuId );
				}
			},
		},
	];

	return (
		<section
			aria-label={ __( 'Your homepage shows' ) }
			className="cnl-homepage-shows"
		>
			<Stack direction="column" gap="xs">
				<h3 className="cnl-page-sections__title">
					{ __( 'Your homepage shows' ) }
				</h3>
				<Text className="cnl-page-sections__hint" variant="body-sm">
					{ __( 'What visitors see first when they arrive.' ) }
				</Text>
			</Stack>
			<ul className="cnl-homepage-shows__options" role="list">
				{ choices.map( ( choice ) => (
					<li
						className={ `cnl-homepage-shows__choice${
							choice.options ? ' has-options' : ''
						}` }
						key={ choice.label }
					>
						<button
							aria-pressed={ choice.isSelected }
							className="cnl-homepage-shows__option"
							onClick={ choice.onSelect }
							type="button"
						>
							<Icon
								className="cnl-homepage-shows__icon"
								icon={ choice.icon }
							/>
							<span className="cnl-homepage-shows__text">
								<span className="cnl-homepage-shows__label">
									{ choice.label }
								</span>
								<span className="cnl-homepage-shows__description">
									{ choice.description }
								</span>
							</span>
							{ choice.isSelected && (
								<Icon
									className="cnl-homepage-shows__check"
									icon={ checkIcon }
									size={ 20 }
								/>
							) }
						</button>
						{ choice.options }
					</li>
				) ) }
			</ul>
			{ isChanging && (
				<ChangePageModal
					currentId={ homepage.pageId }
					onClose={ () => setIsChanging( false ) }
					onPick={ useAsHomepage.request }
					onStartNewPage={ onStartNewPage }
					pages={ pages }
				/>
			) }
			{ useAsHomepage.modal }
		</section>
	);
}

/**
 * Says so when visitors can't see the homepage, with ways to put it right.
 *
 * @param {Object} props          Component props.
 * @param {Object} props.homepage Result of `useHomepageState`.
 * @return {?Element} The notice, if there's a problem.
 */
function HomepageProblem( { homepage } ) {
	const { menuId } = useMainMenu();
	const { showLatestPosts } = useSwitchHomepage( homepage );
	const useAsHomepage = useUseAsHomepage( homepage );

	if ( ! homepage.problem ) {
		return null;
	}

	const actions = [];

	if ( homepage.problem === 'unpublished' && homepage.page ) {
		actions.push( {
			label: sprintf(
				/* translators: %s: page title. */
				__( 'Publish “%s”' ),
				getPageTitle( homepage.page )
			),
			onClick: () => useAsHomepage.request( homepage.page ),
			variant: 'secondary',
		} );
	}

	if ( homepage.canSwitch ) {
		actions.push( {
			label: __( 'Show your latest posts' ),
			onClick: () => showLatestPosts( menuId ),
			variant: 'link',
		} );
	}

	return (
		<>
			<Notice
				actions={ actions }
				className="cnl-homepage-problem"
				isDismissible={ false }
				status="warning"
			>
				{ homepage.problem === 'missing'
					? __(
							'Visitors can’t see your homepage. The page it showed has gone. Pick another page, or show your latest posts.'
						)
					: __(
							'Visitors can’t see your homepage, as its page isn’t published. Publish it, pick another page, or show your latest posts.'
						) }
			</Notice>
			{ useAsHomepage.modal }
		</>
	);
}

function getSentence( homepage ) {
	if ( homepage.shows === 'theme' ) {
		return __(
			'Your theme designs your homepage, so it always looks like this.'
		);
	}

	if ( homepage.canSwitch ) {
		return '';
	}

	return homepage.shows === 'posts'
		? __( 'Your homepage shows your latest posts.' )
		: sprintf(
				/* translators: %s: page title. */
				__( 'Your homepage shows “%s”.' ),
				getPageTitle( homepage.page )
			);
}

/**
 * The top of the homepage: anything wrong with it, and what it shows.
 *
 * @param {Object}   props                Component props.
 * @param {Object}   props.homepage       Result of `useHomepageState`.
 * @param {Function} props.onStartNewPage Opens the add page flow for it.
 * @return {Element} The intro.
 */
function HomepageIntro( { homepage, onStartNewPage } ) {
	const sentence = getSentence( homepage );

	return (
		<>
			<HomepageProblem homepage={ homepage } />
			{ sentence && (
				<Text className="cnl-homepage-intro" variant="body-md">
					{ sentence }
				</Text>
			) }
			{ homepage.canSwitch && homepage.shows !== 'theme' && (
				<HomepageChoice
					homepage={ homepage }
					onStartNewPage={ onStartNewPage }
				/>
			) }
		</>
	);
}

const MemoizedHomepageIntro = memo( HomepageIntro );

/**
 * Where to change how the latest posts look: the layout listing them, among
 * the posts' layouts or the pages', or every layout when it is `index`.
 *
 * @param {string} templateId The layout's ID.
 * @return {Object} `{ search, to }`.
 */
function getLayoutDestination( templateId ) {
	const search = { content: 'templates', postIds: [ templateId ] };

	if ( String( templateId ).endsWith( '//home' ) ) {
		return { search, to: '/types/post/list/all' };
	}

	if ( isFrontPageTemplateId( templateId ) ) {
		return { search, to: LIST_PATH };
	}

	return { to: '/templates' };
}

/**
 * The homepage when no page is behind it: a word about what it lists, and
 * ways on to the posts and to how they look.
 *
 * @param {Object} props          Component props.
 * @param {Object} props.homepage Result of `useHomepageState`.
 * @return {Element} The body.
 */
function LatestPostsBody( { homepage } ) {
	const layout = homepage.latestPostsTemplateId
		? getLayoutDestination( homepage.latestPostsTemplateId )
		: null;

	return (
		<>
			{ homepage.shows === 'posts' && (
				<Text className="cnl-homepage-intro" variant="body-md">
					{ __( 'Shows your newest posts, newest first.' ) }
				</Text>
			) }
			<MemoizedPageLayouts
				isFrontPage
				pageId={ 0 }
				sectionCount={ 0 }
				showsLatestPosts
				slug=""
			/>
			<ScreenLinks
				label={ __( 'More for your homepage' ) }
				links={ [
					{
						description: __( 'Write, edit and publish blog posts' ),
						icon: postIcon,
						title: __( 'Edit your posts' ),
						to: '/types/post/list/all',
					},
					layout && {
						description: __(
							'Change the layout your latest posts are listed in'
						),
						icon: layoutIcon,
						search: layout.search,
						title: __( 'Change how it looks' ),
						to: layout.to,
					},
				].filter( Boolean ) }
			/>
		</>
	);
}

/**
 * The homepage, opened up.
 *
 * @param {Object}   props                Component props.
 * @param {Function} props.onStartNewPage Opens the add page flow, for a new
 *                                        page to be the homepage.
 * @return {Element} The homepage stage.
 */
export default function HomepageStage( { onStartNewPage } ) {
	const homepage = useHomepageState();
	const siteTrail = useSiteTrail();
	const startNewPage = useCallback(
		() => onStartNewPage?.(),
		[ onStartNewPage ]
	);
	const intro = (
		<MemoizedHomepageIntro
			homepage={ homepage }
			onStartNewPage={ startNewPage }
		/>
	);

	if ( homepage.pageId ) {
		return (
			<PageDetailStage
				intro={ intro }
				isHomepage
				key={ homepage.pageId }
				pageId={ homepage.pageId }
			/>
		);
	}

	return (
		<Page
			ariaLabel={ __( 'Homepage' ) }
			breadcrumbs={
				<Breadcrumbs
					items={ [
						...siteTrail,
						{ label: __( 'Pages' ), to: LIST_PATH },
						{ label: __( 'Homepage' ) },
					] }
				/>
			}
			className="cnl-editor-stage cnl-drilldown-stage cnl-pages-detail"
			hasPadding={ false }
			headingLevel={ 2 }
		>
			<div className="cnl-pages-detail__body">
				{ ! homepage.isLoading && intro }
				{ ! homepage.isLoading && (
					<LatestPostsBody homepage={ homepage } />
				) }
			</div>
		</Page>
	);
}
