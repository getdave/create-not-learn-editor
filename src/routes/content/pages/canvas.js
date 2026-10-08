/**
 * The Pages canvas: the page being worked on, always in view, and linked to
 * the sidebar section by section.
 *
 * Point at a section here and it lights up in the sidebar, and the other way
 * round. Click one here to pick it there. While a section is being added or
 * dragged, a marker shows where it will land.
 */

/**
 * WordPress dependencies
 */
import { useNavigate, useSearch } from '@wordpress/route';
import { Editor as LazyEditor } from '@wordpress/lazy-editor';

/**
 * Internal dependencies
 */
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
import { sectionBridge, useSectionBridge } from './section-bridge';
import {
	__,
	Button,
	chevronDownIcon,
	chevronLeftIcon,
	chevronRightIcon,
	coreDataStore,
	desktopIcon,
	dispatch,
	Dropdown,
	el,
	EmptyState,
	externalIcon,
	homeIcon,
	Icon,
	linkIcon,
	MenuGroup,
	MenuItem,
	mobileIcon,
	noticesStore,
	pageIcon,
	pencilIcon,
	tabletIcon,
	ToggleGroupControl,
	ToggleGroupControlOptionIcon,
	useDispatch,
	useEffect,
	useMemo,
	useRef,
	useSelect,
	useState,
} from '../../../wordpress-packages';

const LIST_PATH = '/types/page/list/all';

/*
 * Kept at module scope because the editor provider pushes settings into the
 * store whenever their identity changes.
 */
const PREVIEW_EDITOR_SETTINGS = { isPreviewMode: true };

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
.cnl-sections-linked [data-cnl-section] { cursor: pointer; transition: outline-color .15s ease, box-shadow .15s ease; outline: 2px solid transparent; outline-offset: -2px; }
.cnl-sections-linked a { cursor: pointer; }
.cnl-sections-linked :is(.is-hovered, .is-hovered-draggable):not([data-cnl-section])::before,
.cnl-sections-linked [data-cnl-section]:is(.is-hovered, .is-hovered-draggable):not(.${ INSERT_BEFORE }):not(.${ INSERT_AFTER })::before,
.cnl-sections-linked :is(.is-hovered, .is-hovered-draggable)::after { content: none !important; }
.cnl-sections-linked .block-editor-block-list__block:hover:not(.${ INSERT_BEFORE }):not(.${ INSERT_AFTER })::before { content: none !important; }
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

