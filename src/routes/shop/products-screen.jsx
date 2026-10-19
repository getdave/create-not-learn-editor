/**
 * Products: what the shop sells, read from and saved to WooCommerce.
 *
 * Like Pages, the list is in the stage and the canvas shows what it is about:
 * the shop page, or, with a product picked, that product's page. A product
 * opens in Edit as a page does: in its layout, with its own name, photo,
 * price and description, changed there or in the stage. Either way the
 * changes are unsaved edits, saved with the rest of the site's changes, and
 * a change made in the stage moves the canvas to Edit to show it, as other
 * changes Browse can't show do.
 *
 * A product is two records. Its name and description are the post's, which
 * the editor's title and excerpt blocks change. Its price, stock and photo
 * are WooCommerce's, from `product-entity.js`. Each field edits the record
 * the editor shows it from, so the two never disagree.
 *
 * Only what most shops change is offered: photo, name, price, description,
 * stock and whether it is on sale in the shop. Anything else, like options,
 * delivery and tax, opens WooCommerce's own editor in WP Admin. So does
 * anything this screen can't change without losing something, like a
 * description with a list in it.
 */

/**
 * WordPress dependencies
 */
import { useNavigate, useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import SitePreviewCanvas from '../static/site-preview';
import { ShopPage, useShopSearch } from './heading';
import {
	PRODUCT_KIND,
	PRODUCT_NAME,
	registerProductEntity,
} from './product-entity';
import { getProductEditUrl } from './product-labels';
import { ProductPriceFields } from '../../pickers/product-price';
import ProductsList from './products-list';
import ProductsTable from './products-table';
import { revealProductBlock } from './reveal-product-block';
import { MODE_EDIT, setCanvasMode } from '../../site-canvas/mode';
import { PRODUCTS_PATH, getShop } from './shop';
import {
	Button,
	DropdownMenu,
	InputControl,
	Link,
	MediaUpload,
	MenuGroup,
	MenuItem,
	SelectControl,
	Spinner,
	Stack,
	SwitchControl,
	Text,
	TextareaControl,
	__,
	coreDataStore,
	decodeEntities,
	escapeHTML,
	externalIcon,
	moreVerticalIcon,
	noticesStore,
	useDispatch,
	useMemo,
	useSelect,
	useState,
} from '../../wordpress-packages';

registerProductEntity();

/**
 * A description this screen can change: plain paragraphs, nothing else.
 *
 * @param {string} html Description as WooCommerce stores it.
 * @return {?string} The text, paragraphs a blank line apart, or null when
 *                   the description has other formatting.
 */
function getPlainDescription( html = '' ) {
	const withoutParagraphs = html
		.replace( /<\/p>\s*<p>/g, '\n\n' )
		.replace( /<\/?p>/g, '' )
		.replace( /<br\s*\/?>/g, '\n' );

	if ( /<[a-z!/]/i.test( withoutParagraphs ) ) {
		return null;
	}

	return decodeEntities( withoutParagraphs ).trim();
}

function toDescriptionHtml( text ) {
	return text
		.split( /\n{2,}/ )
		.filter( ( paragraph ) => paragraph.trim() )
		.map(
			( paragraph ) =>
				`<p>${ escapeHTML( paragraph ).replace( /\n/g, '<br>' ) }</p>`
		)
		.join( '' );
}

function stripTags( html = '' ) {
	return decodeEntities( html.replace( /<[^>]+>/g, ' ' ) )
		.replace( /\s+/g, ' ' )
		.trim();
}

/**
 * A post's title or excerpt as text, whichever shape the editor has it in,
 * falling back to WooCommerce's copy until the post has loaded.
 *
 * @param {string|Object} value    The post's field.
 * @param {string}        fallback WooCommerce's copy.
 * @return {string} The text.
 */
function getPostText( value, fallback = '' ) {
	if ( typeof value === 'string' ) {
		return value;
	}

	return value?.raw ?? decodeEntities( fallback || '' );
}

function useProduct( id ) {
	return useSelect(
		( select ) => {
			if ( ! id ) {
				return {};
			}

			const store = select( coreDataStore );

			return {
				hasEdits: store.hasEditsForEntityRecord(
					PRODUCT_KIND,
					PRODUCT_NAME,
					id
				),
				product: store.getEditedEntityRecord(
					PRODUCT_KIND,
					PRODUCT_NAME,
					id
				),
				saved: store.getEntityRecord( PRODUCT_KIND, PRODUCT_NAME, id ),
			};
		},
		[ id ]
	);
}

/**
 * The product's post: its name and description, as the editor has them.
 *
 * @param {?number} id Product ID.
 * @return {Object} `{ hasEdits, post, editPost }`.
 */
function useProductPost( id ) {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const state = useSelect(
		( select ) => {
			if ( ! id ) {
				return {};
			}

			const store = select( coreDataStore );

			return {
				hasEdits: store.hasEditsForEntityRecord(
					'postType',
					'product',
					id
				),
				post: store.getEditedEntityRecord( 'postType', 'product', id ),
			};
		},
		[ id ]
	);

	return {
		...state,
		editPost: ( edits ) =>
			editEntityRecord( 'postType', 'product', id, edits ),
	};
}

function useSelectedId() {
	const { product } = useSearch( { strict: false } );

	return Number( product ) || null;
}

function useOpenProduct() {
	const navigate = useNavigate();
	const search = useShopSearch();

	return ( id ) =>
		navigate( {
			search: id ? { ...search, product: id } : search,
			to: PRODUCTS_PATH,
		} );
}

function ProductPhoto( { className = '', product } ) {
	const src = product.images?.[ 0 ]?.src;

	return src ? (
		<img alt="" className={ className } src={ src } />
	) : (
		<span aria-hidden className={ `${ className } is-empty` } />
	);
}

function PhotoField( { product, update } ) {
	const images = product.images || [];

	return (
		<div className="cnl-shop-product__photo-field">
			<ProductPhoto
				className="cnl-shop-product__photo"
				product={ product }
			/>
			<MediaUpload
				allowedTypes={ [ 'image' ] }
				multiple={ false }
				onSelect={ ( media ) =>
					// WooCommerce uses the ID; the address is only for showing
					// the photo here until it is saved.
					update( {
						images: [
							{
								id: media.id,
								src: media.sizes?.medium?.url || media.url,
							},
							...images.slice( 1 ),
						],
					} )
				}
				render={ ( { open } ) => (
					<Button
						__next40pxDefaultSize
						onClick={ open }
						variant="secondary"
					>
						{ images.length
							? __( 'Replace photo' )
							: __( 'Add a photo' ) }
					</Button>
				) }
				value={ images[ 0 ]?.id }
			/>
		</div>
	);
}

function DescriptionField( { description, onChange, productId } ) {
	const plain = getPlainDescription( description );

	if ( plain === null ) {
		return (
			<Stack direction="column" gap="xs">
				<Text render={ <h3 /> } variant="heading-sm">
					{ __( 'Short description' ) }
				</Text>
				<Text className="routes-styles__muted" variant="body-sm">
					{ stripTags( description ) }
				</Text>
				<Text variant="body-sm">
					{ __(
						'It has formatting, like a list or a link, that can’t be changed here without losing it.'
					) }{ ' ' }
					<Link href={ getProductEditUrl( productId ) } openInNewTab>
						{ __( 'Change it in WP Admin' ) }
					</Link>
				</Text>
			</Stack>
		);
	}

	return (
		<TextareaControl
			description={ __( 'A sentence or two, shown beside the photo.' ) }
			label={ __( 'Short description' ) }
			onValueChange={ ( text ) => onChange( toDescriptionHtml( text ) ) }
			rows={ 3 }
			value={ plain }
		/>
	);
}

/**
 * The long description is rich text, with headings, lists and pictures, so
 * it is written on the page, in the Description tab, with the editor's own
 * tools. This leads there.
 *
 * @param {Object} props           Component props.
 * @param {number} props.productId The product.
 * @return {Element} The field.
 */
function LongDescriptionField( { productId } ) {
	return (
		<Stack direction="column" gap="xs">
			<Text render={ <h3 /> } variant="heading-sm">
				{ __( 'Long description' ) }
			</Text>
			<Text className="routes-styles__muted" variant="body-sm">
				{ __(
					'Everything else about it, with headings, lists and pictures. Written on the page, in the Description tab.'
				) }
			</Text>
			<div>
				<Button
					__next40pxDefaultSize
					onClick={ () => {
						setCanvasMode( MODE_EDIT );
						revealProductBlock( productId, [ 'content' ], {
							isTyping: true,
						} );
					} }
					variant="secondary"
				>
					{ __( 'Write it on the page' ) }
				</Button>
			</div>
		</Stack>
	);
}

function StockField( { product, update } ) {
	if ( product.type === 'external' || product.type === 'grouped' ) {
		return null;
	}

	if ( product.type === 'variable' ) {
		return null;
	}

	if ( product.manage_stock ) {
		return (
			<InputControl
				description={ __(
					'Goes down as people buy it. At 0 it shows as sold out.'
				) }
				inputMode="numeric"
				label={ __( 'How many you have' ) }
				onValueChange={ ( value ) =>
					update( {
						stock_quantity:
							value === '' ? null : Number.parseInt( value, 10 ),
					} )
				}
				type="number"
				value={ product.stock_quantity ?? '' }
			/>
		);
	}

	return (
		<SelectControl
			__next40pxDefaultSize
			__nextHasNoMarginBottom
			label={ __( 'Stock' ) }
			onChange={ ( value ) => update( { stock_status: value } ) }
			options={ [
				{ label: __( 'In stock' ), value: 'instock' },
				{ label: __( 'Sold out' ), value: 'outofstock' },
				{
					label: __( 'Sold out, but taking orders' ),
					value: 'onbackorder',
				},
			] }
			value={ product.stock_status }
		/>
	);
}

function ExternalFields( { product, update } ) {
	if ( product.type !== 'external' ) {
		return null;
	}

	return (
		<>
			<InputControl
				description={ __(
					'It’s sold on another site. Its button takes visitors there.'
				) }
				label={ __( 'Where it’s sold' ) }
				onValueChange={ ( value ) => update( { external_url: value } ) }
				type="url"
				value={ product.external_url }
			/>
			<InputControl
				label={ __( 'Button text' ) }
				onValueChange={ ( value ) => update( { button_text: value } ) }
				value={ product.button_text }
			/>
		</>
	);
}

function getVisibilityDescription( status ) {
	switch ( status ) {
		case 'pending':
			return __( 'Waiting for someone to review it before it shows.' );
		case 'private':
			return __( 'Only people who run the site can see it.' );
		case 'future':
			return __( 'It is scheduled to show later.' );
		default:
			return __( 'When it’s off, visitors can’t see or buy it.' );
	}
}

function ProductFields( { id } ) {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const { hasEdits, product } = useProduct( id );
	const {
		editPost: editProductPost,
		hasEdits: hasPostEdits,
		post,
	} = useProductPost( id );
	// Every change picks, and flashes, the block it shows in on the page.
	const update = ( edits ) => {
		editEntityRecord( PRODUCT_KIND, PRODUCT_NAME, id, edits );
		revealProductBlock( id, Object.keys( edits ) );
	};
	const editPost = ( edits ) => {
		editProductPost( edits );
		revealProductBlock( id, Object.keys( edits ) );
	};
	const fieldProps = { product, update };

	return (
		<div className="routes-styles__section cnl-shop-product">
			<PhotoField { ...fieldProps } />
			<InputControl
				label={ __( 'Name' ) }
				onValueChange={ ( title ) => editPost( { title } ) }
				placeholder={ __( 'What is it called?' ) }
				value={ getPostText( post?.title, product.name ) }
			/>
			<ProductPriceFields { ...fieldProps } />
			<DescriptionField
				description={ getPostText(
					post?.excerpt,
					product.short_description
				) }
				onChange={ ( excerpt ) => editPost( { excerpt } ) }
				productId={ id }
			/>
			<LongDescriptionField productId={ id } />
			<StockField { ...fieldProps } />
			<ExternalFields { ...fieldProps } />
			<SwitchControl
				checked={ product.status === 'publish' }
				description={ getVisibilityDescription( product.status ) }
				label={ __( 'Show in your shop' ) }
				onCheckedChange={ ( isShown ) =>
					update( { status: isShown ? 'publish' : 'draft' } )
				}
			/>
			{ ( hasEdits || hasPostEdits ) && (
				<Text className="routes-styles__muted" variant="body-sm">
					{ __( 'Visitors see your changes once you save.' ) }
				</Text>
			) }
			<Text variant="body-sm">
				<Link href={ getProductEditUrl( id ) } openInNewTab>
					{ __( 'Options, delivery, tax and more' ) }
				</Link>
			</Text>
		</div>
	);
}

/**
 * Products' actions, in the page header as Pages has them: adding a product,
 * and a menu of ways into more detail.
 *
 * @return {Element} The actions.
 */
function ProductsActions() {
	const openProduct = useOpenProduct();
	const { saveEntityRecord } = useDispatch( coreDataStore );
	const { createErrorNotice } = useDispatch( noticesStore );
	const [ isAdding, setIsAdding ] = useState( false );

	// A draft, so nothing shows in the shop until it is switched on.
	const add = async () => {
		setIsAdding( true );

		try {
			const product = await saveEntityRecord(
				PRODUCT_KIND,
				PRODUCT_NAME,
				{ name: __( 'New product' ), status: 'draft', type: 'simple' },
				{ throwOnError: true }
			);
			openProduct( product.id );
		} catch ( addError ) {
			createErrorNotice( addError.message, { type: 'snackbar' } );
		}

		setIsAdding( false );
	};

	return (
		<div className="routes-post-list__page-actions">
			<Button
				__next40pxDefaultSize
				disabled={ isAdding }
				isBusy={ isAdding }
				onClick={ add }
				variant="primary"
			>
				{ __( 'Add product' ) }
			</Button>
			<ProductsOptions />
		</div>
	);
}

function useOpenTable() {
	const navigate = useNavigate();
	const search = useShopSearch();

	return () =>
		navigate( {
			search: { ...search, content: 'all' },
			to: PRODUCTS_PATH,
		} );
}

/**
 * The way on to more detail than the list offers: every product in a table,
 * or WooCommerce's own list in WP Admin.
 *
 * @return {Element} The options menu.
 */
function ProductsOptions() {
	const openTable = useOpenTable();
	const { adminUrls } = getShop();

	return (
		<DropdownMenu
			icon={ moreVerticalIcon }
			className="routes-post-list__more-options"
			label={ __( 'Product Options' ) }
			popoverProps={ { placement: 'bottom-end' } }
			toggleProps={ { __next40pxDefaultSize: true, variant: 'tertiary' } }
		>
			{ ( { onClose } ) => (
				<MenuGroup>
					<MenuItem
						onClick={ () => {
							openTable();
							onClose();
						} }
					>
						{ __( 'Manage products' ) }
					</MenuItem>
					{ adminUrls.products && (
						<MenuItem
							href={ adminUrls.products }
							icon={ externalIcon }
							rel="noopener noreferrer"
							target="_blank"
						>
							{ __( 'Products in WP Admin' ) }
						</MenuItem>
					) }
				</MenuGroup>
			) }
		</DropdownMenu>
	);
}

/**
 * A product's options, in the page header as Products' are: ways to see it
 * outside the editor.
 *
 * @param {Object} props         Component props.
 * @param {Object} props.product The product.
 * @return {Element} The options menu.
 */
function ProductOptions( { product } ) {
	return (
		<DropdownMenu
			className="routes-post-list__more-options"
			icon={ moreVerticalIcon }
			label={ __( 'Product Options' ) }
			popoverProps={ { placement: 'bottom-end' } }
			toggleProps={ { __next40pxDefaultSize: true, variant: 'tertiary' } }
		>
			{ () => (
				<MenuGroup>
					{ product.status === 'publish' && product.permalink && (
						<MenuItem
							href={ product.permalink }
							icon={ externalIcon }
							rel="noopener noreferrer"
							target="_blank"
						>
							{ __( 'View in your shop' ) }
						</MenuItem>
					) }
					<MenuItem
						href={ getProductEditUrl( product.id ) }
						icon={ externalIcon }
						rel="noopener noreferrer"
						target="_blank"
					>
						{ __( 'Edit in WP Admin' ) }
					</MenuItem>
				</MenuGroup>
			) }
		</DropdownMenu>
	);
}

export function ProductsStage() {
	const id = useSelectedId();
	const { content } = useSearch( { strict: false } );
	const { product } = useProduct( id );
	const { post } = useProductPost( id );

	if ( ! getShop().can.editProducts ) {
		return (
			<ShopPage
				crumbs={ [ { label: __( 'Products' ) } ] }
				description={ __(
					'You don’t have permission to change the shop’s products.'
				) }
			/>
		);
	}

	if ( content === 'all' ) {
		return <ProductsTable />;
	}

	if ( id ) {
		return (
			<ShopPage
				actions={
					product?.id && <ProductOptions product={ product } />
				}
				crumbs={ [
					{ label: __( 'Products' ), to: PRODUCTS_PATH },
					{
						label:
							getPostText( post?.title, product?.name ) ||
							__( 'Product' ),
					},
				] }
			>
				{ product?.id ? <ProductFields id={ id } /> : <Spinner /> }
			</ShopPage>
		);
	}

	return (
		<ShopPage
			actions={ <ProductsActions /> }
			crumbs={ [ { label: __( 'Products' ) } ] }
			description={ __( 'What you sell, with photos and prices.' ) }
		>
			<ProductsList
				empty={
					<Text className="routes-styles__muted" variant="body-sm">
						{ __( 'No products yet, or none match.' ) }
					</Text>
				}
			/>
		</ShopPage>
	);
}

/*
 * Edit opens the product in its layout, as a page opens in Pages: its name,
 * photo, price and description are the product's own, and change in place.
 * Changing the layout for every product is on the Shop pages screen. With no
 * product picked, the canvas is the shop page to look at, with nothing to
 * edit: opening the shop's layout in the editor has WooCommerce's product
 * collection rewrite its settings, a change no one made.
 */
export function ProductsCanvas() {
	const id = useSelectedId();
	const { saved } = useProduct( id );
	const productEntity = useMemo(
		() => ( id ? { postId: id, postType: 'product' } : null ),
		[ id ]
	);
	const url = ( id ? saved?.permalink : getShop().pages.shop ) || undefined;

	return (
		<SitePreviewCanvas
			// A product's layout is locked, so there are no sections to pick.
			hasSections={ ! productEntity }
			pinnedEntity={ productEntity }
			url={ url }
		/>
	);
}
