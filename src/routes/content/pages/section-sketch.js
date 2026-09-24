/**
 * A tiny wireframe of a section, drawn from what it holds.
 *
 * Cheaper than a rendered preview, and easier to tell apart at thumbnail size:
 * the real thing is already on the canvas next to it.
 */

/**
 * Internal dependencies
 */
import { getSectionSketch } from './page-sections';
import { el } from '../../../wordpress-packages';

const WIDTH = 48;
const HEIGHT = 32;

function textLines( { button, heading, text, x, y, width, light } ) {
	const shapes = [];
	const fill = light ? 'var(--cnl-sketch-on-fill)' : 'currentColor';
	let top = y;

	if ( heading ) {
		shapes.push(
			el( 'rect', {
				fill,
				height: 3,
				key: 'heading',
				opacity: 0.85,
				rx: 1,
				width: width * 0.7,
				x,
				y: top,
			} )
		);
		top += 5.5;
	}

	if ( text ) {
		[ 1, 0.75 ].forEach( ( scale, index ) => {
			shapes.push(
				el( 'rect', {
					fill,
					height: 1.6,
					key: `text-${ index }`,
					opacity: 0.4,
					rx: 0.8,
					width: width * scale,
					x,
					y: top,
				} )
			);
			top += 3.2;
		} );
		top += 1;
	}

	if ( button ) {
		shapes.push(
			el( 'rect', {
				fill: 'var(--cnl-sketch-accent)',
				height: 3.6,
				key: 'button',
				rx: 1.8,
				width: Math.min( 14, width * 0.45 ),
				x,
				y: top,
			} )
		);
	}

	return shapes;
}

function getShapes( sketch ) {
	const isFilled = sketch.tone === 'filled';
	const shapes = [];

	if ( sketch.media === 'cover' ) {
		shapes.push(
			el( 'rect', {
				fill: 'var(--cnl-sketch-fill)',
				height: HEIGHT,
				key: 'cover',
				width: WIDTH,
			} ),
			...textLines( {
				...sketch,
				light: true,
				width: 28,
				x: 10,
				y: 9,
			} )
		);

		return shapes;
	}

	if ( isFilled ) {
		shapes.push(
			el( 'rect', {
				fill: 'var(--cnl-sketch-tint)',
				height: HEIGHT,
				key: 'tint',
				width: WIDTH,
			} )
		);
	}

	if ( sketch.media === 'side' ) {
		shapes.push(
			el( 'rect', {
				fill: 'var(--cnl-sketch-image)',
				height: 20,
				key: 'image',
				rx: 1.5,
				width: 18,
				x: 5,
				y: 6,
			} ),
			...textLines( { ...sketch, width: 18, x: 26, y: 9 } )
		);

		return shapes;
	}

	if ( sketch.columns > 1 ) {
		const gap = 2.5;
		const inner = WIDTH - 10;
		const width = ( inner - gap * ( sketch.columns - 1 ) ) / sketch.columns;
		const top = sketch.heading ? 10 : 6;

		if ( sketch.heading ) {
			shapes.push(
				el( 'rect', {
					fill: 'currentColor',
					height: 2.6,
					key: 'heading',
					opacity: 0.85,
					rx: 1,
					width: 20,
					x: 5,
					y: 4,
				} )
			);
		}

		for ( let index = 0; index < sketch.columns; index++ ) {
			const x = 5 + index * ( width + gap );

			shapes.push(
				sketch.columnImages
					? el( 'rect', {
							fill: 'var(--cnl-sketch-image)',
							height: 10,
							key: `column-${ index }`,
							rx: 1,
							width,
							x,
							y: top,
						} )
					: el( 'rect', {
							fill: 'currentColor',
							height: 10,
							key: `column-${ index }`,
							opacity: 0.12,
							rx: 1,
							width,
							x,
							y: top,
						} ),
				el( 'rect', {
					fill: 'currentColor',
					height: 1.6,
					key: `column-text-${ index }`,
					opacity: 0.4,
					rx: 0.8,
					width: width * 0.8,
					x,
					y: top + 13,
				} )
			);
		}

		return shapes;
	}

	if ( sketch.media === 'grid' ) {
		[ 0, 1, 2 ].forEach( ( index ) =>
			shapes.push(
				el( 'rect', {
					fill: 'var(--cnl-sketch-image)',
					height: 12,
					key: `grid-${ index }`,
					rx: 1,
					width: 11.5,
					x: 5 + index * 13.5,
					y: sketch.heading ? 12 : 10,
				} )
			)
		);

		if ( sketch.heading ) {
			shapes.push(
				el( 'rect', {
					fill: 'currentColor',
					height: 2.6,
					key: 'heading',
					opacity: 0.85,
					rx: 1,
					width: 20,
					x: 5,
					y: 5,
				} )
			);
		}

		return shapes;
	}

	if ( sketch.media === 'block' ) {
		shapes.push(
			el( 'rect', {
				fill: 'var(--cnl-sketch-image)',
				height: 13,
				key: 'image',
				rx: 1.5,
				width: 38,
				x: 5,
				y: 4,
			} ),
			...textLines( {
				...sketch,
				button: false,
				width: 30,
				x: 5,
				y: 21,
			} )
		);

		return shapes;
	}

	return [
		...shapes,
		...textLines( {
			...sketch,
			heading: sketch.heading || ! sketch.text,
			width: 30,
			x: 9,
			y: sketch.button ? 7 : 10,
		} ),
	];
}

/**
 * @param {Object} props       Component props.
 * @param {Object} props.block The section's top-level block.
 * @return {Element} The sketch.
 */
export default function SectionSketch( { block } ) {
	const sketch = getSectionSketch( block );

	return el(
		'svg',
		{
			'aria-hidden': true,
			className: 'cnl-page-section__sketch',
			focusable: false,
			height: HEIGHT,
			viewBox: `0 0 ${ WIDTH } ${ HEIGHT }`,
			width: WIDTH,
			xmlns: 'http://www.w3.org/2000/svg',
		},
		getShapes( sketch )
	);
}
