const {
	expect,
	test,
	visitEditor,
	writeParityScreenshot,
} = require( '../utils' );

test.describe( 'Add a page view', () => {
	let picker;

	test.beforeEach( async ( { page } ) => {
		await visitEditor( page, '/types/page' );
		await page.getByRole( 'button', { name: 'Add page' } ).click();

		picker = page.getByRole( 'dialog', { name: 'Add a page' } );
		await expect( picker ).toBeVisible();
		await expect(
			picker.locator( '.cnl-add-page-layout-card' ).first()
		).toBeVisible( { timeout: 15000 } );
	} );

	test( 'offers page designs by type', async () => {
		expect( ( await picker.boundingBox() )?.width ).toBeGreaterThan( 680 );
		await expect(
			picker.getByRole( 'button', { name: /Start from scratch/ } )
		).toBeVisible();
		await expect(
			picker
				.getByRole( 'navigation', { name: 'Page types' } )
				.getByRole( 'button' )
				.first()
		).toHaveAttribute( 'aria-current', 'true' );
		await expect(
			picker.getByRole( 'radio', { name: 'Medium previews' } )
		).toBeChecked();
		await expect(
			picker.getByText( /No page designs are available/ )
		).toHaveCount( 0 );

		await writeParityScreenshot(
			picker,
			'add-page-parity',
			'choose-page-design-picker.png'
		);
	} );

	test( 'shows designs on the same cards as sections', async () => {
		const card = picker.locator( '.cnl-add-page-layout-card' ).first();

		await expect( card ).toHaveClass( /cnl-design-picker__card/ );
		await expect(
			card.getByRole( 'button', { name: 'Use design' } )
		).toBeVisible();

		// The corner radius comes from the design system token.
		await expect
			.poll( () =>
				card.evaluate( ( element ) => {
					const styles = window.getComputedStyle( element );
					const token = styles
						/* eslint-disable-next-line @wordpress/no-unknown-ds-tokens -- Reading the token value at runtime, not authoring a style. */
						.getPropertyValue( '--wpds-border-radius-lg' )
						.trim();

					return !! token && styles.borderTopLeftRadius === token;
				} )
			)
			.toBe( true );
	} );

	test( 'scrolls each design preview on its own', async () => {
		const preview = picker
			.locator( '.cnl-add-page-layout-preview-page' )
			.first();

		await expect( preview ).toHaveCSS( 'overflow-y', 'auto' );
		await expect
			.poll( () =>
				preview.evaluate(
					( element ) => element.scrollHeight > element.clientHeight
				)
			)
			.toBe( true );
	} );

	test( 'names the page in a modal the same size as the picker', async ( {
		page,
	} ) => {
		const pickerWidth = ( await picker.boundingBox() )?.width;

		await picker
			.locator( '.cnl-add-page-layout-card' )
			.first()
			.getByRole( 'button', { name: 'Use design' } )
			.click();

		const form = page.getByRole( 'dialog', { name: 'Name your page' } );
		await expect( form ).toBeVisible();
		expect( ( await form.boundingBox() )?.width ).toBe( pickerWidth );

		await expect( form.getByLabel( 'Page title' ) ).toBeVisible();
		await expect(
			form.getByRole( 'checkbox', { name: 'Publish immediately' } )
		).toBeChecked();
		await expect(
			form.getByText(
				'Your page will be visible to visitors immediately.'
			)
		).toBeVisible();

		const layout = form.getByLabel( 'Layout', { exact: true } );
		await expect( layout ).toHaveValue( '' );
		await expect( layout ).toContainText( 'Standard layout' );
		expect(
			await layout.locator( 'option' ).allTextContents()
		).not.toContain( 'Page' );

		// Back sits before Create.
		const backBox = await form
			.getByRole( 'button', { name: 'Back to designs' } )
			.boundingBox();
		const createBox = await form
			.getByRole( 'button', { name: 'Create page' } )
			.boundingBox();
		expect( createBox.x ).toBeGreaterThan( backBox.x );

		await writeParityScreenshot(
			form,
			'add-page-parity',
			'add-page-design-form.png'
		);
	} );
} );
