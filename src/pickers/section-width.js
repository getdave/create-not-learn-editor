/**
 * How wide a section's content runs: Narrow, Wide or Full width.
 *
 * Most sections are a full-width block, so their background runs edge to
 * edge, holding blocks laid out at the theme's content or wide size. What
 * reads as the section's width is how wide those blocks run, so that is what
 * changes, through their alignment, as core's own alignment control would.
 * A section that isn't laid out like that, like a cover on its own, changes
 * its own alignment instead.
 *
 * Shared by Edit design's panel, and ready for the chat, so it is imported
 * package by package. See `src/editor-layer/index.jsx`.
 */

/**
 * WordPress dependencies
 */
import { store as blockEditorStore } from '@wordpress/block-editor';
import { getBlockSupport } from '@wordpress/blocks';
import { useDispatch, useSelect } from '@wordpress/data';
import { useMemo } from '@wordpress/element';

export const WIDTH_NARROW = 'narrow';
export const WIDTH_WIDE = 'wide';
export const WIDTH_FULL = 'full';

// Narrowest first.
export const WIDTHS = [ WIDTH_NARROW, WIDTH_WIDE, WIDTH_FULL ];

// A width's alignment, none being the theme's content size.
const ALIGN = {
	[ WIDTH_NARROW ]: undefined,
	[ WIDTH_WIDE ]: 'wide',
	[ WIDTH_FULL ]: 'full',
};

/**
 * The wide and full alignments a block type offers.
 *
 * @param {string} name Block type.
 * @return {string[]} Of `wide` and `full`.
 */
function getAligns( name ) {
	const support = getBlockSupport( name, 'align' );

	if ( support === true ) {
		return [ 'wide', 'full' ];
	}

	return Array.isArray( support )
		? support.filter( ( align ) => align === 'wide' || align === 'full' )
		: [];
}

/**
 * @param {Object} block A block.
 * @return {boolean} Whether its blocks are laid out at the theme's sizes.
 */
function isConstrained( block ) {
	const type =
		block.attributes.layout?.type ??
		getBlockSupport( block.name, 'layout' )?.default?.type;

	return type === 'constrained';
}

/**
 * The block that holds a header's or footer's content: the one block in its
 * part, when there is one.
 *
 * @param {Object} block The section, or a header's or footer's block.
 * @return {?Object} The section.
 */
function getSectionBlock( block ) {
	if ( block?.name !== 'core/template-part' ) {
		return block || null;
	}

	return block.innerBlocks?.length === 1 ? block.innerBlocks[ 0 ] : null;
}

/**
 * @param {?string} align An alignment.
 * @return {string} Its width.
 */
function toWidth( align ) {
	if ( align === 'full' ) {
		return WIDTH_FULL;
	}

	return align === 'wide' ? WIDTH_WIDE : WIDTH_NARROW;
}

/**
 * How wide a section runs, and the widths it can take.
 *
 * @param {?Object} block The section, with its blocks, or a header's or
 *                        footer's block.
 * @return {?Object} `{ current, options, isInner, targets }`, or null when
 *                   its width can't change. `targets` are the blocks whose
 *                   alignment sets it.
 */
export function getSectionWidth( block ) {
	const section = getSectionBlock( block );

	if ( ! section ) {
		return null;
	}

	if ( section.attributes.align === 'full' && isConstrained( section ) ) {
		const targets = ( section.innerBlocks || [] ).filter(
			( inner ) => getAligns( inner.name ).length
		);

		if ( targets.length ) {
			const aligns = targets.map( ( inner ) => inner.attributes.align );
			const offered = new Set(
				targets.flatMap( ( inner ) => getAligns( inner.name ) )
			);
			let current = WIDTH_NARROW;

			if ( aligns.includes( 'full' ) ) {
				current = WIDTH_FULL;
			} else if ( aligns.includes( 'wide' ) ) {
				current = WIDTH_WIDE;
			}

			return {
				current,
				isInner: true,
				options: WIDTHS.filter(
					( width ) => width === WIDTH_NARROW || offered.has( width )
				),
				targets: targets.map( ( inner ) => inner.clientId ),
			};
		}
	}

	const aligns = getAligns( section.name );

	// A part's block sits in its part, not in the page's layout, so its own
	// alignment does nothing.
	if ( ! aligns.length || block.name === 'core/template-part' ) {
		return null;
	}

	return {
		current: toWidth( section.attributes.align ),
		isInner: false,
		options: WIDTHS.filter(
			( width ) => width === WIDTH_NARROW || aligns.includes( width )
		),
		targets: [ section.clientId ],
	};
}

/**
 * What changes for a section to run a width.
 *
 * Narrow takes every block in it back to the content size. Wide and Full
 * width move the blocks that already run wider than that, so what was
 * narrow by design, like a short line under a wide heading, stays so; when
 * none do, all of them move.
 *
 * @param {Object} block The section, with its blocks, or a header's or
 *                       footer's block.
 * @param {string} width The width.
 * @return {?Object} `{ clientIds, attributes }` to update, or null.
 */
export function getWidthChange( block, width ) {
	const sectionWidth = getSectionWidth( block );

	if ( ! sectionWidth || ! sectionWidth.options.includes( width ) ) {
		return null;
	}

	const attributes = { align: ALIGN[ width ] };

	if ( ! sectionWidth.isInner ) {
		return { attributes, clientIds: sectionWidth.targets };
	}

	const targets = getSectionBlock( block ).innerBlocks.filter( ( inner ) =>
		sectionWidth.targets.includes( inner.clientId )
	);

	if ( width === WIDTH_NARROW ) {
		return {
			attributes,
			clientIds: targets
				.filter( ( inner ) => inner.attributes.align )
				.map( ( inner ) => inner.clientId ),
		};
	}

	const wider = targets.filter(
		( inner ) =>
			inner.attributes.align === 'wide' ||
			inner.attributes.align === 'full'
	);

	return {
		attributes,
		clientIds: ( wider.length ? wider : targets )
			.filter( ( inner ) => getAligns( inner.name ).includes( width ) )
			.map( ( inner ) => inner.clientId ),
	};
}

/**
 * A section's width, and a way to change it.
 *
 * @param {?string} clientId The section, or a header's or footer's block.
 * @return {Object} `{ width, setWidth }`. `width` is from `getSectionWidth`.
 */
export function useSectionWidth( clientId ) {
	// A header's or footer's blocks belong to its part, which core keeps
	// apart from the block that shows it, so they are read from its list.
	const { innerBlocks, ownBlock } = useSelect(
		( select ) => {
			const store = select( blockEditorStore );

			return {
				innerBlocks: clientId ? store.getBlocks( clientId ) : null,
				ownBlock: clientId ? store.getBlock( clientId ) : null,
			};
		},
		[ clientId ]
	);
	const { updateBlockAttributes } = useDispatch( blockEditorStore );
	const block = useMemo(
		() => ownBlock && { ...ownBlock, innerBlocks },
		[ innerBlocks, ownBlock ]
	);
	const width = useMemo( () => getSectionWidth( block ), [ block ] );

	const setWidth = ( next ) => {
		const change = block && getWidthChange( block, next );

		if ( change?.clientIds.length ) {
			updateBlockAttributes( change.clientIds, change.attributes );
		}
	};

	return { setWidth, width };
}