function getDeviceOptions() {
	return [
		{ icon: desktopIcon, label: __( 'Desktop view' ), value: 'Desktop' },
		{ icon: tabletIcon, label: __( 'Tablet view' ), value: 'Tablet' },
		{ icon: mobileIcon, label: __( 'Mobile view' ), value: 'Mobile' },
	];
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
 * Link the page's parts on the canvas to the sidebar: label them, mark them
 * as the bridge says, and report pointing and clicking back to it.
 *
 * @param {Object}   options
 * @param {Document} options.canvasDocument The editor's canvas document.
 * @param {Object[]} options.items          Result of `getLinkedItems`.
 * @param {Function} options.onPick         Called with a clicked item's key.
 */
function useLinkedSections( { canvasDocument, items, onPick } ) {
	const hoveredKey = useSectionBridge( ( state ) => state.hoveredId );
	const selectedKey = useSectionBridge( ( state ) => state.selectedId );
	const insertionIndex = useSectionBridge(
		( state ) => state.insertionIndex
	);
	const scrollRequest = useSectionBridge( ( state ) => state.scrollRequest );
	const itemsRef = useRef( items );
	const onPickRef = useRef( onPick );

	itemsRef.current = items;
	onPickRef.current = onPick;

	// Styles and pointer handling, once per canvas document.
	useEffect( () => {
		if ( ! canvasDocument?.body ) {
			return undefined;
		}

		const style = canvasDocument.createElement( 'style' );
		style.id = 'cnl-linked-sections';
		style.textContent = getCanvasStyles( getAccentColor() );
		canvasDocument.head.appendChild( style );
		canvasDocument.body.classList.add( 'cnl-sections-linked' );

		const findItem = ( target ) => {
			const keys = new Map(
				itemsRef.current
					.filter( ( item ) => item.previewId )
					.map( ( item ) => [ item.previewId, item.key ] )
			);
			let node = target?.closest?.( '[data-block]' );

			while ( node ) {
				const key = keys.get( node.getAttribute( 'data-block' ) );

				if ( key ) {
					return key;
				}

				node = node.parentElement?.closest( '[data-block]' );
			}

			return null;
		};
		// Handled before the editor sees it, so it doesn't outline the block
		// under the pointer as if it could be edited here.
		const onMouseOver = ( event ) => {
			event.stopPropagation();
			sectionBridge.hover( findItem( event.target ) );
		};
		const onMouseLeave = () => sectionBridge.hover( null );
		const onClick = ( event ) => {
			// Nothing on a preview should navigate away or start editing.
			event.preventDefault();
			event.stopPropagation();

			const key = findItem( event.target );

			if ( key ) {
				onPickRef.current( key );
			}
		};
		const stop = ( event ) => {
			event.preventDefault();
			event.stopPropagation();
		};
		const stopPropagation = ( event ) => event.stopPropagation();

		// Clear any outline the editor drew before these listeners took over.
		canvasDocument
			.querySelectorAll( '.is-hovered, .is-hovered-draggable' )
			.forEach( ( node ) =>
				node.classList.remove( 'is-hovered', 'is-hovered-draggable' )
			);
		canvasDocument.addEventListener( 'mouseover', onMouseOver, true );
		canvasDocument.addEventListener( 'mouseout', stopPropagation, true );
		canvasDocument.documentElement.addEventListener(
			'mouseleave',
			onMouseLeave
		);
		canvasDocument.addEventListener( 'click', onClick, true );
		canvasDocument.addEventListener( 'mousedown', stop, true );
		canvasDocument.addEventListener( 'dblclick', stop, true );

		return () => {
			style.remove();
			canvasDocument.body?.classList.remove( 'cnl-sections-linked' );
			canvasDocument.removeEventListener(
				'mouseover',
				onMouseOver,
				true
			);
			canvasDocument.removeEventListener(
				'mouseout',
				stopPropagation,
				true
			);
			canvasDocument.documentElement?.removeEventListener(
				'mouseleave',
				onMouseLeave
			);
			canvasDocument.removeEventListener( 'click', onClick, true );
			canvasDocument.removeEventListener( 'mousedown', stop, true );
			canvasDocument.removeEventListener( 'dblclick', stop, true );
		};
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

/*
 * Stepping back and forward through changes made to the page here, in the
 * place the Home preview steps through pages visited.
 */
function PageHistory() {
	const { hasRedo, hasUndo } = useSelect(
		( select ) => ( {
			hasRedo: select( coreDataStore ).hasRedo(),
			hasUndo: select( coreDataStore ).hasUndo(),
		} ),
		[]
	);
	const { redo, undo } = useDispatch( coreDataStore );

	return el(
		'div',
		{
			'aria-label': __( 'Page changes' ),
			className: 'cnl-editor-homepage-toolbar__history',
			role: 'group',
		},
		el( Button, {
			accessibleWhenDisabled: true,
			className: 'cnl-editor-homepage-toolbar__history-button',
			disabled: ! hasUndo,
			icon: chevronLeftIcon,
			label: __( 'Undo' ),
			onClick: () => undo(),
			showTooltip: true,
			variant: 'tertiary',
		} ),
		el( Button, {
			accessibleWhenDisabled: true,
			className: 'cnl-editor-homepage-toolbar__history-button',
			disabled: ! hasRedo,
			icon: chevronRightIcon,
			label: __( 'Redo' ),
			onClick: () => redo(),
			showTooltip: true,
			variant: 'tertiary',
		} )
	);
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

function PagesCanvas() {
	const navigate = useNavigate();
	const searchParams = useSearch( { strict: false } );
	const drilledId = Number( searchParams.postId ) || 0;
	const { frontPageId, isLoading, pages } = usePages();
	const [ device, setDevice ] = useState( 'Desktop' );
	const containerRef = useRef();
	const fallbackId =
		frontPageId ||
		Number(
			pages.find( ( page ) => ! Number( page.parent ) )?.id ||
				pages[ 0 ]?.id
		) ||
		0;
	const pageId = drilledId || fallbackId;
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
	const canvasDocument = useCanvasDocument( containerRef, pageId );
	const structure = usePreviewStructure();
	const items = useMemo(
		() => getLinkedItems( blocks, structure ),
		[ blocks, structure ]
	);

	useEffect( () => {
		dispatch( 'core/editor' )?.setDeviceType?.( device );
	}, [ device ] );

	useLinkedSections( {
		canvasDocument,
		items,
		onPick: ( key ) => {
			if ( ! drilledId ) {
				navigate( {
					search: { ...searchParams, postId: pageId },
					to: LIST_PATH,
				} );
			}

			sectionBridge.select( key, 'canvas' );
		},
	} );

	if ( ! pageId ) {
		return isLoading ? null : el( CanvasEmptyState );
	}

	const title = getPageTitle( page );
	const isPublished = page?.status === 'publish';
	const meta = [ __( 'Page' ), getStatusLabel( page?.status ) ]
		.filter( Boolean )
		.join( ' · ' );

	return el(
		'section',
		{
			className: `cnl-pages-canvas${ drilledId ? ' is-drilled' : '' }`,
		},
		el(
			'header',
			{
				className:
					'cnl-editor-canvas__toolbar cnl-editor-homepage-toolbar',
			},
			el(
				'div',
				{ className: 'cnl-editor-homepage-toolbar__left' },
				el(
					Button,
					{
						className: 'cnl-editor-homepage-toolbar__edit',
						icon: pencilIcon,
						onClick: () =>
							navigate( { to: `/types/page/edit/${ pageId }` } ),
						variant: 'primary',
					},
					__( 'Edit' )
				),
				el( PageHistory )
			),
			el(
				'div',
				{ className: 'cnl-editor-homepage-toolbar__center' },
				el(
					'div',
					{ className: 'cnl-editor-homepage-document' },
					el(
						'div',
						{ className: 'cnl-editor-homepage-document__text' },
						el(
							'div',
							{
								className:
									'cnl-editor-homepage-document__heading',
							},
							el( Icon, {
								className: 'cnl-editor-homepage-document__icon',
								icon:
									pageId === frontPageId
										? homeIcon
										: pageIcon,
							} ),
							el(
								'h1',
								{
									className:
										'cnl-editor-homepage-document__title',
								},
								title
							)
						),
						el(
							'p',
							{ className: 'cnl-editor-homepage-document__meta' },
							meta
						)
					),
					el( PageOptions, {
						link: isPublished ? page?.link : '',
					} )
				)
			),
			el(
				'div',
				{ className: 'cnl-editor-homepage-toolbar__right' },
				el(
					'div',
					{
						className:
							'cnl-editor-preview-canvas__device-switcher cnl-editor-homepage-device-switcher',
					},
					el(
						ToggleGroupControl,
						{
							__next40pxDefaultSize: true,
							__nextHasNoMarginBottom: true,
							hideLabelFromVision: true,
							label: __( 'Preview device' ),
							onChange: setDevice,
							value: device,
						},
						getDeviceOptions().map( ( option ) =>
							el( ToggleGroupControlOptionIcon, {
								icon: option.icon,
								key: option.value,
								label: option.label,
								value: option.value,
							} )
						)
					)
				),
				el( Button, {
					className: 'cnl-editor-homepage-toolbar__external',
					disabled: ! isPublished || ! page?.link,
					href: isPublished ? page?.link : undefined,
					icon: externalIcon,
					label: isPublished
						? __( 'View page in new tab' )
						: __( 'Publish the page to view it on your site' ),
					rel: 'noreferrer',
					showTooltip: true,
					target: '_blank',
					variant: 'tertiary',
				} )
			)
		),
		el(
			'div',
			{ className: 'cnl-pages-canvas__body', ref: containerRef },
			el( LazyEditor, {
				initialViewport: device,
				key: pageId,
				postId: pageId,
				postType: 'page',
				settings: PREVIEW_EDITOR_SETTINGS,
			} ),
			! drilledId &&
				el(
					'p',
					{ className: 'cnl-pages-canvas__hint' },
					__( 'Click any part of the page to start changing it.' )
				)
		)
	);
}

export default PagesCanvas;
