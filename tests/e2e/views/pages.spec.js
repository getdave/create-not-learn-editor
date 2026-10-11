const {
	expect,
	getEditorCanvas,
	getPreviewSwitch,
	getQuickEditor,
	getStage,
	test,
	visitEditor,
} = require( '../utils' );

test.describe( 'Pages view', () => {
	test( 'lists pages as a tree beside a preview', async ( {
		page,
		rest,
	} ) => {
		const testPage = await rest.createPage();

		await visitEditor( page, '/types/page' );

		const stage = getStage( page );
		const tree = stage.getByRole( 'list', { name: 'Pages' } );

		await expect(
			stage.getByRole( 'heading', { level: 2, name: 'Pages' } )
		).toBeVisible();
		await expect(
			stage.getByRole( 'tab', { name: 'Pages' } )
		).toHaveAttribute( 'aria-selected', 'true' );
		await expect(
			tree.getByRole( 'button', { name: testPage.title, exact: true } )
		).toBeVisible( { timeout: 15000 } );
		await expect(
			tree.getByRole( 'button', { name: `Edit ${ testPage.title }` } )
		).toBeVisible();
		await expect(
			tree.getByRole( 'button', { name: `Delete ${ testPage.title }` } )
		).toBeVisible();

		// A page is open for quick edits before any page is picked.
		await expect( getQuickEditor( page ) ).toBeVisible( {
			timeout: 15000,
		} );
		await expect( getPreviewSwitch( page ) ).not.toBeChecked();
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
			sections.locator( '.cnl-page-section:not(.is-site-part)' )
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
