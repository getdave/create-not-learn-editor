/**
 * The site canvas's Edit mode: sections start content-only, with the same
 * Layout and Color controls as Compose, and "Edit" on their toolbar unlocks
 * them.
 */
const {
	expect,
	getCanvasEditor,
	setCanvasMode,
	test,
	visitEditor,
} = require( '../utils' );

// A page with no blocks. The REST helper fills in a paragraph for no content.
const EMPTY_PAGE = ' ';

async function openPage( page, rest, options = {} ) {
	const testPage = await rest.createPage( options );

	await visitEditor(
		page,
		`/types/page/list/all?previewId=${ testPage.id }`
	);
	await expect(
		page.locator( '.cnl-editor-homepage-document__title' )
	).toHaveText( testPage.title, { timeout: 15000 } );

	return testPage;
}

/**
 * The selected block's name and editing mode, from the block editor.
 *
 * @param {import('@playwright/test').Page} page
 * @return {Promise<string>} `name mode`.
 */
function getSelection( page ) {
	return page.evaluate( () => {
		const store = window.wp.data.select( 'core/block-editor' );
		const clientId = store.getSelectedBlockClientId();

		return clientId
			? `${ store.getBlockName( clientId ) } ${ store.getBlockEditingMode(
					clientId
				) }`
			: '';
	} );
}

function getBlockToolbar( page ) {
	return page.locator( '.block-editor-block-contextual-toolbar' );
}

test.describe( 'Edit mode', () => {
	test( 'sections made of blocks start content-only; single blocks don’t', async ( {
		page,
		rest,
	} ) => {
		await openPage( page, rest, {
			content:
				'<!-- wp:group {"layout":{"type":"constrained"}} --><div class="wp-block-group"><!-- wp:paragraph --><p>Inside a section</p><!-- /wp:paragraph --></div><!-- /wp:group -->' +
				'<!-- wp:paragraph --><p>A section of its own</p><!-- /wp:paragraph -->',
		} );
		await setCanvasMode( page, 'Edit' );

		const canvas = getCanvasEditor( page ).contentFrame();

		// Words inside a section can be changed, its blocks can't.
		await canvas.getByText( 'Inside a section' ).click();
		await expect
			.poll( () => getSelection( page ) )
			.toBe( 'core/paragraph contentOnly' );
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ' changed' );
		await expect(
			canvas.getByText( 'Inside a section changed' )
		).toBeVisible();

		// A section that is a single block keeps all its tools.
		await canvas.getByText( 'A section of its own' ).click();
		await expect
			.poll( () => getSelection( page ) )
			.toBe( 'core/paragraph default' );
		// Core hides the toolbar while typing, until the pointer moves.
		await page.mouse.move( 10, 10 );
		await expect(
			getBlockToolbar( page ).getByRole( 'button', { name: 'Bold' } )
		).toBeVisible();
	} );

	test( 'a section’s toolbar offers Layout, and Edit unlocks it', async ( {
		page,
		rest,
	} ) => {
		await openPage( page, rest, { content: EMPTY_PAGE } );

		// Add a layout from Compose, then open it in Edit.
		await setCanvasMode( page, 'Compose' );
		await page
			.locator( '.cnl-compose-layer__add' )
			.getByRole( 'button', { name: 'Add a section' } )
			.click();

		const picker = page.getByRole( 'dialog', { name: 'Add a section' } );

		await picker.getByText( 'Layouts', { exact: true } ).click();
		await picker
			.getByRole( 'button', {
				name: 'Add Image left, text right',
				exact: true,
			} )
			.click();
		await page
			.locator( '.cnl-compose-toolbar' )
			.getByRole( 'button', { name: 'Edit', exact: true } )
			.click();

		const toolbar = getBlockToolbar( page );

		await expect( toolbar ).toBeVisible( { timeout: 15000 } );
		await expect(
			toolbar.getByRole( 'button', { name: 'Layout' } )
		).toBeVisible();
		// Core's own colour shuffle gives way to Color.
		await expect(
			toolbar.getByRole( 'button', { name: 'Shuffle styles' } )
		).toBeHidden();

		await toolbar
			.getByRole( 'button', { name: 'Edit', exact: true } )
			.click();
		await expect(
			toolbar.getByRole( 'button', { name: 'Done', exact: true } )
		).toBeVisible();

		await toolbar
			.getByRole( 'button', { name: 'Done', exact: true } )
			.click();
		await expect(
			toolbar.getByRole( 'button', { name: 'Edit', exact: true } )
		).toBeVisible();
	} );

	test( 'leaving Edit puts the sections back as they were', async ( {
		page,
		rest,
	} ) => {
		await openPage( page, rest, {
			content:
				'<!-- wp:group {"layout":{"type":"constrained"}} --><div class="wp-block-group"><!-- wp:paragraph --><p>Inside a section</p><!-- /wp:paragraph --></div><!-- /wp:group -->',
		} );

		const getLocks = () =>
			page.evaluate( () => {
				const store = window.wp.data.select( 'core/block-editor' );
				const [ root ] = store.getBlocksByName( 'core/post-content' );

				return store
					.getBlockOrder( root )
					.map(
						( clientId ) =>
							store.getBlockListSettings( clientId )
								?.templateLock ?? null
					);
			} );

		await setCanvasMode( page, 'Edit' );
		await expect.poll( getLocks ).toEqual( [ 'contentOnly' ] );

		await setCanvasMode( page, 'Compose' );
		await expect.poll( getLocks ).not.toEqual( [ 'contentOnly' ] );

		// Locking never counts as a change to the page.
		await expect( page.getByText( /unsaved change/ ) ).toHaveCount( 0 );
	} );
} );
