/**
 * Render the WordPress.org plugin directory images in `.wordpress-org/`.
 *
 * The icon is drawn in `.wordpress-org/icon.svg` and the banner in
 * `scripts/wordpress-org-assets/banner.html`. This draws both in Chromium
 * and writes the PNG sizes the plugin directory asks for. Run it after
 * changing either source:
 *
 *     npm run wporg-assets
 */

/**
 * External dependencies
 */
import { chromium } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve( dirname( fileURLToPath( import.meta.url ) ), '..' );
const assetsDir = resolve( root, '.wordpress-org' );

const icon = pathToFileURL( resolve( assetsDir, 'icon.svg' ) ).href;
const banner = pathToFileURL(
	resolve( root, 'scripts/wordpress-org-assets/banner.html' )
).href;

const renders = [
	{
		url: icon,
		file: 'icon-128x128.png',
		width: 128,
		height: 128,
		scale: 0.5,
	},
	{ url: icon, file: 'icon-256x256.png', width: 256, height: 256, scale: 1 },
	{
		url: banner,
		file: 'banner-772x250.png',
		width: 772,
		height: 250,
		scale: 1,
	},
	{
		url: banner,
		file: 'banner-1544x500.png',
		width: 1544,
		height: 500,
		scale: 2,
	},
];

const browser = await chromium.launch();

try {
	for ( const { url, file, width, height, scale } of renders ) {
		const page = await browser.newPage( {
			viewport: { width: width / scale, height: height / scale },
			deviceScaleFactor: scale,
		} );
		await page.goto( url );
		await page.evaluate( () => document.fonts.ready );
		await page.screenshot( { path: resolve( assetsDir, file ) } );
		await page.close();
		// eslint-disable-next-line no-console
		console.log( `Wrote .wordpress-org/${ file }` );
	}
} finally {
	await browser.close();
}
