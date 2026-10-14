const {
	expect,
	expectBlockEditor,
	getEditorCanvas,
	getPageItem,
	getRoute,
	getSaveControls,
	getStage,
	setCanvasMode,
	test,
	visitEditor,
} = require( '../utils' );

test.describe( 'Pages interactions', () => {
	test( 'picking a page opens it on the canvas', async ( { page, rest } ) => {
		const testPage = await rest.createPage();

		await visitEditor( page, '/types/page' );
		await getPageItem( page, testPage.title ).click();

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
		await getPageItem( page, testPage.title ).hover();
		await stage
			.getByRole( 'button', { name: `Edit ${ testPage.title }` } )
			.click();

		await expect( page ).toHaveURL(
			new RegExp( `postId%3D${ testPage.id }` )
		);
		// The page's sections are listed while composing it.
		await setCanvasMode( page, 'Compose' );
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
			stage.getByRole( 'region', {
				name: 'In your menu',
				exact: true,
			} )
		).toBeVisible();
	} );

	test( 'a page goes into the menu, waiting to be saved', async ( {
		page,
		rest,
	} ) => {
		const draft = await rest.createPage( { status: 'draft' } );
		const stage = getStage( page );
		const inMenu = stage.getByRole( 'region', {
			name: 'In your menu',
			exact: true,
		} );
		const notInMenu = stage.getByRole( 'region', {
			name: 'Not in your menu',
		} );

		await visitEditor( page, '/types/page' );

		// Drafts aren't in a menu that lists every page.
		await expect(
			notInMenu.getByRole( 'button', {
				name: new RegExp( `^${ draft.title }` ),
			} )
		).toBeVisible( { timeout: 15000 } );

		await notInMenu
			.getByRole( 'button', { name: new RegExp( `^${ draft.title }` ) } )
			.hover();
		await notInMenu
			.getByRole( 'button', {
				name: `Add ${ draft.title } to your menu`,
			} )
			.click();

		await expect(
			inMenu.getByRole( 'link', { name: draft.title, exact: true } )
		).toBeVisible();
		await expect(
			notInMenu.getByRole( 'button', {
				name: new RegExp( `^${ draft.title }` ),
			} )
		).toHaveCount( 0 );
		await expect( getSaveControls( page ) ).toContainText(
			'1 unsaved change'
		);
	} );

	test( 'adds a link to the menu with the link control', async ( {
		page,
	} ) => {
		const url = `https://example.com/${ Date.now() }`;
		const inMenu = getStage( page ).getByRole( 'region', {
			name: 'In your menu',
			exact: true,
		} );

		await visitEditor( page, '/types/page' );
		await inMenu
			.getByRole( 'button', { name: 'Add to your menu' } )
			.click( { timeout: 15000 } );
		await page.getByRole( 'menuitem', { name: 'Link' } ).click();

		const urlField = page.getByRole( 'combobox', {
			name: 'Search or type URL',
		} );
		await expect( urlField ).toBeFocused();
		await urlField.fill( url );
		await urlField.press( 'Enter' );

		await expect(
			inMenu.getByRole( 'link', {
				name: url.replace( 'https://', '' ),
				exact: true,
			} )
		).toBeVisible();
		await expect( getSaveControls( page ) ).toContainText(
			'1 unsaved change'
		);
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
