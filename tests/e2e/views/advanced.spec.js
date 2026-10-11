/**
 * The full-width lists under Advanced in the sidebar.
 */
const {
	expect,
	getStage,
	openSidebarLink,
	test,
	visitEditor,
} = require( '../utils' );

test.describe( 'Advanced views', () => {
	test.beforeEach( async ( { page } ) => {
		await visitEditor( page );
	} );

	test( 'lists Layouts full width', async ( { page } ) => {
		await openSidebarLink( page, 'Layouts' );
		await expect( page ).toHaveURL( /p=%2Ftemplates/ );

		const stage = getStage( page );

		await expect(
			stage.getByRole( 'heading', { name: 'Layouts' } )
		).toBeVisible();
		await expect(
			stage.getByRole( 'button', { name: 'Add layout' } )
		).toBeVisible();
		await expect( stage.locator( '.dataviews-search' ) ).toBeVisible( {
			timeout: 15000,
		} );
		await expect(
			stage.locator( '.dataviews-view-grid, .dataviews-view-list' )
		).toBeVisible( { timeout: 15000 } );
		await expect( page.locator( '.boot-layout__canvas' ) ).toHaveCount( 0 );
	} );

	test( 'lists Site parts full width, by area', async ( { page } ) => {
		await openSidebarLink( page, 'Site parts' );
		await expect( page ).toHaveURL( /p=%2Ftemplate-parts/ );

		const stage = getStage( page );

		await expect(
			stage.getByRole( 'heading', { name: 'Site parts' } )
		).toBeVisible();
		await expect(
			stage.getByRole( 'tab', { name: 'All', exact: true } )
		).toBeVisible();
		await expect(
			stage.getByRole( 'tab', { name: 'Headers' } )
		).toBeVisible();
		await expect( stage.locator( '.dataviews-search' ) ).toBeVisible( {
			timeout: 15000,
		} );
		await expect(
			stage.locator( '.dataviews-view-grid, .dataviews-view-list' )
		).toBeVisible( { timeout: 15000 } );
		await expect( page.locator( '.boot-layout__canvas' ) ).toHaveCount( 0 );
	} );

	test( 'lists Sections full width, by source', async ( { page } ) => {
		await openSidebarLink( page, 'Sections' );
		await expect( page ).toHaveURL( /p=%2Fpatterns/ );

		const stage = getStage( page );

		await expect(
			stage.getByRole( 'heading', { name: 'Sections' } )
		).toBeVisible();
		await expect(
			stage.getByRole( 'tab', { name: 'All sections' } )
		).toBeVisible();
		await expect(
			stage.getByRole( 'tab', { name: 'Saved by you' } )
		).toBeVisible();
		await expect( stage.locator( '.dataviews-search' ) ).toBeVisible( {
			timeout: 15000,
		} );
		await expect( page.locator( '.boot-layout__canvas' ) ).toHaveCount( 0 );
	} );
} );
