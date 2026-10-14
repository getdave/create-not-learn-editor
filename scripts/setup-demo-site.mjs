#!/usr/bin/env node
/* eslint no-console: [ 'error', { allow: [ 'error', 'warn', 'log' ] } ] */
/**
 * Runs after `wp-env start` (see `lifecycleScripts` in `.wp-env.json`) and
 * turns the development site into the Fernhouse demo: the Mainstay theme
 * active, plus pages, posts and a menu built from its patterns.
 *
 * The work happens in `scripts/demo-site/seed.php`, which runs once per site
 * and then leaves it alone. Only the development environment is touched, so
 * the tests site keeps its default theme.
 *
 * Set WP_ENV_LIFECYCLE_SCRIPT_AFTER_START to an empty command (for example
 * `true`) to skip it.
 */
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify( execFile );

const repoRoot = path.resolve(
	fileURLToPath( new URL( '..', import.meta.url ) )
);
const wpEnvBin = path.join( repoRoot, 'node_modules', '.bin', 'wp-env' );

// wp-env mounts this plugin under the name of the folder it lives in.
const pluginPath = `wp-content/plugins/${ path.basename( repoRoot ) }`;

try {
	const { stdout } = await execFileAsync(
		wpEnvBin,
		[
			'run',
			'cli',
			`--env-cwd=${ pluginPath }`,
			'wp',
			'eval-file',
			'scripts/demo-site/seed.php',
		],
		{ cwd: repoRoot }
	);
	console.log( stdout.trim() );
} catch ( error ) {
	// A demo site that failed to set up shouldn't stop wp-env from starting.
	console.warn( 'Could not set up the demo site:' );
	console.warn( error.stderr || error.message );
}
