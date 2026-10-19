/**
 * A product, open in its layout, edited on its own page.
 *
 * With a product open in the editor, as Products' Edit opens it, the layout
 * is locked as a page's is, and the product's own details change in place:
 *
 * - Its short description, from the layout's excerpt block, which core leaves
 *   locked.
 * - Its price, from WooCommerce's price block, with "Change price" in the
 *   block toolbar.
 * - Its photo, with "Replace photo" in the block toolbar. WooCommerce only
 *   offers its gallery block in its own site editor, so here the gallery is a
 *   block the editor doesn't know, and this draws the photo in its place.
 * - Its long description, the product's own content, in the Description tab
 *   of WooCommerce's tabs block, as blocks, edited as a page's content is.
 *   A description written in WP Admin's classic editor opens as one Classic
 *   block. The other tabs, attributes and reviews, are WP Admin's.
 *
 * WooCommerce's blocks show the saved product, from its Store API. A price or
 * photo not yet saved is drawn here instead, from the product's unsaved edits
 * (`src/routes/shop/product-entity.js`), so the page shows it straight away.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * for the same reason as `template-part-editing.js`.
 */

/**
 * WordPress dependencies
 */
import {
	BlockControls,
	useInnerBlocksProps,
	/* eslint-disable-next-line @wordpress/no-unsafe-wp-apis -- WooCommerce's own price block uses it for the same thing. */
	__experimentalGetColorClassesAndStyles as getColorClassesAndStyles,
	getTypographyClassesAndStyles,
	useBlockEditingMode,
	useBlockProps,
} from '@wordpress/block-editor';
import { Dropdown, ToolbarButton, ToolbarGroup } from '@wordpress/components';
import {
	store as coreDataStore,
	useEntityBlockEditor,
} from '@wordpress/core-data';
import { useDispatch, useSelect } from '@wordpress/data';
import { addFilter } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';
import { MediaUpload } from '@wordpress/media-utils';

/**
 * Internal dependencies
 */
import { ProductPriceFields } from '../pickers/product-price';
import {
	PRODUCT_KIND,
	PRODUCT_NAME,
	formatPrice,
	registerProductEntity,
} from '../routes/shop/product-entity';
import { HAS_OPTIONS } from '../routes/shop/product-labels';
import { settings } from '../settings';

const EDITOR_STORE = 'core/editor';
const PRICE_BLOCK = 'woocommerce/product-price';
const GALLERY_BLOCK = 'woocommerce/product-image-gallery';
// WooCommerce's tabs. Only the description is changed here.
const TABS = [
	{ id: 'description', label: __( 'Description' ) },
	{ id: 'additional_information', label: __( 'Additional Information' ) },
	{ id: 'reviews', label: __( 'Reviews' ) },
];
const DESCRIPTION_BLOCKS = [
	'woocommerce/product-details',
	'woocommerce/product-description',
];
const PRICE_FIELDS = [ 'regular_price', 'sale_price' ];

/**
 * The product open in the editor, if one is.
 *
 * @return {?number} Its ID.
 */
function useOpenProductId() {
	return useSelect( ( select ) => {
		const editor = select( EDITOR_STORE );

		return editor?.getCurrentPostType() === 'product'
			? editor.getCurrentPostId()
			: null;
	}, [] );
}

/**
 * A product's details, with its unsaved edits.
 *
 * @param {?number} id Product ID.
 * @return {Object} `{ edits, product, update }`.
 */
function useProduct( id ) {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const state = useSelect(
		( select ) => {
			if ( ! id ) {
				return {};
			}

			const store = select( coreDataStore );

			return {
				edits: store.getEntityRecordEdits(
					PRODUCT_KIND,
					PRODUCT_NAME,
					id
				),
				product: store.getEditedEntityRecord(
					PRODUCT_KIND,
					PRODUCT_NAME,
					id
				),
			};
		},
		[ id ]
	);

	return {
		...state,
		update: ( edits ) =>
			editEntityRecord( PRODUCT_KIND, PRODUCT_NAME, id, edits ),
	};
}

function Amount( { price } ) {
	return (
		<span className="woocommerce-Price-amount amount">
			{ formatPrice( price ) }
		</span>
	);
}

/**
 * The price as WooCommerce's block draws it, from the product with its
 * unsaved edits. The block keeps its typography and colours off its wrapper,
 * for the price inside, so they are put there here too.
 *
 * @param {Object} props            Component props.
 * @param {Object} props.attributes The block's attributes.
 * @param {Object} props.product    The product, with its unsaved edits.
 * @return {Element} The price.
 */
