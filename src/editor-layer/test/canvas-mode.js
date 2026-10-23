/**
 * External dependencies
 */
import { describe, expect, it, vi } from 'vitest';

/**
 * Internal dependencies
 */
import { isEditCanvas, subscribeToEditCanvas } from '../canvas-mode';

const LAYOUT = 'c8317e9ebb034cfa__layout';
const FULL_CANVAS = 'e97bb2807a9c4687__has-full-canvas';

/**
 * Let pending MutationObserver callbacks run.
 */
const flush = () => new Promise( ( resolve ) => setTimeout( resolve ) );

function createRoot( className = LAYOUT ) {
	const root = document.createElement( 'div' );
	const layout = document.createElement( 'div' );
	layout.className = className;
	root.appendChild( layout );

	return { root, layout };
}

describe( 'isEditCanvas', () => {
	it( 'matches boot’s hashed full-canvas class', () => {
		expect(
			isEditCanvas( createRoot( `${ LAYOUT } ${ FULL_CANVAS }` ).root )
		).toBe( true );
	} );

	it( 'is false for a stage or preview layout', () => {
		expect( isEditCanvas( createRoot().root ) ).toBe( false );
		expect(
			isEditCanvas( createRoot( `${ LAYOUT } abc__has-canvas` ).root )
		).toBe( false );
	} );
} );

describe( 'subscribeToEditCanvas', () => {
	it( 'reports entering and leaving the edit canvas', async () => {
		const { root, layout } = createRoot();
		const onChange = vi.fn();
		const unsubscribe = subscribeToEditCanvas( onChange, root );

		layout.classList.add( FULL_CANVAS );
		await flush();
		layout.classList.remove( FULL_CANVAS );
		await flush();

		expect( onChange.mock.calls ).toEqual( [ [ true ], [ false ] ] );
		unsubscribe();
	} );

	it( 'ignores class changes that do not touch the marker', async () => {
		const { root, layout } = createRoot();
		const onChange = vi.fn();
		const unsubscribe = subscribeToEditCanvas( onChange, root );

		layout.classList.add( 'is-selected' );
		await flush();

		expect( onChange ).not.toHaveBeenCalled();
		unsubscribe();
	} );

	it( 'follows a layout that boot replaces', async () => {
		const { root, layout } = createRoot();
		const onChange = vi.fn();
		const unsubscribe = subscribeToEditCanvas( onChange, root );

		const replacement = document.createElement( 'div' );
		replacement.className = `${ LAYOUT } ${ FULL_CANVAS }`;
		layout.replaceWith( replacement );
		await flush();

		expect( onChange ).toHaveBeenCalledWith( true );
		unsubscribe();
	} );

	it( 'finds the marker in a subtree that is added', async () => {
		const { root } = createRoot();
		const onChange = vi.fn();
		const unsubscribe = subscribeToEditCanvas( onChange, root );

		const wrapper = document.createElement( 'div' );
		const layout = document.createElement( 'div' );
		layout.className = `${ LAYOUT } ${ FULL_CANVAS }`;
		wrapper.appendChild( layout );
		root.appendChild( wrapper );
		await flush();

		expect( onChange.mock.calls ).toEqual( [ [ true ] ] );
		unsubscribe();
	} );

	it( 'reports leaving when the marked layout is removed', async () => {
		const { root, layout } = createRoot( `${ LAYOUT } ${ FULL_CANVAS }` );
		const onChange = vi.fn();
		const unsubscribe = subscribeToEditCanvas( onChange, root );

		layout.remove();
		await flush();

		expect( onChange.mock.calls ).toEqual( [ [ false ] ] );
		unsubscribe();
	} );

	it( 'ignores tree changes that add no marker', async () => {
		const { root } = createRoot();
		const onChange = vi.fn();
		const unsubscribe = subscribeToEditCanvas( onChange, root );

		root.appendChild( document.createElement( 'div' ) );
		root.appendChild( document.createTextNode( 'text' ) );
		await flush();

		expect( onChange ).not.toHaveBeenCalled();
		unsubscribe();
	} );

	it( 'stops reporting once unsubscribed', async () => {
		const { root, layout } = createRoot();
		const onChange = vi.fn();

		subscribeToEditCanvas( onChange, root )();
		layout.classList.add( FULL_CANVAS );
		await flush();

		expect( onChange ).not.toHaveBeenCalled();
	} );
} );
