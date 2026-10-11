const {
	expect,
	expectBlockEditor,
	getEditorCanvas,
	test,
	visitEditor,
} = require( '../utils' );

test.describe( 'Block editor view', () => {
	test( 'loads page content and theme styles', async ( { page, rest } ) => {
		const testPage = await rest.createPage();

		await visitEditor( page, `/types/page/edit/${ testPage.id }` );
		await expectBlockEditor( page );

		const editorFrame = getEditorCanvas( page );
		await expect( editorFrame.getByText( testPage.body ) ).toBeVisible( {
			timeout: 15000,
		} );

		// Opening a page doesn't count as changing it.
		await expect
			.poll( () =>
				page.evaluate(
					( postId ) =>
						window.wp.data
							.select( window.wp.coreData.store )
							.hasEditsForEntityRecord(
								'postType',
								'page',
								postId
							),
					testPage.id
				)
			)
			.toBe( false );

		// Theme fonts reach the canvas, rather than the browser default.
		await expect
			.poll(
				() =>
					editorFrame
						.locator( 'body' )
						.evaluate(
							( body ) =>
								window.getComputedStyle( body ).fontFamily
						),
				{ timeout: 15000 }
			)
			.not.toContain( 'Times New Roman' );
	} );
} );
