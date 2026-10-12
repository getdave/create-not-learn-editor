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
	getModeToggle,
	getRoute,
	getSitePreview,
	openSidebarLink,
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

	test( 'the mode menu offers Browse, Edit and Compose', async ( {
		page,
	} ) => {
		await visitEditor( page );

		const toggle = getModeToggle( page );

		await expect( toggle ).toHaveAccessibleName( 'Mode: Browse' );
		await expect( toggle ).toHaveText( /Browse/ );

		await toggle.click();

		const items = page.getByRole( 'menuitemradio' );

		await expect( items ).toHaveCount( 3 );
		for ( const [ name, description ] of [
			[ 'Browse', 'See your site as visitors do.' ],
			[ 'Edit', 'Change anything on the page.' ],
			[ 'Compose', 'Step back to add, move and style sections.' ],
		] ) {
			await expect(
				page.getByRole( 'menuitemradio', {
					name: new RegExp( `^${ name }` ),
				} )
			).toContainText( description );
		}
		await expect(
			page.getByRole( 'menuitemradio', { name: /^Browse/ } )
		).toBeChecked();
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

		await getModeToggle( page ).click();
		await page.getByRole( 'menuitemradio', { name: /^Browse/ } ).click();

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
			page.getByRole( 'menuitem', { name: 'Configure Homepage' } )
		).toBeVisible();
	} );

	test( 'Open in full editor opens the page in the full-screen editor', async ( {
		page,
	} ) => {
		await visitEditor( page );

		const toolbar = page.locator( '.cnl-editor-homepage-toolbar' );
		const openFull = toolbar.getByRole( 'button', {
			name: 'Open in full editor',
		} );

		// Only Edit offers it.
		await expect( openFull ).toHaveCount( 0 );
		await setCanvasMode( page, 'Compose' );
		await expect( openFull ).toHaveCount( 0 );
		await setCanvasMode( page, 'Edit' );
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