function EditedPrice( { attributes, product } ) {
	const blockProps = useBlockProps();
	const typography = getTypographyClassesAndStyles( attributes );
	const color = getColorClassesAndStyles( attributes );
	const regular = Number.parseFloat( product.regular_price );
	const sale = Number.parseFloat( product.sale_price );
	const isOnSale = sale < regular;

	return (
		<div { ...blockProps }>
			<div
				className={ [
					'wc-block-components-product-price',
					attributes.textAlign &&
						`has-text-align-${ attributes.textAlign }`,
					typography.className,
					color.className,
				]
					.filter( Boolean )
					.join( ' ' ) }
				style={ { ...typography.style, ...color.style } }
			>
				{ isOnSale ? (
					<>
						<del>
							<Amount price={ product.regular_price } />
						</del>{ ' ' }
						<ins>
							<Amount price={ product.sale_price } />
						</ins>
					</>
				) : (
					<Amount price={ product.regular_price } />
				) }
			</div>
		</div>
	);
}

function PriceToolbar( { product, update } ) {
	return (
		<BlockControls group="other">
			<ToolbarGroup>
				<Dropdown
					contentClassName="cnl-product-price-popover"
					popoverProps={ { placement: 'bottom-start' } }
					renderContent={ () => (
						<div className="cnl-product-price-popover__fields">
							<ProductPriceFields
								product={ product }
								update={ update }
							/>
						</div>
					) }
					renderToggle={ ( { isOpen, onToggle } ) => (
						<ToolbarButton
							aria-expanded={ isOpen }
							onClick={ onToggle }
						>
							{ __( 'Change price' ) }
						</ToolbarButton>
					) }
				/>
			</ToolbarGroup>
		</BlockControls>
	);
}

/**
 * WooCommerce's price block. In the product open in the editor, it is drawn
 * here, from the product with its unsaved edits, and can be picked, with
 * "Change price" in its toolbar. Drawn here from the start rather than only
 * once the price changes, so the block isn't swapped mid-edit, which would
 * close "Change price" and lose the field's focus. Anywhere else, like a
 * list of related products, WooCommerce's block shows the saved price until
 * that product's price changes.
 *
 * @param {Object} props           Component props.
 * @param {Object} props.BlockEdit WooCommerce's block.
 * @param {Object} props.blockEdit The block's props.
 * @return {Element} The block.
 */
function ProductPrice( { BlockEdit, blockEdit } ) {
	const productId = blockEdit.context?.postId;
	const openProductId = useOpenProductId();
	const isOpenProduct = !! productId && productId === openProductId;
	const { edits, product, update } = useProduct( productId );
	const hasPriceEdits = PRICE_FIELDS.some(
		( field ) => edits && field in edits
	);
	const canChange =
		isOpenProduct && product?.id && ! HAS_OPTIONS.includes( product.type );

	useBlockEditingMode( canChange ? 'contentOnly' : undefined );

	return (
		<>
			{ ( canChange || hasPriceEdits ) && product?.id ? (
				<EditedPrice
					attributes={ blockEdit.attributes }
					product={ product }
				/>
			) : (
				<BlockEdit { ...blockEdit } />
			) }
			{ canChange && blockEdit.isSelected && (
				<PriceToolbar product={ product } update={ update } />
			) }
		</>
	);
}

/**
 * The product's photo, in place of WooCommerce's gallery block, which the
 * editor doesn't have. "Replace photo" in its toolbar picks another.
 *
 * @param {Object} props           Component props.
 * @param {Object} props.blockEdit The block's props.
 * @param {number} props.productId The product open in the editor.
 * @return {Element} The photo.
 */
function ProductPhoto( { blockEdit, productId } ) {
	const { product, update } = useProduct( productId );
	const blockProps = useBlockProps( { className: 'cnl-product-photo' } );
	const images = product?.images || [];
	const src = images[ 0 ]?.src;

	useBlockEditingMode( 'contentOnly' );

	return (
		<>
			<div { ...blockProps }>
				{ src ? (
					// Styled here, as the editor's canvas doesn't load ours.
					<img
						alt=""
						src={ src }
						style={ {
							display: 'block',
							height: 'auto',
							objectFit: 'cover',
							width: '100%',
						} }
					/>
				) : (
					<div
						style={ {
							alignItems: 'center',
							aspectRatio: '1',
							background: 'rgba(0, 0, 0, 0.05)',
							display: 'flex',
							justifyContent: 'center',
						} }
					>
						{ __( 'No photo yet' ) }
					</div>
				) }
			</div>
			{ blockEdit.isSelected && (
				<BlockControls group="other">
					<ToolbarGroup>
						<MediaUpload
							allowedTypes={ [ 'image' ] }
							multiple={ false }
							onSelect={ ( media ) =>
								update( {
									images: [
										{
											id: media.id,
											src:
												media.sizes?.large?.url ||
												media.url,
										},
										...images.slice( 1 ),
									],
								} )
							}
							render={ ( { open } ) => (
								<ToolbarButton onClick={ open }>
									{ src
										? __( 'Replace photo' )
										: __( 'Add a photo' ) }
								</ToolbarButton>
							) }
							value={ images[ 0 ]?.id }
						/>
					</ToolbarGroup>
				</BlockControls>
			) }
		</>
	);
}

/**
 * The layout's excerpt block, which core locks with the rest of the layout,
 * opened up for the product's short description, as the title is.
 *
 * @param {Object} props           Component props.
 * @param {Object} props.BlockEdit Core's block.
 * @param {Object} props.blockEdit The block's props.
 * @return {Element} The block.
 */
