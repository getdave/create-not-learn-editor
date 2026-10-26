/**
 * External dependencies
 */
import { describe, expect, it, vi } from 'vitest';

/**
 * Internal dependencies
 */
import {
	closeStartPatterns,
	keepStartPatternsClosed,
} from '../start-patterns';

/**
 * Let pending MutationObserver callbacks run.
 */
const flush = () => new Promise( ( resolve ) => setTimeout( resolve ) );

function createModal( className = 'editor-start-page-options__modal' ) {
	const overlay = document.createElement( 'div' );
	overlay.className = 'components-modal__screen-overlay';
	overlay.innerHTML = `<div class="components-modal__frame ${ className }"><div class="components-modal__header"><button type="button">Close</button></div></div>`;
	const onClose = vi.fn();
	overlay.querySelector( 'button' ).addEventListener( 'click', onClose );

	return { overlay, onClose };
}

describe( 'closeStartPatterns', () => {
	it( 'closes the modal with its close button', () => {
		const root = document.createElement( 'div' );
		const { overlay, onClose } = createModal();
		root.appendChild( overlay );

		expect( closeStartPatterns( root ) ).toBe( true );
		expect( onClose ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'leaves other modals alone', () => {
		const root = document.createElement( 'div' );
		const { overlay, onClose } = createModal( 'editor-preferences-modal' );
		root.appendChild( overlay );

		expect( closeStartPatterns( root ) ).toBe( false );
		expect( onClose ).not.toHaveBeenCalled();
	} );
} );

describe( 'keepStartPatternsClosed', () => {
	it( 'closes the modal when it opens, until stopped', async () => {
		const root = document.createElement( 'div' );
		const stop = keepStartPatternsClosed( root );
		const first = createModal();
		root.appendChild( first.overlay );
		await flush();

		expect( first.onClose ).toHaveBeenCalledTimes( 1 );

		first.overlay.remove();
		stop();
		const second = createModal();
		root.appendChild( second.overlay );
		await flush();

		expect( second.onClose ).not.toHaveBeenCalled();
	} );
} );
