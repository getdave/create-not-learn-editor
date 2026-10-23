/**
 * A section's rows of cards, on the page. Once the section is picked, a row
 * pointed at is outlined, as a click opens it. The row open has its tools.
 * Where its last line has a gap beside its cards, a dashed placeholder card
 * fills it, and adds a card there. Where it hasn't, a slim strip with a + on
 * the right of the last card adds one beside it: one more side by side, for
 * a row on one line, else a card wrapping onto a new line. The card under
 * the pointer gets a button on its corner to remove it. Under the row's end,
 * how many cards sit side by side, the rest flowing onto the next line.
 */

/**
 * WordPress dependencies
 */
import { closeSmall as removeIcon, plus as plusIcon } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import {
	__,
	Button,
	sprintf,
	useEffect,
	useState,
} from '../../wordpress-packages';

// Sizes on screen, in pixels.
const STRIP_MIN_WIDTH = 20;
const STRIP_MAX_WIDTH = 32;
const EDGE_GAP = 4;
// Between a row's bottom edge and its per-row choice.
const PER_ROW_GAP = 10;
const REMOVE_OFFSET = 12;

function local( rect, frame ) {
	return {
		height: rect.height,
		left: rect.left - frame.left,
		top: rect.top - frame.top,
		width: rect.width,
	};
}

function contains( box, x, y ) {
	return (
		x >= box.left &&
		x <= box.left + box.width &&
		y >= box.top &&
		y <= box.top + box.height
	);
}

/**
 * Where the next card will go, when it fills a gap beside the cards in the
 * last line, as when four sit in a row and there are five.
 *
 * @param {Object[]} items The cards' boxes, in order.
 * @param {Object}   row   The row's box.
 * @return {?Object} The gap's box, or null when there is none.
 */
function getGap( items, row ) {
	const [ first, second ] = items;
	const last = items[ items.length - 1 ];
	const perLine = items.filter(
		( item ) => Math.abs( item.top - first.top ) < 2
	).length;
	const lineStart = items.findIndex(
		( item ) => Math.abs( item.top - last.top ) < 2
	);

	if ( lineStart === 0 || items.length - lineStart >= perLine ) {
		return null;
	}

	const box = { ...last, left: last.left + ( second.left - first.left ) };

	// A grid of cards spanning cells, like a mosaic, has no simple gap.
	return box.left + box.width <= row.left + row.width + 2 ? box : null;
}

/**
 * A slim strip in the room on the right of the last card, as tall as it,
 * read as the place one more goes. Where there is no room, as when the row
 * runs to the section's edge, it overlaps the card a little.
 *
 * @param {Object} last    The last card's box.
 * @param {Object} section The section's box.
 * @return {Object} The strip's box.
 */
function getStrip( last, section ) {
	const room = section.left + section.width - ( last.left + last.width );
	const width = Math.max(
		STRIP_MIN_WIDTH,
		Math.min( STRIP_MAX_WIDTH, room - EDGE_GAP )
	);

	return {
		height: last.height,
		left:
			room >= STRIP_MIN_WIDTH + EDGE_GAP
				? last.left + last.width + ( room - width ) / 2
				: section.left + section.width - width - EDGE_GAP,
		top: last.top,
		width,
	};
}

/**
 * @param {Object}   props
 * @param {Object[]} props.rows           The section's rows.
 * @param {?string}  props.activeRowId    The row open, if any.
 * @param {Object}   props.rects          Block rects, by client ID.
 * @param {Object}   props.frame          The canvas's rect.
 * @param {?Object}  props.canvasDocument The canvas's document.
 * @param {Object}   props.holdHover      Handlers keeping the section
 *                                        pointed at while on a button.
 * @param {Function} props.onAdd          Called with a row's client ID, no
 *                                        index, and `{ grow }`, whether one
 *                                        more sits side by side.
 * @param {Function} props.onRemove       Called with a row's client ID and
 *                                        an item's index in it.
 * @param {Function} props.onPerRow       Called with a row's client ID and
 *                                        how many to put side by side.
 * @param {Object}   props.section        The section's box on the canvas.
 * @return {Element} The handles.
 */
