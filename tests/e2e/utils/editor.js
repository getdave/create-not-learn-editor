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

const CANVAS_MODES = [ 'Browse', 'Edit', 'Compose' ];

/**
 * The site canvas's mode menu toggle, named for the mode it is in, such as
 * "Mode: Browse".
 *
 * @param {import('@playwright/test').Page} page
 * @return {import('@playwright/test').Locator} The toggle.
 */
function getModeToggle( page ) {
	return page.locator( '.cnl-site-canvas__mode-toggle' );
}

/**
 * Open the mode menu and pick a mode, without waiting for the canvas to
 * follow. Use `setCanvasMode` unless something, such as the unsaved changes
 * dialog, is expected to hold the switch back.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'Browse'|'Edit'|'Compose'}       mode The mode to pick.
 */
async function pickCanvasMode( page, mode ) {
	if ( ! CANVAS_MODES.includes( mode ) ) {
		throw new Error( `Unknown canvas mode: ${ mode }` );
	}

	const item = page.getByRole( 'menuitemradio', {
		name: new RegExp( `^${ mode }` ),
	} );

	/*
	 * The menu closes if focus moves away while it is open, as it does when a
	 * screen that has just opened focuses its heading, so it is opened again
	 * until the pick lands. Edit and Compose also wait for there to be
	 * something to edit.
	 */
	await expect( async () => {
		if ( ! ( await item.isVisible() ) ) {
			await getModeToggle( page ).click();
		}

		await expect( item ).toBeEnabled( { timeout: 2000 } );
		await item.click( { timeout: 2000 } );
	} ).toPass( { timeout: 20000 } );
}

/**
 * The block editor inside the site canvas.
 *
 * @param {import('@playwright/test').Page} page
 * @return {import('@playwright/test').Locator} The editor's frame element.
 */
function getCanvasEditor( page ) {
	return page.locator( '.cnl-site-canvas iframe[name="editor-canvas"]' );
}

/**
 * Wait for the site canvas to show a mode's surface: the site preview for
 * Browse, the editor for Edit, and the Compose layer over the editor for
 * Compose.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'Browse'|'Edit'|'Compose'}       mode The mode.
 */
async function expectCanvasMode( page, mode ) {
	await expect( getModeToggle( page ) ).toHaveAccessibleName(
		`Mode: ${ mode }`,
		{ timeout: 15000 }
	);

	if ( mode === 'Browse' ) {
		await expect( getSitePreview( page ) ).toBeVisible();
		// The canvas only follows pages it has seen finish loading.
		await expect(
			page.locator( '.cnl-editor-preview-canvas__spinner' )
		).toHaveCount( 0, { timeout: 15000 } );
		return;
	}

	await expect( getSitePreview( page ) ).toBeHidden();
	await expect( getCanvasEditor( page ) ).toBeVisible( { timeout: 15000 } );

	const composeLayer = page.locator( '.cnl-compose-layer' );

	if ( mode === 'Compose' ) {
		await expect( composeLayer ).toBeVisible( { timeout: 15000 } );
	} else {
		await expect( composeLayer ).toHaveCount( 0 );
	}
}

/**
 * Switch the site canvas to a mode, and wait for it to show.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'Browse'|'Edit'|'Compose'}       mode The mode to switch to.
 */
async function setCanvasMode( page, mode ) {
	const label = await getModeToggle( page ).getAttribute( 'aria-label' );

	if ( label !== `Mode: ${ mode }` ) {
		await pickCanvasMode( page, mode );
	}

	await expectCanvasMode( page, mode );
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
	expectCanvasMode,
	getCanvasEditor,
	getEditorCanvas,
	getFrameTexts,
	getModeToggle,
	getRoute,
	getSaveControls,
	getSitePreview,
	getStage,
	openReviewChanges,
	openSidebarLink,
	pickCanvasMode,
	setCanvasMode,
	visitEditor,
	writeParityScreenshot,
};
