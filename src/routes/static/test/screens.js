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
		visit( '/colors' );
		expect( getCurrentEditorPath() ).toBe( '/colors' );
	} );

	test( 'gives colors and fonts a screen of their own', () => {
		visit( '/colors' );
		expect( getStaticScreen().title ).toBe( 'Colors' );

		visit( '/fonts' );
		expect( getStaticScreen().title ).toBe( 'Fonts' );
	} );

	test( 'leaves the whole-site looks on their own screen', () => {
		visit( '/styles' );
		expect( getStaticScreen().title ).toBe( 'Site look' );
	} );

	test( 'files all three under Design', () => {
		[ '/styles', '/colors', '/fonts' ].forEach( ( path ) => {
			visit( path );
			expect( getStaticScreen().section ).toBe( 'Design' );
		} );
	} );
} );
