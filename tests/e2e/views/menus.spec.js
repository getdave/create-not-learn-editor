const {
	expect,
	getFrameTexts,
	getRoute,
	getStage,
	openSidebarLink,
	test,
	visitEditor,
} = require( '../utils' );

test.describe( 'Menus views', () => {
	test( 'Menus lists every menu, and leaves the main one to Pages', async ( {
		page,
	} ) => {
		await visitEditor( page );
		await openSidebarLink( page, 'Menus' );

		await expect
			.poll( () => getRoute( page ), { timeout: 15000 } )
			.toMatch( /^\/navigation/ );

		const stage = getStage( page );

		await expect(
			stage.getByRole( 'heading', { name: 'Menus' } )
		).toBeVisible( { timeout: 15000 } );
		await expect(
			stage.getByText( /is looked after on the Pages screen/ )
		).toBeVisible();
		await expect(
			stage.getByRole( 'button', { name: 'Add menu' } )
		).toBeVisible();
	} );

	test( 'a menu opens on its own screen', async ( { page, rest } ) => {
		const menuId = await rest.getMainMenuId();

		await visitEditor( page, `/navigation/edit/${ menuId }` );

		const stage = getStage( page );
		const canvas = page.locator( '.routes-navigation-canvas' );

		await expect(
			stage.getByText( 'Manage this navigation menu.' )
		).toBeVisible( { timeout: 15000 } );
		await expect(
			stage.getByRole( 'button', { name: 'Navigation menu options' } )
		).toBeVisible();
		await expect(
			stage.getByRole( 'treegrid', {
				name: 'Block navigation structure',
			} )
		).toBeVisible( { timeout: 15000 } );

		await expect(
			canvas.locator( '.routes-navigation-canvas-toolbar__meta' )
		).toHaveText( /^Shown in \d+ locations?$/, { timeout: 15000 } );
		await expect(
			canvas.getByRole( 'checkbox', { name: 'Preview site' } )
		).toBeChecked();
		await expect(
			canvas.getByRole( 'radio', { name: 'Desktop view' } )
		).toBeChecked();
		await expect(
			canvas.getByRole( 'radio', { name: 'Tablet view' } )
		).toBeVisible();
		await expect(
			canvas.getByRole( 'radio', { name: 'Mobile view' } )
		).toBeVisible();
	} );

	test( 'an automatic menu follows the pages on the site', async ( {
		page,
		rest,
	} ) => {
		const testPage = await rest.createPage();
		const menu = await rest.createNavigationMenu();

		await visitEditor( page, `/navigation/edit/${ menu.id }` );

		const stage = getStage( page );

		await expect(
			stage.getByRole( 'heading', { level: 2, name: menu.title } )
		).toBeVisible( { timeout: 15000 } );
		// It reads like any other menu, as the pages it lists.
		await expect(
			stage.getByRole( 'heading', { name: 'Auto-menu' } )
		).toHaveCount( 0 );
		await expect(
			stage.getByRole( 'button', { name: 'Customize' } )
		).toHaveCount( 0 );
		await expect(
			stage
				.getByRole( 'treegrid', { name: 'Block navigation structure' } )
				.getByRole( 'row', { name: testPage.title } )
		).toBeVisible( { timeout: 15000 } );
	} );

	test( 'a menu that is not on the site says so', async ( {
		page,
		rest,
	} ) => {
		const menu = await rest.createNavigationMenu();

		await visitEditor( page, `/navigation/edit/${ menu.id }` );

		const canvas = page.locator( '.routes-navigation-canvas' );

		await expect(
			canvas.locator( '.routes-navigation-canvas-toolbar__meta' )
		).toHaveText( 'Not shown on your site', { timeout: 15000 } );
		await expect(
			canvas.getByText(
				'This menu is not shown anywhere on your site yet, so it does not appear in the preview.'
			)
		).toBeVisible();

		// With the preview off, the canvas offers to place the menu.
		await canvas
			.getByRole( 'checkbox', { name: 'Preview site' } )
			.uncheck();

		const emptyState = canvas.locator(
			'.routes-navigation-locations-canvas__empty-state'
		);
		const description = emptyState.getByText(
			'Choose where this menu should appear, such as your header or footer.'
		);
		const chooseLocation = emptyState.getByRole( 'button', {
			name: 'Choose location',
		} );

		await expect(
			emptyState.getByRole( 'heading', {
				name: 'This menu is not shown on your site yet',
			} )
		).toBeVisible();
		await expect( chooseLocation ).toBeVisible();

		const [ descriptionBox, buttonBox ] = await Promise.all( [
			description.boundingBox(),
			chooseLocation.boundingBox(),
		] );
		expect(
			buttonBox.y - ( descriptionBox.y + descriptionBox.height )
		).toBeGreaterThan( 12 );
	} );

	test( 'a menu on the site previews each place it appears', async ( {
		page,
		rest,
	} ) => {
		await visitEditor(
			page,
			`/navigation/edit/${ await rest.getMainMenuId() }`
		);

		const canvas = page.locator( '.routes-navigation-canvas' );
		await canvas
			.getByRole( 'checkbox', { name: 'Preview site' } )
			.uncheck();

		const card = canvas
			.locator( '.routes-navigation-locations-canvas__card' )
			.first();
		const cardHeader = card.locator(
			'.routes-navigation-locations-canvas__card-header'
		);

		await expect( card ).toBeVisible( { timeout: 15000 } );
		await expect(
			card.getByRole( 'button', { name: 'Edit' } )
		).toBeVisible();
		await expect
			.poll(
				async () => ( await cardHeader.boundingBox() )?.height || 0,
				{
					timeout: 15000,
				}
			)
			.toBeLessThanOrEqual( 64 );
		await expect
			.poll(
				async () =>
					(
						await getFrameTexts(
							page,
							'.routes-navigation-locations-canvas__preview iframe'
						)
					).some( ( text ) => text.trim().length ),
				{ timeout: 15000 }
			)
			.toBe( true );
	} );
} );
