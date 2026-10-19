/**
 * Browse's hints that the page is changed in Edit, laid over the preview.
 *
 * Browse shows the site as visitors see it, and looks just like Edit, so
 * people try to change it there. The hints only show where someone is
 * already reaching for a change, and leave links and buttons working:
 *
 * - The page's words have the arrow, not the text cursor, so they don't
 *   look ready to type into.
 * - Resting on a section for a moment outlines it faintly, with an Edit tag
 *   in its corner. The header and footer are purple, as every page shares
 *   them. Passing over the page shows nothing.
 * - A click on anything that isn't a link or a button highlights its
 *   section the same way, straight away. Another click on it asks "Want to
 *   change this?", with Edit. A double click goes straight to Edit.
 *
 * Edit, from either, opens the editor with that section picked, as if it
 * had been clicked there. See `preview-blocks.js` for how a spot in the
 * preview is matched to a section in the editor underneath.
 */

/**
 * WordPress dependencies
 */
import { globe as globeIcon, pencil as pencilIcon } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { GlobalScope } from '../global-scope';
import {
	__,
	blockEditorStore,
	Button,
	dispatch,
	Fragment,
	LegacyIcon,
	Popover,
	select,
	useEffect,
	useMemo,
	useRef,
	useState,
} from '../wordpress-packages';
import { useComposeStructure } from './compose/use-compose-structure';
import { MODE_EDIT } from './mode';
import {
	findPreviewSection,
	getPreviewBlock,
	isInteractive,
} from './preview-blocks';

const CURSOR_STYLE_ID = 'cnl-browse-cursor';

// The height a section needs below the top of its view to hold the tag.
const TAG_ROOM = 40;

// How long the pointer rests on a section before it is outlined.
const HOVER_DELAY_MS = 700;

/*
 * The arrow everywhere but on what is used by clicking or typing, which keep
 * theirs. Zero specificity, so a theme's own cursors still win.
 */
const CURSOR_CSS = `
:where(body, body *) { cursor: default; }
:where(a[href], a[href] *, button, button *, label, summary, select, [role="button"], [role="button"] *, [role="link"], [role="link"] *, input[type="checkbox"], input[type="radio"], input[type="button"], input[type="submit"], input[type="reset"]) { cursor: pointer; }
:where(input:not([type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="reset"]), textarea, [contenteditable]) { cursor: text; }
`;

/**
 * Give the preview's page the arrow over its words while asked to.
 *
 * @param {?Document} frameDocument The page on show.
 * @param {boolean}   isActive      Whether to.
 */
function useArrowCursor( frameDocument, isActive ) {
	useEffect( () => {
		if ( ! frameDocument?.head || ! isActive ) {
			return undefined;
		}

		const style = frameDocument.createElement( 'style' );

		style.id = CURSOR_STYLE_ID;
		style.textContent = CURSOR_CSS;
		frameDocument.head.appendChild( style );

		return () => style.remove();
	}, [ frameDocument, isActive ] );
}

/**
 * Where an element on the preview's page is, and where the frame is.
 *
 * @param {?Element} element An element on the preview's page.
 * @param {?Element} iframe  The preview's iframe.
 * @return {?Object} `{ box, rect }`: the frame in the preview, which lays it
 *                   out, and the element in the frame's own view, each as
 *                   `{ top, left, width, height }`.
 */
function measure( element, iframe ) {
	if ( ! element?.isConnected || ! iframe ) {
		return null;
	}

	const { top, left, width, height } = element.getBoundingClientRect();

	return {
		box: {
			height: iframe.offsetHeight,
			left: iframe.offsetLeft,
			top: iframe.offsetTop,
			width: iframe.offsetWidth,
		},
		rect: { height, left, top, width },
	};
}

function isSameBox( a, b ) {
	return (
		a?.top === b?.top &&
		a?.left === b?.left &&
		a?.width === b?.width &&
		a?.height === b?.height
	);
}

/**
 * Follow an element on the preview's page as it scrolls and resizes, and the
 * frame as it changes size with the device.
 *
 * @param {?Element} element   An element on the preview's page.
 * @param {Object}   iframeRef Ref to the preview's iframe.
 * @return {?Object} From `measure`.
 */
