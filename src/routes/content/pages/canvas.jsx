/**
 * The Pages canvas: the page being worked on, always in view, and linked to
 * the sidebar section by section.
 *
 * It is a site canvas: Browse shows the saved page as visitors see it, Edit
 * changes it in place, and Compose works on its sections. Following a link in
 * the preview to another page opens that page in the sidebar, and picking a
 * page there moves the preview.
 *
 * In Edit, a section picked in the sidebar is marked on the page, and while a
 * section is being added or dragged, a marker shows where it will land. In
 * Compose, its own layer marks them instead, and what it points at and picks
 * is pointed at and picked in the sidebar too. Changes made from the sidebar
 * leave Browse, where they can't be seen.
 */

/**
 * WordPress dependencies
 */
import { useNavigate, useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { settings } from '../../../settings';
import { MODE_BROWSE, useCanvasMode } from '../../../site-canvas/mode';
import {
	SiteCanvas,
	useCanvasDocument,
	useSiteCanvas,
} from '../../../site-canvas';
import { getErrorMessage } from '../../../records';
import {
	getPageTitle,
	PAGES_QUERY,
	usePageSections,
	usePreviewStructure,
} from './data';
import { getHomepageSummary, parseTarget, useHomepageState } from './homepage';
import { HOMEPAGE, isIndexTemplateId } from './homepage-state';
import {
	getSectionTitle,
	getTemplateElementKey,
	getTemplateElementLabel,
} from './page-sections';
import { getPagePreviewUrl } from './preview-url';
import { sectionBridge, useSectionBridge } from './section-bridge';
import {
	__,
	Button,
	chevronDownIcon,
	coreDataStore,
	Dropdown,
	EmptyState,
	externalIcon,
	homeIcon,
	Icon,
	linkIcon,
	MenuGroup,
	MenuItem,
	noticesStore,
	pageIcon,
	Tooltip,
	useCallback,
	useDispatch,
	useEffect,
	useMemo,
	useRef,
	useSelect,
} from '../../../wordpress-packages';

const LIST_PATH = '/types/page/list/all';

const HOVERED = 'cnl-section-is-hovered';
const SELECTED = 'cnl-section-is-selected';
const INSERT_BEFORE = 'cnl-section-insert-before';
const INSERT_AFTER = 'cnl-section-insert-after';
const MARKER_CLASSES = [ HOVERED, SELECTED, INSERT_BEFORE, INSERT_AFTER ];

/*
 * Styles for the markers, added to the editor's iframe. The iframe has the
 * theme's styles, not ours, so they travel with it.
 */
function getCanvasStyles( accent ) {
	return `
:root { --cnl-section-accent: ${ accent }; }
[data-cnl-section] { transition: outline-color .15s ease, box-shadow .15s ease; outline: 2px solid transparent; outline-offset: -2px; }
[data-cnl-section].${ HOVERED } { outline-color: var(--cnl-section-accent); }
[data-cnl-section].${ SELECTED } { outline: 3px solid var(--cnl-section-accent); outline-offset: -3px; }
[data-cnl-section].${ HOVERED }, [data-cnl-section].${ SELECTED }, [data-cnl-section].${ INSERT_BEFORE }, [data-cnl-section].${ INSERT_AFTER } { position: relative; }
[data-cnl-section].${ INSERT_BEFORE }::before, [data-cnl-section].${ INSERT_AFTER }::before {
	content: ""; position: absolute; z-index: 21; left: 12px; right: 12px; height: 4px;
	border-radius: 4px; background: var(--cnl-section-accent);
	box-shadow: 0 0 0 4px color-mix(in srgb, var(--cnl-section-accent) 25%, transparent);
	pointer-events: none; animation: cnl-insert-pulse 1.2s ease-in-out infinite;
}
[data-cnl-section].${ INSERT_BEFORE }::before { top: -2px; }
[data-cnl-section].${ INSERT_AFTER }::before { bottom: -2px; }
@keyframes cnl-insert-pulse { 50% { box-shadow: 0 0 0 8px color-mix(in srgb, var(--cnl-section-accent) 10%, transparent); } }
@media (prefers-reduced-motion: reduce) { [data-cnl-section]::before { animation: none !important; } }
`;
}

function getAccentColor() {
	return (
		window
			.getComputedStyle( document.body )
			.getPropertyValue( '--wp-admin-theme-color' )
			.trim() || '#3858e9'
	);
}

/**
 * A page as the sidebar's list has it, with its address, status and layout,
 * if the list has loaded.
 *
 * @param {Function} select Registry `select`.
 * @param {number}   pageId Page ID.
 * @return {?Object} The page, or `null`.
 */
function getListedPage( select, pageId ) {
	const pages = select( coreDataStore ).getEntityRecords(
		'postType',
		'page',
		PAGES_QUERY
	);

	return pages?.find( ( listed ) => listed.id === pageId ) || null;
}

/**
 * What the canvas links to the sidebar: the header, each section and the
 * footer, keyed as the sidebar knows them and pointing at where the preview
 * renders them.
 *
 * @param {Object[]} blocks    The page's sections.
 * @param {Object}   structure Result of `usePreviewStructure`.
 * @return {Object[]} `{ key, previewId, label, isSection }` items.
 */
export function getLinkedItems( blocks, structure ) {
	const items = [];
	const getElementItem = ( element ) => ( {
		key: getTemplateElementKey( element ),
		label: getTemplateElementLabel( element ),
		previewId: element.clientId,
	} );

	structure.before.forEach( ( element ) =>
		items.push( getElementItem( element ) )
	);

	blocks.forEach( ( block, index ) => {
		items.push( {
			isSection: true,
			key: block.clientId,
			label: getSectionTitle( block ),
			previewId: structure.sectionIds[ index ],
		} );
	} );

	structure.after.forEach( ( element ) =>
		items.push( getElementItem( element ) )
	);

	return items;
}

/**
 * Link the page's parts on the canvas to the sidebar: label them, and mark
 * them as the bridge says.
 *
 * @param {Object}   options
 * @param {Document} options.canvasDocument The editor's canvas document.
 * @param {Object[]} options.items          Result of `getLinkedItems`.
 */
function useLinkedSections( { canvasDocument, items } ) {
	const hoveredKey = useSectionBridge( ( state ) => state.hoveredId );
	const selectedKey = useSectionBridge( ( state ) => state.selectedId );
	const insertionIndex = useSectionBridge(
		( state ) => state.insertionIndex
	);
	const scrollRequest = useSectionBridge( ( state ) => state.scrollRequest );

	// Styles for the markers, once per canvas document.
	useEffect( () => {
		if ( ! canvasDocument?.body ) {
			return undefined;
		}

		const style = canvasDocument.createElement( 'style' );
		style.id = 'cnl-linked-sections';
		style.textContent = getCanvasStyles( getAccentColor() );
		canvasDocument.head.appendChild( style );

		return () => style.remove();
	}, [ canvasDocument ] );

	const getNode = ( key ) => {
		const previewId = items.find( ( item ) => item.key === key )?.previewId;

		return previewId
			? canvasDocument?.getElementById( `block-${ previewId }` )
			: null;
	};

	// Name every part, so the canvas can show what the sidebar calls it.
	useEffect( () => {
		if ( ! canvasDocument?.body ) {
			return undefined;
		}

		const label = () =>
			items.forEach( ( item ) => {
				const node =
					item.previewId &&
					canvasDocument.getElementById(
						`block-${ item.previewId }`
					);

				if (
					node &&
					node.getAttribute( 'data-cnl-section' ) !== item.label
				) {
					node.setAttribute( 'data-cnl-section', item.label );
				}
			} );

		label();

		// Blocks render asynchronously, and re-render as the page changes.
		const observer = new canvasDocument.defaultView.MutationObserver(
			label
		);
		observer.observe( canvasDocument.body, {
			childList: true,
			subtree: true,
		} );

		return () => observer.disconnect();
	}, [ canvasDocument, items ] );

	// Mark the pointed-at and picked parts, and where a new section would go.
	useEffect( () => {
		if ( ! canvasDocument?.body ) {
			return undefined;
		}

		const mark = () => {
			canvasDocument
				.querySelectorAll(
					MARKER_CLASSES.map( ( name ) => `.${ name }` ).join()
				)
				.forEach( ( node ) =>
					node.classList.remove( ...MARKER_CLASSES )
				);

			getNode( hoveredKey )?.classList.add( HOVERED );
			getNode( selectedKey )?.classList.add( SELECTED );

			const sections = items.filter( ( item ) => item.isSection );

			if ( insertionIndex !== null && sections.length ) {
				const isAfter = insertionIndex >= sections.length;
				const anchor =
					sections[ Math.min( insertionIndex, sections.length - 1 ) ];

				getNode( anchor.key )?.classList.add(
					isAfter ? INSERT_AFTER : INSERT_BEFORE
				);
			}
		};

		mark();

		// A section that was just added may not have rendered yet.
		const retry = window.setTimeout( mark, 400 );

		return () => {
			window.clearTimeout( retry );
			canvasDocument
				.querySelectorAll(
					MARKER_CLASSES.map( ( name ) => `.${ name }` ).join()
				)
				.forEach( ( node ) =>
					node.classList.remove( ...MARKER_CLASSES )
				);
		};
		// `getNode` reads `items`, which is a dependency.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ canvasDocument, hoveredKey, insertionIndex, items, selectedKey ] );

	// Bring a part picked in the sidebar into view.
	useEffect( () => {
		if ( ! canvasDocument?.body || ! scrollRequest || ! selectedKey ) {
			return undefined;
		}

		let attempts = 0;
		let timeout;
		const scroll = () => {
			const node = getNode( selectedKey );

			if ( node ) {
				const view = canvasDocument.defaultView;
				const rect = node.getBoundingClientRect();
				const isTall = rect.height > view.innerHeight * 0.8;
				const reduceMotion = view.matchMedia(
					'(prefers-reduced-motion: reduce)'
				).matches;

				/*
				 * Scrolled on the canvas's own window rather than with
				 * `scrollIntoView`, which also scrolls every container
				 * around the iframe. A tall part is brought in from its top,
				 * where its label is; anything else is centred.
				 */
				view.scrollTo( {
					behavior: reduceMotion ? 'auto' : 'smooth',
					top:
						view.scrollY +
						rect.top -
						( isTall ? 0 : ( view.innerHeight - rect.height ) / 2 ),
				} );
				return;
			}

			if ( attempts++ < 10 ) {
				timeout = window.setTimeout( scroll, 150 );
			}
		};

		scroll();

		return () => window.clearTimeout( timeout );
		// Only a new request should scroll, not every change to the selection.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ canvasDocument, scrollRequest ] );

	// Bring where a new section would go into view.
	useEffect( () => {
		const sections = items.filter( ( item ) => item.isSection );

		if (
			! canvasDocument?.body ||
			insertionIndex === null ||
			! sections.length
		) {
			return;
		}

		const isAfter = insertionIndex >= sections.length;
		const node = getNode(
			sections[ Math.min( insertionIndex, sections.length - 1 ) ].key
		);

		if ( ! node ) {
			return;
		}

		const rect = node.getBoundingClientRect();
		const edge = isAfter ? rect.bottom : rect.top;
		const view = canvasDocument.defaultView;

		// Keep the marker comfortably in view, a third of the way down.
		if ( edge < 40 || edge > view.innerHeight - 40 ) {
			view.scrollBy( {
				behavior: 'smooth',
				top: edge - view.innerHeight / 3,
			} );
		}
		// `getNode` reads `items`, which is a dependency.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ canvasDocument, insertionIndex, items ] );
}

function getStatusLabel( status ) {
	switch ( status ) {
		case 'publish':
			return __( 'Published' );
		case 'draft':
		case 'auto-draft':
			return __( 'Draft' );
		case 'future':
			return __( 'Scheduled' );
		case 'pending':
			return __( 'Pending review' );
		case 'private':
			return __( 'Private' );
		default:
			return '';
	}
}

/**
 * The part of a page's address after the domain, as visitors would type it.
 *
 * @param {string} link Page URL.
 * @return {string} The path, or an empty string without a link.
 */
function getPagePath( link ) {
	if ( ! link ) {
		return '';
	}

	try {
		const url = new URL( link );

		return decodeURI( url.pathname + url.search ) || '/';
	} catch {
		return link;
	}
}

function PageOptions( { link } ) {
	const { createSuccessNotice } = useDispatch( noticesStore );

	if ( ! link ) {
		return null;
	}

	return (
		<Dropdown
			className="cnl-editor-homepage-options"
			contentClassName="cnl-editor-homepage-options__content"
			popoverProps={ { placement: 'bottom' } }
			renderContent={ ( { onClose } ) => (
				<MenuGroup className="cnl-editor-homepage-options__menu">
					<MenuItem
						icon={ externalIcon }
						onClick={ () => {
							onClose();
							window.open(
								link,
								'_blank',
								'noopener,noreferrer'
							);
						} }
					>
						{ __( 'View on your site' ) }
					</MenuItem>
					<MenuItem
						icon={ linkIcon }
						onClick={ async () => {
							onClose();
							await window.navigator.clipboard?.writeText( link );
							createSuccessNotice( __( 'Link copied.' ), {
								type: 'snackbar',
							} );
						} }
					>
						{ __( 'Copy link' ) }
					</MenuItem>
				</MenuGroup>
			) }
			renderToggle={ ( { isOpen, onToggle } ) => (
				<Button
					aria-expanded={ isOpen }
					className="cnl-editor-homepage-options__toggle"
					icon={ chevronDownIcon }
					label={ __( 'Page options' ) }
					onClick={ onToggle }
					showTooltip
					variant="tertiary"
				/>
			) }
		/>
	);
}

function CanvasEmptyState() {
	return (
		<section className="cnl-pages-canvas cnl-pages-canvas--empty">
			<EmptyState.Root>
				<EmptyState.Icon icon={ pageIcon } />
				<EmptyState.Title>
					{ __( 'Your page will show here' ) }
				</EmptyState.Title>
				<EmptyState.Description>
					{ __(
						'Add a page and you will see it take shape as you work.'
					) }
				</EmptyState.Description>
			</EmptyState.Root>
		</section>
	);
}

/**
 * Whether the preview shows an unsaved change: a page whose only edits are its
 * layout or publishing it, or the site's whose only edits are what the
 * homepage shows, all of which `getPagePreviewUrl` passes along.
 *
 * @param {Object}   change Unsaved change, from `useChanges`.
 * @param {Function} select The registry's `select`.
 * @return {boolean} Whether the preview shows it.
 */
function isPassedToPreview( change, select ) {
	const { kind, name, key } = change;
	let shown;

	if ( kind === 'postType' && name === 'page' ) {
		shown = [ 'status', 'template' ];
	} else if ( kind === 'root' && name === 'site' ) {
		shown = [ 'page_on_front', 'show_on_front' ];
	} else {
		return false;
	}

	const edits = Object.keys(
		select( coreDataStore ).getEntityRecordNonTransientEdits(
			kind,
			name,
			key
		) || {}
	);

	return (
		edits.length > 0 && edits.every( ( edit ) => shown.includes( edit ) )
	);
}

function PageDocument( { homepage, page } ) {
	const isPublished = page?.status === 'publish';
	let link = page?.link;
	let path = isPublished ? getPagePath( link ) : '';
	let heading = getPageTitle( page );
	let meta = [ __( 'Page' ), getStatusLabel( page?.status ) ]
		.filter( Boolean )
		.join( ' · ' );

	if ( homepage ) {
		link = settings.homeUrl;
		path = getPagePath( link );
		heading = __( 'Homepage' );
		const { badge, summary } = getHomepageSummary( homepage );

		meta = summary || badge?.label || '';
	}

	return (
		<div className="cnl-editor-homepage-document">
			<div className="cnl-editor-homepage-document__text">
				<div className="cnl-editor-homepage-document__heading">
					<Icon
						className="cnl-editor-homepage-document__icon"
						icon={ homepage ? homeIcon : pageIcon }
					/>
					<Tooltip.Root disabled={ ! path }>
						<Tooltip.Trigger
							className="cnl-editor-homepage-document__title"
							render={ <h1 /> }
						>
							{ heading }
						</Tooltip.Trigger>
						<Tooltip.Popup>{ path }</Tooltip.Popup>
					</Tooltip.Root>
				</div>
				<p className="cnl-editor-homepage-document__meta">{ meta }</p>
			</div>
			<PageOptions link={ path ? link : '' } />
		</div>
	);
}

/**
 * Links the page's parts on the canvas to the sidebar, from a component of its
 * own. It follows the page's blocks, which change on every keystroke, and the
 * part pointed at, which changes on every hover, so the canvas around it
 * doesn't have to.
 *
 * @param {Object}    props                Component props.
 * @param {?Document} props.canvasDocument The editor's canvas document.
 * @param {number}    props.pageId         Page ID.
 * @return {null} Nothing.
 */
function LinkedSections( { canvasDocument, pageId } ) {
	const { blocks } = usePageSections( pageId );
	const structure = usePreviewStructure();
	const items = useMemo(
		() => getLinkedItems( blocks, structure ),
		[ blocks, structure ]
	);

	useLinkedSections( { canvasDocument, items } );

	return null;
}

/**
 * Link Compose to the sidebar's list of the page's sections: what one points
 * at or picks, the other does too.
 *
 * The sidebar knows sections by the page's own client IDs and Compose by the
 * editor's, which are matched up by position. See `getLinkedItems`.
 *
 * @param {number} pageId The page on show.
 * @return {Function} A hook for `SectionModesLayer` to call while composing.
 */
function useComposeSyncHook( pageId ) {
	return useMemo(
		() =>
			function usePagesComposeSync() {
				const { blocks } = usePageSections( pageId );
				const structure = usePreviewStructure();
				const items = useMemo(
					() => getLinkedItems( blocks, structure ),
					[ blocks, structure ]
				);
				const hoveredKey = useSectionBridge(
					( state ) => state.hoveredId
				);
				const selectedKey = useSectionBridge(
					( state ) => state.selectedId
				);
				const selectedFrom = useSectionBridge(
					( state ) => state.selectedFrom
				);

				return useMemo( () => {
					const toEditor = ( key ) =>
						items.find( ( item ) => item.key === key )?.previewId ??
						null;
					const toKey = ( clientId ) =>
						items.find( ( item ) => item.previewId === clientId )
							?.key ?? null;

					return {
						hoveredId: toEditor( hoveredKey ),
						// Only what the sidebar picks; Compose knows its own.
						selectedId:
							selectedFrom === 'canvas'
								? null
								: toEditor( selectedKey ),
						onHover: ( clientId ) =>
							sectionBridge.hover( toKey( clientId ) ),
						onSelect: ( clientId ) =>
							sectionBridge.select( toKey( clientId ), 'canvas' ),
					};
				}, [ hoveredKey, items, selectedFrom, selectedKey ] );
			},
		[ pageId ]
	);
}

/**
 * The layout the canvas edits while the homepage lists the latest posts.
 *
 * Without a `home` layout, WordPress lists them in `index`, which every other
 * list of posts uses too, like categories and search results. Editing that in
 * place would change all of them, so as soon as the canvas opens it to edit,
 * the homepage gets a `home` layout of its own, copied from `index`, and the
 * canvas moves on to it once it is there. Nothing looks different until it
 * is changed, and only the homepage changes then.
 *
 * @param {Object}  args
 * @param {string}  args.templateId The layout WordPress uses, if known.
 * @param {boolean} args.isEditing  Whether the canvas is open to edit.
 * @return {string|undefined} The layout to edit.
 */
function useLatestPostsLayout( { templateId, isEditing } ) {
	const { invalidateResolution, saveEntityRecord } =
		useDispatch( coreDataStore );
	const { createErrorNotice } = useDispatch( noticesStore );
	const isCopying = useRef( false );
	const indexContent = useSelect(
		( select ) =>
			isIndexTemplateId( templateId )
				? select( coreDataStore ).getEntityRecord(
						'postType',
						'wp_template',
						templateId
					)?.content?.raw
				: undefined,
		[ templateId ]
	);

	useEffect( () => {
		if (
			! isEditing ||
			typeof indexContent !== 'string' ||
			isCopying.current
		) {
			return;
		}

		isCopying.current = true;
		saveEntityRecord(
			'postType',
			'wp_template',
			{
				content: indexContent,
				slug: 'home',
				status: 'publish',
				title: __( 'Blog Home' ),
			},
			{ throwOnError: true }
		)
			.then( () =>
				invalidateResolution( 'getDefaultTemplateId', [
					{ slug: 'front-page' },
				] )
			)
			.catch( ( error ) =>
				createErrorNotice( getErrorMessage( error ), {
					type: 'snackbar',
				} )
			)
			.finally( () => {
				isCopying.current = false;
			} );
	}, [
		createErrorNotice,
		indexContent,
		invalidateResolution,
		isEditing,
		saveEntityRecord,
	] );

	return templateId;
}

function PagesCanvas() {
	const navigate = useNavigate();
	const searchParams = useSearch( { strict: false } );
	const homepage = useHomepageState();
	const drilled = parseTarget( searchParams.postId );
	let target = drilled || parseTarget( searchParams.previewId ) || HOMEPAGE;

	// The homepage's page is only ever shown as the homepage.
	if ( target === homepage.pageId && homepage.pageId ) {
		target = HOMEPAGE;
	}

	const isHomepage = target === HOMEPAGE;
	const pageId = isHomepage ? homepage.pageId : target;
	// With no page behind it, the homepage lists the latest posts, or is
	// whatever the theme's layout makes it.
	const showsLatestPosts = isHomepage && ! pageId;
	const editorRef = useRef();
	/*
	 * Only what the canvas shows of the page. The edited record is new on
	 * every keystroke, as the editor writes the page's blocks back to it.
	 * Until the page's own record has loaded, the sidebar's list has what
	 * the preview needs, so a page picked there starts loading at once.
	 */
	const { id, link, status, template, title } = useSelect(
		( select ) => {
			const record = pageId
				? select( coreDataStore ).getEditedEntityRecord(
						'postType',
						'page',
						pageId
					) || getListedPage( select, pageId )
				: null;

			return {
				id: record?.id,
				link: record?.link,
				status: record?.status,
				template: record?.template,
				title: record?.title,
			};
		},
		[ pageId ]
	);
	const page = useMemo(
		() =>
			link || status || title
				? { id, link, status, template, title }
				: null,
		[ id, link, status, template, title ]
	);
	const saved = useSelect(
		( select ) => {
			const record = pageId
				? select( coreDataStore ).getEntityRecord(
						'postType',
						'page',
						pageId
					) || getListedPage( select, pageId )
				: null;

			return {
				status: record?.status,
				template: record?.template || '',
			};
		},
		[ pageId ]
	);
	const site = useSelect(
		( select ) =>
			select( coreDataStore ).getEditedEntityRecord( 'root', 'site' ),
		[]
	);
	const isEditing = useCanvasMode() !== MODE_BROWSE;
	const latestPostsTemplateId = useLatestPostsLayout( {
		isEditing: showsLatestPosts && isEditing,
		templateId: showsLatestPosts
			? homepage.latestPostsTemplateId
			: undefined,
	} );
	const pinnedEntity = useMemo( () => {
		if ( showsLatestPosts ) {
			return latestPostsTemplateId
				? { postId: latestPostsTemplateId, postType: 'wp_template' }
				: null;
		}

		return pageId ? { postId: pageId, postType: 'page' } : null;
	}, [ latestPostsTemplateId, pageId, showsLatestPosts ] );
	const isShownInPreview = useCallback( isPassedToPreview, [] );
	const canvas = useSiteCanvas( {
		isShownInPreview,
		pinnedEntity,
		url: getPagePreviewUrl( {
			homeUrl: settings.homeUrl,
			isHomepage,
			page: showsLatestPosts ? null : page,
			savedSite: homepage.saved || site,
			savedStatus: saved.status,
			savedTemplate: saved.template,
			site,
		} ),
	} );
	const canvasDocument = useCanvasDocument( editorRef, `${ target }` );
	const useComposeSync = useComposeSyncHook( pageId );
	const scrollRequest = useSectionBridge( ( state ) => state.scrollRequest );
	const insertionIndex = useSectionBridge(
		( state ) => state.insertionIndex
	);
	const previewPageId =
		canvas.previewEntity?.postType === 'page'
			? Number( canvas.previewEntity.postId )
			: 0;

	// A link followed in the preview to another page picks it in the sidebar,
	// and opens it there if a page was already open.
	useEffect( () => {
		if (
			previewPageId &&
			previewPageId !== pageId &&
			canvas.isPreviewing
		) {
			const next =
				previewPageId === homepage.pageId ? HOMEPAGE : previewPageId;

			navigate( {
				search: {
					...searchParams,
					postId: drilled ? next : undefined,
					previewId: next,
				},
				to: LIST_PATH,
			} );
		}
		// Only the preview arriving on a page should open it, not the sidebar
		// moving on from the page the preview is still showing.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ previewPageId ] );

	// A section picked, or about to be added, can only be marked in the
	// editor, in Edit or Compose.
	useEffect( () => {
		if ( scrollRequest || insertionIndex !== null ) {
			canvas.showEditor();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ scrollRequest, insertionIndex ] );

	if ( homepage.isLoading ) {
		return null;
	}

	if ( ! pageId && ! isHomepage ) {
		return <CanvasEmptyState />;
	}

	return (
		<>
			{ ! canvas.isComposing && pageId > 0 && (
				<LinkedSections
					canvasDocument={ canvasDocument }
					pageId={ pageId }
				/>
			) }
			<SiteCanvas
				canvas={ canvas }
				className={ `cnl-pages-canvas${ drilled ? ' is-drilled' : '' }` }
				useComposeSync={ useComposeSync }
				document={
					<PageDocument
						homepage={ isHomepage ? homepage : null }
						page={ page }
					/>
				}
				editorChildren={
					! drilled && (
						<p className="cnl-pages-canvas__hint">
							{ __(
								'Point at a section to choose how to edit it.'
							) }
						</p>
					)
				}
				editorRef={ editorRef }
			/>
		</>
	);
}

export default PagesCanvas;
