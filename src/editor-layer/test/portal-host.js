/**
 * Internal dependencies
 */
import { observeHost } from '../portal-host';

const REGION = '.region';
const HOST = 'layer-host';

/**
 * Let pending MutationObserver callbacks run.
 */
const flush = () => new Promise( ( resolve ) => setTimeout( resolve ) );

function createRegion() {
	const region = document.createElement( 'div' );
	region.className = 'region';

	return region;
}

describe( 'observeHost', () => {
	it( 'appends a host to a region that is already there', () => {
		const root = document.createElement( 'div' );
		const region = createRegion();
		root.appendChild( region );
		const onHost = jest.fn();

		const stop = observeHost( REGION, HOST, onHost, root );

		expect( onHost ).toHaveBeenCalledTimes( 1 );
		const [ host ] = onHost.mock.calls[ 0 ];
		expect( host.parentNode ).toBe( region );
		expect( host.className ).toBe( HOST );
		stop();
	} );

	it( 'waits for a region that mounts later', async () => {
		const root = document.createElement( 'div' );
		const onHost = jest.fn();
		const stop = observeHost( REGION, HOST, onHost, root );

		expect( onHost ).not.toHaveBeenCalled();

		const region = createRegion();
		root.appendChild( region );
		await flush();

		expect( onHost ).toHaveBeenCalledTimes( 1 );
		expect( onHost.mock.calls[ 0 ][ 0 ].parentNode ).toBe( region );
		stop();
	} );

	it( 'reports null when the region goes and re-attaches when it returns', async () => {
		const root = document.createElement( 'div' );
		const region = createRegion();
		root.appendChild( region );
		const onHost = jest.fn();
		const stop = observeHost( REGION, HOST, onHost, root );

		region.remove();
		await flush();
		expect( onHost ).toHaveBeenLastCalledWith( null );

		const replacement = createRegion();
		root.appendChild( replacement );
		await flush();

		expect( onHost ).toHaveBeenCalledTimes( 3 );
		expect( onHost.mock.calls[ 2 ][ 0 ].parentNode ).toBe( replacement );
		stop();
	} );

	it( 'does not append again in response to its own mutation', async () => {
		const root = document.createElement( 'div' );
		const region = createRegion();
		root.appendChild( region );
		const onHost = jest.fn();
		const stop = observeHost( REGION, HOST, onHost, root );

		await flush();

		expect( onHost ).toHaveBeenCalledTimes( 1 );
		expect( region.querySelectorAll( `.${ HOST }` ) ).toHaveLength( 1 );
		stop();
	} );

	it( 'removes its host when stopped', () => {
		const root = document.createElement( 'div' );
		const region = createRegion();
		root.appendChild( region );

		observeHost( REGION, HOST, () => {}, root )();

		expect( region.children ).toHaveLength( 0 );
	} );
} );
