/**
 * The shop's screens: the shop itself, Products and Shop pages. Registered
 * only when WooCommerce is active (`includes/shop.php`).
 */

/**
 * Internal dependencies
 */
import { withCanvasRecovery } from '../../canvas-recovery';
import { withUiTheme } from '../../theme';
import { getCurrentEditorPath } from '../static/screens';
import { ShopCanvas, ShopStage } from './hub';
import { ShopPagesCanvas, ShopPagesStage } from './pages-screen';
import { ProductsCanvas, ProductsStage } from './products-screen';
import { PRODUCTS_PATH, SHOP_PAGES_PATH } from './shop';

const SCREENS = {
	[ PRODUCTS_PATH ]: { Canvas: ProductsCanvas, Stage: ProductsStage },
	[ SHOP_PAGES_PATH ]: { Canvas: ShopPagesCanvas, Stage: ShopPagesStage },
};

function getScreen() {
	return (
		SCREENS[ getCurrentEditorPath() ] || {
			Canvas: ShopCanvas,
			Stage: ShopStage,
		}
	);
}

function Stage() {
	const { Stage: ScreenStage } = getScreen();

	return <ScreenStage />;
}

function Canvas() {
	const { Canvas: ScreenCanvas } = getScreen();

	return <ScreenCanvas />;
}

export const stage = withUiTheme( Stage );
export const canvas = withCanvasRecovery( withUiTheme( Canvas ) );
