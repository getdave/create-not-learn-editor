/**
 * The homepage on the Pages screen: what it shows, the ways to change that,
 * and how a menu item linking to it is marked.
 *
 * Every change is an edit to review and save with the rest. Nothing is written
 * while the screen loads, however odd the stored settings.
 */

/**
 * Internal dependencies
 */
import { getErrorMessage } from '../../../records';
import { settings } from '../../../settings';
import { getEditedMenuContent } from '../use-main-menu';
import {
	getParsedBlocks,
	hasPageListBlock,
	serializeNavigationBlocks,
} from '../../navigation-edit/navigation-blocks';
import { getPageTitle } from './data';
import {
	getHomepageState,
	HOMEPAGE,
	isFrontPageTemplateId,
	replacePageLinksWithHomeLinks,
} from './homepage-state';
import {
	__,
	blocksStore,
	Button,
	coreDataStore,
	dispatch,
	getBlockVariations,
	homeIcon,
	Modal,
	noticesStore,
	select,
	sprintf,
	useCallback,
	useDispatch,
	useMemo,
	useSelect,
	useState,
} from '../../../wordpress-packages';

/**
 * Read a Pages screen address value as the homepage or a page ID.
 *
 * @param {*} value `postId` or `previewId` from the address.
 * @return {string|number} `HOMEPAGE`, a page ID, or 0.
 */
export function parseTarget( value ) {
	return value === HOMEPAGE ? HOMEPAGE : Number( value ) || 0;
}

/**
 * The homepage as visitors will get it, unsaved changes included.
 *
 * @return {Object} `getHomepageState`'s result, plus the page it shows or
 *                  remembers (`page`), whether the user may change what it
 *                  shows (`canSwitch`), the layout it lists posts in
 *                  (`latestPostsTemplateId`) and the saved settings, which the
 *                  preview needs to tell what is unsaved (`saved`).
 */
export function useHomepageState() {
	const {
		canSwitch,
		frontId,
		frontState,
		frontStatus,
		frontTitle,
		latestPostsTemplateId,
		saved,
		showOnFront,
		pageOnFront,
	} = useSelect( ( selectStore ) => {
		const store = selectStore( coreDataStore );
		const edited = store.getEditedEntityRecord( 'root', 'site' );
		const savedSite = store.getEntityRecord( 'root', 'site' );
		const id = Number( edited?.page_on_front ) || 0;
		const args = [ 'postType', 'page', id ];
		// Asked for, so the edited record below is there to read.
		const record = id ? store.getEntityRecord( ...args ) : undefined;
		// Only the fields used are read: the page's edited record is new on
		// every keystroke while the homepage is being edited.
		let front = {};

		if ( id && record ) {
			const page = store.getEditedEntityRecord( ...args );

			front = {
				frontState: 'found',
				frontStatus: page?.status,
				frontTitle: page?.title,
			};
		} else if (
			id &&
			store.hasFinishedResolution( 'getEntityRecord', args )
		) {
			front = { frontState: 'missing' };
		}

		return {
			canSwitch: !! store.canUser( 'update', {
				kind: 'root',
				name: 'site',
			} ),
			frontId: id,
			latestPostsTemplateId: store.getDefaultTemplateId( {
				slug: 'front-page',
			} ),
			pageOnFront: edited?.page_on_front,
			saved: savedSite,
			showOnFront: edited?.show_on_front,
			...front,
		};
	}, [] );
	// The page's record, as far as the homepage reads it: null when it doesn't
	// exist, undefined while loading.
	const frontPage = useMemo( () => {
		if ( frontState === 'found' ) {
			return { id: frontId, status: frontStatus, title: frontTitle };
		}

		return frontState === 'missing' ? null : undefined;
	}, [ frontId, frontState, frontStatus, frontTitle ] );
	const page = frontPage || null;
	const hasFrontPageTemplate = isFrontPageTemplateId( latestPostsTemplateId );

	return useMemo(
		() => ( {
			...getHomepageState( {
				frontPage,
				hasFrontPageTemplate,
				pageOnFront,
				showOnFront,
			} ),
			canSwitch,
			isLoading: showOnFront === undefined,
			latestPostsTemplateId,
			page,
			saved,
			showOnFront,
		} ),
		[
			canSwitch,
			frontPage,
			hasFrontPageTemplate,
			latestPostsTemplateId,
			page,
			pageOnFront,
			saved,
			showOnFront,
		]
	);
}

/**
 * The plain words for what the homepage shows, under its name.
 *
 * @param {Object} state Result of `useHomepageState`.
 * @return {Object} `{ summary, badge }`, the badge only when visitors can't
 *                  see the homepage.
 */
export function getHomepageSummary( state ) {
	if ( state.shows === 'theme' ) {
		return { summary: __( 'Designed by your theme' ) };
	}

	if ( state.shows === 'posts' ) {
		return { summary: __( 'Your latest posts' ) };
	}

	if ( state.problem === 'missing' ) {
		return {
			badge: { intent: 'high', label: __( 'Page missing' ) },
			summary: '',
		};
	}

	return {
		badge:
			state.problem === 'unpublished'
				? { intent: 'medium', label: __( 'Not published' ) }
				: null,
		summary: state.page ? getPageTitle( state.page ) : '',
	};
}

/**
 * What a menu needs to know to spot links to the homepage.
 *
 * @param {Object} state Result of `useHomepageState`.
 * @return {Object} `{ frontPageId, homeUrl }`, for `isHomeMenuItem`.
 */
