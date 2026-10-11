const {
	expect,
	getSaveControls,
	getStage,
	openReviewChanges,
	openSidebarLink,
	test,
	visitEditor,
} = require( '../utils' );

/**
 * Follow one of the links under the site looks on Design.
 *
 * @param {import('@playwright/test').Locator} stage The white panel.
 * @param {string}                             name  The link's title.
 */
async function openDesignLink( stage, name ) {
	await stage
		.getByRole( 'navigation', { name: 'More design options' } )
		.getByRole( 'button', { name: new RegExp( `^${ name }` ) } )
		.click();
}

test.describe( 'Design interactions', () => {
	test( 'links lead to each design screen, and breadcrumbs lead back', async ( {
		page,
	} ) => {
		await visitEditor( page );
		await openSidebarLink( page, 'Design' );

		const stage = getStage( page );
		const backToDesign = stage
			.getByRole( 'navigation', { name: 'Breadcrumbs' } )
			.getByRole( 'link', { name: 'Design' } );

		for ( const [ name, route ] of [
			[ 'Colors', 'colors' ],
			[ 'Fonts', 'fonts' ],
			[ 'Name & logo', 'identity' ],
		] ) {
			await openDesignLink( stage, name );
			await expect( page ).toHaveURL(
				new RegExp( `p=%2Fdesign%2F${ route }` )
			);

			await backToDesign.click();
			await expect( page ).toHaveURL( /p=%2Fdesign$/ );
		}
	} );

	test( 'picking a look previews it, and discarding it puts the theme’s back', async ( {
		page,
	} ) => {
		await visitEditor( page, '/design' );

		const stage = getStage( page );
		const looks = stage.locator( '.routes-styles__look' );
		const themeDefault = stage
			.getByRole( 'button', { name: 'Theme default' } )
			.first();

		await expect( themeDefault ).toHaveAttribute( 'aria-pressed', 'true' );
		test.skip(
			( await looks.count() ) < 2,
			'The active theme has no style variations to pick.'
		);

		await looks.nth( 1 ).click();
		await expect( looks.nth( 1 ) ).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect( getSaveControls( page ) ).toContainText(
			'1 unsaved change'
		);

		const review = await openReviewChanges( page );
		await review
			.getByRole( 'button', { name: 'Discard change to Site look' } )
			.click();

		await expect( themeDefault ).toHaveAttribute( 'aria-pressed', 'true' );
		await expect( getSaveControls( page ) ).not.toContainText( 'unsaved' );
	} );

	test( 'picking a color palette waits to be saved', async ( { page } ) => {
		await visitEditor( page, '/design/colors' );

		const palettes = getStage( page ).locator( '.routes-styles__palette' );

		await expect( palettes.first() ).toBeVisible( { timeout: 15000 } );
		test.skip(
			( await palettes.count() ) < 2,
			'The active theme has no other palettes to pick.'
		);

		await palettes.nth( 1 ).click();
		await expect( palettes.nth( 1 ) ).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect( getSaveControls( page ) ).toContainText(
			'1 unsaved change'
		);
	} );

	test( 'saves the site name and tagline, previewing them first', async ( {
		page,
		rest,
	} ) => {
		const original = await rest.fetch( '/wp/v2/settings', {
			params: { _fields: 'title,description' },
		} );
		rest.onCleanup( () =>
			rest.fetch( '/wp/v2/settings', { data: original, method: 'POST' } )
		);

		const timestamp = Date.now();
		const title = `Create Not Learn ${ timestamp }`;
		const tagline = `Tagline ${ timestamp }`;

		await visitEditor( page, '/design/identity' );

		const stage = getStage( page );
		await stage.getByLabel( 'Site name' ).fill( title );
		await stage.getByLabel( 'Tagline' ).fill( tagline );

		// The preview reads unsaved edits, so the header updates before saving.
		await expect(
			page
				.frameLocator( '.cnl-site-canvas iframe[name="editor-canvas"]' )
				.getByText( title )
				.first()
		).toBeVisible( { timeout: 15000 } );

		await expect( getSaveControls( page ) ).toContainText(
			'2 unsaved changes'
		);
		const review = await openReviewChanges( page );
		await review.getByRole( 'button', { name: 'Save 2 changes' } ).click();

		await expect( getSaveControls( page ) ).toContainText(
			'All changes saved',
			{ timeout: 15000 }
		);
		expect(
			await rest.fetch( '/wp/v2/settings', {
				params: { _fields: 'title,description' },
			} )
		).toEqual( { description: tagline, title } );
	} );

	test( 'discards unsaved changes one at a time or all at once', async ( {
		page,
	} ) => {
		await visitEditor( page, '/design/identity' );

		const stage = getStage( page );
		const saveControls = getSaveControls( page );
		const siteName = stage.getByLabel( 'Site name' );
		const tagline = stage.getByLabel( 'Tagline' );

		await expect( siteName ).toBeEditable( { timeout: 15000 } );

		const savedName = await siteName.inputValue();
		const savedTagline = await tagline.inputValue();

		await siteName.fill( `Discarded name ${ Date.now() }` );
		await tagline.fill( `Discarded tagline ${ Date.now() }` );
		await expect( saveControls ).toContainText( '2 unsaved changes' );

		// One change, from the review.
		const review = await openReviewChanges( page );
		await review
			.getByRole( 'button', { name: 'Discard change to Site name' } )
			.click();
		await expect( siteName ).toHaveValue( savedName );
		await expect( review.getByRole( 'listitem' ) ).toHaveCount( 1 );

		// Discard all asks first, and Keep changes goes back to the list.
		const confirm = page.getByRole( 'dialog', {
			name: 'Discard changes?',
		} );
		await review.getByRole( 'button', { name: 'Discard all' } ).click();
		await confirm.getByRole( 'button', { name: 'Keep changes' } ).click();
		await expect( review.getByRole( 'listitem' ) ).toHaveCount( 1 );
		await page.keyboard.press( 'Escape' );
		await expect( review ).toHaveCount( 0 );

		// The rest, all at once.
		await openReviewChanges( page );
		await review.getByRole( 'button', { name: 'Discard all' } ).click();
		await confirm
			.getByRole( 'button', { name: 'Discard changes' } )
			.click();
		await expect( tagline ).toHaveValue( savedTagline );
		await expect( saveControls ).not.toContainText( 'unsaved' );
	} );
} );
