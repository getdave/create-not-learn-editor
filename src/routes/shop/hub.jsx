/**
 * The shop, reached from "Your site", or from the sidebar in the Selling
 * workspace.
 *
 * What visitors see is worked on here: the products, and how the shop's pages
 * look. What they don't, like orders and payments, is run from WP Admin, so
 * those rows open it in a new tab rather than copying its screens.
 */

/**
 * Internal dependencies
 */
import ScreenLinks from '../../screen-links';
import SitePreviewCanvas from '../static/site-preview';
import { ShopHeading, useShopSearch } from './heading';
import { PRODUCTS_PATH, SHOP_PAGES_PATH, getShop } from './shop';
import {
	Link,
	Stack,
	Text,
	__,
	paymentIcon,
	percentIcon,
	receiptIcon,
	shippingIcon,
	storeIcon,
	tagIcon,
} from '../../wordpress-packages';

function getAdminLinks() {
	const { adminUrls, can } = getShop();

	return [
		can.editOrders && {
			description: __( 'See new orders and mark them as sent.' ),
			href: adminUrls.orders,
			icon: receiptIcon,
			title: __( 'Orders' ),
		},
		can.manageShop && {
			description: __( 'Choose how customers pay you.' ),
			href: adminUrls.payments,
			icon: paymentIcon,
			title: __( 'Payments' ),
		},
		can.manageShop && {
			description: __( 'Where you deliver, and what it costs.' ),
			href: adminUrls.shipping,
			icon: shippingIcon,
			title: __( 'Shipping' ),
		},
		can.manageShop && {
			description: __( 'Whether to add tax to your prices.' ),
			href: adminUrls.tax,
			icon: percentIcon,
			title: __( 'Tax' ),
		},
	].filter( ( link ) => link?.href );
}

export function ShopStage() {
	const search = useShopSearch();
	const { adminUrls, can } = getShop();
	const adminLinks = getAdminLinks();

	return (
		<div className="cnl-editor-stage routes-styles cnl-shop">
			<ShopHeading
				description={ __( 'What you sell, and how your shop looks.' ) }
			/>
			<ScreenLinks
				label={ __( 'Your shop on your site' ) }
				links={ [
					can.editProducts && {
						description: __(
							'Add what you sell, with photos and prices.'
						),
						icon: tagIcon,
						search,
						title: __( 'Products' ),
						to: PRODUCTS_PATH,
					},
					{
						description: __(
							'How your shop, product, cart and checkout pages look.'
						),
						icon: storeIcon,
						search,
						title: __( 'Shop pages' ),
						to: SHOP_PAGES_PATH,
					},
				].filter( Boolean ) }
			/>
			{ !! adminLinks.length && (
				<Stack direction="column" gap="sm">
					<Stack direction="column" gap="xs">
						<Text render={ <h2 /> } variant="heading-sm">
							{ __( 'Run your shop' ) }
						</Text>
						<Text
							className="routes-styles__muted"
							variant="body-sm"
						>
							{ __(
								'Visitors never see these, so they open in WP Admin.'
							) }
						</Text>
					</Stack>
					<ScreenLinks
						label={ __( 'Run your shop in WP Admin' ) }
						links={ adminLinks }
					/>
					{ can.manageShop && adminUrls.settings && (
						<Text variant="body-sm">
							<Link href={ adminUrls.settings } openInNewTab>
								{ __( 'All shop settings' ) }
							</Link>
						</Text>
					) }
				</Stack>
			) }
		</div>
	);
}

export function ShopCanvas() {
	return <SitePreviewCanvas url={ getShop().pages.shop || undefined } />;
}
