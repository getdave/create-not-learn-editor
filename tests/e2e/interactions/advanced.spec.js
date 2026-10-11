/**
 * Making and finding things on the lists under Advanced in the sidebar.
 */
const {
	expect,
	expectBlockEditor,
	getRoute,
	getStage,
	test,
	visitEditor,
} = require( '../utils' );

/**
 * The `postId` in the route, for routes like `/wp_template?postId=…`.
 *
 * @param {import('@playwright/test').Page} page
 * @return {string|null} The ID.
 */
function getRoutePostId( page ) {
	const [ , search = '' ] = getRoute( page ).split( '?' );

	return new URLSearchParams( search ).get( 'postId' );
}

test.describe( 'Advanced interactions', () => {
	test( 'adds a layout and opens it in the block editor', async ( {
		page,
		rest,
	} ) => {
		const title = `Created layout ${ Date.now() }`;

		await visitEditor( page, '/templates' );
		await getStage( page )
			.getByRole( 'button', { name: 'Add layout' } )
			.click();

		const dialog = page.getByRole( 'dialog', { name: 'Add a layout' } );
		await dialog.getByLabel( 'Name' ).fill( title );
		await dialog.getByRole( 'button', { name: 'Add' } ).click();

		await expect
			.poll( () => getRoute( page ), { timeout: 15000 } )
			.toMatch( /^\/wp_template\?/ );
		await expectBlockEditor( page );

		const id = getRoutePostId( page );
		expect( id ).toBeTruthy();
		rest.deleteLater( `/wp/v2/templates/${ id }` );

		const template = await rest.fetch( `/wp/v2/templates/${ id }`, {
			params: { context: 'edit' },
		} );
		expect( template.title.raw ).toBe( title );
	} );

	test( 'adds a header site part and opens it in the block editor', async ( {
		page,
		rest,
	} ) => {
		const title = `Created site part ${ Date.now() }`;

		await visitEditor( page, '/template-parts' );
		await getStage( page )
			.getByRole( 'button', { name: 'Add site part' } )
			.click();

		const dialog = page.getByRole( 'dialog', { name: 'Add a site part' } );
		await dialog.getByLabel( 'Name' ).fill( title );
		await dialog
			.getByRole( 'combobox' )
			.selectOption( { label: 'Header' } );
		await dialog.getByRole( 'button', { name: 'Add' } ).click();

		await expect
			.poll( () => getRoute( page ), { timeout: 15000 } )
			.toMatch( /^\/wp_template_part\?/ );
		await expectBlockEditor( page );

		const id = getRoutePostId( page );
		expect( id ).toBeTruthy();
		rest.deleteLater( `/wp/v2/template-parts/${ id }` );

		const part = await rest.fetch( `/wp/v2/template-parts/${ id }`, {
			params: { context: 'edit' },
		} );
		expect( part.title.raw ).toBe( title );
		expect( part.area ).toBe( 'header' );
	} );

	test( 'adds a section and opens it in the block editor', async ( {
		page,
		rest,
	} ) => {
		const title = `Created section ${ Date.now() }`;

		await visitEditor( page, '/patterns' );
		await getStage( page )
			.getByRole( 'button', { name: 'Add section' } )
			.click();

		const dialog = page.getByRole( 'dialog', { name: 'Add a section' } );
		await dialog.getByLabel( 'Name' ).fill( title );
		await dialog.getByRole( 'combobox' ).selectOption( {
			label: 'Let each copy be changed on its own',
		} );
		await dialog.getByRole( 'button', { name: 'Add' } ).click();

		await expect
			.poll( () => getRoute( page ), { timeout: 15000 } )
			.toMatch( /^\/types\/wp_block\/edit\/\d+$/ );
		await expectBlockEditor( page );

		const id = getRoute( page ).match( /(\d+)$/ )[ 1 ];
		rest.deleteLater( `/wp/v2/blocks/${ id }` );

		const pattern = await rest.fetch( `/wp/v2/blocks/${ id }`, {
			params: { context: 'edit' },
		} );
		expect( pattern.title.raw ).toBe( title );
	} );

	test( 'finds a saved section by searching', async ( { page, rest } ) => {
		const pattern = await rest.createPattern();

		await visitEditor( page, '/patterns' );

		const stage = getStage( page );
		await stage.getByRole( 'tab', { name: 'Saved by you' } ).click();
		await expect( page ).toHaveURL( /type(?:=|%3D)my-patterns/ );

		await stage.locator( '.dataviews-search input' ).fill( pattern.title );
		await expect(
			stage.getByRole( 'button', { name: pattern.title } ).first()
		).toBeVisible( { timeout: 15000 } );
	} );
} );
