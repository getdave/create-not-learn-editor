/**
 * WordPress dependencies
 */
import { useSearch } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { useSiteTrail } from '../../site-trail';
import { SHOP_PATH } from './shop';
import { Breadcrumbs, Page, Stack, Text, __ } from '../../wordpress-packages';

/**
 * Search params that keep a visit's trail as it moves between the shop's
 * screens, so a visit begun at "Your site" still leads back there.
 *
 * @return {Object} Search params.
 */
export function useShopSearch() {
	const { from } = useSearch( { strict: false } );

	return from ? { from } : {};
}

/**
 * The title of a shop screen. The shop itself has a heading, or breadcrumbs
 * back to "Your site" when opened from there. The screens inside it lead back
 * to the shop.
 *
 * @param {Object}   props             Component props.
 * @param {Object[]} props.crumbs      Breadcrumbs after the shop's own, the
 *                                     last one this screen.
 * @param {string}   props.description Sentence under the title.
 * @return {Element} The heading.
 */
export function ShopHeading( { crumbs = [], description } ) {
	const trail = useSiteTrail();
	const shopCrumb = { label: __( 'Shop' ), to: SHOP_PATH };
	const items = [ ...trail, shopCrumb, ...crumbs ];

	return (
		<Stack direction="column" gap="xs">
			{ items.length > 1 ? (
				<Breadcrumbs
					items={ items.map( ( item, index ) =>
						index === items.length - 1
							? { label: item.label }
							: item
					) }
				/>
			) : (
				<Text render={ <h1 /> } variant="heading-lg">
					{ shopCrumb.label }
				</Text>
			) }
			{ description && (
				<Text className="routes-styles__muted" variant="body-md">
					{ description }
				</Text>
			) }
		</Stack>
	);
}

/**
 * A shop screen in the design system's page, like Pages: breadcrumbs, a
 * sentence and the screen's actions in its header, then the screen.
 *
 * @param {Object}   props             Component props.
 * @param {Element}  props.actions     The screen's actions, like adding.
 * @param {Element}  props.children    The screen.
 * @param {string}   props.className   Extra class for the page.
 * @param {Object[]} props.crumbs      Breadcrumbs after the shop's own, the
 *                                     last one this screen.
 * @param {string}   props.description Sentence under the breadcrumbs.
 * @param {boolean}  props.hasPadding  Whether the screen is padded, as a
 *                                     list is. A table runs edge to edge.
 * @return {Element} The page.
 */
export function ShopPage( {
	actions,
	children,
	className = '',
	crumbs,
	description,
	hasPadding = true,
} ) {
	const trail = useSiteTrail();
	const items = [
		...trail,
		{ label: __( 'Shop' ), to: SHOP_PATH },
		...crumbs,
	];

	return (
		<Page
			actions={ actions }
			breadcrumbs={
				<Breadcrumbs
					items={ items.map( ( item, index ) =>
						index === items.length - 1
							? { label: item.label }
							: item
					) }
				/>
			}
			className={ `cnl-editor-stage cnl-editor-content-page cnl-shop-page ${ className }` }
			hasPadding={ false }
			headingLevel={ 2 }
			subTitle={ description }
		>
			{ hasPadding ? (
				<div className="cnl-shop-page__body">{ children }</div>
			) : (
				children
			) }
		</Page>
	);
}
