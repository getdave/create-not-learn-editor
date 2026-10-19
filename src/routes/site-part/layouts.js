/**
 * The layouts a theme offers for a site part, and which one the part uses.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * because the chat loads the layout picker from app init. See
 * `src/editor-layer/index.jsx`.
 */

/**
 * WordPress dependencies
 */
import { parse as parseBlocks, serialize } from '@wordpress/blocks';
import { store as coreDataStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { useMemo } from '@wordpress/element';

/**
 * Internal dependencies
 */
import {
	getBlockAttributes,
	getBlockName,
	getParsedBlocks,
} from '../navigation-edit/navigation-blocks';

const EMPTY_ARRAY = [];

/**
 * The theme's layouts for a site part: its patterns for that area.
 *
 * @param {Object[]} patterns Block patterns.
 * @param {string}   area     `header` or `footer`.
 * @return {Object[]} The patterns for the part.
 */
export function getSitePartPatterns( patterns, area ) {
	const blockType = `core/template-part/${ area }`;

	return ( patterns || EMPTY_ARRAY ).filter(
		( pattern ) =>
			pattern?.inserter !== false &&
			( pattern?.blockTypes || EMPTY_ARRAY ).includes( blockType )
	);
}

/**
 * The layouts with one moved to the front, the rest in their own order.
 *
 * @param {Object[]} layouts The part's layouts.
 * @param {?string}  name    Pattern name to lead with.
 * @return {Object[]} The layouts.
 */
export function putLayoutFirst( layouts, name ) {
	const lead = name && layouts.find( ( pattern ) => pattern.name === name );

	return lead
		? [ lead, ...layouts.filter( ( pattern ) => pattern !== lead ) ]
		: layouts;
}

function getRawContent( content ) {
	return typeof content === 'string' ? content : content?.raw || '';
}

function normalize( markup ) {
	return String( markup || '' )
		.replace( />\s+</g, '><' )
		.replace( /\s+/g, ' ' )
		.trim();
}

/*
 * Without what placing a layout adds to it, or fills in on it: the name a
 * pattern is stamped with in a part, the menu a Navigation block without one
 * is given, and the site's social links.
 */
function withoutPlacementDetails( blocks ) {
	return blocks.map( ( block ) => {
		const key = block.attributes ? 'attributes' : 'attrs';
		const { metadata, ...attributes } = block[ key ] || {};
		const name = getBlockName( block );

		if ( name === 'core/navigation' ) {
			delete attributes.ref;
		}

		return {
			...block,
			[ key ]: attributes,
			innerBlocks:
				name === 'core/social-links'
					? []
					: withoutPlacementDetails( block.innerBlocks || [] ),
		};
	} );
}

/*
 * Without the colours on the part's outermost blocks, which Edit design
 * changes apart from its layout: a style class, or core's colour settings.
 */
function withoutPartColors( blocks ) {
	return blocks.map( ( block ) => {
		const key = block.attributes ? 'attributes' : 'attrs';
		const {
			backgroundColor,
			className,
			gradient,
			style,
			textColor,
			...attributes
		} = block[ key ] || {};
		const kept = String( className || '' )
			.split( /\s+/ )
			.filter(
				( item ) =>
					item &&
					! /^is-style-/.test( item ) &&
					! /^has-[a-z0-9-]*(?:color|background)$/.test( item )
			)
			.join( ' ' );
		const { color, elements, ...otherStyle } = style || {};
		const keptElements = Object.fromEntries(
			Object.entries( elements || {} )
				.map( ( [ name, { color: elementColor, ...rest } ] ) => [
					name,
					rest,
				] )
				.filter( ( [ , rest ] ) => Object.keys( rest ).length )
		);
		const keptStyle = Object.keys( keptElements ).length
			? { ...otherStyle, elements: keptElements }
			: otherStyle;

		if ( kept ) {
			attributes.className = kept;
		}

		if ( Object.keys( keptStyle ).length ) {
			attributes.style = keptStyle;
		}

		return { ...block, [ key ]: attributes };
	} );
}

function toComparable( content ) {
	return normalize(
		serialize(
			withoutPartColors(
				withoutPlacementDetails(
					parseBlocks( content, {
						__unstableSkipMigrationLogs: true,
					} )
				)
			)
		)
	);
}

/**
 * Which of the theme's layouts a site part is using, if any.
 *
 * A part that only places a pattern, as many themes' own parts do, uses that
 * pattern. Otherwise its blocks must match a layout's, give or take spacing,
 * what placing it adds, the social links filled in on it and its colours. A part that
 * has been changed since matches none.
 *
 * @param {string}   content  The part's markup.
 * @param {Object[]} patterns The part's layouts.
 * @return {?string} The layout's pattern name, or `null`.
 */
export function getCurrentPatternName( content, patterns ) {
	if ( ! content || ! patterns?.length ) {
		return null;
	}

	const blocks = getParsedBlocks( content ).filter( ( block ) =>
		getBlockName( block )
	);

	if (
		blocks.length === 1 &&
		getBlockName( blocks[ 0 ] ) === 'core/pattern'
	) {
		const { slug } = getBlockAttributes( blocks[ 0 ] );

		return (
			patterns.find( ( pattern ) => pattern.name === slug )?.name || null
		);
	}

	const comparable = toComparable( content );

	return (
		patterns.find(
			( pattern ) =>
				toComparable( getRawContent( pattern.content ) ) === comparable
		)?.name || null
	);
}

/**
 * A site part's markup as it stands, with any unsaved changes.
 *
 * @param {Object} record Edited template part record.
 * @return {string} Its markup.
 */
export function getSitePartContent( record ) {
	if ( Array.isArray( record?.blocks ) ) {
		return serialize( record.blocks );
	}

	return getRawContent( record?.content );
}

/**
 * The theme's layouts for a site part, and which one it uses as it stands.
 *
 * @param {string}  area `header` or `footer`.
 * @param {?string} id   The part's template part ID.
 * @return {Object} `{ content, currentName, hasResolved, layouts }`.
 *                  `hasResolved` is whether the theme's patterns have loaded.
 */
export function useSitePartLayouts( area, id ) {
	const { content, hasResolved, patterns } = useSelect(
		( select ) => {
			const store = select( coreDataStore );

			return {
				content: id
					? getSitePartContent(
							store.getEditedEntityRecord(
								'postType',
								'wp_template_part',
								id
							)
						)
					: '',
				hasResolved: store.hasFinishedResolution(
					'getBlockPatterns',
					[]
				),
				patterns: store.getBlockPatterns?.() || EMPTY_ARRAY,
			};
		},
		[ id ]
	);
	const layouts = useMemo(
		() => getSitePartPatterns( patterns, area ),
		[ area, patterns ]
	);
	const currentName = useMemo(
		() => getCurrentPatternName( content, layouts ),
		[ content, layouts ]
	);

	return { content, currentName, hasResolved, layouts };
}
