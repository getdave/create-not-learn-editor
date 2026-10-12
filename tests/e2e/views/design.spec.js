const {
	expect,
	getSitePreview,
	getStage,
	test,
	visitEditor,
} = require( '../utils' );

test.describe( 'Design views', () => {
	test( 'Design shows the site looks and links to the rest', async ( {
		page,
	} ) => {
		await visitEditor( page, '/design' );

		const stage = getStage( page );

		await expect(
			stage.getByRole( 'heading', { level: 1, name: 'Design' } )
		).toBeVisible();
		await expect(
			stage
				.getByRole( 'region', { name: 'Site look' } )
				.getByRole( 'button', { name: 'Theme default' } )
		).toBeVisible();

		const links = stage.getByRole( 'navigation', {
			name: 'More design options',
		} );
		for ( const name of [ 'Colors', 'Fonts', 'Name & logo' ] ) {
			await expect(
				links.getByRole( 'button', {
					name: new RegExp( `^${ name }` ),
				} )
			).toBeVisible();
		}

		await expect(
			stage.getByRole( 'link', { name: 'full Styles editor' } )
		).toBeVisible();
		await expect( getSitePreview( page ) ).toBeVisible( {
			timeout: 15000,
		} );
	} );

	test( 'Colors shows only color palettes', async ( { page } ) => {
		await visitEditor( page, '/design/colors' );

		const stage = getStage( page );
		const themeColors = stage.getByRole( 'button', {
			name: 'Theme colors',
		} );

		await expect(
			stage.getByRole( 'heading', { name: 'Colors' } )
		).toBeVisible();
		await expect( themeColors ).toBeVisible( { timeout: 15000 } );
		await expect( themeColors ).toHaveAttribute( 'aria-pressed', 'true' );
		await expect(
			stage.getByRole( 'button', { name: 'Theme fonts' } )
		).toBeHidden();
	} );

	test( 'Fonts shows only font pairings', async ( { page } ) => {
		await visitEditor( page, '/design/fonts' );

		const stage = getStage( page );
		const themeFonts = stage.getByRole( 'button', { name: 'Theme fonts' } );

		await expect(
			stage.getByRole( 'heading', { name: 'Fonts' } )
		).toBeVisible();
		await expect( themeFonts ).toBeVisible( { timeout: 15000 } );
		await expect( themeFonts ).toHaveAttribute( 'aria-pressed', 'true' );
		await expect(
			stage.getByRole( 'button', { name: 'Theme colors' } )
		).toBeHidden();
	} );

	test( 'Name & logo shows the site identity fields', async ( { page } ) => {
		await visitEditor( page, '/design/identity' );

		const stage = getStage( page );

		await expect( stage.getByLabel( 'Site name' ) ).toBeEditable( {
			timeout: 15000,
		} );
		await expect( stage.getByLabel( 'Tagline' ) ).toBeEditable();
		await expect(
			stage.getByText( 'Logo', { exact: true } )
		).toBeVisible();
		await expect(
			stage.getByText( 'Browser icon', { exact: true } )
		).toBeVisible();
		await expect(
			stage.getByRole( 'button', { name: 'Choose image' } )
		).toHaveCount( 2 );
	} );
} );