function useMeasure( element, iframeRef ) {
	const [ measured, setMeasured ] = useState( null );

	useEffect( () => {
		let frame;
		const update = () => {
			const next = measure( element, iframeRef.current );

			setMeasured( ( last ) =>
				isSameBox( last?.box, next?.box ) &&
				isSameBox( last?.rect, next?.rect )
					? last
					: next
			);
			frame = window.requestAnimationFrame( update );
		};

		update();

		return () => window.cancelAnimationFrame( frame );
	}, [ element, iframeRef ] );

	return measured;
}

/**
 * The faint outline round the section pointed at, and its Edit tag.
 *
 * @param {Object}   props
 * @param {Element}  props.element    The section's outermost element.
 * @param {boolean}  props.hasTag     Whether to offer Edit on it, rather
 *                                    than only outline it.
 * @param {Object}   props.iframeRef  Ref to the preview's iframe.
 * @param {boolean}  props.isPart     Whether it is the header or footer.
 * @param {boolean}  props.isPicked   Whether it was clicked, so shows at
 *                                    once rather than fading in.
 * @param {Function} props.onEdit     Opens it in Edit.
 * @param {Function} props.onTagLeave Called as the pointer leaves the tag.
 * @param {Object}   props.tagRef     Ref to the tag, for keeping the hint up
 *                                    while the pointer moves onto it.
 * @return {?Element} The outline.
 */
function SectionHint( {
	element,
	hasTag: canHaveTag = true,
	iframeRef,
	isPart,
	isPicked = false,
	onEdit,
	onTagLeave,
	tagRef,
} ) {
	const measured = useMeasure( element, iframeRef );

	if ( ! measured ) {
		return null;
	}

	const { box, rect } = measured;
	const Scope = isPart ? GlobalScope : Fragment;
	// The tag stays in view while the section's top is scrolled past, and
	// goes once too little of the section is left to hold it.
	const tagTop = Math.max( rect.top, 0 );
	const hasTag = canHaveTag && rect.top + rect.height - tagTop > TAG_ROOM;

	return (
		<Scope>
			<div
				className={ `cnl-browse-hints${
					isPicked ? ' is-picked' : ''
				}` }
				style={ box }
			>
				<div
					aria-hidden
					className="cnl-browse-hints__outline"
					style={ rect }
				/>
				{ hasTag && (
					<Button
						className="cnl-browse-hints__tag"
						icon={
							<LegacyIcon
								icon={ isPart ? globeIcon : pencilIcon }
								size={ 16 }
							/>
						}
						label={
							isPart
								? __( 'Edit, shown on every page' )
								: undefined
						}
						onClick={ onEdit }
						onPointerLeave={ onTagLeave }
						ref={ tagRef }
						showTooltip={ false }
						size="small"
						style={ {
							right: box.width - rect.left - rect.width,
							top: tagTop,
						} }
						variant="primary"
					>
						{ __( 'Edit' ) }
					</Button>
				) }
			</div>
		</Scope>
	);
}

/**
 * The question asked where something that isn't a link or button is
 * clicked.
 *
 * @param {Object}   props
 * @param {Object}   props.iframeRef Ref to the preview's iframe.
 * @param {Object}   props.nudge     `{ x, y }`, where the click landed, in
 *                                   the frame's view.
 * @param {Function} props.onClose   Puts it away.
 * @param {Function} props.onEdit    Opens the section in Edit.
 * @return {Element} The popover.
 */
function EditNudge( { iframeRef, nudge, onClose, onEdit } ) {
	const anchor = useMemo(
		() => ( {
			getBoundingClientRect() {
				const frameRect = iframeRef.current?.getBoundingClientRect();

				return new window.DOMRect(
					( frameRect?.left ?? 0 ) + nudge.x,
					( frameRect?.top ?? 0 ) + nudge.y,
					0,
					0
				);
			},
			ownerDocument: document,
		} ),
		[ iframeRef, nudge ]
	);

	return (
		<Popover
			anchor={ anchor }
			className="cnl-browse-hints__nudge"
			offset={ 8 }
			onClose={ onClose }
			placement="top"
		>
			<div className="cnl-browse-hints__nudge-body">
				<span>{ __( 'Want to change this?' ) }</span>
				<Button
					__next40pxDefaultSize
					onClick={ onEdit }
					variant="primary"
				>
					{ __( 'Edit' ) }
				</Button>
			</div>
		</Popover>
	);
}

