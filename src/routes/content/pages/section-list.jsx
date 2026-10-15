/**
 * The sections an opened page is made of, to reorder, add to and edit.
 */

/**
 * Internal dependencies
 */
import { usePreviewStructure } from './data';
import {
	getDropIndex,
	getSectionSummary,
	getSectionTitle,
	getTemplateElementKey,
	getTemplateElementLabel,
	insertItems,
	isSingleBlockSection,
	moveItem,
	removeItem,
} from './page-sections';
import { sectionBridge, useSectionBridge } from './section-bridge';
import SectionSketch from './section-sketch';
import {
	__,
	arrowDownIcon,
	arrowUpIcon,
	BlockIcon,
	cloneBlock,
	copyIcon,
	dragHandleIcon,
	DropdownMenu,
	getBlockType,
	footerIcon,
	headerIcon,
	Icon,
	lockSmallIcon,
	MenuGroup,
	MenuItem,
	memo,
	moreVerticalIcon,
	noticesStore,
	pencilIcon,
	plusIcon,
	Skeleton,
	sprintf,
	Stack,
	Text,
	trashIcon,
	useDispatch,
	useEffect,
	useMemo,
	useRef,
	useState,
} from '../../../wordpress-packages';

function SectionGap( { index, isActive, onAdd } ) {
	return (
		<li
			className={ `cnl-page-sections__gap${ isActive ? ' is-active' : '' }` }
			onMouseEnter={ () => sectionBridge.setInsertionIndex( index ) }
			onMouseLeave={ () => sectionBridge.setInsertionIndex( null ) }
		>
			<button
				aria-label={ __( 'Add a section here' ) }
				className="cnl-page-sections__gap-button"
				onBlur={ () => sectionBridge.setInsertionIndex( null ) }
				onClick={ () => onAdd( index ) }
				onFocus={ () => sectionBridge.setInsertionIndex( index ) }
				type="button"
			>
				<Icon icon={ plusIcon } size={ 16 } />
			</button>
		</li>
	);
}

