/**
 * Internal dependencies
 */
import { createSettingsGuard } from '../settings-guard';

jest.mock( '@wordpress/block-editor', () => ( {
	store: 'core/block-editor',
} ) );

/**
 * A stand-in for the block editor settings, with the editor's own values
 * behind it and a way to push those over the top as `EditorProvider` does.
 *
 * @param {Object} userSettings What the editor would set on its own.
 */
function createIO( userSettings = {} ) {
	let settings = { ...userSettings };
	let listeners = [];

	const io = {
		settled: true,
		getSettings: () => settings,
		updateSettings: jest.fn( ( changes ) => {
			settings = { ...settings, ...changes };
			listeners.forEach( ( listener ) => listener() );
		} ),
		getUserSetting: ( key ) => userSettings[ key ],
		isSettled: () => io.settled,
		subscribe: jest.fn( ( listener ) => {
			listeners.push( listener );
			return () => {
				listeners = listeners.filter( ( l ) => l !== listener );
			};
		} ),
		listenerCount: () => listeners.length,
		// What the editor does on every post load.
		providerPush: () => {
			settings = { ...settings, ...userSettings };
			listeners.forEach( ( listener ) => listener() );
		},
		notify: () => listeners.forEach( ( listener ) => listener() ),
	};

	return io;
}

describe( 'createSettingsGuard', () => {
	it( 'forces settings and re-asserts them over the editor’s own', () => {
		const io = createIO( { templateLock: undefined } );
		const guard = createSettingsGuard( io );

		guard.set( { templateLock: 'contentOnly' } );
		expect( io.getSettings().templateLock ).toBe( 'contentOnly' );

		io.providerPush();
		expect( io.getSettings().templateLock ).toBe( 'contentOnly' );
	} );

	it( 'hands the editor’s values back when released', () => {
		const io = createIO( { templateLock: 'all' } );
		const guard = createSettingsGuard( io );

		guard.set( { templateLock: 'contentOnly' } );
		guard.set( null );

		expect( io.getSettings().templateLock ).toBe( 'all' );
		expect( io.listenerCount() ).toBe( 0 );
	} );

	it( 'reads the value to hand back at release, not when forcing began', () => {
		const userSettings = { templateLock: undefined };
		const io = createIO( userSettings );
		const guard = createSettingsGuard( io );

		guard.set( { templateLock: 'contentOnly' } );
		userSettings.templateLock = 'insert';
		guard.set( null );

		expect( io.getSettings().templateLock ).toBe( 'insert' );
	} );

	it( 'only hands back keys that are no longer forced', () => {
		const io = createIO( { templateLock: 'all', focusMode: false } );
		const guard = createSettingsGuard( io );

		guard.set( { templateLock: 'contentOnly', focusMode: true } );
		guard.set( { focusMode: true } );

		expect( io.getSettings() ).toEqual( {
			templateLock: 'all',
			focusMode: true,
		} );
	} );

	it( 'waits until the editor is settled before writing', () => {
		const io = createIO();
		io.settled = false;
		const guard = createSettingsGuard( io );

		guard.set( { templateLock: 'contentOnly' } );
		expect( io.updateSettings ).not.toHaveBeenCalled();

		io.settled = true;
		io.notify();
		expect( io.getSettings().templateLock ).toBe( 'contentOnly' );
	} );

	it( 'leaves the editor alone if it never got to write', () => {
		const io = createIO( { templateLock: 'all' } );
		io.settled = false;
		const guard = createSettingsGuard( io );

		guard.set( { templateLock: 'contentOnly' } );
		guard.set( null );

		expect( io.updateSettings ).not.toHaveBeenCalled();
	} );

	it( 'does not subscribe when there is nothing to force', () => {
		const io = createIO();
		const guard = createSettingsGuard( io );

		guard.set( {} );
		guard.set( null );

		expect( io.subscribe ).not.toHaveBeenCalled();
		expect( io.updateSettings ).not.toHaveBeenCalled();
	} );

	it( 'skips writes for values that already match', () => {
		const io = createIO( { templateLock: 'contentOnly' } );
		const guard = createSettingsGuard( io );

		guard.set( { templateLock: 'contentOnly' } );
		io.notify();

		expect( io.updateSettings ).not.toHaveBeenCalled();
	} );

	it( 'stops enforcing without restoring once destroyed', () => {
		const io = createIO( { templateLock: undefined } );
		const guard = createSettingsGuard( io );

		guard.set( { templateLock: 'contentOnly' } );
		guard.destroy();
		io.providerPush();

		expect( io.getSettings().templateLock ).toBeUndefined();
		expect( io.listenerCount() ).toBe( 0 );
	} );
} );
