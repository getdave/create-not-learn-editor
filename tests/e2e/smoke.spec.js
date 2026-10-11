/**
 * One quick pass through every main screen, to catch the editor failing to
 * load at all. The views and interactions folders test each screen properly.
 */
const {
	expect,
	expectBlockEditor,
	getRoute,
	getQuickEditor,
	getStage,
	openSidebarLink,
	test,
	visitEditor,
} = require( './utils' );

test( 'every main screen loads without errors', async ( { page, rest } ) => {
	const errors = [];
	page.on( 'pageerror', ( error ) => errors.push( error.message ) );

	const testPage = await rest.createPage();
	const stage = getStage( page );

	await test.step( 'Home', async () => {
		await visitEditor( page );
		await expect(
			page.getByRole( 'heading', { level: 1, name: 'Your site' } )
		).toBeVisible();
		await expect( getQuickEditor( page ) ).toBeVisible( {
			timeout: 15000,
		} );
	} );

	await test.step( 'Pages', async () => {
		await openSidebarLink( page, 'Pages' );
		await expect(
			page.getByRole( 'list', { name: 'Pages' } ).getByRole( 'button', {
				name: testPage.title,
				exact: true,
			} )
		).toBeVisible( { timeout: 15000 } );
	} );

	await test.step( 'Menus', async () => {
		await openSidebarLink( page, 'Menus' );
		await expect.poll( () => getRoute( page ) ).toMatch( /^\/navigation/ );
		await expect(
			page.getByText( 'Manage this navigation menu.' )
		).toBeVisible( { timeout: 15000 } );
	} );

	await test.step( 'Design', async () => {
		await openSidebarLink( page, 'Design' );
		await expect(
			stage.getByRole( 'region', { name: 'Site look' } )
		).toBeVisible();
	} );

	for ( const [ link, heading ] of [
		[ 'Layouts', 'Layouts' ],
		[ 'Site parts', 'Site parts' ],
		[ 'Sections', 'Sections' ],
	] ) {
		await test.step( `Advanced › ${ link }`, async () => {
			await openSidebarLink( page, link );
			await expect(
				stage.getByRole( 'heading', { name: heading } )
			).toBeVisible();
			await expect(
				stage.locator( '.dataviews-view-grid, .dataviews-view-list' )
			).toBeVisible( { timeout: 15000 } );
		} );
	}

	await test.step( 'Block editor', async () => {
		await visitEditor( page, `/types/page/edit/${ testPage.id }` );
		await expectBlockEditor( page );
	} );

	expect( errors ).toEqual( [] );
} );
