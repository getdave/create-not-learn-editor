#!/usr/bin/env node
/* eslint no-console: [ 'error', { allow: [ 'error', 'warn', 'log' ] } ] */
/**
 * wp-env can clone a plugin straight from GitHub, but it never builds it.
 * The Automattic/canvas plugin ships no release zip and requires
 * `npm ci && npm run build` before WordPress can activate it, so this
 * script clones/updates it into a local cache and builds it before
 * `wp-env start` runs its (all-or-nothing) plugin activation step.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify( execFile );

const repoRoot = path.resolve(
	fileURLToPath( new URL( '..', import.meta.url ) )
);
const pluginDir = path.join( repoRoot, '.wp-env', 'plugins', 'canvas' );
const builtMarkerPath = path.join( pluginDir, '.last-built-commit' );
const repoUrl = 'https://github.com/Automattic/canvas.git';

async function run( command, args, options = {} ) {
	return execFileAsync( command, args, {
		cwd: pluginDir,
		...options,
	} );
}

async function pathExists( targetPath ) {
	try {
		await fs.access( targetPath );
		return true;
	} catch {
		return false;
	}
}

async function cloneOrUpdate() {
	if ( ! ( await pathExists( path.join( pluginDir, '.git' ) ) ) ) {
		await fs.mkdir( path.dirname( pluginDir ), { recursive: true } );
		console.log( 'Cloning Automattic/canvas...' );
		await execFileAsync( 'git', [
			'clone',
			'--depth',
			'1',
			repoUrl,
			pluginDir,
		] );
		return;
	}

	try {
		console.log( 'Updating Automattic/canvas...' );
		const { stdout: branch } = await run( 'git', [
			'rev-parse',
			'--abbrev-ref',
			'HEAD',
		] );
		await run( 'git', [
			'fetch',
			'--depth',
			'1',
			'origin',
			branch.trim(),
		] );
		await run( 'git', [ 'reset', '--hard', 'FETCH_HEAD' ] );
	} catch ( error ) {
		console.warn(
			`Warning: could not update Automattic/canvas, using cached checkout. (${ error.message })`
		);
	}
}

async function buildIfNeeded() {
	const { stdout: headCommit } = await run( 'git', [ 'rev-parse', 'HEAD' ] );
	const currentCommit = headCommit.trim();

	const builtCommit = ( await pathExists( builtMarkerPath ) )
		? ( await fs.readFile( builtMarkerPath, 'utf8' ) ).trim()
		: null;

	const hasBuild = await pathExists( path.join( pluginDir, 'build' ) );

	if ( hasBuild && builtCommit === currentCommit ) {
		console.log( 'Automattic/canvas build is already up to date.' );
		return;
	}

	console.log( 'Building Automattic/canvas...' );
	await run( 'npm', [ 'ci' ] );
	await run( 'npm', [ 'run', 'build' ] );
	await fs.writeFile( builtMarkerPath, currentCommit );
}

async function main() {
	await cloneOrUpdate();
	await buildIfNeeded();
}

main().catch( ( error ) => {
	console.error( 'Failed to prepare the Automattic/canvas plugin.' );
	console.error( error );
	process.exit( 1 );
} );
