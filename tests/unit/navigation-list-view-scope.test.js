const fs = require( 'fs/promises' );
const path = require( 'path' );

const repoRoot = process.cwd();
const srcRoot = path.join( repoRoot, 'src' );
const listViewWrapper = path.join( srcRoot, 'list-view.js' );

async function getJavaScriptFiles( dir ) {
	const entries = await fs.readdir( dir, { withFileTypes: true } );
	const files = await Promise.all(
		entries.map( async ( entry ) => {
			const entryPath = path.join( dir, entry.name );

			if ( entry.isDirectory() ) {
				if (
					entryPath.includes( `${ path.sep }vendor${ path.sep }` )
				) {
					return [];
				}
				return getJavaScriptFiles( entryPath );
			}

			return entry.isFile() && entry.name.endsWith( '.js' )
				? [ entryPath ]
				: [];
		} )
	);

	return files.flat();
}

function resolveImport( importer, source ) {
	if ( ! source.startsWith( '.' ) ) {
		return null;
	}

	const resolved = path.normalize(
		path.resolve( path.dirname( importer ), source )
	);

	return path.extname( resolved ) ? resolved : `${ resolved }.js`;
}

describe( 'custom ListView import scope', () => {
	test( 'only the Navigation edit route imports the custom ListView wrapper', async () => {
		const files = await getJavaScriptFiles( srcRoot );
		const offenders = [];
		const importPattern = /import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g;

		for ( const file of files ) {
			if ( file === listViewWrapper ) {
				continue;
			}

			const source = await fs.readFile( file, 'utf8' );
			let match;

			while ( ( match = importPattern.exec( source ) ) ) {
				const resolved = resolveImport( file, match[ 1 ] );

				if ( resolved === listViewWrapper ) {
					const relativeFile = path.relative( repoRoot, file );

					if (
						! relativeFile.startsWith(
							`src${ path.sep }routes${ path.sep }navigation-edit${ path.sep }`
						)
					) {
						offenders.push( relativeFile );
					}
				}
			}
		}

		expect( offenders ).toEqual( [] );
	} );
} );
