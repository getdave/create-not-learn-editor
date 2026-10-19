/**
 * A product's price, as typed in the Products screen and from the price on
 * its page in Edit, so the two always say the same thing.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * because the editor's product blocks load it from app init.
 */

/**
 * WordPress dependencies
 */
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { InputControl, InputLayout, Stack, Text } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { parsePrice } from '../routes/shop/product-entity';
import { HAS_OPTIONS } from '../routes/shop/product-labels';
import { getShop } from '../routes/shop/shop';

/**
 * A product's price and sale price, as unsaved edits through `update`. A
 * product with options, or a group, is priced elsewhere, so it says so.
 *
 * @param {Object}   props         Component props.
 * @param {Object}   props.product The product, with its unsaved edits.
 * @param {Function} props.update  Called with the edits to make.
 * @return {Element} The fields.
 */
export function ProductPriceFields( { product, update } ) {
	const { currencySymbol } = getShop();
	const prefix = (
		<InputLayout.Slot padding="minimal">
			{ currencySymbol }
		</InputLayout.Slot>
	);

	if ( HAS_OPTIONS.includes( product.type ) ) {
		return (
			<Stack direction="column" gap="xs">
				<Text render={ <h3 /> } variant="heading-sm">
					{ __( 'Price' ) }
				</Text>
				<Text className="routes-styles__muted" variant="body-sm">
					{ product.type === 'variable'
						? __(
								'Each option, like a size or colour, has its own price and stock. Change them in WP Admin.'
							)
						: __(
								'It is a group of other products, each with its own price.'
							) }
				</Text>
			</Stack>
		);
	}

	const regular = Number.parseFloat( product.regular_price );
	const sale = Number.parseFloat( product.sale_price );

	return (
		<>
			<PriceInput
				label={ __( 'Price' ) }
				onChange={ ( price ) => update( { regular_price: price } ) }
				placeholder="0.00"
				prefix={ prefix }
				value={ product.regular_price }
			/>
			<PriceInput
				description={
					sale >= regular || ( sale && ! regular )
						? __(
								'WooCommerce only keeps a sale price that is less than the price. This one won’t be saved.'
							)
						: __( 'Leave empty unless it is on sale.' )
				}
				label={ __( 'Sale price' ) }
				onChange={ ( price ) => update( { sale_price: price } ) }
				placeholder={ __( 'Not on sale' ) }
				prefix={ prefix }
				value={ product.sale_price }
			/>
		</>
	);
}

/**
 * A price field that only passes on prices WooCommerce reads as typed. What
 * isn't one stays in the field, with a note, until it is.
 *
 * @param {Object}   props             Component props.
 * @param {string}   props.description Note under the field.
 * @param {string}   props.label       Field label.
 * @param {Function} props.onChange    Called with the price, as stored.
 * @param {string}   props.placeholder Placeholder.
 * @param {Element}  props.prefix      The currency symbol.
 * @param {string}   props.value       The price, as stored.
 * @return {Element} The field.
 */
function PriceInput( {
	description,
	label,
	onChange,
	placeholder,
	prefix,
	value = '',
} ) {
	const [ text, setText ] = useState( value );
	const isPrice = parsePrice( text ) !== null;

	// Follow changes from elsewhere, like undo, unless they're this field's.
	useEffect( () => {
		if ( parsePrice( text ) !== value ) {
			setText( value );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ value ] );

	return (
		<InputControl
			description={
				isPrice ? description : __( 'Use numbers only, like 12.50.' )
			}
			inputMode="decimal"
			label={ label }
			onValueChange={ ( next ) => {
				setText( next );

				const price = parsePrice( next );

				if ( price !== null ) {
					onChange( price );
				}
			} }
			placeholder={ placeholder }
			prefix={ prefix }
			value={ text }
		/>
	);
}