export function RowHandles( {
	activeRowId,
	canvasDocument,
	frame,
	holdHover,
	onAdd,
	onPerRow,
	onRemove,
	rects,
	rows,
	section,
} ) {
	// `{ rowId, index }` of the row and item under the pointer, `index`
	// null between items.
	const [ pointed, setPointed ] = useState( null );

	useEffect( () => {
		if ( ! canvasDocument ) {
			return undefined;
		}

		const onPointerMove = ( event ) => {
			const x = event.clientX;
			const y = event.clientY;
			let found = null;

			rows.forEach( ( row ) => {
				const rowRect = rects[ row.clientId ];

				if (
					! rowRect ||
					! contains( local( rowRect, frame ), x, y )
				) {
					return;
				}

				found = { index: null, rowId: row.clientId };

				row.itemIds.forEach( ( itemId, index ) => {
					const rect = rects[ itemId ];

					if ( rect && contains( local( rect, frame ), x, y ) ) {
						found = { index, rowId: row.clientId };
					}
				} );
			} );

			setPointed( ( current ) =>
				current?.rowId === found?.rowId &&
				current?.index === found?.index
					? current
					: found
			);
		};

		canvasDocument.addEventListener( 'pointermove', onPointerMove );

		return () =>
			canvasDocument.removeEventListener( 'pointermove', onPointerMove );
	}, [ canvasDocument, frame, rects, rows ] );

	return rows.map( ( row ) => {
		const items = row.itemIds
			.map( ( itemId ) => rects[ itemId ] )
			.filter( Boolean )
			.map( ( rect ) => local( rect, frame ) );
		const rowRect = rects[ row.clientId ];

		if ( items.length !== row.itemIds.length || ! rowRect ) {
			return null;
		}

		const rowBox = local( rowRect, frame );

		// A row not open is outlined while pointed at, as a click opens it.
		if ( row.clientId !== activeRowId ) {
			return (
				pointed?.rowId === row.clientId && (
					<div
						className="cnl-section-modes__row-outline"
						key={ row.clientId }
						style={ rowBox }
					>
						<span
							aria-hidden
							className="cnl-section-modes__row-tag"
						>
							{ __( 'Cards' ) }
						</span>
					</div>
				)
			);
		}

		const last = items[ items.length - 1 ];
		const gap = row.kind === 'grid' ? getGap( items, rowBox ) : null;
		// One line: the strip adds one more side by side.
		const isOneLine = items.every(
			( item ) => Math.abs( item.top - items[ 0 ].top ) < 2
		);
		const canAddBeside =
			row.canAdd &&
			( row.kind === 'columns' || ! isOneLine || row.canGrow );
		const pointedIndex =
			pointed?.rowId === row.clientId ? pointed.index : null;
		const pointedBox = pointedIndex !== null && items[ pointedIndex ];

		return (
			<div key={ row.clientId } { ...holdHover }>
				<div
					className="cnl-section-modes__row-outline is-open"
					style={ rowBox }
				>
					<span aria-hidden className="cnl-section-modes__row-tag">
						{ __( 'Cards' ) }
					</span>
				</div>
				{ row.canAdd && gap && (
					<button
						className="cnl-section-modes__row-cell"
						onClick={ () => onAdd( row.clientId ) }
						onPointerEnter={ () => setPointed( null ) }
						style={ gap }
						type="button"
					>
						<span className="cnl-section-modes__row-cell-label">
							{ __( 'Add card' ) }
						</span>
					</button>
				) }
				{ canAddBeside && ! gap && (
					<Button
						className="cnl-section-modes__row-add"
						icon={ plusIcon }
						label={ __( 'Add another card' ) }
						onClick={ () =>
							onAdd( row.clientId, undefined, {
								grow: isOneLine,
							} )
						}
						onPointerEnter={ () => setPointed( null ) }
						showTooltip
						style={ getStrip( last, section ) }
						tooltipPosition="middle left"
					/>
				) }
				{ row.canRemove && pointedBox && (
					<Button
						className="cnl-section-modes__row-remove"
						icon={ removeIcon }
						label={ __( 'Remove this item' ) }
						onClick={ () => {
							setPointed( null );
							onRemove( row.clientId, pointedIndex );
						} }
						onPointerEnter={ () =>
							setPointed( {
								index: pointedIndex,
								rowId: row.clientId,
							} )
						}
						showTooltip
						size="small"
						style={ {
							left:
								pointedBox.left +
								pointedBox.width -
								REMOVE_OFFSET,
							top: pointedBox.top - REMOVE_OFFSET,
						} }
						tooltipPosition="top"
					/>
				) }
				{ pointedBox && (
					<div
						className="cnl-section-modes__row-item"
						style={ pointedBox }
					/>
				) }
				<div
					aria-label={ __( 'Items per row' ) }
					className="cnl-section-modes__per-row"
					onPointerEnter={ () => setPointed( null ) }
					role="group"
					style={ {
						left: rowBox.left + rowBox.width,
						top: rowBox.top + rowBox.height + PER_ROW_GAP,
					} }
				>
					<span
						aria-hidden
						className="cnl-section-modes__per-row-label"
					>
						{ __( 'Per row' ) }
					</span>
					{ row.perRowOptions.map( ( count ) => (
						<Button
							aria-pressed={ count === row.perRow }
							className="cnl-section-modes__per-row-option"
							key={ count }
							label={ sprintf(
								/* translators: %d: how many items sit side by side. */
								__( '%d per row' ),
								count
							) }
							onClick={ () =>
								count !== row.perRow &&
								onPerRow( row.clientId, count )
							}
							size="small"
						>
							{ count }
						</Button>
					) ) }
				</div>
			</div>
		);
	} );
}
