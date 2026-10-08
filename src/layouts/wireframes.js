/**
 * Grey wireframes that stand in for a layout's empty blocks in previews.
 *
 * Each calls `useBlockProps()`, so Columns and Group still place it like the
 * block it stands in for. Styles live in `assets/layouts.css`.
 */

/**
 * WordPress dependencies
 */
import { useBlockProps, useInnerBlocksProps } from '@wordpress/block-editor';
import { createElement as el } from '@wordpress/element';

const HEADING_HEIGHTS = { 1: 40, 2: 32, 3: 24 };

// Headings set in a big preset size, like a statement or a key number, draw
// taller than their level alone would make them.
const HEADING_FONT_SIZE_HEIGHTS = { 'x-large': 44, 'xx-large': 56 };

const LINE = 10;
const GAP = 10;
const LINE_WIDTHS = [ 100, 100, 60 ];

/**
 * Text alignment across the attribute shapes core has used: block supports,
 * the older textAlign attribute, and align.
 *
 * @param {Object} attributes Block attributes.
 * @return {?string} Alignment.
 */
function getTextAlign( attributes ) {
	return (
		attributes.style?.typography?.textAlign ??
		attributes.textAlign ??
		attributes.align
	);
}

// Image sizes arrive as CSS strings ("80px") or, from older markup, numbers.
function getCssSize( value ) {
	return typeof value === 'number' ? `${ value }px` : value || undefined;
}

/**
 * A mountain and sun, 32x24. Centred on the parent SVG, or drawn at double
 * size inset from the top right, clear of a cover's centred content.
 *
 * @param {Object}  props        Component props.
 * @param {boolean} props.corner Whether to draw it in the corner.
 * @return {Element} The icon.
 */
function ImageIcon( { corner = false } ) {
	return el(
		'svg',
		{
			className: 'cnl-layout-wireframe__icon',
			overflow: 'visible',
			x: corner ? '100%' : '50%',
			y: corner ? 0 : '50%',
		},
		el(
			'g',
			{
				transform: corner
					? 'translate(-96 32) scale(2)'
					: 'translate(-16 -12)',
			},
			el( 'circle', { cx: 8, cy: 6, r: 3 } ),
			el( 'path', { d: 'M0 24 L10 12 L16 18 L22 10 L32 24 Z' } )
		)
	);
}

function HeadingWireframe( { attributes } ) {
	const height =
		HEADING_FONT_SIZE_HEIGHTS[ attributes.fontSize ] ??
		HEADING_HEIGHTS[ attributes.level ] ??
		18;
	const isCentred = getTextAlign( attributes ) === 'center';
	const blockProps = useBlockProps( {
		'aria-hidden': true,
		className: 'cnl-layout-wireframe cnl-layout-wireframe--heading',
	} );

	return el(
		'div',
		blockProps,
		el(
			'svg',
			{ height, width: '100%' },
			el( 'rect', {
				height,
				rx: height / 4,
				width: '70%',
				x: isCentred ? '15%' : 0,
			} )
		)
	);
}

function ParagraphWireframe( { attributes } ) {
	const isCentred = getTextAlign( attributes ) === 'center';
	const blockProps = useBlockProps( {
		'aria-hidden': true,
		className: 'cnl-layout-wireframe cnl-layout-wireframe--paragraph',
	} );

	return el(
		'div',
		blockProps,
		el(
			'svg',
			{
				height: LINE_WIDTHS.length * ( LINE + GAP ) - GAP,
				width: '100%',
			},
			LINE_WIDTHS.map( ( width, index ) =>
				el( 'rect', {
					height: LINE,
					key: index,
					rx: LINE / 2,
					width: `${ width }%`,
					x: isCentred ? `${ ( 100 - width ) / 2 }%` : 0,
					y: index * ( LINE + GAP ),
				} )
			)
		)
	);
}

function ButtonWireframe() {
	const blockProps = useBlockProps( {
		'aria-hidden': true,
		className: 'cnl-layout-wireframe cnl-layout-wireframe--button',
	} );

	return el(
		'div',
		blockProps,
		el(
			'svg',
			{ height: 40, viewBox: '0 0 120 40', width: 120 },
			el( 'rect', {
				className: 'cnl-layout-wireframe__outline',
				height: 38,
				rx: 19,
				width: 118,
				x: 1,
				y: 1,
			} ),
			el( 'rect', { height: 8, rx: 4, width: 50, x: 35, y: 16 } )
		)
	);
}

function ImageWireframe( { attributes } ) {
	const { align, aspectRatio, height, width } = attributes;
	const isRound = ( attributes.className ?? '' )
		.split( /\s+/ )
		.includes( 'is-style-rounded' );
	const blockProps = useBlockProps( {
		'aria-hidden': true,
		className: `cnl-layout-wireframe cnl-layout-wireframe--image${
			isRound ? ' is-round' : ''
		}`,
		// Mirror the image's own size so small images (a quote's 80px
		// portrait) look small. Unset values fall back to the stylesheet.
		style: {
			aspectRatio:
				aspectRatio && aspectRatio !== 'auto' ? aspectRatio : undefined,
			height: getCssSize( height ),
			marginInline: align === 'center' ? 'auto' : undefined,
			width: getCssSize( width ),
		},
	} );

	return el(
		'div',
		blockProps,
		el(
			'svg',
			{ height: '100%', width: '100%' },
			isRound
				? el( 'ellipse', {
						cx: '50%',
						cy: '50%',
						rx: '50%',
						ry: '50%',
					} )
				: el( 'rect', { height: '100%', rx: 4, width: '100%' } ),
			el( ImageIcon )
		)
	);
}

function CoverWireframe( { attributes } ) {
	const { minHeight, minHeightUnit } = attributes;
	const blockProps = useBlockProps( {
		className: 'cnl-layout-wireframe cnl-layout-wireframe--cover',
		// Unset falls back to the stylesheet's min-height.
		style: minHeight
			? { minHeight: `${ minHeight }${ minHeightUnit || 'px' }` }
			: undefined,
	} );
	// The cover's heading and button draw as wireframes on top.
	const innerBlocksProps = useInnerBlocksProps( {
		className: 'cnl-layout-wireframe__cover-inner',
	} );

	return el(
		'div',
		blockProps,
		el(
			'svg',
			{
				'aria-hidden': true,
				className: 'cnl-layout-wireframe__cover-bg',
				height: '100%',
				width: '100%',
			},
			el( 'rect', { height: '100%', rx: 4, width: '100%' } ),
			el( ImageIcon, { corner: true } )
		),
		el( 'div', innerBlocksProps )
	);
}

/**
 * The wireframe for each block that has one.
 */
export const WIREFRAMES = {
	'core/button': ButtonWireframe,
	'core/cover': CoverWireframe,
	'core/heading': HeadingWireframe,
	'core/image': ImageWireframe,
	'core/paragraph': ParagraphWireframe,
};
