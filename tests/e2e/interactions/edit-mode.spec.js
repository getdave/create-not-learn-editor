/**
 * The site canvas's Edit mode: nothing on the page can be clicked until a
 * section's way of editing is picked from the bar over it, or the section
 * is double-clicked. Edit content
 * changes its words, and Edit design drills into its layouts, colours and
 * width in the bar over it, and More control, which unlocks it with core's
 * own unlock.
 */
const {
	expect,
	getCanvasEditor,
	pickSectionMode,
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
	test( 'words change only once Edit content is picked', async ( {
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
		const inside = canvas.getByText( 'Inside a section' );

		// Before a mode is picked, a click selects nothing.
		await inside.click();
		await expect.poll( () => getSelection( page ) ).toBe( '' );

		// Words inside a section can be changed, its blocks can't.
		await pickSectionMode( page, inside, 'Edit content' );
		await expect(
			page.locator( '.cnl-section-modes__mode-bar' )
		).toHaveAttribute( 'aria-label', 'Edit content' );
		await inside.click();
		await expect
			.poll( () => getSelection( page ) )
			.toBe( 'core/paragraph contentOnly' );
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ' changed' );
		await expect(
			canvas.getByText( 'Inside a section changed' )
		).toBeVisible();

		// Core's toolbar offers Remove for a block in the section, and the
		// small bar's Restore puts it back. Core hides its toolbar while
		// typing, until the pointer moves over the page.
		const typed = await canvas
			.getByText( 'Inside a section changed' )
			.boundingBox();

		await page.mouse.move( typed.x + 5, typed.y + 5 );
		await page.mouse.move( typed.x + 15, typed.y + 8 );
		await page
			.locator( '.block-editor-block-contextual-toolbar' )
			.getByRole( 'button', { name: 'Remove' } )
			.click();
		await expect(
			canvas.getByText( 'Inside a section changed' )
		).toHaveCount( 0 );
		await page
			.locator( '.cnl-section-modes__mode-bar' )
			.getByRole( 'button', { name: /^Restore/ } )
			.click();
		await expect(
			canvas.getByText( 'Inside a section changed' )
		).toBeVisible();

		// A click on another section leaves the mode.
		const own = canvas.getByText( 'A section of its own' );

		await own.click();
		await expect(
			page.locator( '.cnl-section-modes__mode-bar' )
		).toHaveCount( 0 );
		await expect.poll( () => getSelection( page ) ).toBe( '' );

		// A section that is a single block keeps all its tools.
		await pickSectionMode( page, own, 'Edit content' );
		await own.click();
		await expect
			.poll( () => getSelection( page ) )
			.toBe( 'core/paragraph default' );
		// Core hides the toolbar while typing, until the pointer moves.
		await page.mouse.move( 10, 10 );
		await expect(
			getBlockToolbar( page ).getByRole( 'button', { name: 'Bold' } )
		).toBeVisible();

		// Escape leaves the mode, typing or not.
		await page.keyboard.press( 'Escape' );
		await expect(
			page.locator( '.cnl-section-modes__mode-bar' )
		).toHaveCount( 0 );

		// The section stays picked, its bar showing with the pointer away,
		// until Escape again.
		const bar = page.locator( '.cnl-section-modes__bar' );

		await page.mouse.move( 0, 0 );
		await expect( bar ).toBeVisible();
		await expect( page.locator( '.cnl-section-modes__tint' ) ).toHaveClass(
			/is-picked/
		);
		await page.keyboard.press( 'Escape' );
		await expect( bar ).toHaveCount( 0 );
	} );

	test( 'a double click opens Edit content with the caret there', async ( {
		page,
		rest,
	} ) => {
		await openPage( page, rest, {
			content:
				'<!-- wp:group {"style":{"spacing":{"padding":{"top":"160px","bottom":"160px"}}},"layout":{"type":"constrained"}} --><div class="wp-block-group" style="padding-top:160px;padding-bottom:160px"><!-- wp:paragraph --><p>Double click me</p><!-- /wp:paragraph --></div><!-- /wp:group -->',
		} );
		await setCanvasMode( page, 'Edit' );

		const canvas = getCanvasEditor( page ).contentFrame();
		const words = canvas.getByText( 'Double click me' );

		await expect( words ).toBeVisible( { timeout: 15000 } );

		// On the words themselves, clear of the bar at the section's top.
		const box = await words.boundingBox();

		// Pointed at until the section lights up, once the canvas is ready.
		await expect( async () => {
			await page.mouse.move( 0, 0 );
			await page.mouse.move( box.x + 10, box.y + box.height / 2 );
			await expect(
				page.locator( '.cnl-section-modes__bar' )
			).toBeVisible( { timeout: 1000 } );
		} ).toPass( { timeout: 15000 } );

		// Measured again, as the page may have settled since.
		const settled = await words.boundingBox();

		await page.mouse.dblclick(
			settled.x + 10,
			settled.y + settled.height / 2
		);
		await expect(
			page.locator( '.cnl-section-modes__mode-bar' )
		).toHaveAttribute( 'aria-label', 'Edit content' );
		await expect
			.poll( () => getSelection( page ) )
			.toBe( 'core/paragraph contentOnly' );
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ', then type' );
		await expect(
			canvas.getByText( 'Double click me, then type' )
		).toBeVisible();
	} );

	test( 'Add puts a block last in the section, ready to type in', async ( {
		page,
		rest,
	} ) => {
		await openPage( page, rest, {
			content:
				'<!-- wp:group {"style":{"spacing":{"padding":{"top":"160px","bottom":"160px"}}},"layout":{"type":"constrained"}} --><div class="wp-block-group" style="padding-top:160px;padding-bottom:160px"><!-- wp:group {"layout":{"type":"constrained"}} --><div class="wp-block-group"><!-- wp:paragraph --><p>First words</p><!-- /wp:paragraph --></div><!-- /wp:group --></div><!-- /wp:group -->',
		} );
		await setCanvasMode( page, 'Edit' );

		const canvas = getCanvasEditor( page ).contentFrame();
		const words = canvas.getByText( 'First words' );
		const bar = page.locator( '.cnl-section-modes__bar' );

		await expect( words ).toBeVisible( { timeout: 15000 } );
		await expect( async () => {
			await page.mouse.move( 0, 0 );
			await words.hover( { force: true } );
			await expect( bar ).toBeVisible( { timeout: 1000 } );
		} ).toPass( { timeout: 15000 } );
		await bar.getByRole( 'button', { name: 'Add', exact: true } ).click();
		await page.getByRole( 'menuitem', { name: 'Heading' } ).click();

		// Straight into Edit content, with the caret in the new heading.
		await expect(
			page.locator( '.cnl-section-modes__mode-bar' )
		).toHaveAttribute( 'aria-label', 'Edit content' );
		await page.keyboard.type( 'Added last' );
		await expect( canvas.getByText( 'Added last' ) ).toBeVisible();

		// Last, inside the group that wraps the section's words.
		await expect
			.poll( () =>
				page.evaluate( () => {
					const store = window.wp.data.select( 'core/block-editor' );
					const [ root ] =
						store.getBlocksByName( 'core/post-content' );
					const [ section ] = store.getBlocks( root );

					return section.innerBlocks[ 0 ].innerBlocks.map(
						( block ) => block.name
					);
				} )
			)
			.toEqual( [ 'core/paragraph', 'core/heading' ] );
	} );

	test( 'a section added from the picker is picked', async ( {
		page,
		rest,
	} ) => {
		await openPage( page, rest, {
			content:
				'<!-- wp:group {"style":{"spacing":{"padding":{"top":"160px","bottom":"160px"}}},"layout":{"type":"constrained"}} --><div class="wp-block-group" style="padding-top:160px;padding-bottom:160px"><!-- wp:paragraph --><p>Existing section</p><!-- /wp:paragraph --></div><!-- /wp:group -->',
		} );
		await setCanvasMode( page, 'Edit' );

		const words = getCanvasEditor( page )
			.contentFrame()
			.getByText( 'Existing section' );
		const addSection = page.locator( '.cnl-section-modes__add-section' );

		await expect( words ).toBeVisible( { timeout: 15000 } );
		await expect( async () => {
			await page.mouse.move( 0, 0 );
			await words.hover( { force: true } );
			await expect( addSection.last() ).toBeVisible( { timeout: 1000 } );
		} ).toPass( { timeout: 15000 } );
		await addSection.last().click();

		const picker = page.getByRole( 'dialog', { name: 'Add a section' } );

		await picker.getByText( 'Layouts', { exact: true } ).click();
		await picker
			.getByRole( 'button', {
				name: 'Add Image left, text right',
				exact: true,
			} )
			.click();

		// Picked: outlined, named and with its bar, the pointer elsewhere.
		await page.mouse.move( 0, 0 );
		await expect( page.locator( '.cnl-section-modes__tab' ) ).toHaveText(
			'Image left, text right'
		);
		await expect( page.locator( '.cnl-section-modes__tint' ) ).toHaveClass(
			/is-picked/
		);
		await expect( page.locator( '.cnl-section-modes__bar' ) ).toBeVisible();
	} );

	test( 'Edit design drills into layouts, and More control', async ( {
		page,
		rest,
	} ) => {
		await openPage( page, rest, { content: EMPTY_PAGE } );
		await setCanvasMode( page, 'Edit' );

		// Add a layout from the empty page's placeholder.
		await page
			.locator( '.cnl-section-modes__empty' )
			.getByRole( 'button', { name: 'Add a section' } )
			.click( { timeout: 15000 } );

		const picker = page.getByRole( 'dialog', { name: 'Add a section' } );

		await picker.getByText( 'Layouts', { exact: true } ).click();
		await picker
			.getByRole( 'button', {
				name: 'Add Image left, text right',
				exact: true,
			} )
			.click();

		const modeBar = page.locator( '.cnl-section-modes__mode-bar' );

		const section = getCanvasEditor( page )
			.contentFrame()
			.locator( '.is-root-container .wp-block-post-content > *' )
			.first();

		await pickSectionMode( page, section, 'Edit design' );

		const designBar = page.locator( '.cnl-section-modes__design' );
		const options = designBar.locator( '.cnl-section-modes__option' );

		await expect( designBar ).toBeVisible();

		// Layout opens the layouts in a tray, and a pick goes in at once.
		await designBar
			.getByRole( 'button', { name: 'Layout', exact: true } )
			.click();
		await expect( options.nth( 1 ) ).toBeVisible();

		const other = designBar.locator(
			'.cnl-section-modes__option[aria-pressed="false"]:not([inert])'
		);
		const otherName = await other.first().getAttribute( 'title' );

		await other.first().click();
		await expect(
			options.filter( { hasText: otherName } )
		).toHaveAttribute( 'aria-pressed', 'true' );

		// Escape steps back to the choices.
		await page.keyboard.press( 'Escape' );
		await expect( options ).toHaveCount( 0 );
		await expect(
			designBar.getByRole( 'button', { name: 'Layout', exact: true } )
		).toBeVisible();

		// A click off the bar leaves Edit design, the layout kept.
		await page.locator( '.cnl-editor-homepage-toolbar' ).click( {
			position: { x: 4, y: 4 },
		} );
		await expect( designBar ).toHaveCount( 0 );

		// More control is core's unlock, with none of its colour shuffle.
		await pickSectionMode( page, section, 'Edit design' );
		await designBar
			.getByRole( 'button', { name: 'More control', exact: true } )
			.click();
		await expect( designBar ).toHaveCount( 0 );
		await expect( modeBar ).toHaveAttribute( 'aria-label', 'Freeform' );

		// Its blocks take core's full tools, not only their words.
		await section.locator( 'p' ).first().click();
		await expect
			.poll( () => getSelection( page ) )
			.toBe( 'core/paragraph default' );
		await expect(
			getBlockToolbar( page ).getByRole( 'button', {
				name: 'Shuffle styles',
			} )
		).toBeHidden();

		// Done leaves it altogether: there is no way back to Edit design.
		await expect(
			modeBar.getByRole( 'button', { name: /^Back/ } )
		).toHaveCount( 0 );
		await modeBar.getByRole( 'button', { name: 'Done editing' } ).click();
		await expect( modeBar ).toHaveCount( 0 );
		await expect( designBar ).toHaveCount( 0 );
	} );

	test( 'an empty page offers a section or a blank start', async ( {
		page,
		rest,
	} ) => {
		await openPage( page, rest, { content: EMPTY_PAGE } );
		await setCanvasMode( page, 'Edit' );

		const placeholder = page.locator( '.cnl-section-modes__empty' );

		await expect( placeholder ).toBeVisible( { timeout: 15000 } );

		// Add a section opens the picker.
		await placeholder
			.getByRole( 'button', { name: 'Add a section' } )
			.click();

		const picker = page.getByRole( 'dialog', { name: 'Add a section' } );

		await expect( picker ).toBeVisible();
		await page.keyboard.press( 'Escape' );
		await expect( picker ).toBeHidden();

		// Start blank adds a section to type into straight away.
		await placeholder
			.getByRole( 'button', { name: 'Start blank' } )
			.click();
		await expect( placeholder ).toHaveCount( 0 );
		await expect(
			page.locator( '.cnl-section-modes__mode-bar' )
		).toHaveAttribute( 'aria-label', 'Edit content' );
		await page.keyboard.type( 'Words on a blank page' );
		await expect(
			getCanvasEditor( page )
				.contentFrame()
				.getByText( 'Words on a blank page' )
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
