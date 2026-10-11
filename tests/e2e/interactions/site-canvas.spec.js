/**
 * The site canvas beside Home, Pages and Design: quick edits, the Preview
 * switch and its history, Edit, devices and the More options menu.
 */
const {
	expect,
	expectBlockEditor,
	getPreviewSwitch,
	getQuickEditor,
	getRoute,
	getSitePreview,
	showSitePreview,
	test,
	visitEditor,
} = require( '../utils' );

test.describe( 'Site canvas interactions', () => {
	test( 'Preview shows the site as visitors see it, and switches back', async ( {
		page,
	} ) => {
		await visitEditor( page );
		await showSitePreview( page );

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

		await getPreviewSwitch( page ).uncheck();
		await expect( preview ).toBeHidden();
		await expect( getQuickEditor( page ) ).toBeVisible();
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
		await showSitePreview( page );
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

	test( 'Edit opens the page in the full-screen editor', async ( {
		page,
	} ) => {
		await visitEditor( page );

		const edit = page
			.locator( '.cnl-editor-homepage-toolbar' )
			.getByRole( 'button', { name: 'Edit', exact: true } );

		await expect( edit ).toBeEnabled( { timeout: 15000 } );
		await edit.click();

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
