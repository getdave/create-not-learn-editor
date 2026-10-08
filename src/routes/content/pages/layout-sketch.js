/**
 * A wireframe of a layout with the page in it: what the template adds in the
 * purple of everything that is the same on every page, and the page's own
 * sections in between.
 */

/**
 * Internal dependencies
 */
import { el } from '../../../wordpress-packages';

const WIDTH = 120;
const HEIGHT = 82;
const GAP = 3;
const BAR_HEIGHT = 11;
const MAX_SECTIONS = 4;
const SECTION_HEIGHT = { max: 12, min: 4 };

const GLOBAL = 'var(--cnl-layout-sketch-global)';
const GLOBAL_TINT = 'var(--cnl-layout-sketch-global-tint)';
const PAGE = 'var(--cnl-layout-sketch-page)';
const LINE = 'currentColor';

// Fixed heights of what a layout adds, to share out what is left between the
// page's sections.
const ITEM_HEIGHTS = {
	comments: 8,
	image: 14,
	other: 1.6,
	part: 6,
	posts: 12,
	title: 3.4,
};

function rect( key, props ) {
	return el( 'rect', { key, rx: 1, ...props } );
}

function getColumns( sidebar ) {
	if ( ! sidebar ) {
		return { content: { x: 24, width: 72 } };
	}

	return {
		content: { width: 58, x: sidebar === 'start' ? 40 : 22 },
		sidebar: { width: 20, x: sidebar === 'start' ? 14 : 86 },
	};
}

function drawBar( kind, y ) {
	const isHeader = kind === 'header';
	const textY = isHeader ? y + 4.7 : y + 4;

	return el(
		'g',
		{ key: `${ kind }-${ y }` },
		rect( 'fill', {
			fill: GLOBAL_TINT,
			height: BAR_HEIGHT,
			rx: 0,
			width: WIDTH,
			y,
		} ),
		isHeader &&
			el( 'circle', {
				cx: 9,
				cy: y + 5.5,
				fill: GLOBAL,
				key: 'logo',
				r: 2.2,
			} ),
		rect( 'name', {
			fill: GLOBAL,
			height: 1.8,
			opacity: 0.7,
			width: isHeader ? 14 : 18,
			x: isHeader ? 13 : 8,
			y: textY,
		} ),
		...[ 0, 1, 2 ].map( ( index ) =>
			rect( `link-${ index }`, {
				fill: GLOBAL,
				height: 1.5,
				opacity: 0.45,
				width: 7,
				x: 84 + index * 10,
				y: textY + 0.15,
			} )
		)
	);
}

function drawItem( item, y, column, key ) {
	switch ( item.kind ) {
		case 'title': {
			const width = column.width * 0.55;

			return rect( key, {
				fill: GLOBAL,
				height: ITEM_HEIGHTS.title,
				width,
				x:
					item.align === 'center'
						? column.x + ( column.width - width ) / 2
						: column.x,
				y,
			} );
		}
		case 'image': {
			let { x, width } = column;

			if ( item.width === 'full' ) {
				x = 0;
				width = WIDTH;
			} else if ( item.width === 'wide' ) {
				x = Math.max( 0, column.x - 12 );
				width = Math.min( WIDTH - x, column.width + 24 );
			}

			return rect( key, {
				fill: GLOBAL_TINT,
				height: ITEM_HEIGHTS.image,
				rx: item.width === 'full' ? 0 : 1,
				stroke: GLOBAL,
				strokeOpacity: 0.35,
				strokeWidth: 0.5,
				width,
				x,
				y,
			} );
		}
		case 'posts':
			return el(
				'g',
				{ key },
				[ 0, 1, 2 ].map( ( index ) =>
					rect( index, {
						fill: GLOBAL_TINT,
						height: 3,
						width: column.width,
						x: column.x,
						y: y + index * 4.5,
					} )
				)
			);
		case 'comments':
			return el(
				'g',
				{ key },
				rect( 'heading', {
					fill: GLOBAL,
					height: 1.8,
					opacity: 0.7,
					width: column.width * 0.3,
					x: column.x,
					y,
				} ),
				rect( 'box', {
					fill: 'none',
					height: 4.5,
					stroke: GLOBAL,
					strokeOpacity: 0.5,
					strokeWidth: 0.5,
					width: column.width,
					x: column.x,
					y: y + 3.5,
				} )
			);
		case 'part':
			return rect( key, {
				fill: GLOBAL_TINT,
				height: ITEM_HEIGHTS.part,
				width: column.width,
				x: column.x,
				y,
			} );
	}

	return rect( key, {
		fill: GLOBAL,
		height: ITEM_HEIGHTS.other,
		opacity: 0.45,
		width: column.width * 0.35,
		x: column.x,
		y,
	} );
}

