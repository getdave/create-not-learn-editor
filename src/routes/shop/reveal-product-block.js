/**
 * Show where a change made in the Products screen lands on the page: the
 * block it changes is picked in the canvas and flashes once typing pauses.
 *
 * The block is picked without taking focus, so typing carries on in the
 * field. A change made while the canvas is in Browse moves it to Edit first
 * (see `useSiteCanvas`), so the block is looked for again until the product
 * is open there, for a moment, then given up on.
 */

/**
 * Internal dependencies
 */
import { MODE_BROWSE, getCanvasMode } from '../../site-canvas/mode';
import { blockEditorStore, dispatch, select } from '../../wordpress-packages';

const GALLERY_BLOCK = 'woocommerce/product-image-gallery';

// The blocks that show each kind of change, most likely first.
const FIELD_BLOCKS = {
	button: [ 'woocommerce/add-to-cart-form', 'woocommerce/product-button' ],
	content: [
		'woocommerce/product-details',
		'woocommerce/product-description',
	],
	excerpt: [ 'core/post-excerpt' ],
	photo: [ GALLERY_BLOCK, 'woocommerce/product-image' ],
	price: [ 'woocommerce/product-price' ],
	stock: [
		'woocommerce/product-stock-indicator',
		'woocommerce/add-to-cart-form',
	],
	title: [ 'core/post-title' ],
};

// WooCommerce's fields, by the kind of change they are.
const PRODUCT_FIELDS = {
	button_text: 'button',
	external_url: 'button',
	images: 'photo',
	regular_price: 'price',
	sale_price: 'price',
	stock_quantity: 'stock',
	stock_status: 'stock',
};

// Lists of other products in the layout, like related products, whose
// blocks are about those products, not this one.
const LIST_BLOCKS = [
	'core/query',
	'woocommerce/product-collection',
	'woocommerce/product-template',
];

// How long the flash waits for typing to pause, and how long it lasts.
const FLASH_DELAY_MS = 250;
const FLASH_MS = 1800;

// How often, and how many times, to look for the block while the canvas
// moves to Edit and the product opens there.
const RETRY_MS = 300;
const RETRIES = 12;

let flashTimeout;
let retryTimeout;

/**
 * The block on the page showing a kind of change to the product.
 *
 * @param {string} field Kind of change, a key of `FIELD_BLOCKS`.
 * @return {?string} Its client ID.
 */
function findBlock( field ) {
	const blockEditor = select( blockEditorStore );

	for ( const name of FIELD_BLOCKS[ field ] || [] ) {
		// WooCommerce's gallery is only offered in its own site editor, so
		// here it is a block the editor doesn't have.
		const candidates =
			name === GALLERY_BLOCK
				? blockEditor
						.getBlocksByName( 'core/missing' )
						.filter(
							( clientId ) =>
								blockEditor.getBlockAttributes( clientId )
									?.originalName === GALLERY_BLOCK
						)
				: blockEditor.getBlocksByName( name );
		const clientId = candidates.find(
			( id ) =>
				! blockEditor.getBlockParentsByBlockName( id, LIST_BLOCKS )
					.length
		);

		if ( clientId ) {
			return clientId;
		}
	}

	return null;
}

function isProductOpen( productId ) {
	const editor = select( 'core/editor' );

	return (
		getCanvasMode() !== MODE_BROWSE &&
		editor?.getCurrentPostType() === 'product' &&
		Number( editor.getCurrentPostId() ) === Number( productId )
	);
}

function scrollIntoView( clientId ) {
	const canvas = document.querySelector( 'iframe[name="editor-canvas"]' );

	canvas?.contentDocument
		?.getElementById( `block-${ clientId }` )
		?.scrollIntoView( { behavior: 'smooth', block: 'nearest' } );
}

/**
 * Pick, and flash, the block on the page that a change to the product shows
 * in.
 *
 * @param {number}   productId        The product changed.
 * @param {string[]} fields           What changed: WooCommerce's field names,
 *                                    or `title`, `excerpt` and `content` for
 *                                    the post's.
 * @param {Object}   options
 * @param {boolean}  options.isTyping Whether to put the caret at the end of
 *                                    what the block holds, for writing in it
 *                                    there, rather than leave focus where it
 *                                    is.
 * @param {number}   tries            Looks left before giving up.
 */
export function revealProductBlock(
	productId,
	fields,
	{ isTyping = false } = {},
	tries = RETRIES
) {
	const field = fields
		.map( ( name ) => PRODUCT_FIELDS[ name ] || name )
		.find( ( name ) => FIELD_BLOCKS[ name ] );

	window.clearTimeout( retryTimeout );

	if ( ! field ) {
		return;
	}

	const clientId = isProductOpen( productId ) ? findBlock( field ) : null;

	if ( ! clientId ) {
		if ( tries > 0 ) {
			retryTimeout = window.setTimeout(
				() =>
					revealProductBlock(
						productId,
						fields,
						{ isTyping },
						tries - 1
					),
				RETRY_MS
			);
		}

		return;
	}

	const blockEditor = select( blockEditorStore );

	if ( isTyping ) {
		const inner = blockEditor.getBlockOrder( clientId );

		// `-1`, the end of the last block in it, with focus.
		dispatch( blockEditorStore ).selectBlock(
			inner[ inner.length - 1 ] || clientId,
			-1
		);
		scrollIntoView( clientId );
	} else if ( blockEditor.getSelectedBlockClientId() !== clientId ) {
		// `null`, so the block is picked without moving focus to it.
		dispatch( blockEditorStore ).selectBlock( clientId, null );
		scrollIntoView( clientId );
	}

	window.clearTimeout( flashTimeout );
	flashTimeout = window.setTimeout(
		() => dispatch( blockEditorStore ).flashBlock( clientId, FLASH_MS ),
		FLASH_DELAY_MS
	);
}
