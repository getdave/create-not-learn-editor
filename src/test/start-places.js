/**
 * External dependencies
 */
import { afterEach, describe, expect, test } from 'vitest';

/**
 * Internal dependencies
 */
import { settings } from '../settings';
import { getStartPlaces } from '../start-places';

const ids = ( places ) => places.map( ( { id } ) => id );

describe( 'getStartPlaces', () => {
	afterEach( () => {
		delete settings.shop;
	} );

	test( 'offers the shop only on a site with one', () => {
		expect( ids( getStartPlaces() ) ).not.toContain( 'shop' );

		settings.shop = {};

		expect( ids( getStartPlaces() ) ).toContain( 'shop' );
	} );

	test( 'puts the place a workspace leads with first', () => {
		settings.shop = {};

		const places = ids( getStartPlaces( 'shop' ) );

		expect( places[ 0 ] ).toBe( 'shop' );
		expect( places ).toHaveLength( ids( getStartPlaces() ).length );
	} );

	test( 'keeps its order when the lead place is missing', () => {
		expect( ids( getStartPlaces( 'shop' ) ) ).toEqual(
			ids( getStartPlaces() )
		);
	} );
} );
