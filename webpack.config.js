const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const DependencyExtractionWebpackPlugin = require( '@wordpress/dependency-extraction-webpack-plugin' );

const moduleRequests = new Set( [
	'@wordpress/boot',
	'@wordpress/route',
	'@wordpress/lazy-editor',
] );

module.exports = {
	...defaultConfig,
	entry: {
		loader: './src/loader.js',
		'routes/home/route': './src/routes/home/route.js',
		'routes/home/content': './src/routes/home/content.js',
		'routes/content/route': './src/routes/content/route.js',
		'routes/content/content': './src/routes/content/content.js',
		'routes/post-edit/route': './src/routes/post-edit/route.js',
		'routes/post-new/route': './src/routes/post-new/route.js',
		'routes/post-new/content': './src/routes/post-new/content.js',
	},
	output: {
		...defaultConfig.output,
		filename: '[name].js',
		chunkFilename: '[name].js',
		library: {
			type: 'module',
		},
		module: true,
		environment: {
			...( defaultConfig.output?.environment || {} ),
			module: true,
		},
	},
	experiments: {
		...( defaultConfig.experiments || {} ),
		outputModule: true,
	},
	optimization: {
		...defaultConfig.optimization,
		usedExports: false,
	},
	plugins: [
		...defaultConfig.plugins.filter(
			( plugin ) =>
				plugin.constructor.name !== 'DependencyExtractionWebpackPlugin'
		),
		new DependencyExtractionWebpackPlugin( {
			requestToExternalModule( request ) {
				if ( moduleRequests.has( request ) ) {
					return request;
				}
			},
		} ),
	],
};
