/**
 * Internal dependencies
 */
import { getCurrentEditorPath, getStaticScreen } from '../screens';

// The screens only need `__`; the real module pulls in the whole editor.
jest.mock( '../../../wordpress-packages', () => ( {
	__: ( text ) => text,
} ) );

function visit( path ) {
	window.history.pushState(
		{},
		'',
		`/wp-admin/admin.php?page=create-not-learn-editor&p=${ encodeURIComponent(
			path
		) }`
	);
}

describe( 'static screens', () => {
	test( 'reads the editor path from the query string', () => {
		visit( '/design/colors' );
		expect( getCurrentEditorPath() ).toBe( '/design/colors' );
	} );

	test( 'gives colors and fonts a screen of their own', () => {
		visit( '/design/colors' );
		expect( getStaticScreen().title ).toBe( 'Colors' );

		visit( '/design/fonts' );
		expect( getStaticScreen().title ).toBe( 'Fonts' );
	} );

	test( 'puts the whole-site looks on the Design screen', () => {
		visit( '/design' );
		expect( getStaticScreen().title ).toBe( 'Design' );
	} );

	test( 'files every design screen under Design', () => {
		[
			'/design',
			'/design/colors',
			'/design/fonts',
			'/design/identity',
		].forEach( ( path ) => {
			visit( path );
			expect( getStaticScreen().section ).toBe( 'Design' );
		} );
	} );
} );
