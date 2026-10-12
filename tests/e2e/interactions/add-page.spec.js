const {
	expect,
	getFrameTexts,
	getStage,
	setCanvasMode,
	test,
	visitEditor,
} = require( '../utils' );

/**
 * How many columns the design grid has.
 *
 * @param {import('@playwright/test').Locator} picker The Add a page dialog.
 * @return {Promise<number>} The column count.
 */
function getGridColumnCount( picker ) {
	return picker
		.locator( '.cnl-add-page-layout-grid' )
		.first()
		.evaluate(
			( element ) =>
				window
					.getComputedStyle( element )
					.gridTemplateColumns.split( ' ' ).length
		);
}

test.describe( 'Add a page interactions', () => {
	let picker;

	test.beforeEach( async ( { page } ) => {
		await visitEditor( page, '/types/page' );
		await page.getByRole( 'button', { name: 'Add Page' } ).click();

		picker = page.getByRole( 'dialog', { name: 'Add a page' } );
		await expect(
			picker.locator( '.cnl-add-page-layout-card' ).first()
		).toBeVisible( { timeout: 15000 } );
	} );

	test( 'picking a page type shows its designs', async () => {
		const pageTypes = picker
			.getByRole( 'navigation', { name: 'Page types' } )
			.getByRole( 'button' );
		const secondType = pageTypes.nth( 1 );
		const secondTypeName = ( await secondType.innerText() ).trim();

		await secondType.click();

		await expect( secondType ).toHaveAttribute( 'aria-current', 'true' );
		await expect( pageTypes.first() ).not.toHaveAttribute(
			'aria-current',
			'true'
		);
		await expect(
			picker.getByRole( 'heading', { level: 3, name: secondTypeName } )
		).toBeVisible();
	} );

	test( 'preview size changes how many designs fit across', async () => {
		await expect.poll( () => getGridColumnCount( picker ) ).toBe( 2 );

		await picker.getByRole( 'radio', { name: 'Large previews' } ).click();
		await expect.poll( () => getGridColumnCount( picker ) ).toBe( 1 );
		await expect(
			picker.locator( '.cnl-add-page-layout-card' )
		).toHaveCount( 1 );

		await picker.getByRole( 'radio', { name: 'Small previews' } ).click();
		await expect.poll( () => getGridColumnCount( picker ) ).toBe( 3 );

		await picker.getByRole( 'radio', { name: 'Medium previews' } ).click();
		await expect.poll( () => getGridColumnCount( picker ) ).toBe( 2 );
	} );

	test( 'scrolls a design preview without scrolling the rest', async () => {
		const preview = picker
			.locator( '.cnl-add-page-layout-preview-page' )
			.first();

		// Designs load in, so wait until there is something to scroll.
		await expect
			.poll( () =>
				preview.evaluate(
					( element ) => element.scrollHeight > element.clientHeight
				)
			)
			.toBe( true );
		await preview.evaluate( ( element ) => {
			element.scrollTop = 200;
		} );
		await expect
			.poll( () => preview.evaluate( ( element ) => element.scrollTop ) )
			.toBeGreaterThan( 0 );
	} );

	test( 'the page title shows in the design preview as it is typed', async ( {
		page,
	} ) => {
		await picker
			.locator( '.cnl-add-page-layout-card' )
			.first()
			.getByRole( 'button', { name: 'Use design' } )
			.click();

		const form = page.getByRole( 'dialog', { name: 'Name your page' } );
		const title = `Preview title ${ Date.now() }`;

		await form.getByLabel( 'Page title' ).fill( title );
		await expect
			.poll(
				async () =>
					(
						await getFrameTexts(
							page,
							'.cnl-add-page-form__preview iframe'
						)
					).some( ( text ) => text.includes( title ) ),
				{ timeout: 20000 }
			)
			.toBe( true );

		// Back to designs keeps the picker open.
		await form.getByRole( 'button', { name: 'Back to designs' } ).click();
		await expect( picker ).toBeVisible();
		await expect( form ).toHaveCount( 0 );
	} );

	test( 'starting from scratch makes a page and opens it', async ( {
		page,
		rest,
	} ) => {
		await picker
			.getByRole( 'button', { name: /Start from scratch/ } )
			.click();

		const form = page.getByRole( 'dialog', { name: 'Name your page' } );
		const title = `Blank page ${ Date.now() }`;

		await form.getByLabel( 'Page title' ).fill( title );
		await form.getByRole( 'button', { name: 'Create page' } ).click();

		await expect( page ).toHaveURL(
			/p=.*%2Ftypes%2Fpage%2Flist%2Fall.*postId%3D\d+/,
			{ timeout: 15000 }
		);
		const pageId = decodeURIComponent( page.url() ).match(
			/postId=(\d+)/
		)[ 1 ];
		rest.deleteLater( `/wp/v2/pages/${ pageId }` );

		const stage = getStage( page );
		await expect(
			stage.getByRole( 'heading', { level: 1, name: title } )
		).toBeVisible( { timeout: 15000 } );
		// A new page is empty, ready for its first section in Compose.
		await setCanvasMode( page, 'Compose' );
		await expect(
			stage
				.getByRole( 'region', { name: 'Sections' } )
				.getByText( /^Nothing here yet/ )
		).toBeVisible();
		await expect(
			page.getByText( 'This page has no sections yet' )
		).toBeVisible();
	} );
} );
