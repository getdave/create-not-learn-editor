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

const ADVANCED_LINKS = [
	'Posts',
	'Menus',
	'Sections',
	'Site parts',
	'Layouts',
];

/**
 * Follow a link in the sidebar, opening Advanced first for links under it.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string}                          name The link's name.
 */
async function openSidebarLink( page, name ) {
	const advanced = page.getByRole( 'button', { name: 'Advanced' } );
	const back = page.getByRole( 'button', { name: 'Back', exact: true } );
	const expand = page.getByRole( 'button', { name: 'Expand sidebar' } );

	// Picking a screen folds the sidebar to a strip of icons, without Back.
	if ( await expand.isVisible() ) {
		await expand.click();
	}

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
 * Open page layouts from the Pages screen's options menu.
 *
 * @param {import('@playwright/test').Page} page
 */
async function openPageLayouts( page ) {
	await getStage( page )
		.getByRole( 'button', { name: 'Page options', exact: true } )
		.click();
	await page.getByRole( 'menuitem', { name: 'Manage layouts' } ).click();
}

/**
 * A page in the Pages screen's list, whether it is in the main menu or not.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string}                          title The page's title.
 * @return {import('@playwright/test').Locator} The page's item.
 */
function getPageItem( page, title ) {
	const list = getStage( page ).locator( '.cnl-pages-menu, .cnl-pages-tree' );

	return list
		.getByRole( 'link', { name: title, exact: true } )
		.or( list.getByRole( 'button', { name: title, exact: true } ) );
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
 * The site canvas's Browse | Edit toggle.
 *
 * @param {import('@playwright/test').Page} page
 * @return {import('@playwright/test').Locator} The toggle.
 */
function getModeToggle( page ) {
	return page.locator( '.cnl-site-canvas__mode-toggle' );
}

/**
 * The site canvas's Compose button, offered while editing.
 *
 * @param {import('@playwright/test').Page} page
 * @return {import('@playwright/test').Locator} The button.
 */
function getComposeButton( page ) {
	return page.locator( '.cnl-site-canvas__compose-button' );
}

/**
 * The mode the site canvas is in, from its controls: Browse or Edit from the
 * toggle, and Compose when its button is pressed.
 *
 * @param {import('@playwright/test').Page} page
 * @return {Promise<?string>} `Browse`, `Edit` or `Compose`.
 */
async function getCanvasMode( page ) {
	const toggle = getModeToggle( page );

	if (
		( await toggle
			.getByRole( 'radio', { name: 'Browse' } )
			.getAttribute( 'aria-checked' ) ) === 'true'
	) {
		return 'Browse';
	}

	return ( await getComposeButton( page ).getAttribute( 'aria-pressed' ) ) ===
		'true'
		? 'Compose'
		: 'Edit';
}

/**
 * Switch the canvas's mode with its controls, without waiting for the canvas
 * to follow. Use `setCanvasMode` unless something, such as the unsaved
 * changes dialog, is expected to hold the switch back.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'Browse'|'Edit'|'Compose'}       mode The mode to pick.
 */
async function pickCanvasMode( page, mode ) {
	if ( ! CANVAS_MODES.includes( mode ) ) {
		throw new Error( `Unknown canvas mode: ${ mode }` );
	}

	const current = await getCanvasMode( page );

	if ( mode === current ) {
		return;
	}

	// Leaving Compose for Edit is its own button, pressed again.
	if ( mode === 'Edit' && current === 'Compose' ) {
		await getComposeButton( page ).click();
		return;
	}

	const radio = getModeToggle( page ).getByRole( 'radio', {
		name: mode === 'Browse' ? 'Browse' : 'Edit',
	} );

	// Edit waits for there to be something to edit.
	await expect( radio ).toBeEnabled( { timeout: 15000 } );

	if ( current !== ( mode === 'Browse' ? 'Browse' : 'Edit' ) ) {
		await radio.click();
	}

	if ( mode === 'Compose' ) {
		await expect( getComposeButton( page ) ).toBeVisible( {
			timeout: 15000,
		} );
		await getComposeButton( page ).click();
	}
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
 * Browse, the editor for Edit, and the editor zoomed out for Compose.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'Browse'|'Edit'|'Compose'}       mode The mode.
 */
async function expectCanvasMode( page, mode ) {
	await expect
		.poll( () => getCanvasMode( page ), { timeout: 15000 } )
		.toBe( mode );

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

	// Compose is the same editor, zoomed out.
	const isZoomedOut = () =>
		getCanvasEditor( page )
			.contentFrame()
			.locator( 'html' )
			.getAttribute( 'class' )
			.then( ( value ) => /\bis-zoomed-out\b/.test( value || '' ) );

	await expect
		.poll( isZoomedOut, { timeout: 15000 } )
		.toBe( mode === 'Compose' );
}

/**
 * Switch the site canvas to a mode, and wait for it to show.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'Browse'|'Edit'|'Compose'}       mode The mode to switch to.
 */
async function setCanvasMode( page, mode ) {
	await pickCanvasMode( page, mode );
	await expectCanvasMode( page, mode );
}

/**
 * In Edit, point at a section and pick one of the ways to edit it from the
 * bar over it: Edit design or Edit content.
 *
 * @param {import('@playwright/test').Page}    page
 * @param {import('@playwright/test').Locator} target Something in the
 *                                                    section, in the canvas.
 * @param {string}                             mode   The way to edit it.
 */
async function pickSectionMode( page, target, mode ) {
	/*
	 * Pointed at again until the right section is in the mode: the layer
	 * only hears the pointer once the canvas has loaded, and while the page
	 * is still settling, the browser can move a neighbour under the pointer.
	 */
	await expect( async () => {
		const done = page.locator( '.cnl-section-modes__done' );

		if ( await done.count() ) {
			await done.first().click();
		}

		// Edit design has no Done: Escape steps out, a level at a time.
		while ( await page.locator( '.cnl-section-modes__design' ).count() ) {
			await page.keyboard.press( 'Escape' );
		}

		await pointAtSection( page, target, { timeout: 1000 } );
		await page
			.locator( '.cnl-section-modes__bar' )
			.getByRole( 'button', { name: mode, exact: true } )
			.click( { timeout: 2000 } );
		expect(
			await isWithin( page, target, '.cnl-section-modes__outline' )
		).toBe( true );
	} ).toPass( { timeout: 20000 } );
}

/**
 * Whether the middle of something on the canvas is inside one of the
 * layer's boxes.
 *
 * @param {import('@playwright/test').Page}    page
 * @param {import('@playwright/test').Locator} target   On the canvas.
 * @param {string}                             selector The layer's box.
 * @return {Promise<boolean>} Whether it is.
 */
async function isWithin( page, target, selector ) {
	const lit = await page.locator( selector ).first().boundingBox();
	const box = await target.boundingBox();
	const x = box.x + box.width / 2;
	const y = box.y + box.height / 2;

	return (
		Boolean( lit ) &&
		x >= lit.x &&
		x <= lit.x + lit.width &&
		y >= lit.y &&
		y <= lit.y + lit.height
	);
}

/**
 * In Edit or Compose, point at the section holding something until the
 * layer lights it up, with its bar. Forced, as the bar over a short section
 * covers it once it shows.
 *
 * @param {import('@playwright/test').Page}    page
 * @param {import('@playwright/test').Locator} target          Something in
 *                                                             the section.
 * @param {Object}                             options
 * @param {number}                             options.timeout How long to
 *                                                             keep trying.
 */
async function pointAtSection( page, target, { timeout = 15000 } = {} ) {
	await expect( async () => {
		await page.mouse.move( 0, 0 );
		await target.hover( { force: true } );
		await expect( page.locator( '.cnl-section-modes__bar' ) ).toBeVisible( {
			timeout: 1000,
		} );
		expect(
			await isWithin( page, target, '.cnl-section-modes__tint' )
		).toBe( true );
	} ).toPass( { timeout } );
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
 * Add one of the plugin's section templates from the Add a section picker,
 * already open, in place on the canvas or as a modal. The picker in place
 * only shows a few at random, so it goes on to View all sections.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string}                          name The template's title.
 */
async function pickSectionTemplate( page, name ) {
	const inline = page.getByRole( 'region', { name: 'Add a section' } );
	const modal = page.getByRole( 'dialog', { name: 'Add a section' } );

	await expect( inline.or( modal ) ).toBeVisible();

	if ( await inline.isVisible() ) {
		await inline
			.getByRole( 'button', { name: 'View all sections' } )
			.click();
	}

	await expect( modal ).toBeVisible();
	await modal.getByText( 'Templates', { exact: true } ).click();
	await modal
		.getByRole( 'button', { name: `Add ${ name }`, exact: true } )
		.click();
	await expect( modal ).toBeHidden();
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
	getCanvasMode,
	getComposeButton,
	getModeToggle,
	getPageItem,
	getRoute,
	getSaveControls,
	getSitePreview,
	getStage,
	openPageLayouts,
	openReviewChanges,
	openSidebarLink,
	pickCanvasMode,
	pickSectionMode,
	pickSectionTemplate,
	pointAtSection,
	setCanvasMode,
	visitEditor,
	writeParityScreenshot,
};