function SectionCard( {
	block,
	dropPosition,
	index,
	isDragging,
	isHovered,
	isLast,
	isNew,
	isSelected,
	onDuplicate,
	onEdit,
	onMove,
	onPointerDown,
	onRemove,
	onSelect,
	shouldReveal,
} ) {
	const title = getSectionTitle( block );
	const summary = getSectionSummary( block );
	const ref = useRef();

	/*
	 * Only a section picked on the canvas is brought into view here. One
	 * clicked in this list is already in view, and scrolling the list too
	 * would compete with the canvas scrolling to it.
	 */
	useEffect( () => {
		if ( shouldReveal ) {
			ref.current?.scrollIntoView( {
				block: 'nearest',
				behavior: 'smooth',
			} );
		}
	}, [ shouldReveal ] );

	const onKeyDown = ( event ) => {
		if ( ! event.altKey ) {
			return;
		}

		if ( event.key === 'ArrowUp' && index > 0 ) {
			event.preventDefault();
			onMove( index, index - 1 );
		}

		if ( event.key === 'ArrowDown' && ! isLast ) {
			event.preventDefault();
			onMove( index, index + 1 );
		}
	};

	const className = [
		'cnl-page-section',
		isSelected && 'is-selected',
		isHovered && 'is-hovered',
		isDragging && 'is-dragging',
		isNew && 'is-new',
		dropPosition && `is-drop-${ dropPosition }`,
	]
		.filter( Boolean )
		.join( ' ' );

	return (
		<li
			className={ className }
			data-section-index={ index }
			onMouseEnter={ () => sectionBridge.hover( block.clientId ) }
			onPointerDown={ ( event ) => onPointerDown( event, index ) }
			onMouseLeave={ () => sectionBridge.hover( null ) }
			ref={ ref }
		>
			<div className="cnl-page-section__row">
				<span
					aria-hidden
					className="cnl-page-section__handle"
					title={ __( 'Drag to move' ) }
				>
					<Icon icon={ dragHandleIcon } size={ 20 } />
				</span>
				{ /* eslint-disable-next-line jsx-a11y/role-supports-aria-props -- aria-description is a global attribute in ARIA 1.3. */ }
				<button
					aria-current={ isSelected ? 'true' : undefined }
					aria-description={ __(
						'Press Alt and an arrow key to move this section.'
					) }
					className="cnl-page-section__main"
					onClick={ () => onSelect( block.clientId ) }
					onKeyDown={ onKeyDown }
					type="button"
				>
					{ isSingleBlockSection( block ) ? (
						<span
							aria-hidden
							className="cnl-page-section__part-icon"
						>
							<BlockIcon
								icon={ getBlockType( block.name )?.icon }
							/>
						</span>
					) : (
						<SectionSketch block={ block } />
					) }
					<span className="cnl-page-section__text">
						<span className="cnl-page-section__title">
							{ title }
						</span>
						{ summary && (
							<span className="cnl-page-section__summary">
								{ summary }
							</span>
						) }
					</span>
				</button>
				<DropdownMenu
					className="cnl-page-section__menu"
					icon={ moreVerticalIcon }
					label={ sprintf(
						/* translators: %s: section name. */
						__( 'Options for %s' ),
						title
					) }
					popoverProps={ { placement: 'bottom-end' } }
					toggleProps={ { size: 'small' } }
				>
					{ ( { onClose } ) => [
						<MenuGroup key="edit">
							<MenuItem
								icon={ pencilIcon }
								onClick={ () => {
									onClose();
									onEdit( index );
								} }
							>
								{ __( 'Edit words and images' ) }
							</MenuItem>
						</MenuGroup>,
						<MenuGroup key="move">
							<MenuItem
								disabled={ index === 0 }
								icon={ arrowUpIcon }
								onClick={ () => {
									onMove( index, index - 1 );
									onClose();
								} }
								shortcut="Alt+↑"
							>
								{ __( 'Move up' ) }
							</MenuItem>
							<MenuItem
								disabled={ isLast }
								icon={ arrowDownIcon }
								onClick={ () => {
									onMove( index, index + 1 );
									onClose();
								} }
								shortcut="Alt+↓"
							>
								{ __( 'Move down' ) }
							</MenuItem>
							<MenuItem
								icon={ copyIcon }
								onClick={ () => {
									onDuplicate( index );
									onClose();
								} }
							>
								{ __( 'Duplicate' ) }
							</MenuItem>
						</MenuGroup>,
						<MenuGroup key="remove">
							<MenuItem
								icon={ trashIcon }
								isDestructive
								onClick={ () => {
									onRemove( index );
									onClose();
								} }
							>
								{ __( 'Remove' ) }
							</MenuItem>
						</MenuGroup>,
					] }
				</DropdownMenu>
			</div>
		</li>
	);
}

const MemoizedSectionCard = memo( SectionCard );

function getTemplateElementIcon( element ) {
	// A site part's icon is a plain SVG, like the sections' own icons. Any
	// other block's icon comes from the block type, normalized to
	// `{ src, background, foreground }`, which only `BlockIcon` understands.
	if ( element.area === 'header' ) {
		return <Icon icon={ headerIcon } />;
	}

	if ( element.area === 'footer' ) {
		return <Icon icon={ footerIcon } />;
	}

	return <BlockIcon icon={ getBlockType( element.name )?.icon } />;
}

/*
 * A block the template puts around the page rather than the page itself: its
 * header or footer, or anything else the layout adds, like a title or a
 * featured image. Shown, but fixed, since it isn't this page's to move.
 */
