const path = require( 'node:path' );
const { request } = require( '@playwright/test' );

const ADMIN_USER = process.env.WP_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.WP_ADMIN_PASSWORD || 'password';

const STORAGE_STATE_PATH = path.join(
	__dirname,
	'..',
	'..',
	'artifacts',
	'storage-states',
	'admin.json'
);

/**
 * Log in once for the whole run, and share the session cookies with every
 * test through `storageState`, so tests start on the page they are about.
 *
 * @param {import('@playwright/test').FullConfig} config
 */
async function globalSetup( config ) {
	const { baseURL } = config.projects[ 0 ].use;
	const context = await request.newContext( { baseURL } );

	// The login form refuses to log in without its test cookie.
	await context.get( '/wp-login.php' );
	const response = await context.post( '/wp-login.php', {
		form: {
			log: ADMIN_USER,
			pwd: ADMIN_PASSWORD,
			redirect_to: '/wp-admin/',
			testcookie: '1',
			'wp-submit': 'Log In',
		},
	} );

	if ( ! response.url().includes( '/wp-admin/' ) ) {
		throw new Error(
			`Logging in as "${ ADMIN_USER }" failed. Check WP_ADMIN_USER and WP_ADMIN_PASSWORD.`
		);
	}

	await context.storageState( { path: STORAGE_STATE_PATH } );
	await context.dispose();
}

module.exports = globalSetup;
module.exports.STORAGE_STATE_PATH = STORAGE_STATE_PATH;
