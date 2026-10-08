/**
 * When an empty block in a layout is drawn as a wireframe.
 */

/**
 * The class on every layout's root block. See `patterns/layouts/`.
 */
export const LAYOUT_MARKER = 'cnl-layout';

const TEXT_BLOCKS = [ 'core/heading', 'core/paragraph', 'core/button' ];
const MEDIA_BLOCKS = [ 'core/image', 'core/cover' ];

// core/button keeps its label in `text`; heading and paragraph use `content`.
const TEXT_ATTRIBUTE = { 'core/button': 'text' };

/**
 * Whether a block has nothing in it yet: no text, or no image.
 *
 * @param {string} name       Block name.
 * @param {Object} attributes Block attributes.
 * @return {boolean} Whether it is empty.
 */
export function isEmptyBlock( name, attributes = {} ) {
	if ( TEXT_BLOCKS.includes( name ) ) {
		const text = attributes[ TEXT_ATTRIBUTE[ name ] ?? 'content' ];

		return ! String( text ?? '' ).trim();
	}

	if ( name === 'core/cover' ) {
		return ! attributes.url && ! attributes.useFeaturedImage;
	}

	if ( MEDIA_BLOCKS.includes( name ) ) {
		return ! attributes.url;
	}

	return false;
}

/**
 * Whether a class name list holds the layout marker.
 *
 * @param {?string} className Block class names.
 * @return {boolean} Whether it is marked.
 */
export function hasLayoutMarker( className ) {
	return ( className ?? '' ).split( /\s+/ ).includes( LAYOUT_MARKER );
}

/**
 * Whether to draw a block as a wireframe: an empty block, in a preview, in a
 * layout. A layout that has been filled in previews as its real content.
 *
 * The marker can sit on the block itself (a cover root) or any ancestor.
 *
 * @param {Object}    options                    Options.
 * @param {string}    options.name               Block name.
 * @param {Object}    options.attributes         Block attributes.
 * @param {boolean}   options.isPreviewMode      Whether the editor is a
 *                                               preview.
 * @param {?string[]} options.ancestorClassNames Ancestors' class names.
 * @return {boolean} Whether to draw a wireframe.
 */
export function shouldWireframe( {
	name,
	attributes = {},
	isPreviewMode,
	ancestorClassNames = [],
} ) {
	if ( ! isPreviewMode || ! isEmptyBlock( name, attributes ) ) {
		return false;
	}

	return [ attributes.className, ...ancestorClassNames ].some(
		hasLayoutMarker
	);
}
