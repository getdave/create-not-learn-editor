/**
 * The blocks a design preview draws.
 *
 * A preview draws in an iframe as tall as what's in it, so a height in
 * viewport units is a share of the preview's own height: the taller a block
 * makes the preview, the taller the block gets. An `85vh` cover settles at
 * thousands of pixels and pushes the rest of the design out of sight. So
 * previews stand in for a screen 800px tall, and viewport heights become
 * pixels of that screen, as they would in a browser window.
 *
 * Page designs are mostly pattern blocks, which only become their sections
 * once they draw, so those are swapped for their blocks first.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * because the chat loads the pickers from app init. See
 * `src/editor-layer/index.jsx`.
 */

/**
 * WordPress dependencies
 */
import { parse, store as blocksStore } from '@wordpress/blocks';
import { store as coreDataStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { useMemo } from '@wordpress/element';

/**
 * Height of the screen a preview stands in for. Previews are 1200px wide, so
 * this is a laptop's proportions.
 */
export const PREVIEW_VIEWPORT_HEIGHT = 800;

const EMPTY_ARRAY = [];
const VIEWPORT_HEIGHT_UNIT = /^[sdl]?vh$/;
const VIEWPORT_HEIGHT_LENGTH = /(-?\d*\.?\d+)[sdl]?vh\b/g;

function toPixels( amount ) {
	return Math.round( ( amount * PREVIEW_VIEWPORT_HEIGHT ) / 100 );
}

function replaceViewportHeights( value ) {
	if ( typeof value === 'string' ) {
		return value.replace(
			VIEWPORT_HEIGHT_LENGTH,
			( match, amount ) => `${ toPixels( parseFloat( amount ) ) }px`
		);
	}

	if ( Array.isArray( value ) ) {
		return value.map( replaceViewportHeights );
	}

	if ( value && typeof value === 'object' ) {
		return Object.fromEntries(
			Object.entries( value ).map( ( [ key, entry ] ) => [
				key,
				replaceViewportHeights( entry ),
			] )
		);
	}

	return value;
}

function getPreviewAttributes( attributes ) {
	const next = { ...attributes };

	if ( next.style ) {
		next.style = replaceViewportHeights( next.style );
	}

	// A Spacer's height.
	if ( typeof next.height === 'string' ) {
		next.height = replaceViewportHeights( next.height );
	}

	// A Cover's height, a number with its unit kept apart.
	if (
		typeof next.minHeight === 'number' &&
		VIEWPORT_HEIGHT_UNIT.test( next.minHeightUnit )
	) {
		next.minHeight = toPixels( next.minHeight );
		next.minHeightUnit = 'px';
	}

	return next;
}

function getPatternMarkup( pattern ) {
	return typeof pattern.content === 'string'
		? pattern.content
		: pattern.content?.raw || '';
}

/**
 * @param {Object[]} blocks   Parsed blocks.
 * @param {Object[]} patterns Registered block patterns, for pattern blocks.
 * @param {string[]} within   Patterns already being swapped in, so one that
 *                            contains itself stops.
 * @return {Object[]} The blocks to preview.
 */
export function getPreviewBlocks(
	blocks,
	patterns = EMPTY_ARRAY,
	within = EMPTY_ARRAY
) {
	return blocks.flatMap( ( block ) => {
		if ( block.name === 'core/pattern' ) {
			const slug = block.attributes?.slug;
			const pattern =
				! within.includes( slug ) &&
				patterns.find( ( { name } ) => name === slug );

			return pattern
				? getPreviewBlocks(
						parse( getPatternMarkup( pattern ), {
							__unstableSkipMigrationLogs: true,
						} ),
						patterns,
						[ ...within, slug ]
					)
				: [ block ];
		}

		return [
			{
				...block,
				attributes: getPreviewAttributes( block.attributes ),
				innerBlocks: getPreviewBlocks(
					block.innerBlocks || EMPTY_ARRAY,
					patterns,
					within
				),
			},
		];
	} );
}

/**
 * The blocks to preview markup with.
 *
 * The editor's assets register the blocks once a preview first loads them, and
 * markup parsed before then loses every block it doesn't know. So it's parsed
 * again as blocks are registered.
 *
 * @param {string} content Block markup.
 * @return {Object[]} The blocks to preview it with.
 */
export function usePreviewBlocks( content ) {
	const { blockTypes, patterns } = useSelect(
		( select ) => ( {
			blockTypes: select( blocksStore ).getBlockTypes(),
			patterns:
				select( coreDataStore ).getBlockPatterns?.() || EMPTY_ARRAY,
		} ),
		[]
	);

	return useMemo(
		() =>
			getPreviewBlocks(
				parse( content || '', { __unstableSkipMigrationLogs: true } ),
				patterns
			),
		// Not read, but parsing depends on which blocks are registered.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[ blockTypes, content, patterns ]
	);
}