function TemplateElementCard( { element, isHovered, isSelected, onEdit } ) {
	const title = getTemplateElementLabel( element );
	const key = getTemplateElementKey( element );
	// Only a site part is its own entity with something to open and edit.
	const isEditable = Boolean( element.area );
	const className = [
		'cnl-page-section',
		'is-template-element',
		isSelected && 'is-selected',
		isHovered && 'is-hovered',
	]
		.filter( Boolean )
		.join( ' ' );

	return (
		<li
			className={ className }
			onMouseEnter={ () => sectionBridge.hover( key ) }
			onMouseLeave={ () => sectionBridge.hover( null ) }
		>
			<div className="cnl-page-section__row">
				<span aria-hidden className="cnl-page-section__handle" />
				<button
					aria-current={ isSelected ? 'true' : undefined }
					className="cnl-page-section__main"
					onClick={ () => sectionBridge.select( key, 'stage' ) }
					type="button"
				>
					<span aria-hidden className="cnl-page-section__part-icon">
						{ getTemplateElementIcon( element ) }
					</span>
					<span className="cnl-page-section__text">
						<span className="cnl-page-section__title">
							{ title }
						</span>
						<span className="cnl-page-section__summary">
							{ __( 'Same on every page' ) }
						</span>
					</span>
				</button>
				<Icon
					aria-hidden
					className="cnl-page-section__lock"
					icon={ lockSmallIcon }
					size={ 20 }
				/>
				{
					// Without a menu, keep the lock where it sits when one is there.
					! isEditable && (
						<span
							aria-hidden
							className="cnl-page-section__menu-spacer"
						/>
					)
				}
				{ isEditable && (
					<DropdownMenu
						className="cnl-page-section__menu"
						icon={ moreVerticalIcon }
						label={ sprintf(
							/* translators: %s: site part name, like Header. */
							__( 'Options for %s' ),
							title
						) }
						popoverProps={ { placement: 'bottom-end' } }
						toggleProps={ { size: 'small' } }
					>
						{ ( { onClose } ) => (
							<MenuGroup>
								<MenuItem
									icon={ pencilIcon }
									info={ __( 'Changes it on every page' ) }
									onClick={ () => {
										onClose();
										onEdit( element.id );
									} }
								>
									{ element.area === 'header'
										? __( 'Edit header' )
										: __( 'Edit footer' ) }
								</MenuItem>
							</MenuGroup>
						) }
					</DropdownMenu>
				) }
			</div>
		</li>
	);
}

