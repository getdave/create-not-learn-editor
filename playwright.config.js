const { execFileSync } = require( 'node:child_process' );
const path = require( 'node:path' );
const { defineConfig } = require( '@playwright/test' );

function getBaseURL() {
	if ( process.env.WP_BASE_URL ) {
		return process.env.WP_BASE_URL;
	}

	if ( process.env.WP_ENV_PORT ) {
		return `http://localhost:${ process.env.WP_ENV_PORT }`;
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
		const port = status?.ports?.development;

		if ( port ) {
			return `http://localhost:${ port }`;
		}
	} catch ( error ) {
		throw new Error(
			`Unable to determine the WordPress base URL. Set WP_BASE_URL explicitly. ${ error.message }`
		);
	}

	throw new Error( 'Unable to determine the WordPress base URL.' );
}

module.exports = defineConfig( {
	testDir: './tests/e2e',
	timeout: 60 * 1000,
	use: {
		baseURL: getBaseURL(),
		trace: 'retain-on-failure',
	},
} );
