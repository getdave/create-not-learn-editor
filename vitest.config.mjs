/**
 * External dependencies
 */
import { defineConfig } from 'vitest/config';

export default defineConfig( {
	test: {
		// Several helpers read `window` and build DOM nodes.
		environment: 'jsdom',
		globals: false,
		restoreMocks: true,
		include: [ 'src/**/test/*.{js,jsx}', 'tests/unit/**/*.test.{js,jsx}' ],
		exclude: [ '**/node_modules/**', 'build/**', '.context/**' ],
	},
} );
