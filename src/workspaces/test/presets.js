/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import { DEFAULT_WORKSPACE, WORKSPACES, getWorkspace } from '../presets';
import { getStartPlaces } from '../../start-places';

describe( 'getWorkspace', () => {
	it( 'finds a workspace by its id', () => {
		expect( getWorkspace( 'writing' ).id ).toBe( 'writing' );
	} );

	it( 'finds a renamed workspace by the id it was saved under', () => {
		expect( getWorkspace( 'blogging' ).id ).toBe( 'writing' );
	} );

	it( 'falls back to the default for an unknown id', () => {
		expect( getWorkspace( 'nope' ) ).toBe( DEFAULT_WORKSPACE );
		expect( getWorkspace( undefined ) ).toBe( DEFAULT_WORKSPACE );
	} );
} );

describe( 'WORKSPACES', () => {
	it( 'gives every workspace every setting', () => {
		WORKSPACES.forEach( ( workspace ) => {
			expect( workspace.home.places.length ).toBeGreaterThan( 0 );
			expect( workspace.home.hint ).toBeTruthy();
			expect( workspace.posts.description ).toBeTruthy();
			expect( typeof workspace.writingAids ).toBe( 'boolean' );
		} );
	} );

	it( 'keeps settings a workspace leaves out at the default’s', () => {
		const builder = getWorkspace( 'builder' );

		expect( builder.home ).toEqual( DEFAULT_WORKSPACE.home );
		expect( builder.posts ).toEqual( DEFAULT_WORKSPACE.posts );
	} );

	it( 'offers only places that exist on "Home"', () => {
		WORKSPACES.forEach( ( workspace ) => {
			expect( getStartPlaces( workspace.home ) ).toHaveLength(
				workspace.home.places.length
			);
		} );
	} );
} );

describe( 'getStartPlaces', () => {
	it( 'keeps the order it is given', () => {
		expect(
			getStartPlaces( { places: [ 'style', 'write' ] } ).map(
				( place ) => place.id
			)
		).toEqual( [ 'style', 'write' ] );
	} );

	it( 'rewords a place', () => {
		const [ place ] = getStartPlaces( {
			places: [ 'identity' ],
			copy: { identity: { description: 'Name your blog.' } },
		} );

		expect( place.description ).toBe( 'Name your blog.' );
		expect( place.title ).toBeTruthy();
	} );

	it( 'leaves out places it doesn’t know', () => {
		expect(
			getStartPlaces( { places: [ 'nope', 'write' ] } )
		).toHaveLength( 1 );
	} );
} );
