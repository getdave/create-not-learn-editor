const fs = require( 'fs/promises' );
const path = require( 'path' );
const { execFileSync } = require( 'child_process' );

const repoRoot = process.cwd();

function runScriptModule( body ) {
	const output = execFileSync(
		process.execPath,
		[ '--input-type=module', '--eval', body ],
		{
			cwd: repoRoot,
			encoding: 'utf8',
		}
	);

	return output ? JSON.parse( output ) : undefined;
}

async function makeTempDir( prefix ) {
	return fs.mkdtemp( path.join( repoRoot, prefix ) );
}

describe( 'sync-gutenberg-list-view script', () => {
	afterEach( async () => {
		const entries = await fs.readdir( repoRoot );
		await Promise.all(
			entries
				.filter( ( entry ) =>
					entry.startsWith( '.tmp-list-view-test-' )
				)
				.map( ( entry ) =>
					fs.rm( path.join( repoRoot, entry ), {
						recursive: true,
						force: true,
					} )
				)
		);
	} );

	it( 'rewrites known Gutenberg-internal imports', () => {
		const source =
			"import { store } from '../../store';\n" +
			"import BlockIcon from '../block-icon';\n";

		const result = runScriptModule( `
			import { rewriteImports } from './scripts/sync-gutenberg-list-view.mjs';
			const result = rewriteImports( ${ JSON.stringify( source ) }, [
				[ '../../store', './compat/block-editor-store' ],
				[ '../block-icon', './compat/block-icon' ],
			] );
			process.stdout.write( JSON.stringify( result ) );
		` );

		expect( result ).toBe(
			"import { store } from './compat/block-editor-store';\n" +
				"import BlockIcon from './compat/block-icon';\n"
		);
	} );

	it( 'reports unknown Gutenberg-internal imports', () => {
		const result = runScriptModule( `
			import { findUnknownInternalImports } from './scripts/sync-gutenberg-list-view.mjs';
			const result = findUnknownInternalImports(
				'block.js',
				"import Missing from '../missing-private-file';"
			);
			process.stdout.write( JSON.stringify( result ) );
		` );

		expect( result ).toEqual( [ 'block.js: ../missing-private-file' ] );
	} );

	it( 'generates vendored files with provenance and the local patch', async () => {
		const targetRoot = await makeTempDir( '.tmp-list-view-test-sync-' );

		runScriptModule( `
			import { syncListView } from './scripts/sync-gutenberg-list-view.mjs';
			await syncListView( { targetRoot: ${ JSON.stringify( targetRoot ) } } );
			process.stdout.write( 'null' );
		` );

		const vendorDir = path.join(
			targetRoot,
			'src/vendor/gutenberg/list-view'
		);
		const provenance = JSON.parse(
			await fs.readFile(
				path.join( vendorDir, 'provenance.json' ),
				'utf8'
			)
		);
		const appender = await fs.readFile(
			path.join( vendorDir, 'appender.jsx' ),
			'utf8'
		);

		expect( provenance.source ).toBe( '@wordpress/block-editor' );
		expect( provenance.patch ).toBe( 'patches/gutenberg-list-view.patch' );
		expect( provenance.patchChecksum ).toMatch( /^[a-f0-9]{64}$/ );
		expect( provenance.copiedFiles ).toContain( 'index.jsx' );
		expect( provenance.compatFiles ).toContain( 'compat/lock-unlock.jsx' );
		expect( appender ).toContain( 'renderAppender' );
	} );

	it( 'detects stale committed vendor files by directory comparison', async () => {
		const tempRoot = await makeTempDir( '.tmp-list-view-test-compare-' );
		const expected = path.join( tempRoot, 'expected' );
		const actual = path.join( tempRoot, 'actual' );
		await fs.mkdir( expected, { recursive: true } );
		await fs.mkdir( actual, { recursive: true } );
		await fs.writeFile( path.join( expected, 'file.js' ), 'expected\n' );
		await fs.writeFile( path.join( actual, 'file.js' ), 'actual\n' );

		const result = runScriptModule( `
			import { compareDirectories } from './scripts/sync-gutenberg-list-view.mjs';
			const result = await compareDirectories(
				${ JSON.stringify( expected ) },
				${ JSON.stringify( actual ) }
			);
			process.stdout.write( JSON.stringify( result ) );
		` );

		expect( result ).toEqual( [ 'changed file: file.js' ] );
	} );
} );
