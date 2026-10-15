/**
 * The site canvas beside Home, Pages and Design: its Browse, Edit and Compose
 * modes, the preview's history, the full editor, devices and the More options
 * menu. Compose has its own file.
 */
const {
	expect,
	expectBlockEditor,
	expectCanvasMode,
	getCanvasEditor,
	getComposeButton,
	getModeToggle,
	getRoute,
	getSitePreview,
	openSidebarLink,
	pickCanvasMode,
	setCanvasMode,
	test,
	visitEditor,
} = require( '../utils' );

test.describe( 'Site canvas interactions', () => {
	test( 'Browse shows the site as visitors see it, and Edit switches to the editor', async ( {
		page,
	} ) => {
		await visitEditor( page );
		await expectCanvasMode( page, 'Browse' );

		const preview = getSitePreview( page );
		const frame = page.frameLocator( 'iframe[title="Site preview"]' );

		await expect( preview ).toHaveAttribute(
			'src',
			/cnl-editor-preview=1/
		);
		await expect( frame.locator( 'body' ) ).toBeVisible();
		await expect( frame.locator( '#wpadminbar' ) ).toHaveCount( 0 );
		await expect(
			page.getByRole( 'group', { name: 'Preview history' } )
		).toBeVisible();

		await setCanvasMode( page, 'Edit' );
		await expect( preview ).toBeHidden();
		await expect( getCanvasEditor( page ) ).toBeVisible();
		await expect(
			page.getByRole( 'group', { name: 'Preview history' } )
		).toHaveCount( 0 );

		await setCanvasMode( page, 'Browse' );
		await expect(
			page.getByRole( 'group', { name: 'Preview history' } )
		).toBeVisible();
	} );

	test( 'Browse and Edit are a toggle; Compose is offered while editing', async ( {
		page,
	} ) => {
		await visitEditor( page );

		const toggle = getModeToggle( page );
		const compose = getComposeButton( page );

		await expect(
			toggle.getByRole( 'radio', { name: 'Browse' } )
		).toBeChecked();
		await expect( compose ).toHaveCount( 0 );

		await setCanvasMode( page, 'Edit' );
		await expect( compose ).toBeVisible();
		await expect( compose ).toHaveAttribute( 'aria-pressed', 'false' );

		// Compose is editing from further away: the toggle stays on Edit.
		await compose.click();
		await expectCanvasMode( page, 'Compose' );
		await expect(
			toggle.getByRole( 'radio', { name: 'Edit' } )
		).toBeChecked();

		// Escape, with nothing picked, steps back in to Edit.
		await page.keyboard.press( 'Escape' );
		await expectCanvasMode( page, 'Edit' );
	} );

	test( 'the mode carries over to another screen, but not a reload', async ( {
		page,
	} ) => {
		await visitEditor( page );
		await setCanvasMode( page, 'Edit' );

		await openSidebarLink( page, 'Pages' );
		await expect.poll( () => getRoute( page ) ).toMatch( /^\/types\/page/ );
		await expectCanvasMode( page, 'Edit' );

		await page.reload();
		await expectCanvasMode( page, 'Browse' );
	} );

	test( 'leaving Edit with unsaved changes asks to save them', async ( {
		page,
		rest,
	} ) => {
		const testPage = await rest.createPage();

		await visitEditor(
			page,
			`/types/page/list/all?previewId=${ testPage.id }`
		);
		await expect(
			page.locator( '.cnl-editor-homepage-document__title' )
		).toHaveText( testPage.title, { timeout: 15000 } );
		await setCanvasMode( page, 'Edit' );

		const paragraph = getCanvasEditor( page )
			.contentFrame()
			.getByText( testPage.body );

		await paragraph.click();
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ' changed' );

		await pickCanvasMode( page, 'Browse' );

		const dialog = page.getByRole( 'dialog', {
			name: 'Save your changes?',
		} );

		await expect( dialog ).toBeVisible();
		await dialog.getByRole( 'button', { name: 'Discard' } ).click();
		await expectCanvasMode( page, 'Browse' );
		await expect(
			page
				.frameLocator( 'iframe[title="Site preview"]' )
				.getByText( testPage.body, { exact: true } )
		).toBeVisible();
	} );

	test( 'switches the canvas between desktop and mobile', async ( {
		page,
	} ) => {
		await visitEditor( page );

		const preview = page.locator( '.cnl-site-canvas__preview' );

		await page.getByRole( 'radio', { name: 'Mobile view' } ).click();
		await expect( preview ).toHaveClass( /is-mobile/ );

		await page.getByRole( 'radio', { name: 'Desktop view' } ).click();
		await expect( preview ).toHaveClass( /is-desktop/ );
	} );

	test( 'follows links in the preview, and back again', async ( {
		page,
		rest,
	} ) => {
		const target = await rest.createPage( {
			title: `Preview target ${ Date.now() }`,
		} );
		const source = await rest.createPage( {
			content: `<!-- wp:paragraph --><p><a href="${ target.link }">Preview target link</a></p><!-- /wp:paragraph -->`,
			title: `Preview source ${ Date.now() }`,
		} );

		await visitEditor(
			page,
			`/types/page/list/all?previewId=${ source.id }`
		);

		const toolbar = page.locator( '.cnl-editor-homepage-toolbar' );
		const title = toolbar.locator( '.cnl-editor-homepage-document__title' );
		const meta = toolbar.locator( '.cnl-editor-homepage-document__meta' );
		const back = toolbar.getByRole( 'button', { name: 'Back in preview' } );
		const frame = page.frameLocator( 'iframe[title="Site preview"]' );

		await expect( title ).toHaveText( source.title, { timeout: 15000 } );
		await expectCanvasMode( page, 'Browse' );
		await expect( title ).toHaveText( source.title );
		await expect( meta ).toHaveText( 'Page · Published' );
		await expect( back ).toBeDisabled();

		await frame
			.getByRole( 'link', { name: 'Preview target link' } )
			.click();

		await expect( title ).toHaveText( target.title, { timeout: 15000 } );
		await expect( frame.locator( '#wpadminbar' ) ).toHaveCount( 0 );
		await expect( back ).toBeEnabled();

		await back.click();
		await expect( title ).toHaveText( source.title, { timeout: 15000 } );
	} );

	test( 'offers homepage options for the homepage', async ( { page } ) => {
		await visitEditor( page );

		await page.getByRole( 'button', { name: 'Page Options' } ).click();
		await expect(
			page.getByRole( 'menuitem', { name: 'Manage homepage' } )
		).toBeVisible();
	} );

	test( 'More options opens the page in the full-screen editor', async ( {
		page,
	} ) => {
		await visitEditor( page );

		const openFull = page.getByRole( 'menuitem', {
			name: 'Open in full editor',
		} );

		// It's in the menu, not on the toolbar, in any mode.
		await expect(
			page
				.locator( '.cnl-editor-homepage-toolbar' )
				.getByRole( 'button', { name: 'Open in full editor' } )
		).toHaveCount( 0 );
		await page.getByRole( 'button', { name: 'More options' } ).click();
		await expect( openFull ).toBeEnabled( { timeout: 15000 } );
		await openFull.click();

		await expect
			.poll( () => getRoute( page ), { timeout: 15000 } )
			.toMatch( /^\/types\/page\/edit\/\d+$/ );
		await expectBlockEditor( page );
	} );

	test( 'More options opens the site in a new tab', async ( {
		context,
		page,
	} ) => {
		await visitEditor( page );

		await page.getByRole( 'button', { name: 'More options' } ).click();
		const [ tab ] = await Promise.all( [
			context.waitForEvent( 'page' ),
			page.getByRole( 'menuitem', { name: 'Open in a new tab' } ).click(),
		] );

		await tab.waitForLoadState();
		expect(
			new URL( tab.url() ).searchParams.has( 'cnl-editor-preview' )
		).toBe( false );
		await expect( tab.locator( 'body' ) ).toBeVisible();
	} );
} );