/*
 * The page's own sections, as many as fit up to a few, sharing out the height
 * the layout leaves them. A page with none yet gets an empty slot.
 */
function drawSections( count, y, height, column ) {
	if ( ! count ) {
		return {
			height,
			shapes: [
				rect( 'empty', {
					fill: 'none',
					height,
					stroke: LINE,
					strokeDasharray: '2 1.5',
					strokeOpacity: 0.35,
					strokeWidth: 0.6,
					width: column.width,
					x: column.x,
					y,
				} ),
			],
		};
	}

	// Fewer when the layout leaves little room, so the footer still shows.
	const shown = Math.max(
		1,
		Math.min(
			count,
			MAX_SECTIONS,
			Math.floor( ( height + GAP ) / ( SECTION_HEIGHT.min + GAP ) )
		)
	);
	const sectionHeight = Math.max(
		SECTION_HEIGHT.min,
		Math.min( SECTION_HEIGHT.max, ( height - GAP * ( shown - 1 ) ) / shown )
	);
	const shapes = Array.from( { length: shown }, ( _, index ) => {
		const top = y + index * ( sectionHeight + GAP );

		return el(
			'g',
			{ key: `section-${ index }` },
			rect( 'fill', {
				fill: PAGE,
				height: sectionHeight,
				width: column.width,
				x: column.x,
				y: top,
			} ),
			rect( 'line', {
				fill: LINE,
				height: 1.4,
				opacity: 0.35,
				width: column.width * ( index % 2 ? 0.45 : 0.6 ),
				x: column.x + 3,
				y: top + sectionHeight / 2 - 0.7,
			} )
		);
	} );

	return { height: shown * ( sectionHeight + GAP ) - GAP, shapes };
}

function getItemHeight( item ) {
	if ( item.kind === 'image' && item.width === 'full' ) {
		return ITEM_HEIGHTS.image + 2;
	}

	return ITEM_HEIGHTS[ item.kind ] ?? ITEM_HEIGHTS.other;
}

/**
 * @param {Object} props              Component props.
 * @param {Object} props.outline      Result of `getLayoutOutline`.
 * @param {number} props.sectionCount How many sections the page has.
 * @return {Element} The sketch.
 */
export default function LayoutSketch( { outline, sectionCount } ) {
	const before = [ ...outline.before ];
	const after = [ ...outline.after ];
	const hasHeader = before[ 0 ]?.kind === 'header';
	// Without the page's content, everything the layout shows is `before`.
	const end = outline.hasContent ? after : before;
	const hasFooter = end.at( -1 )?.kind === 'footer';

	if ( hasHeader ) {
		before.shift();
	}

	if ( hasFooter ) {
		end.pop();
	}

	const columns = getColumns( outline.hasContent && outline.sidebar );
	const top = hasHeader ? BAR_HEIGHT + GAP + 1 : GAP + 1;
	const bottom = hasFooter ? HEIGHT - BAR_HEIGHT - GAP - 1 : HEIGHT - GAP;
	const fixed = [ ...before, ...after ].reduce(
		( total, item ) => total + getItemHeight( item ) + GAP,
		0
	);
	const shapes = [];
	let y = top;

	if ( hasHeader ) {
		shapes.push( drawBar( 'header', 0 ) );
	}

	before.forEach( ( item, index ) => {
		shapes.push(
			drawItem( item, y, columns.content, `before-${ index }` )
		);
		y += getItemHeight( item ) + GAP;
	} );

	if ( outline.hasContent ) {
		const sections = drawSections(
			sectionCount,
			y,
			Math.max( SECTION_HEIGHT.min, bottom - top - fixed ),
			columns.content
		);

		if ( columns.sidebar ) {
			[ 0, 1, 2 ].forEach( ( index ) =>
				shapes.push(
					rect( `sidebar-${ index }`, {
						fill: GLOBAL_TINT,
						height: 6,
						width: columns.sidebar.width,
						x: columns.sidebar.x,
						y: y + index * 8,
					} )
				)
			);
		}

		shapes.push( ...sections.shapes );
		y += sections.height + GAP;
	}

	after.forEach( ( item, index ) => {
		shapes.push( drawItem( item, y, columns.content, `after-${ index }` ) );
		y += getItemHeight( item ) + GAP;
	} );

	if ( hasFooter ) {
		// Footers sit at the bottom, however little is above them.
		shapes.push(
			drawBar( 'footer', Math.max( y + 1, HEIGHT - BAR_HEIGHT ) )
		);
	}

	return el(
		'svg',
		{
			'aria-hidden': true,
			className: 'cnl-layout-sketch',
			focusable: false,
			preserveAspectRatio: 'xMidYMin meet',
			viewBox: `0 0 ${ WIDTH } ${ HEIGHT }`,
			xmlns: 'http://www.w3.org/2000/svg',
		},
		shapes
	);
}
