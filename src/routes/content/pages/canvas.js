/**
 * The Pages canvas: the page being worked on, always in view, and linked to
 * the sidebar section by section.
 *
 * It is a site canvas: Preview shows the saved page as visitors see it, and
 * Edit changes it in place. Following a link in the preview to another page
 * opens that page in the sidebar, and picking a page there moves the preview.
 *
 * In Edit, a section picked in the sidebar is marked on the page, and while a
 * section is being added or dragged, a marker shows where it will land. Both
 * switch the canvas to Edit, where they can be seen, as do changes made from
 * the sidebar.
 */

/**
 * WordPress dependencies
 */
import { useNavigate, useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import {
	SiteCanvas,
	TEMPLATE_PARAM,
	useSiteCanvas,
} from '../../../site-canvas';
import {
	getPageTitle,
	usePages,
	usePageSections,
	usePreviewStructure,
} from './data';
import {
	getSectionTitle,
	getTemplateElementKey,
	getTemplateElementLabel,
} from './page-sections';
import { useSectionBridge } from './section-bridge';
import {
	__,
	Button,
	chevronDownIcon,
	coreDataStore,
	Dropdown,
	el,
	EmptyState,
	externalIcon,
	homeIcon,
	Icon,
	linkIcon,
	MenuGroup,
	MenuItem,
	noticesStore,
	pageIcon,
	useCallback,
	useDispatch,
	useEffect,
	useMemo,
	useRef,
	useSelect,
	useState,
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
 * Find the editor's canvas document once it is ready, and again whenever the
 * editor swaps its iframe out, as it does when the device changes.
 *
 * @param {Object} containerRef Ref to the element the editor renders in.
 * @param {*}      resetKey     Changes when the editor is remounted.
 * @return {Document|null} The canvas document.
 */
function useCanvasDocument( containerRef, resetKey ) {
	const [ canvasDocument, setCanvasDocument ] = useState( null );

	useEffect( () => {
		let current = null;
		const check = () => {
			const iframe = containerRef.current?.querySelector(
				'iframe[name="editor-canvas"]'
			);
			const doc = iframe?.contentDocument;
			const next =
				doc?.readyState === 'complete' &&
				doc.body?.querySelector( '.is-root-container' )
					? doc
					: null;

			if ( next !== current ) {
				current = next;
				setCanvasDocument( next );
			}
		};
		const interval = window.setInterval( check, 300 );

		check();

		return () => window.clearInterval( interval );
	}, [ containerRef, resetKey ] );

	return canvasDocument;
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

		return () => window.clearTimeout( retry );
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

function PageOptions( { link } ) {
	const { createSuccessNotice } = useDispatch( noticesStore );

	if ( ! link ) {
		return null;
	}

	return el( Dropdown, {
		className: 'cnl-editor-homepage-options',
		contentClassName: 'cnl-editor-homepage-options__content',
		popoverProps: { placement: 'bottom' },
		renderContent: ( { onClose } ) =>
			el(
				MenuGroup,
				{ className: 'cnl-editor-homepage-options__menu' },
				el(
					MenuItem,
					{
						icon: externalIcon,
						onClick: () => {
							onClose();
							window.open(
								link,
								'_blank',
								'noopener,noreferrer'
							);
						},
					},
					__( 'View on your site' )
				),
				el(
					MenuItem,
					{
						icon: linkIcon,
						onClick: async () => {
							onClose();
							await window.navigator.clipboard?.writeText( link );
							createSuccessNotice( __( 'Link copied.' ), {
								type: 'snackbar',
							} );
						},
					},
					__( 'Copy link' )
				)
			),
		renderToggle: ( { isOpen, onToggle } ) =>
			el( Button, {
				'aria-expanded': isOpen,
				className: 'cnl-editor-homepage-options__toggle',
				icon: chevronDownIcon,
				label: __( 'Page options' ),
				onClick: onToggle,
				showTooltip: true,
				variant: 'tertiary',
			} ),
	} );
}

function CanvasEmptyState() {
	return el(
		'section',
		{ className: 'cnl-pages-canvas cnl-pages-canvas--empty' },
		el(
			EmptyState.Root,
			null,
			el( EmptyState.Icon, { icon: pageIcon } ),
			el( EmptyState.Title, null, __( 'Your page will show here' ) ),
			el(
				EmptyState.Description,
				null,
				__( 'Add a page and you will see it take shape as you work.' )
			)
		)
	);
}

/**
 * Where the preview shows a page. A page that isn't published only shows to
 * those who can edit it, as a preview. A layout chosen but not saved yet is
 * passed along, so the preview shows the page in it.
 *
 * @param {Object} page          Page record, with its unsaved edits.
 * @param {string} savedTemplate The page's saved layout.
 * @return {string} The page's URL, or an empty string.
 */
function getPagePreviewUrl( page, savedTemplate ) {
	if ( ! page?.link ) {
		return '';
	}

	const url = new URL( page.link, window.location.origin );

	if ( page.status !== 'publish' ) {
		url.searchParams.set( 'preview', 'true' );
	}

	if ( ( page.template || '' ) !== ( savedTemplate || '' ) ) {
		url.searchParams.set( TEMPLATE_PARAM, page.template || 'default' );
	}

	return url.href;
}

/**
 * Whether the preview shows an unsaved change: a page whose only edit is its
 * layout, which `getPagePreviewUrl` passes along.
 *
 * @param {Object}   change Unsaved change, from `useChanges`.
 * @param {Function} select The registry's `select`.
 * @return {boolean} Whether the preview shows it.
 */
function isLayoutChange( change, select ) {
	const { kind, name, key } = change;

	if ( kind !== 'postType' || name !== 'page' ) {
		return false;
	}

	const edits = Object.keys(
		select( coreDataStore ).getEntityRecordNonTransientEdits(
			kind,
			name,
			key
		) || {}
	);

	return edits.length > 0 && edits.every( ( edit ) => edit === 'template' );
}

function PageDocument( { isFrontPage, page } ) {
	const isPublished = page?.status === 'publish';
	const meta = [ __( 'Page' ), getStatusLabel( page?.status ) ]
		.filter( Boolean )
		.join( ' · ' );

	return el(
		'div',
		{ className: 'cnl-editor-homepage-document' },
		el(
			'div',
			{ className: 'cnl-editor-homepage-document__text' },
			el(
				'div',
				{ className: 'cnl-editor-homepage-document__heading' },
				el( Icon, {
					className: 'cnl-editor-homepage-document__icon',
					icon: isFrontPage ? homeIcon : pageIcon,
				} ),
				el(
					'h1',
					{ className: 'cnl-editor-homepage-document__title' },
					getPageTitle( page )
				)
			),
			el( 'p', { className: 'cnl-editor-homepage-document__meta' }, meta )
		),
		el( PageOptions, { link: isPublished ? page?.link : '' } )
	);
}

function PagesCanvas() {
	const navigate = useNavigate();
	const searchParams = useSearch( { strict: false } );
	const drilledId = Number( searchParams.postId ) || 0;
	const { frontPageId, isLoading, pages } = usePages();
	const editorRef = useRef();
	const fallbackId =
		frontPageId ||
		Number(
			pages.find( ( page ) => ! Number( page.parent ) )?.id ||
				pages[ 0 ]?.id
		) ||
		0;
	const pageId = drilledId || Number( searchParams.previewId ) || fallbackId;
	const { blocks } = usePageSections( pageId );
	const page = useSelect(
		( select ) =>
			pageId
				? select( coreDataStore ).getEditedEntityRecord(
						'postType',
						'page',
						pageId
					)
				: null,
		[ pageId ]
	);
	const savedTemplate = useSelect(
		( select ) =>
			pageId
				? select( coreDataStore ).getEntityRecord(
						'postType',
						'page',
						pageId
					)?.template
				: '',
		[ pageId ]
	);
	const pinnedEntity = useMemo(
		() => ( pageId ? { postId: pageId, postType: 'page' } : null ),
		[ pageId ]
	);
	const isShownInPreview = useCallback( isLayoutChange, [] );
	const canvas = useSiteCanvas( {
		isShownInPreview,
		pinnedEntity,
		url: getPagePreviewUrl( page, savedTemplate ),
	} );
	const canvasDocument = useCanvasDocument( editorRef, pageId );
	const structure = usePreviewStructure();
	const items = useMemo(
		() => getLinkedItems( blocks, structure ),
		[ blocks, structure ]
	);
	const scrollRequest = useSectionBridge( ( state ) => state.scrollRequest );
	const insertionIndex = useSectionBridge(
		( state ) => state.insertionIndex
	);
	const previewPageId =
		canvas.previewEntity?.postType === 'page'
			? Number( canvas.previewEntity.postId )
			: 0;

	useLinkedSections( { canvasDocument, items } );

	// A link followed in the preview to another page picks it in the sidebar,
	// and opens it there if a page was already open.
	useEffect( () => {
		if ( previewPageId && previewPageId !== pageId && ! canvas.isEditing ) {
			navigate( {
				search: {
					...searchParams,
					postId: drilledId ? previewPageId : undefined,
					previewId: previewPageId,
				},
				to: LIST_PATH,
			} );
		}
		// Only the preview arriving on a page should open it, not the sidebar
		// moving on from the page the preview is still showing.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ previewPageId ] );

	// A section picked, or about to be added, can only be marked in Edit.
	useEffect( () => {
		if ( scrollRequest || insertionIndex !== null ) {
			canvas.showEdit();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ scrollRequest, insertionIndex ] );

	if ( ! pageId ) {
		return isLoading ? null : el( CanvasEmptyState );
	}

	return el( SiteCanvas, {
		canvas,
		className: `cnl-pages-canvas${ drilledId ? ' is-drilled' : '' }`,
		document: el( PageDocument, {
			isFrontPage: pageId === frontPageId,
			page,
		} ),
		editorChildren:
			! drilledId &&
			el(
				'p',
				{ className: 'cnl-pages-canvas__hint' },
				__( 'Click any part of the page to change it.' )
			),
		editorRef,
	} );
}

export default PagesCanvas;
