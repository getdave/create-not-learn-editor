/**
 * What the shop screens share: the shop's settings, and the screens' paths.
 *
 * Imported package by package, as the editor's product blocks load it from
 * app init.
 */

/**
 * WordPress dependencies
 */
import { store as coreDataStore } from '@wordpress/core-data';
import { useSelect } from '@wordpress/data';
import { useMemo } from '@wordpress/element';

/**
 * Internal dependencies
 */
import { settings } from '../../settings';

const EMPTY_SHOP = {
	adminUrls: {},
	can: {},
	currencySymbol: '$',
	pages: {},
	price: {},
};

export const SHOP_PATH = '/shop';
export const PRODUCTS_PATH = '/shop/products';
export const SHOP_PAGES_PATH = '/shop/pages';

/**
 * The shop's settings from `cnl_editor_get_shop_settings()`.
 *
 * @return {Object} `{ adminUrls, can, currencySymbol, pages, price }`.
 */
export function getShop() {
	return settings.shop || EMPTY_SHOP;
}

/**
 * The theme's layout for a kind of shop page, for Edit to change in place of
 * the one page on show.
 *
 * @param {?string} slug Layout slug, like `single-product`.
 * @return {?Object} `{ postType, postId }` for the layout, if the theme has it.
 */
export function useTemplateEntity( slug ) {
	const templateId = useSelect(
		( select ) =>
			slug
				? select( coreDataStore )
						.getEntityRecords( 'postType', 'wp_template', {
							per_page: -1,
						} )
						?.find( ( template ) => template.slug === slug )?.id
				: undefined,
		[ slug ]
	);

	return useMemo(
		() =>
			templateId ? { postId: templateId, postType: 'wp_template' } : null,
		[ templateId ]
	);
}
