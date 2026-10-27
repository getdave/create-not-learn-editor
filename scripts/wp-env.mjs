#!/usr/bin/env node
/* eslint no-console: [ 'error', { allow: [ 'error', 'warn', 'log' ] } ] */
/**
 * Runs wp-env with its downloads served from a cache shared by every checkout.
 *
 * Left to itself, wp-env downloads WordPress, Gutenberg and two copies of the
 * WordPress PHPUnit suite into a fresh directory for every checkout. With many
 * checkouts that is a lot of traffic to wordpress.org and GitHub, so `start`
 * first makes sure each one is in the shared cache. Each version downloads
 * once, and wp-env's PHPUnit clones fetch from a cached clone instead of
 * GitHub.
 *
 * `.wp-env.json` points at `.wp-env/sources/`, where Gutenberg is a symlink
 * into the cache. WordPress is copied, because wp-env writes `wp-config.php`
 * and uploads into it.
 *
 * Set CNL_WP_ENV_CACHE to move the cache.
 */
import fs from 'node:fs/promises';
import { createWriteStream, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { execFile, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify( execFile );
const require = createRequire( import.meta.url );

const repoRoot = path.resolve(
	fileURLToPath( new URL( '..', import.meta.url ) )
);
const sourcesDir = path.join( repoRoot, '.wp-env', 'sources' );
const cacheDir = process.env.CNL_WP_ENV_CACHE
	? path.resolve( process.env.CNL_WP_ENV_CACHE )
	: path.join( os.homedir(), '.cache', 'create-not-learn-editor', 'wp-env' );

/*
 * Zipped sources. `link` is where each one appears under `.wp-env/sources/`,
 * which `.wp-env.json` refers to. Its last segment is the directory name
 * WordPress sees, so Gutenberg's must stay `gutenberg`. Change `key` along
 * with the version so the new one downloads.
 */
const WORDPRESS = {
	name: 'WordPress 7.1',
	key: 'wordpress-7.1',
	url: 'https://wordpress.org/wordpress-7.1.zip',
	link: 'wordpress',
};
/*
 * The build of the pull request at the top of Gutenberg's grid stack
 * (https://github.com/WordPress/gutenberg/stack/85397), from its CI, through
 * the proxy WordPress Playground installs pull requests with. The proxy serves
 * the PR's latest build, so `key` names the commit it was taken at.
 * `scripts/update-grid-stack.sh` moves this, and `demos/blueprint.json`, to
 * whichever PR is on top.
 */
const GUTENBERG = {
	name: 'Gutenberg #85210 (grid stack)',
	key: 'gutenberg-pr-85210-8e80005',
	url: 'https://playground.wordpress.net/plugin-proxy.php?org=WordPress&repo=gutenberg&workflow=Build%20Gutenberg%20Plugin%20Zip&artifact=gutenberg.zip&pr=85210',
	link: 'plugins/gutenberg',
};
const WORDPRESS_DEVELOP = 'https://github.com/WordPress/wordpress-develop.git';

async function exists( target ) {
	try {
		await fs.lstat( target );
		return true;
	} catch {
		return false;
	}
}

async function git( args, cwd ) {
	const { stdout } = await execFileAsync( 'git', args, {
		cwd,
		maxBuffer: 64 * 1024 * 1024,
	} );
	return stdout.trim();
}

/**
 * Runs `callback` while holding a lock, so checkouts starting at the same
 * time do not download or build the same thing twice.
 *
 * @param {string}                 name     Lock name.
 * @param {() => Promise<unknown>} callback Work to do while holding the lock.
 */
async function withLock( name, callback ) {
	const lockPath = path.join( cacheDir, `.lock-${ name }` );
	const staleAfterMs = 30 * 60 * 1000;
	let warned = false;

	for (;;) {
		try {
			await fs.mkdir( lockPath );
			break;
		} catch ( error ) {
			if ( error.code !== 'EEXIST' ) {
				throw error;
			}
			const { mtimeMs } = await fs.stat( lockPath ).catch( () => ( {
				mtimeMs: Date.now(),
			} ) );
			if ( Date.now() - mtimeMs > staleAfterMs ) {
				await fs.rm( lockPath, { recursive: true, force: true } );
				continue;
			}
			if ( ! warned ) {
				console.log(
					`Waiting for another checkout to prepare ${ name }...`
				);
				warned = true;
			}
			await new Promise( ( resolve ) => setTimeout( resolve, 2000 ) );
		}
	}

	try {
		return await callback();
	} finally {
		await fs.rm( lockPath, { recursive: true, force: true } );
	}
}

async function download( url, destination ) {
	const attempts = 3;
	for ( let attempt = 1; ; attempt++ ) {
		try {
			const response = await fetch( url, {
				signal: AbortSignal.timeout( 10 * 60 * 1000 ),
			} );
			if ( ! response.ok ) {
				throw new Error(
					`${ response.status } ${ response.statusText }`
				);
			}
			await pipeline(
				Readable.fromWeb( response.body ),
				createWriteStream( destination )
			);
			return;
		} catch ( error ) {
			if ( attempt === attempts ) {
				throw new Error(
					`Could not download ${ url }: ${ error.message }`
				);
			}
			console.warn(
				`Download failed (${ error.message }), retrying in ${
					attempt * 10
				}s...`
			);
			await new Promise( ( resolve ) =>
				setTimeout( resolve, attempt * 10000 )
			);
		}
	}
}

/**
 * Downloads and unzips a source into the cache, moving it into place only once
 * it is complete. Zips holding a single directory are unwrapped, as wp-env
 * does.
 *
 * @param {Object} source A zipped source.
 */
async function fetchZip( source ) {
	const target = path.join( cacheDir, source.key );
	const temp = `${ target }.tmp-${ process.pid }`;
	const zipPath = `${ temp }.zip`;

	console.log( `Downloading ${ source.name }...` );
	try {
		await download( source.url, zipPath );
		await fs.mkdir( temp );
		await execFileAsync( 'unzip', [ '-q', zipPath, '-d', temp ] );

		const entries = await fs.readdir( temp );
		let root = temp;
		if (
			entries.length === 1 &&
			( await fs.stat( path.join( temp, entries[ 0 ] ) ) ).isDirectory()
		) {
			root = path.join( temp, entries[ 0 ] );
		}
		await fs.rename( root, target );
	} finally {
		await fs.rm( temp, { recursive: true, force: true } );
		await fs.rm( zipPath, { force: true } );
	}
}

async function ensureZip( source ) {
	const target = path.join( cacheDir, source.key );

	return withLock( source.key, async () => {
		if ( ! ( await exists( target ) ) ) {
			await fetchZip( source );
		}
		return target;
	} );
}

async function linkSource( link, target ) {
	const linkPath = path.join( sourcesDir, link );
	await fs.mkdir( path.dirname( linkPath ), { recursive: true } );

	try {
		const stat = await fs.lstat( linkPath );
		if ( ! stat.isSymbolicLink() ) {
			throw new Error(
				`${ linkPath } should be a symlink into ${ cacheDir }. Remove it and try again.`
			);
		}
		if ( ( await fs.readlink( linkPath ) ) === target ) {
			return;
		}
		await fs.unlink( linkPath );
	} catch ( error ) {
		if ( error.code !== 'ENOENT' ) {
			throw error;
		}
	}
	await fs.symlink( target, linkPath, 'dir' );
}

/**
 * Copies WordPress into the checkout, which wp-env then installs into. When
 * the version changes, core files are copied over the top, leaving
 * `wp-config.php` and anything WordPress has added in place.
 *
 * @param {string} cached Path to the cached WordPress.
 */
async function copyWordPress( cached ) {
	const target = path.join( sourcesDir, WORDPRESS.link );
	const marker = path.join( target, '.cnl-source' );
	const current = await fs.readFile( marker, 'utf8' ).catch( () => '' );

	if ( current.trim() === WORDPRESS.key ) {
		return target;
	}

	console.log( `Copying ${ WORDPRESS.name } into this checkout...` );
	await fs.mkdir( target, { recursive: true } );
	await fs.cp( cached, target, { recursive: true, force: true } );
	await fs.writeFile( marker, WORDPRESS.key );
	return target;
}

async function readWordPressVersion( wordpressDir ) {
	const versionFile = await fs.readFile(
		path.join( wordpressDir, 'wp-includes', 'version.php' ),
		'utf8'
	);
	const version = versionFile.match( /\$wp_version = '([^']+)'/ )[ 1 ];
	// wp-env asks for the X.Y.Z tag, as wordpress-develop names them.
	return /^\d+\.\d+$/.test( version ) ? `${ version }.0` : version;
}

/**
 * Keeps a clone of wordpress-develop holding each tag wp-env has needed. It
 * is shallow but has every file, so the PHPUnit clones below can check
 * anything out from it without going to GitHub.
 *
 * @param {string} tag WordPress version tag, such as 7.1.0.
 */
async function ensurePHPUnitCache( tag ) {
	const repoDir = path.join( cacheDir, 'wordpress-develop' );

	return withLock( 'wordpress-develop', async () => {
		if ( ! ( await exists( path.join( repoDir, '.git' ) ) ) ) {
			await fs.rm( repoDir, { recursive: true, force: true } );
			await git( [ 'init', '--quiet', repoDir ] );
			await git(
				[ 'remote', 'add', 'origin', WORDPRESS_DEVELOP ],
				repoDir
			);
			// Let partial clones made by wp-env fetch missing files from here.
			await git(
				[ 'config', 'uploadpack.allowFilter', 'true' ],
				repoDir
			);
			await git(
				[ 'config', 'uploadpack.allowAnySHA1InWant', 'true' ],
				repoDir
			);
		}

		const hasTag = await git( [ 'tag', '--list', tag ], repoDir ).then(
			Boolean
		);
		if ( ! hasTag ) {
			console.log(
				`Downloading the WordPress ${ tag } PHPUnit suite...`
			);
			await git(
				[ 'fetch', '--depth', '1', 'origin', 'tag', tag, '--no-tags' ],
				repoDir
			);
		}
		return repoDir;
	} );
}

/**
 * Points wp-env's PHPUnit clones at the cached clone, creating them if they
 * are missing. wp-env still runs `git fetch` in them on start, but the fetch
 * is now local.
 *
 * @param {string} tag WordPress version tag, such as 7.1.0.
 */
async function preparePHPUnit( tag ) {
	const { loadConfig } = require( '@wordpress/env/lib/config' );
	const config = await loadConfig( repoRoot );
	const cachedRepo = await ensurePHPUnitCache( tag );

	const directories = [ 'WordPress-PHPUnit' ];
	if ( config.testsEnvironment !== false ) {
		directories.push( 'tests-WordPress-PHPUnit' );
	}

	await fs.mkdir( config.workDirectoryPath, { recursive: true } );
	for ( const directory of directories ) {
		const clone = path.join( config.workDirectoryPath, directory );
		if ( ! existsSync( path.join( clone, '.git' ) ) ) {
			await fs.rm( clone, { recursive: true, force: true } );
			await git( [
				'clone',
				'--quiet',
				'--no-checkout',
				cachedRepo,
				clone,
			] );
			await git(
				[ 'sparse-checkout', 'set', '--cone', 'tests/phpunit' ],
				clone
			);
		} else {
			// Clones wp-env made itself are partial, so anything missing is now
			// fetched from the cached clone too.
			await git( [ 'remote', 'set-url', 'origin', cachedRepo ], clone );
		}
	}
}

async function prepareSources() {
	await fs.mkdir( cacheDir, { recursive: true } );

	const wordpress = await copyWordPress( await ensureZip( WORDPRESS ) );
	await linkSource( GUTENBERG.link, await ensureZip( GUTENBERG ) );
	await preparePHPUnit( await readWordPressVersion( wordpress ) );
}

function runWpEnv( args ) {
	const bin = path.join(
		path.dirname( require.resolve( '@wordpress/env/package.json' ) ),
		'bin',
		'wp-env'
	);
	const child = spawn( process.execPath, [ bin, ...args ], {
		stdio: 'inherit',
	} );
	child.on( 'exit', ( code, signal ) => {
		if ( signal ) {
			process.kill( process.pid, signal );
		}
		process.exit( code ?? 1 );
	} );
}

async function main() {
	const args = process.argv.slice( 2 );
	if ( args[ 0 ] === 'start' ) {
		await prepareSources();
	}
	runWpEnv( args );
}

main().catch( ( error ) => {
	console.error( 'Failed to prepare the wp-env sources.' );
	console.error( error.message );
	process.exit( 1 );
} );
