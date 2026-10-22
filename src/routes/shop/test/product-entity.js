/**
 * External dependencies
 */
import { describe, expect, test, vi } from 'vitest';

vi.mock( '@wordpress/core-data', () => ( { store: {} } ) );

vi.mock( '@wordpress/data', () => ( {
	dispatch: vi.fn(),
	resolveSelect: vi.fn(),
	select: vi.fn(),
	subscribe: vi.fn(),
	useSelect: vi.fn(),
} ) );

/**
 * Internal dependencies
 */
import { formatPrice, parsePrice } from '../product-entity';

describe( 'parsePrice', () => {
	test( 'passes on plain prices, with a point or a comma', () => {
		expect( parsePrice( '12' ) ).toBe( '12' );
		expect( parsePrice( ' 12.5 ' ) ).toBe( '12.5' );
		expect( parsePrice( '12,50' ) ).toBe( '12.50' );
	} );

	test( 'treats an empty field as no price', () => {
		expect( parsePrice( '' ) ).toBe( '' );
		expect( parsePrice( '  ' ) ).toBe( '' );
	} );

	test( 'turns down what WooCommerce would misread', () => {
		expect( parsePrice( 'abc' ) ).toBeNull();
		expect( parsePrice( '£12' ) ).toBeNull();
		expect( parsePrice( '1,250' ) ).toBeNull();
		expect( parsePrice( '1,250.00' ) ).toBeNull();
		expect( parsePrice( '-3' ) ).toBeNull();
	} );

	test( 'allows as many decimals as the shop uses', () => {
		expect( parsePrice( '1,250', 3 ) ).toBe( '1.250' );
		expect( parsePrice( '12.5', 0 ) ).toBeNull();
	} );
} );

describe( 'formatPrice', () => {
	test( 'shows no price for an empty one', () => {
		expect( formatPrice( '' ) ).toBe( '' );
	} );

	test( 'groups thousands and keeps the decimals', () => {
		expect( formatPrice( '1250.5' ) ).toBe( '$1,250.50' );
	} );
} );
