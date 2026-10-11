const { execFileSync } = require( 'node:child_process' );
const path = require( 'node:path' );
const { defineConfig } = require( '@playwright/test' );
const { STORAGE_STATE_PATH } = require( './tests/e2e/global-setup' );

function getBaseURL() {
	if ( process.env.WP_BASE_URL ) {
		return process.env.WP_BASE_URL;
	}

	if ( process.env.WP_ENV_TESTS_PORT ) {
		return `http://localhost:${ process.env.WP_ENV_TESTS_PORT }`;
	}

	try {
		const wpEnvBin = path.join(
			__dirname,
			'node_modules',
			'.bin',
			'wp-env'
		);
		const output = execFileSync( wpEnvBin, [ 'status', '--json' ], {
			cwd: __dirname,
			encoding: 'utf8',
		} );
		const status = JSON.parse( output );
		const port = status?.ports?.tests;

		if ( port ) {
			return `http://localhost:${ port }`;
		}
	} catch ( error ) {
		throw new Error(
			`Unable to determine the WordPress tests base URL. Start the wp-env tests environment or set WP_BASE_URL explicitly. ${ error.message }`
		);
	}

	throw new Error(
		'Unable to determine the WordPress tests base URL. Start the wp-env tests environment or set WP_BASE_URL explicitly.'
	);
}

module.exports = defineConfig( {
	testDir: './tests/e2e',
	globalSetup: require.resolve( './tests/e2e/global-setup' ),
	timeout: 60 * 1000,
	// Every test shares one WordPress site. Running them side by side makes
	// the editor open pages empty now and then, so run one at a time.
	workers: 1,
	use: {
		baseURL: getBaseURL(),
		storageState: STORAGE_STATE_PATH,
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure',
	},
} );
