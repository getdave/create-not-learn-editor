const {
	expect,
	getEditorCanvas,
	expectCanvasMode,
	getPageItem,
	getSitePreview,
	getStage,
	setCanvasMode,
	test,
	visitEditor,
} = require( '../utils' );

test.describe( 'Pages view', () => {
	test( 'lists pages in and out of the main menu beside a preview', async ( {
		page,
		rest,
	} ) => {
		const testPage = await rest.createPage();

		await visitEditor( page, '/types/page' );

		const stage = getStage( page );

		await expect(
			stage.getByRole( 'heading', { level: 2, name: 'Pages' } )
		).toBeVisible();
		await expect(
			stage.getByRole( 'tab', { name: 'Pages' } )
		).toHaveAttribute( 'aria-selected', 'true' );
		await expect(
			stage.getByRole( 'region', {
				name: 'In your menu',
				exact: true,
			} )
		).toBeVisible( { timeout: 15000 } );
		await expect(
			stage.getByRole( 'region', { name: 'Not in your menu' } )
		).toBeVisible();
		await expect( getPageItem( page, testPage.title ) ).toBeVisible( {
			timeout: 15000,
		} );
		await expect(
			stage.getByRole( 'button', { name: `Edit ${ testPage.title }` } )
		).toBeAttached();
		await expect(
			stage.getByRole( 'button', { name: `Delete ${ testPage.title }` } )
		).toBeAttached();

		// The site is on show in Browse before any page is picked.
		await expect( getSitePreview( page ) ).toBeVisible( {
			timeout: 15000,
		} );
		await expectCanvasMode( page, 'Browse' );
	} );

	test( 'shows a page’s details, layout and sections', async ( {
		page,
		rest,
	} ) => {
		const testPage = await rest.createPage();

		await visitEditor(
			page,
			`/types/page/list/all?postId=${ testPage.id }`
		);

		const stage = getStage( page );

		await expect(
			stage
				.getByRole( 'navigation', { name: 'Breadcrumbs' } )
				.getByRole( 'link', { name: 'Pages' } )
		).toBeVisible( { timeout: 15000 } );
		await expect(
			stage.getByRole( 'heading', { level: 1, name: testPage.title } )
		).toBeVisible();
		await expect(
			stage.getByRole( 'button', { name: 'Page options' } )
		).toBeVisible();
		const layouts = stage
			.getByRole( 'region', { name: 'Layout' } )
			.getByRole( 'list', { name: 'Layouts' } );
		await expect(
			layouts.getByRole( 'button', { name: 'Standard' } )
		).toBeVisible();
		await expect(
			layouts.getByRole( 'button', { pressed: true } )
		).toHaveCount( 1 );

		// The page's sections are listed while composing it.
		await setCanvasMode( page, 'Compose' );

		// Its one paragraph is the only section that isn't on every page.
		const sections = stage.getByRole( 'list', {
			name: 'The page, top to bottom',
		} );
		await expect(
			sections.getByRole( 'button', {
				name: new RegExp( `^${ testPage.body }` ),
			} )
		).toBeVisible( { timeout: 15000 } );
		await expect(
			sections.locator( '.cnl-page-section:not(.is-template-element)' )
		).toHaveCount( 1 );

		await expect(
			getEditorCanvas( page, '.cnl-site-canvas' ).getByText(
				testPage.body
			)
		).toBeAttached( { timeout: 15000 } );
	} );

	test( 'lists page layouts on the Layouts tab', async ( { page } ) => {
		await visitEditor( page, '/types/page' );

		const stage = getStage( page );
		await stage.getByRole( 'tab', { name: 'Layouts' } ).click();

		await expect( page ).toHaveURL( /content%3Dtemplates/ );
		await expect(
			stage.getByText( /Layouts decide how your pages are arranged/ )
		).toBeVisible();
		await expect(
			stage.locator( '.routes-post-list__template-card' ).first()
		).toBeVisible( { timeout: 15000 } );
		await expect(
			stage.locator( '.routes-post-list__dataviews-toolbar' )
		).toHaveCount( 0 );
		await expect(
			stage.getByRole( 'button', { name: 'See all layouts.' } )
		).toBeVisible();
	} );
} );
