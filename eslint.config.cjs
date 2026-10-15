/**
 * ESLint flat config.
 *
 * Extends the @wordpress/scripts default, which only picks up `.js` files,
 * so components written in `.jsx` are linted too.
 */
const defaultConfig = require( '@wordpress/scripts/config/eslint.config.cjs' );

module.exports = [
	{ files: [ '**/*.jsx' ] },
	...defaultConfig,
	{
		rules: {
			// Safari drops list semantics from lists styled without bullets,
			// so `role="list"` on a `ul` is kept on purpose.
			'jsx-a11y/no-redundant-roles': [ 'error', { ul: [ 'list' ] } ],
		},
	},
];