export function SectionList( {
	blocks,
	isReady,
	onAdd,
	onEdit,
	onEditPart,
	setBlocks,
} ) {
	const structure = usePreviewStructure();
	const { createSuccessNotice } = useDispatch( noticesStore );
	const hoveredId = useSectionBridge( ( state ) => state.hoveredId );
	const selectedId = useSectionBridge( ( state ) => state.selectedId );
	const selectedFrom = useSectionBridge( ( state ) => state.selectedFrom );
	const insertionIndex = useSectionBridge(
		( state ) => state.insertionIndex
	);
	const [ dragIndex, setDragIndex ] = useState( null );
	const [ dropTarget, setDropTarget ] = useState( null );
	const [ newId, setNewId ] = useState( null );
	const listRef = useRef();
	const latestRef = useRef();
	const dragRef = useRef( null );

	// Stop a drag that is still going if the list goes away.
	useEffect( () => () => dragRef.current?.stop(), [] );

	useEffect( () => {
		if ( ! newId ) {
			return undefined;
		}

		const timeout = window.setTimeout( () => setNewId( null ), 1600 );

		return () => window.clearTimeout( timeout );
	}, [ newId ] );

	const move = ( from, to ) => {
		const block = blocks[ from ];
		setBlocks( moveItem( blocks, from, to ) );
		sectionBridge.select( block.clientId, 'stage' );
	};
	const duplicate = ( index ) => {
		const copy = cloneBlock( blocks[ index ] );
		setBlocks( insertItems( blocks, index + 1, [ copy ] ) );
		setNewId( copy.clientId );
		sectionBridge.select( copy.clientId, 'stage' );
	};
	const remove = ( index ) => {
		const previous = blocks;
		const title = getSectionTitle( blocks[ index ] );

		setBlocks( removeItem( blocks, index ) );
		sectionBridge.select( null, 'stage' );
		sectionBridge.hover( null );
		createSuccessNotice(
			sprintf(
				/* translators: %s: section name. */
				__( 'Removed “%s”.' ),
				title
			),
			{
				actions: [
					{
						label: __( 'Undo' ),
						onClick: () => setBlocks( previous ),
					},
				],
				id: 'cnl-page-section-removed',
				type: 'snackbar',
			}
		);
	};
	const selectSection = ( clientId ) =>
		sectionBridge.select( clientId, 'stage' );

	/*
	 * Sections are dragged with pointer events rather than native drag and
	 * drop, which hands the cursor to the browser: this way it stays a grab
	 * hand the whole time. The list scrolls when dragged near its edges, and
	 * Escape puts the section back.
	 */
	latestRef.current = { blocks, move };

	const onPointerDown = ( event, index ) => {
		if (
			event.button !== 0 ||
			event.target.closest( '.cnl-page-section__menu' )
		) {
			return;
		}

		const startX = event.clientX;
		const startY = event.clientY;
		const scroller = listRef.current?.closest( '.cnl-pages-detail__body' );
		const drag = { active: false, frame: 0, lastY: startY, target: null };

		const findTarget = ( clientY ) => {
			const cards = [
				...listRef.current.querySelectorAll( '[data-section-index]' ),
			];
			const card =
				cards.find(
					( item ) => clientY < item.getBoundingClientRect().bottom
				) || cards[ cards.length - 1 ];

			if ( ! card ) {
				return null;
			}

			const rect = card.getBoundingClientRect();

			return {
				index: Number( card.dataset.sectionIndex ),
				position:
					clientY < rect.top + rect.height / 2 ? 'before' : 'after',
			};
		};
		const update = () => {
			const target = findTarget( drag.lastY );

			if (
				target &&
				( target.index !== drag.target?.index ||
					target.position !== drag.target?.position )
			) {
				drag.target = target;
				setDropTarget( target );
				sectionBridge.setInsertionIndex(
					target.index + ( target.position === 'after' ? 1 : 0 )
				);
			}
		};
		const autoScroll = () => {
			const rect = scroller?.getBoundingClientRect();
			const edge = 48;
			let delta = 0;

			if ( rect && drag.lastY < rect.top + edge ) {
				delta = -Math.ceil( ( rect.top + edge - drag.lastY ) / 4 );
			} else if ( rect && drag.lastY > rect.bottom - edge ) {
				delta = Math.ceil( ( drag.lastY - rect.bottom + edge ) / 4 );
			}

			if ( delta ) {
				scroller.scrollTop += delta;
				update();
			}

			drag.frame = window.requestAnimationFrame( autoScroll );
		};
		const stop = () => {
			window.removeEventListener( 'pointermove', onMove );
			window.removeEventListener( 'pointerup', onUp );
			window.removeEventListener( 'pointercancel', stop );
			window.removeEventListener( 'keydown', onKeyDown, true );
			window.cancelAnimationFrame( drag.frame );
			document.body.classList.remove( 'cnl-is-dragging-section' );
			dragRef.current = null;

			if ( drag.active ) {
				setDragIndex( null );
				setDropTarget( null );
				sectionBridge.setInsertionIndex( null );
			}
		};
		function onMove( moveEvent ) {
			drag.lastY = moveEvent.clientY;

			if ( ! drag.active ) {
				if (
					Math.hypot(
						moveEvent.clientX - startX,
						moveEvent.clientY - startY
					) < 5
				) {
					return;
				}

				drag.active = true;
				setDragIndex( index );
				document.body.classList.add( 'cnl-is-dragging-section' );
				sectionBridge.select(
					latestRef.current.blocks[ index ].clientId,
					'stage'
				);
				drag.frame = window.requestAnimationFrame( autoScroll );
			}

			moveEvent.preventDefault();
			update();
		}
		function onUp() {
			if ( drag.active ) {
				// Letting go over a card would otherwise count as clicking it.
				const swallowClick = ( clickEvent ) => {
					clickEvent.preventDefault();
					clickEvent.stopPropagation();
				};

				window.addEventListener( 'click', swallowClick, true );
				window.setTimeout( () =>
					window.removeEventListener( 'click', swallowClick, true )
				);

				if ( drag.target ) {
					const to = getDropIndex(
						index,
						drag.target.index,
						drag.target.position
					);

					if ( to !== index ) {
						latestRef.current.move( index, to );
					}
				}
			}

			stop();
		}
		function onKeyDown( keyEvent ) {
			if ( keyEvent.key === 'Escape' && drag.active ) {
				keyEvent.preventDefault();
				keyEvent.stopPropagation();
				stop();
			}
		}

		window.addEventListener( 'pointermove', onMove );
		window.addEventListener( 'pointerup', onUp );
		window.addEventListener( 'pointercancel', stop );
		window.addEventListener( 'keydown', onKeyDown, true );
		dragRef.current = { stop };
	};

	/*
	 * Handed to the cards through a ref, so they keep one identity and a card
	 * only re-renders when its own section or state changes, not on every
	 * keystroke in the canvas or every hover.
	 */
	const handlersRef = useRef();
	handlersRef.current = {
		duplicate,
		move,
		onEdit,
		onPointerDown,
		remove,
		selectSection,
	};
	const handlers = useMemo(
		() => ( {
			onDuplicate: ( ...args ) =>
				handlersRef.current.duplicate( ...args ),
			onEdit: ( ...args ) => handlersRef.current.onEdit( ...args ),
			onMove: ( ...args ) => handlersRef.current.move( ...args ),
			onPointerDown: ( ...args ) =>
				handlersRef.current.onPointerDown( ...args ),
			onRemove: ( ...args ) => handlersRef.current.remove( ...args ),
			onSelect: ( ...args ) =>
				handlersRef.current.selectSection( ...args ),
		} ),
		[]
	);

	if ( ! isReady ) {
		return (
			<Stack
				aria-hidden
				className="cnl-page-sections__loading"
				direction="column"
				gap="sm"
			>
				{ [ 0, 1, 2 ].map( ( index ) => (
					<Skeleton key={ index } style={ { height: 56 } } />
				) ) }
			</Stack>
		);
	}

	const items = [];

	blocks.forEach( ( block, index ) => {
		items.push(
			<SectionGap
				index={ index }
				isActive={ insertionIndex === index && dragIndex === null }
				key={ `gap-${ block.clientId }` }
				onAdd={ onAdd }
			/>,
			<MemoizedSectionCard
				{ ...handlers }
				block={ block }
				dropPosition={
					dropTarget?.index === index && dragIndex !== index
						? dropTarget.position
						: null
				}
				index={ index }
				isDragging={ dragIndex === index }
				isHovered={ hoveredId === block.clientId }
				isLast={ index === blocks.length - 1 }
				isNew={ newId === block.clientId }
				isSelected={ selectedId === block.clientId }
				shouldReveal={
					selectedId === block.clientId && selectedFrom === 'canvas'
				}
				key={ block.clientId }
			/>
		);
	} );

	const addButton = (
		<button
			className={ `cnl-page-sections__add${
				blocks.length ? '' : ' is-empty'
			}${ insertionIndex === blocks.length ? ' is-active' : '' }` }
			onBlur={ () => sectionBridge.setInsertionIndex( null ) }
			onClick={ () => onAdd( blocks.length ) }
			onFocus={ () => sectionBridge.setInsertionIndex( blocks.length ) }
			onMouseEnter={ () =>
				sectionBridge.setInsertionIndex( blocks.length )
			}
			onMouseLeave={ () => sectionBridge.setInsertionIndex( null ) }
			type="button"
		>
			{ ! blocks.length && (
				<Text className="cnl-page-sections__add-hint" variant="body-sm">
					{ __(
						'Nothing here yet. Pages are built from sections, like a banner, a row of pictures or a contact form.'
					) }
				</Text>
			) }
			<span className="cnl-page-sections__add-label">
				<Icon icon={ plusIcon } />
				{ __( 'Add a section' ) }
			</span>
		</button>
	);
	const renderElement = ( element ) => {
		const key = getTemplateElementKey( element );

		return (
			<TemplateElementCard
				element={ element }
				isHovered={ hoveredId === key }
				isSelected={ selectedId === key }
				key={ key }
				onEdit={ onEditPart }
			/>
		);
	};

	return (
		<ol
			aria-label={ __( 'The page, top to bottom' ) }
			ref={ listRef }
			className={ `cnl-page-sections__list${
				dragIndex !== null ? ' is-dragging' : ''
			}` }
		>
			{ structure.before.map( renderElement ) }
			{ items }
			<li className="cnl-page-sections__add-item" key="add">
				{ addButton }
			</li>
			{ structure.after.map( renderElement ) }
		</ol>
	);
}
