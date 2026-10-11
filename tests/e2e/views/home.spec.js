const {
	expect,
	getPreviewSwitch,
	getQuickEditor,
	getSitePreview,
	test,
	visitEditor,
	writeParityScreenshot,
} = require( '../utils' );

test.describe( 'Home view', () => {
	test.beforeEach( async ( { page } ) => {
		await visitEditor( page );
	} );

	test( 'shows the steps to create your site', async ( { page } ) => {
		await expect(
			page.getByRole( 'heading', { level: 1, name: 'Your site' } )
		).toBeVisible();
		await expect(
			page.getByRole( 'link', { name: /View site/ } )
		).toHaveAttribute( 'target', '_blank' );

		const steps = page.getByRole( 'list', {
			name: 'Steps to create your site',
		} );
		await expect( steps.getByRole( 'listitem' ) ).toHaveCount( 5 );
		for ( const step of [
			'Name & logo',
			'Colors',
			'Fonts',
			'Your homepage',
			'Pages & menu',
		] ) {
			await expect(
				steps.getByRole( 'button', {
					name: new RegExp( `^${ step }` ),
				} )
			).toBeVisible();
		}
	} );

	test( 'opens the homepage for quick edits', async ( { page } ) => {
		await page.setViewportSize( { height: 1003, width: 2048 } );

		const toolbar = page.locator( '.cnl-editor-homepage-toolbar' );
		const document = toolbar.locator( '.cnl-editor-homepage-document' );

		await expect( getQuickEditor( page ) ).toBeVisible( {
			timeout: 15000,
		} );
		await expect( getSitePreview( page ) ).toBeHidden();
		await expect( getPreviewSwitch( page ) ).not.toBeChecked();
		await expect(
			toolbar.getByRole( 'button', { name: 'Edit', exact: true } )
		).toBeEnabled( { timeout: 15000 } );
		// History is only for moving around the preview.
		await expect(
			toolbar.getByRole( 'group', { name: 'Preview history' } )
		).toHaveCount( 0 );
		await expect(
			toolbar.getByRole( 'radio', { name: 'Desktop view' } )
		).toBeChecked();
		await expect(
			document.getByRole( 'heading', { level: 1, name: 'Home' } )
		).toBeVisible();
		await expect(
			document.locator( '.cnl-editor-homepage-document__icon' )
		).toHaveCount( 1 );

		await writeParityScreenshot(
			page.locator( 'body' ),
			'homepage-parity',
			'plugin-homepage-full.png'
		);
		await writeParityScreenshot(
			toolbar.locator( '.cnl-editor-homepage-toolbar__left' ),
			'homepage-parity',
			'plugin-homepage-left-controls.png'
		);
		await writeParityScreenshot(
			toolbar.locator( '.cnl-editor-homepage-toolbar__center' ),
			'homepage-parity',
			'plugin-homepage-title-controls.png'
		);
		await writeParityScreenshot(
			toolbar.locator( '.cnl-editor-homepage-toolbar__right' ),
			'homepage-parity',
			'plugin-homepage-device-controls.png'
		);
	} );
} );
