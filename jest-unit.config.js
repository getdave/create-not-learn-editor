const defaultConfig = require( '@wordpress/scripts/config/jest-unit.config' );

module.exports = {
	...defaultConfig,
	modulePathIgnorePatterns: [
		...( defaultConfig.modulePathIgnorePatterns || [] ),
		'<rootDir>/.context/',
		'<rootDir>/build/',
		'<rootDir>/packages/.*/build/',
		'<rootDir>/packages/.*/build-module/',
		'<rootDir>/packages/.*/build-style/',
	],
	testPathIgnorePatterns: [
		...( defaultConfig.testPathIgnorePatterns || [] ),
		'<rootDir>/.context/',
		'<rootDir>/build/',
		'<rootDir>/packages/.*/build/',
		'<rootDir>/packages/.*/build-module/',
		'<rootDir>/packages/.*/build-style/',
	],
};
