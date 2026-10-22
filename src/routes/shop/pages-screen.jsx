/**
 * Shop pages: the pages WooCommerce adds, shown in the site canvas one at a
 * time, so each is changed in place like any other page, in Edit.
 *
 * The shop and product pages are drawn from layouts, so Edit changes the
 * layout, for every product, rather than the one product on show. The cart
 * and checkout are pages with their blocks in them, so Edit changes the page.
 */

/**
 * WordPress dependencies
 */
import { useNavigate, useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import SitePreviewCanvas from '../static/site-preview';
import { ShopHeading, useShopSearch } from './heading';
import { SHOP_PAGES_PATH, getShop, useTemplateEntity } from './shop';
import {
	Button,
	Icon,
	__,
	pageIcon,
	paymentIcon,
	storeIcon,
	tagIcon,
} from '../../wordpress-packages';

function getShopPages() {
	const { pages } = getShop();

	return [
		{
			description: __( 'Where visitors browse everything you sell.' ),
			icon: storeIcon,
			id: 'shop',
			templateSlug: 'archive-product',
			title: __( 'Shop' ),
			url: pages.shop,
		},
		{
			description: pages.product
				? __( 'How every product’s page is laid out.' )
				: __( 'Add a product to see its page.' ),
			icon: tagIcon,
			id: 'product',
			templateSlug: 'single-product',
			title: __( 'Product' ),
			url: pages.product,
		},
		{
			description: __( 'What visitors have picked, before they pay.' ),
			icon: pageIcon,
			id: 'cart',
			title: __( 'Cart' ),
			url: pages.cart,
		},
		{
			description: __( 'Where visitors pay.' ),
			icon: paymentIcon,
			id: 'checkout',
			title: __( 'Checkout' ),
			url: pages.checkout,
		},
	];
}

function useSelectedShopPage() {
	const { page } = useSearch( { strict: false } );
	const pages = getShopPages();

	return {
		pages,
		selected:
			pages.find( ( { id, url } ) => id === page && url ) || pages[ 0 ],
	};
}

export function ShopPagesStage() {
	const navigate = useNavigate();
	const search = useShopSearch();
	const { pages, selected } = useSelectedShopPage();

	return (
		<div className="cnl-editor-stage routes-styles cnl-shop">
			<ShopHeading
				crumbs={ [ { label: __( 'Shop pages' ) } ] }
				description={ __(
					'Pick a page to see it. Switch to Edit to change how it looks.'
				) }
			/>
			<ul className="cnl-shop-products">
				{ pages.map( ( page ) => (
					<li key={ page.id }>
						<Button
							aria-pressed={ page.id === selected.id }
							className="cnl-shop-products__item"
							disabled={ ! page.url }
							onClick={ () =>
								navigate( {
									search: { ...search, page: page.id },
									to: SHOP_PAGES_PATH,
								} )
							}
						>
							<Icon
								className="cnl-shop-products__icon"
								icon={ page.icon }
							/>
							<span className="cnl-shop-products__text">
								<span className="cnl-shop-products__name">
									{ page.title }
								</span>
								<span className="cnl-shop-products__meta">
									{ page.description }
								</span>
							</span>
						</Button>
					</li>
				) ) }
			</ul>
		</div>
	);
}

export function ShopPagesCanvas() {
	const { selected } = useSelectedShopPage();
	const pinnedEntity = useTemplateEntity( selected.templateSlug );

	return (
		<SitePreviewCanvas
			pinnedEntity={ pinnedEntity }
			url={ selected.url || undefined }
		/>
	);
}
