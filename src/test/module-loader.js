/**
 * External dependencies
 */
import { afterEach, describe, expect, test, vi } from 'vitest';

/**
 * Internal dependencies
 */
import { createModuleLoader, whenIdle } from '../module-loader';

afterEach( () => {
	vi.useRealTimers();
	delete window.requestIdleCallback;
} );

describe( 'createModuleLoader', () => {
	test( 'imports once, however often it is asked', async () => {
		const module = { name: 'deferred' };
		const importModule = vi.fn( () => Promise.resolve( module ) );
		const loader = createModuleLoader( importModule );

		expect( loader.getLoaded() ).toBe( null );

		const [ first, second ] = await Promise.all( [
			loader.load(),
			loader.load(),
		] );

		expect( first ).toBe( module );
		expect( second ).toBe( module );
		expect( await loader.load() ).toBe( module );
		expect( loader.getLoaded() ).toBe( module );
		expect( importModule ).toHaveBeenCalledTimes( 1 );
	} );

	test( 'tries again after a failed import', async () => {
		const module = { name: 'deferred' };
		const importModule = vi
			.fn()
			.mockRejectedValueOnce( new Error( 'offline' ) )
			.mockResolvedValueOnce( module );
		const loader = createModuleLoader( importModule );

		await expect( loader.load() ).rejects.toThrow( 'offline' );
		expect( loader.getLoaded() ).toBe( null );
		expect( await loader.load() ).toBe( module );
		expect( importModule ).toHaveBeenCalledTimes( 2 );
	} );

	test( 'a preload that fails leaves it to the next ask', async () => {
		const importModule = vi.fn( () =>
			Promise.reject( new Error( 'offline' ) )
		);
		const loader = createModuleLoader( importModule );

		loader.preload();
		await vi.waitFor( () =>
			expect( importModule ).toHaveBeenCalledTimes( 1 )
		);
		await expect( loader.load() ).rejects.toThrow( 'offline' );
		expect( importModule ).toHaveBeenCalledTimes( 2 );
	} );

	test( 'preloads once the browser is idle, and only once', () => {
		const callbacks = [];
		window.requestIdleCallback = vi.fn( ( callback ) =>
			callbacks.push( callback )
		);
		const importModule = vi.fn( () => Promise.resolve( {} ) );
		const loader = createModuleLoader( importModule );

		loader.preloadWhenIdle();
		loader.preloadWhenIdle();

		expect( window.requestIdleCallback ).toHaveBeenCalledTimes( 1 );
		expect( importModule ).not.toHaveBeenCalled();

		callbacks[ 0 ]();

		expect( importModule ).toHaveBeenCalledTimes( 1 );
	} );
} );

describe( 'whenIdle', () => {
	test( 'waits for the browser to be idle, with a timeout', () => {
		window.requestIdleCallback = vi.fn();
		const callback = vi.fn();

		whenIdle( callback );

		expect( window.requestIdleCallback ).toHaveBeenCalledWith( callback, {
			timeout: expect.any( Number ),
		} );
	} );

	test( 'falls back to a timer without requestIdleCallback', () => {
		vi.useFakeTimers();
		const callback = vi.fn();

		whenIdle( callback );
		expect( callback ).not.toHaveBeenCalled();

		vi.runAllTimers();
		expect( callback ).toHaveBeenCalledTimes( 1 );
	} );

	test( 'waits for the page to load first', () => {
		vi.useFakeTimers();
		const readyState = vi
			.spyOn( document, 'readyState', 'get' )
			.mockReturnValue( 'interactive' );
		const callback = vi.fn();

		whenIdle( callback );
		vi.runAllTimers();
		expect( callback ).not.toHaveBeenCalled();

		readyState.mockReturnValue( 'complete' );
		window.dispatchEvent( new window.Event( 'load' ) );
		vi.runAllTimers();
		expect( callback ).toHaveBeenCalledTimes( 1 );
	} );
} );
