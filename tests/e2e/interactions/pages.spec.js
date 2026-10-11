const {
	expect,
	expectBlockEditor,
	getEditorCanvas,
	getRoute,
	getSaveControls,
	getStage,
	test,
	visitEditor,
} = require( '../utils' );

test.describe( 'Pages interactions', () => {
	test( 'picking a page opens it on the canvas', async ( { page, rest } ) => {
		const testPage = await rest.createPage();

		await visitEditor( page, '/types/page' );
		await getStage( page )
			.getByRole( 'list', { name: 'Pages' } )
			.getByRole( 'button', { name: testPage.title, exact: true } )
			.click();

		await expect( page ).toHaveURL(
			new RegExp( `previewId%3D${ testPage.id }` )
		);
		await expect(
			page.locator( '.cnl-editor-homepage-document__title' )
		).toHaveText( testPage.title, { timeout: 15000 } );
		await expect(
			getEditorCanvas( page, '.cnl-site-canvas' ).getByText(
				testPage.body
			)
		).toBeVisible( { timeout: 15000 } );
	} );

	test( 'the pencil opens a page into its sections, and Pages goes back', async ( {
		page,
		rest,
	} ) => {
		const testPage = await rest.createPage();
		const stage = getStage( page );

		await visitEditor( page, '/types/page' );
		await stage
			.getByRole( 'button', { name: `Edit ${ testPage.title }` } )
			.click();

		await expect( page ).toHaveURL(
			new RegExp( `postId%3D${ testPage.id }` )
		);
		await expect(
			stage
				.getByRole( 'list', { name: 'The page, top to bottom' } )
				.getByRole( 'button', {
					name: new RegExp( `^${ testPage.body }` ),
				} )
		).toBeVisible( { timeout: 15000 } );
		await expect(
			getEditorCanvas( page, '.cnl-site-canvas' ).getByText(
				testPage.body
			)
		).toBeAttached( { timeout: 15000 } );

		await stage
			.getByRole( 'navigation', { name: 'Breadcrumbs' } )
			.getByRole( 'link', { name: 'Pages' } )
			.click();
		await expect(
			stage.getByRole( 'list', { name: 'Pages' } )
		).toBeVisible();
	} );

	test( 'renames a page from its options', async ( { page, rest } ) => {
		const testPage = await rest.createPage();
		const newTitle = `Renamed page ${ Date.now() }`;
		const stage = getStage( page );

		await visitEditor(
			page,
			`/types/page/list/all?postId=${ testPage.id }`
		);
		await stage.getByRole( 'button', { name: 'Page options' } ).click();
		await page.getByRole( 'menuitem', { name: 'Rename' } ).click();

		const dialog = page.getByRole( 'dialog', { name: 'Rename page' } );
		await expect( dialog.getByLabel( 'Page title' ) ).toHaveValue(
			testPage.title
		);
		await dialog.getByLabel( 'Page title' ).fill( newTitle );
		await dialog.getByRole( 'button', { name: 'Rename' } ).click();

		// The new name waits in the top bar to be saved.
		await expect( dialog ).toHaveCount( 0 );
		await expect(
			page.locator( '.cnl-editor-homepage-document__title' )
		).toHaveText( newTitle );
		await expect( getSaveControls( page ) ).toContainText(
			'1 unsaved change'
		);
	} );

	test( 'opens a page layout in the block editor', async ( { page } ) => {
		await visitEditor( page, '/types/page' );

		const stage = getStage( page );
		const canvas = page.locator( '.cnl-editor-canvas' );

		await stage.getByRole( 'tab', { name: 'Layouts' } ).click();
		await expect( page ).toHaveURL( /content%3Dtemplates/ );

		// Picking a layout previews it, styled by the theme.
		await stage
			.locator( '.routes-post-list__template-card' )
			.first()
			.click();
		await expect
			.poll(
				() =>
					getEditorCanvas( page )
						.locator( 'body' )
						.evaluate(
							( body ) =>
								window.getComputedStyle( body ).fontFamily
						),
				{ timeout: 15000 }
			)
			.not.toContain( 'Times New Roman' );

		await stage.getByRole( 'tab', { name: 'Pages' } ).click();
		await stage.getByRole( 'tab', { name: 'Layouts' } ).click();
		await canvas
			.getByRole( 'button', { name: 'Edit', exact: true } )
			.click();

		await expect
			.poll( () => getRoute( page ), { timeout: 15000 } )
			.toMatch( /^\/wp_template\?postId=/ );
		await expectBlockEditor( page );
	} );
} );
