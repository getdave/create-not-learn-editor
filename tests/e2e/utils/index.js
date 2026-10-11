const { test: base, expect } = require( '@playwright/test' );
const { RestClient } = require( './rest' );

/**
 * Playwright's `test`, with a `rest` fixture for setting up and checking
 * site data. The session is already logged in by the global setup.
 */
const test = base.extend( {
	rest: async ( { page }, use ) => {
		const rest = new RestClient( page.request );

		// Playwright's fixture callback, not a React hook.
		// eslint-disable-next-line react-hooks/rules-of-hooks
		await use( rest );
		await rest.cleanup();
	},
} );

module.exports = {
	expect,
	test,
	...require( './editor' ),
};