function ProductExcerpt( { BlockEdit, blockEdit } ) {
	const openProductId = useOpenProductId();
	const isOpenProduct =
		!! openProductId && blockEdit.context?.postId === openProductId;

	useBlockEditingMode( isOpenProduct ? 'contentOnly' : undefined );

	return <BlockEdit { ...blockEdit } />;
}

/**
 * The photo while a product is open. In the layout on its own, as Shop pages
 * opens it, there is no product to show, so the block stays as it is.
 *
 * @param {Object} props           Component props.
 * @param {Object} props.BlockEdit The block the editor has in its place.
 * @param {Object} props.blockEdit The block's props.
 * @return {Element} The block.
 */
function ProductGallery( { BlockEdit, blockEdit } ) {
	const productId = useOpenProductId();

	return productId ? (
		<ProductPhoto blockEdit={ blockEdit } productId={ productId } />
	) : (
		<BlockEdit { ...blockEdit } />
	);
}

/**
 * The product's long description, its own content, edited as blocks in place
 * of what WooCommerce's block shows. WooCommerce's tabs block keeps its tabs,
 * with the description under its own.
 *
 * @param {Object} props           Component props.
 * @param {Object} props.blockEdit The block's props.
 * @param {number} props.productId The product open in the editor.
 * @return {Element} The description.
 */
function ProductDescription( { blockEdit, productId } ) {
	const [ blocks, onInput, onChange ] = useEntityBlockEditor(
		'postType',
		'product',
		{ id: productId }
	);
	const isTabs = blockEdit.name === 'woocommerce/product-details';
	const blockProps = useBlockProps();
	const innerBlocksProps = useInnerBlocksProps(
		{ className: 'cnl-product-description entry-content' },
		{
			onChange,
			onInput,
			// A bare paragraph, as core's post content starts with, so
			// nothing about the editor is saved in the description.
			template: blocks?.length ? undefined : [ [ 'core/paragraph' ] ],
			value: blocks,
		}
	);

	useBlockEditingMode( 'contentOnly' );

	if ( ! isTabs ) {
		return <div { ...blockProps } { ...innerBlocksProps } />;
	}

	// WooCommerce's tabs, as its block draws them. Only the description is
	// changed here.
	return (
		<div { ...blockProps }>
			<ul className="wc-tabs tabs" role="presentation">
				{ TABS.map( ( { id, label } ) => (
					<li
						className={ `${ id }_tab${
							id === 'description' ? ' active' : ''
						}` }
						key={ id }
					>
						{ /* Links, as WooCommerce's tabs are styled as. */ }
						<a
							href={ `#tab-${ id }` }
							onClick={ ( event ) => event.preventDefault() }
							tabIndex={ -1 }
						>
							{ label }
						</a>
					</li>
				) ) }
			</ul>
			<div className="description_tab">
				<h2>{ __( 'Description' ) }</h2>
				<div { ...innerBlocksProps } />
			</div>
		</div>
	);
}

/**
 * WooCommerce's description block, or its tabs, for the product open in the
 * editor. Anywhere else, like the layout on its own, it stays as it is.
 *
 * @param {Object} props           Component props.
 * @param {Object} props.BlockEdit WooCommerce's block.
 * @param {Object} props.blockEdit The block's props.
 * @return {Element} The block.
 */
function ProductDetails( { BlockEdit, blockEdit } ) {
	const openProductId = useOpenProductId();
	// WooCommerce's tabs block takes no context, being only ever about the
	// product on show.
	const productId = blockEdit.context?.postId ?? openProductId;

	return openProductId && productId === openProductId ? (
		<ProductDescription blockEdit={ blockEdit } productId={ productId } />
	) : (
		<BlockEdit { ...blockEdit } />
	);
}

function isGallery( props ) {
	return (
		props.name === 'core/missing' &&
		props.attributes?.originalName === GALLERY_BLOCK
	);
}

function withProductBlocks( BlockEdit ) {
	return function ProductBlockEdit( props ) {
		if ( props.name === PRICE_BLOCK ) {
			return <ProductPrice BlockEdit={ BlockEdit } blockEdit={ props } />;
		}

		if ( props.name === 'core/post-excerpt' ) {
			return (
				<ProductExcerpt BlockEdit={ BlockEdit } blockEdit={ props } />
			);
		}

		if ( DESCRIPTION_BLOCKS.includes( props.name ) ) {
			return (
				<ProductDetails BlockEdit={ BlockEdit } blockEdit={ props } />
			);
		}

		if ( isGallery( props ) ) {
			return (
				<ProductGallery BlockEdit={ BlockEdit } blockEdit={ props } />
			);
		}

		return <BlockEdit { ...props } />;
	};
}

/**
 * Register the product blocks with the editor, on a site with a shop.
 */
export function registerProductBlocks() {
	if ( ! settings.shop ) {
		return;
	}

	registerProductEntity();
	addFilter(
		'editor.BlockEdit',
		'create-not-learn-editor/product-blocks',
		withProductBlocks
	);
}