/**
 * @param {Object} props
 * @param {Object} props.canvas Result of `useSiteCanvas`.
 * @return {?Element} The hints, while browsing a page that can be edited.
 */
export function BrowseHints( { canvas } ) {
	const { canEdit, frame, isPreviewing, requestMode } = canvas;
	const { frameDocument } = frame;
	const iframeRef = frame.frameProps.ref;
	const isActive = isPreviewing && canEdit && Boolean( frameDocument );
	const { parts, sectionIds } = useComposeStructure();
	const partIds = useMemo(
		() => new Set( parts.map( ( part ) => part.clientId ) ),
		[ parts ]
	);
	const targets = useMemo(
		() => new Set( [ ...sectionIds, ...partIds ] ),
		[ partIds, sectionIds ]
	);
	// `{ clientId, element }`: the section pointed at, once rested on.
	const [ hovered, setHovered ] = useState( null );
	// `{ clientId, element }`: the section clicked once.
	const [ highlighted, setHighlighted ] = useState( null );
	// `{ clientId, element, x, y }`: where a second click asked to change it.
	const [ nudge, setNudge ] = useState( null );
	const tagRef = useRef();
	const latestRef = useRef();

	useArrowCursor( frameDocument, isActive );

	const edit = ( clientId ) => {
		setNudge( null );
		setHovered( null );
		setHighlighted( null );
		requestMode( MODE_EDIT );

		// Picked in Edit, as Edit's section layer picks the section of a
		// block selected. See `SectionModesLayer`.
		if ( clientId ) {
			dispatch( blockEditorStore ).selectBlock( clientId );
		}
	};

	latestRef.current = {
		edit,
		highlighted,
		isActive,
		nudge,
		requestMode,
		targets,
	};

	// Nothing carries over to another page, or out of Browse.
	useEffect( () => {
		setHovered( null );
		setHighlighted( null );
		setNudge( null );
	}, [ frameDocument, isActive ] );

	useEffect( () => {
		const iframe = iframeRef.current;
		const view = frameDocument?.defaultView;

		if ( ! frameDocument || ! view || ! iframe ) {
			return undefined;
		}

		const find = ( element ) =>
			latestRef.current.isActive
				? findPreviewSection(
						select( blockEditorStore ),
						element,
						latestRef.current.targets
					)
				: null;
		let lastBlock;
		let lastSection;
		let hoverTimer;

		const clearHover = () => {
			window.clearTimeout( hoverTimer );
			lastBlock = undefined;
			lastSection = undefined;
			setHovered( null );
		};

		const onPointerMove = ( event ) => {
			const block = getPreviewBlock( event.target );

			// Pointing within the same block points at the same section.
			if ( block === lastBlock ) {
				return;
			}

			lastBlock = block;

			const section = find( event.target );

			if ( section?.element === lastSection ) {
				return;
			}

			// Another section: outlined only once the pointer rests on it.
			lastSection = section?.element;
			window.clearTimeout( hoverTimer );
			setHovered( null );

			if ( section ) {
				hoverTimer = window.setTimeout(
					() => setHovered( section ),
					HOVER_DELAY_MS
				);
			}
		};

		// Leaving the frame, unless for the tag laid over it.
		const onPointerLeave = ( event ) => {
			if (
				tagRef.current &&
				tagRef.current.contains( event.relatedTarget )
			) {
				return;
			}

			clearHover();
		};

		const onClick = ( event ) => {
			const { target } = event;

			// A double click's second click is left to the double click.
			if ( event.detail > 1 ) {
				return;
			}

			if (
				event.button !== 0 ||
				event.defaultPrevented ||
				isInteractive( target ) ||
				! view.getSelection()?.isCollapsed
			) {
				setNudge( null );
				setHighlighted( null );
				return;
			}

			const section = find( target );

			if ( ! section ) {
				setNudge( null );
				setHighlighted( null );
				return;
			}

			// The first click highlights the section. Another asks, and
			// another again puts the question away.
			if ( section.element !== latestRef.current.highlighted?.element ) {
				setNudge( null );
				setHighlighted( section );
				return;
			}

			setNudge( ( last ) =>
				last ? null : { ...section, x: event.clientX, y: event.clientY }
			);
		};

		const onDoubleClick = ( event ) => {
			// Double-clicking a word selects it, which would be left
			// highlighted when the preview comes back.
			view.getSelection()?.removeAllRanges();

			if ( latestRef.current.isActive ) {
				latestRef.current.edit( find( event.target )?.clientId );
			} else {
				latestRef.current.requestMode( MODE_EDIT );
			}
		};

		const onScroll = () => setNudge( null );

		/*
		 * Escape puts the question away, then the highlight. Heard here too,
		 * as the question takes the focus out of the preview and gives it
		 * back to the admin page.
		 */
		const onKeyDown = ( event ) => {
			// The question closes itself.
			if (
				event.key !== 'Escape' ||
				event.target.closest?.( '.cnl-browse-hints__nudge' )
			) {
				return;
			}

			if ( latestRef.current.nudge ) {
				setNudge( null );
			} else {
				setHighlighted( null );
			}
		};

		frameDocument.addEventListener( 'pointermove', onPointerMove );
		frameDocument.addEventListener( 'click', onClick );
		frameDocument.addEventListener( 'dblclick', onDoubleClick );
		frameDocument.addEventListener( 'keydown', onKeyDown );
		iframe.ownerDocument.addEventListener( 'keydown', onKeyDown );
		view.addEventListener( 'scroll', onScroll );
		iframe.addEventListener( 'pointerleave', onPointerLeave );

		return () => {
			window.clearTimeout( hoverTimer );
			frameDocument.removeEventListener( 'pointermove', onPointerMove );
			frameDocument.removeEventListener( 'click', onClick );
			frameDocument.removeEventListener( 'dblclick', onDoubleClick );
			frameDocument.removeEventListener( 'keydown', onKeyDown );
			iframe.ownerDocument.removeEventListener( 'keydown', onKeyDown );
			view.removeEventListener( 'scroll', onScroll );
			iframe.removeEventListener( 'pointerleave', onPointerLeave );
		};
	}, [ frameDocument, iframeRef ] );

	if ( ! isActive ) {
		return null;
	}

	// The tag's own leaving, unless back onto the page under it.
	const onTagLeave = ( event ) => {
		if ( event.relatedTarget !== iframeRef.current ) {
			setHovered( null );
		}
	};

	const pickedId = nudge?.clientId || highlighted?.clientId;

	return (
		<>
			{ hovered && hovered.clientId !== pickedId && (
				<SectionHint
					element={ hovered.element }
					iframeRef={ iframeRef }
					isPart={ partIds.has( hovered.clientId ) }
					key={ hovered.clientId }
					onEdit={ () => edit( hovered.clientId ) }
					onTagLeave={ onTagLeave }
					tagRef={ tagRef }
				/>
			) }
			{ /* The section clicked stays outlined, its tag giving way to
			the question while it is asked. */ }
			{ highlighted && (
				<SectionHint
					element={ highlighted.element }
					hasTag={ ! nudge }
					iframeRef={ iframeRef }
					isPart={ partIds.has( highlighted.clientId ) }
					isPicked
					key={ `picked-${ highlighted.clientId }` }
					onEdit={ () => edit( highlighted.clientId ) }
				/>
			) }
			{ nudge && (
				<EditNudge
					iframeRef={ iframeRef }
					nudge={ nudge }
					onClose={ () => setNudge( null ) }
					onEdit={ () => edit( nudge.clientId ) }
				/>
			) }
		</>
	);
}