export function getHomeLinkContext( state ) {
	return { frontPageId: state.pageId, homeUrl: settings.homeUrl };
}

/*
 * ---------------------------------------------------------------------------
 * Switching what the homepage shows.
 * ---------------------------------------------------------------------------
 */

/*
 * Edits made as one switch are staged, then the last one closes the undo
 * level, so Undo takes the whole switch back at once.
 */
const STAGED = { isCached: true };

/**
 * Ways to change what the homepage shows.
 *
 * @param {Object} state Result of `useHomepageState`.
 * @return {Object} `{ showLatestPosts, showPage }`.
 */
export function useSwitchHomepage( state ) {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const { createErrorNotice } = useDispatch( noticesStore );

	/**
	 * Show a page. One that isn't published is published with it, once the
	 * user has agreed to that (see `useUseAsHomepage`).
	 *
	 * @param {Object} page Page record.
	 */
	const showPage = useCallback(
		( page ) => {
			const id = Number( page.id );
			const site = select( coreDataStore ).getEditedEntityRecord(
				'root',
				'site'
			);
			const siteEdits = { page_on_front: id, show_on_front: 'page' };

			// WordPress muddles a page that is both the homepage and the blog.
			if ( Number( site?.page_for_posts ) === id ) {
				siteEdits.page_for_posts = 0;
			}

			if ( page.status !== 'publish' ) {
				editEntityRecord(
					'postType',
					'page',
					id,
					{ status: 'publish' },
					STAGED
				);
			}

			editEntityRecord( 'root', 'site', undefined, siteEdits );
		},
		[ editEntityRecord ]
	);

	/**
	 * Show the latest posts. A menu set by hand that linked the page keeps
	 * going home: the link becomes a Home link in its place. A menu that lists
	 * every page is left as it is.
	 *
	 * @param {number} [menuId] The main menu's ID, if there is one.
	 */
	const showLatestPosts = useCallback(
		async ( menuId ) => {
			const pageId = state.pageId;

			try {
				const content =
					menuId && pageId
						? await getEditedMenuContent( menuId )
						: '';
				const blocks = getParsedBlocks( content );
				const next =
					content && ! hasPageListBlock( blocks )
						? replacePageLinksWithHomeLinks(
								blocks,
								pageId,
								__( 'Home' )
							)
						: blocks;

				if ( next !== blocks ) {
					editEntityRecord(
						'postType',
						'wp_navigation',
						menuId,
						{
							blocks: undefined,
							content: serializeNavigationBlocks( next ),
							selection: undefined,
						},
						STAGED
					);
				}
			} catch ( error ) {
				createErrorNotice( getErrorMessage( error ), {
					type: 'snackbar',
				} );
			}

			editEntityRecord( 'root', 'site', undefined, {
				show_on_front: 'posts',
			} );
		},
		[ createErrorNotice, editEntityRecord, state.pageId ]
	);

	return { showLatestPosts, showPage };
}

/**
 * Make a page the homepage, asking first if that means publishing it.
 *
 * @param {Object} state Result of `useHomepageState`.
 * @return {Object} `{ modal, request }`: the confirmation to render, and a
 *                  callback taking the page record.
 */
export function useUseAsHomepage( state ) {
	const { showPage } = useSwitchHomepage( state );
	const [ pending, setPending ] = useState( null );
	const request = useCallback(
		( page ) => {
			if ( page.status === 'publish' ) {
				showPage( page );
			} else {
				setPending( page );
			}
		},
		[ showPage ]
	);
	const close = () => setPending( null );

	return {
		modal: pending && (
			<Modal
				className="routes-navigation-edit__item-modal"
				onRequestClose={ close }
				title={ __( 'Publish this page?' ) }
			>
				<p>
					{ sprintf(
						/* translators: %s: page title. */
						__(
							'“%s” isn’t published yet. To be your homepage, visitors need to see it, so it will be published when you save your changes.'
						),
						getPageTitle( pending )
					) }
				</p>
				<div className="routes-navigation-edit__modal-actions">
					<Button onClick={ close } variant="tertiary">
						{ __( 'Cancel' ) }
					</Button>
					<Button
						onClick={ () => {
							showPage( pending );
							close();
						} }
						variant="primary"
					>
						{ __( 'Publish and use as homepage' ) }
					</Button>
				</div>
			</Modal>
		),
		request,
	};
}

/*
 * ---------------------------------------------------------------------------
 * Home links in lists of menu items.
 * ---------------------------------------------------------------------------
 */

const HOME_LINK_VARIATION = 'cnl-home-link';

/**
 * List a Home link by its label. It has no label of its own in lists, so it
 * would be listed as "Home Link", the block's name, rather than "Home" as
 * visitors see it. Matched only while it has that usual label, and not
 * offered anywhere links are added.
 */
export function registerHomeLinkVariation() {
	const existing = getBlockVariations( 'core/home-link' ) || [];

	if ( existing.some( ( { name } ) => name === HOME_LINK_VARIATION ) ) {
		return;
	}

	dispatch( blocksStore ).addBlockVariations( 'core/home-link', [
		{
			icon: homeIcon,
			isActive: ( attributes ) =>
				! attributes.label || attributes.label === __( 'Home' ),
			name: HOME_LINK_VARIATION,
			scope: [],
			title: __( 'Home' ),
		},
	] );
}
