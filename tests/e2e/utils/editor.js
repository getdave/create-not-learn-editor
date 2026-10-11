const fs = require( 'node:fs/promises' );
const path = require( 'node:path' );
const { expect } = require( '@playwright/test' );

const EDITOR_PATH = '/wp-admin/admin.php?page=create-not-learn-editor';
const PARITY_SCREENSHOTS_DIR = path.join( process.cwd(), '.context' );

/**
 * The admin URL of an editor route.
 *
 * @param {string} [route] Route path, such as `/design/colors`.
 * @return {string} The URL.
 */
function editorUrl( route ) {
	return route
		? `${ EDITOR_PATH }&p=${ encodeURIComponent( route ) }`
		: EDITOR_PATH;
}

/**
 * Open the editor, optionally straight on a route.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string}                          [route] Route path.
 */
async function visitEditor( page, route ) {
	await page.goto( editorUrl( route ) );
}

/**
 * The route the editor is on, decoded, such as `/navigation/edit/12`.
 *
 * @param {import('@playwright/test').Page} page
 * @return {string} The route.
 */
function getRoute( page ) {
	return new URL( page.url() ).searchParams.get( 'p' ) || '';
}

const ADVANCED_LINKS = [ 'Posts', 'Sections', 'Site parts', 'Layouts' ];

/**
 * Follow a link in the sidebar, opening Advanced first for links under it.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string}                          name The link's name.
 */
async function openSidebarLink( page, name ) {
	const advanced = page.getByRole( 'button', { name: 'Advanced' } );
	const back = page.getByRole( 'button', { name: 'Back', exact: true } );

	if ( ADVANCED_LINKS.includes( name ) ) {
		if ( ! ( await back.isVisible() ) ) {
			await advanced.click();
		}
	} else if ( await back.isVisible() ) {
		await back.click();
	}

	await page.getByRole( 'link', { name, exact: true } ).click();
}

/**
 * The white panel beside the canvas.
 *
 * @param {import('@playwright/test').Page} page
 * @return {import('@playwright/test').Locator} The panel.
 */
function getStage( page ) {
	return page.locator( '.cnl-editor-stage' );
}

/**
 * The block editor's content frame.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string}                          [scope] Selector to look within.
 * @return {import('@playwright/test').FrameLocator} The frame.
 */
function getEditorCanvas( page, scope = '' ) {
	return page
		.locator( `${ scope } iframe[name="editor-canvas"]`.trim() )
		.first()
		.contentFrame();
}

/**
 * The site preview frame on Home, Pages and Design.
 *
 * @param {import('@playwright/test').Page} page
 * @return {import('@playwright/test').Locator} The frame.
 */
function getSitePreview( page ) {
	return page.locator( 'iframe[title="Site preview"]' );
}

/**
 * The site canvas's Preview switch. The canvas opens for quick edits, and
 * Preview lays the saved site over the editor.
 *
 * @param {import('@playwright/test').Page} page
 * @return {import('@playwright/test').Locator} The switch.
 */
function getPreviewSwitch( page ) {
	return page
		.locator( '.cnl-site-canvas__preview-toggle' )
		.getByLabel( 'Preview', { exact: true } );
}

/**
 * Turn Preview on, and wait for the site to show.
 *
 * @param {import('@playwright/test').Page} page
 */
async function showSitePreview( page ) {
	const toggle = getPreviewSwitch( page );

	// The switch holds off until the preview has loaded the page on show.
	await toggle.click();
	await expect( toggle ).toBeChecked( { timeout: 15000 } );
	await expect( getSitePreview( page ) ).toBeVisible();
	// The canvas only follows pages it has seen finish loading.
	await expect(
		page.locator( '.cnl-editor-preview-canvas__spinner' )
	).toHaveCount( 0, { timeout: 15000 } );
}

/**
 * The quick-edit editor in the site canvas.
 *
 * @param {import('@playwright/test').Page} page
 * @return {import('@playwright/test').Locator} The editor's frame element.
 */
function getQuickEditor( page ) {
	return page.locator( '.cnl-site-canvas iframe[name="editor-canvas"]' );
}

/**
 * The text of every frame matching a selector.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string}                          selector Frames to read.
 * @return {Promise<string[]>} Their text.
 */
async function getFrameTexts( page, selector ) {
	const texts = [];

	for ( const handle of await page.locator( selector ).elementHandles() ) {
		const frame = await handle.contentFrame();

		if ( frame ) {
			texts.push( await frame.locator( 'body' ).innerText() );
		}
	}

	return texts;
}

/**
 * Check the full block editor opened inside the plugin, not wp-admin's.
 *
 * @param {import('@playwright/test').Page} page
 */
async function expectBlockEditor( page ) {
	await expect(
		page.locator( 'iframe[src*="post-new.php"], iframe[src*="post.php"]' )
	).toHaveCount( 0 );
	await expect(
		page
			.locator(
				[
					'.interface-interface-skeleton',
					'.edit-site-layout',
					'.edit-post-layout',
					'.block-editor-writing-flow',
				].join( ', ' )
			)
			.first()
	).toBeVisible( { timeout: 15000 } );
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string|RegExp}                   message Snackbar text.
 */
async function expectSnackbar( page, message ) {
	await expect(
		page.locator( '.components-snackbar' ).getByText( message )
	).toBeVisible( { timeout: 15000 } );
}

/**
 * The unsaved-changes summary and Review changes button in the top bar.
 *
 * @param {import('@playwright/test').Page} page
 * @return {import('@playwright/test').Locator} The controls.
 */
function getSaveControls( page ) {
	return page.locator( '.cnl-save-controls' );
}

/**
 * Open the Review changes dialog from the top bar.
 *
 * @param {import('@playwright/test').Page} page
 * @return {Promise<import('@playwright/test').Locator>} The dialog.
 */
async function openReviewChanges( page ) {
	await getSaveControls( page )
		.getByRole( 'button', { name: 'Review changes' } )
		.click();

	return page.getByRole( 'dialog', { name: 'Review changes' } );
}

/**
 * Save a screenshot for comparing against the prototype by eye. These are
 * not asserted on.
 *
 * @param {import('@playwright/test').Locator} locator What to capture.
 * @param {string}                             folder  Folder in `.context`.
 * @param {string}                             name    File name.
 */
async function writeParityScreenshot( locator, folder, name ) {
	const dir = path.join( PARITY_SCREENSHOTS_DIR, folder );

	await fs.mkdir( dir, { recursive: true } );
	await locator.screenshot( {
		animations: 'disabled',
		path: path.join( dir, name ),
	} );
}

module.exports = {
	editorUrl,
	expectBlockEditor,
	expectSnackbar,
	getEditorCanvas,
	getPreviewSwitch,
	getQuickEditor,
	getFrameTexts,
	getRoute,
	getSaveControls,
	getSitePreview,
	getStage,
	openReviewChanges,
	openSidebarLink,
	showSitePreview,
	visitEditor,
	writeParityScreenshot,
};
