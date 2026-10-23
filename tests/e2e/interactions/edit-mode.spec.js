/**
 * The site canvas's Edit mode: a section is worked on a click at a time.
 * The first click picks it, a click on a row of cards opens the row, and
 * the next reaches a block, the caret in its text. A double click goes
 * straight to the text. Edit design drills into its layouts, colours and
 * width in the bar over it, and More control, which unlocks it with core's
 * own unlock.
 */
const {
	clickIntoSection,
	expect,
	getCanvasEditor,
	pickSectionMode,
	pickSectionTemplate,
	setCanvasMode,
	test,
	visitEditor,
} = require( '../utils' );

// Near the start of some words, clear of "Add section" in the middle of a
// short section's edges.
const START = { position: { x: 8, y: 8 } };

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
	test( 'the first click picks a section, the next reaches its words', async ( {
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
		const layer = page.locator( '.cnl-section-modes' );
		const bar = page.locator( '.cnl-section-modes__bar' );

		// The first click picks the section, and selects nothing.
		await expect( async () => {
			await inside.click( START );
			await expect( layer ).toHaveAttribute( 'data-level', 'section', {
				timeout: 1000,
			} );
		} ).toPass( { timeout: 15000 } );
		await expect.poll( () => getSelection( page ) ).toBe( '' );

		// The next reaches its words, which can be changed; its blocks can't.
		await clickIntoSection( page, inside );
		await expect
			.poll( () => getSelection( page ) )
			.toBe( 'core/paragraph contentOnly' );
		await page.keyboard.press( 'End' );
		await page.keyboard.type( ' changed' );
		await expect(
			canvas.getByText( 'Inside a section changed' )
		).toBeVisible();

		// The section's bar stays, with Edit design and no Edit content.
		await expect(
			bar.getByRole( 'button', { name: 'Edit design' } )
		).toBeVisible();
		await expect(
			bar.getByRole( 'button', { name: 'Edit content' } )
		).toHaveCount( 0 );

		// Core's toolbar offers Remove for a block in the section, and undo
		// puts it back. Core hides its toolbar while typing, until the
		// pointer moves over the page.
		const typed = await canvas
			.getByText( 'Inside a section changed' )
			.boundingBox();

		await page.mouse.move( typed.x + 5, typed.y + 5 );
		await page.mouse.move( typed.x + 15, typed.y + 8 );
		await getBlockToolbar( page )
			.getByRole( 'button', { name: 'Remove' } )
			.click();
		await expect(
			canvas.getByText( 'Inside a section changed' )
		).toHaveCount( 0 );
		await page.keyboard.press( 'ControlOrMeta+z' );
		await expect(
			canvas.getByText( 'Inside a section changed' )
		).toBeVisible();

		// A click on another section picks it instead.
		const own = canvas.getByText( 'A section of its own' );

		await own.click( START );
		await expect( layer ).toHaveAttribute( 'data-level', 'section' );
		await expect.poll( () => getSelection( page ) ).toBe( '' );

		// A section that is a single block keeps all its tools.
		await clickIntoSection( page, own );
		await expect
			.poll( () => getSelection( page ) )
			.toBe( 'core/paragraph default' );
		// Core hides the toolbar while typing, until the pointer moves.
		await page.mouse.move( 10, 10 );
		await expect(
			getBlockToolbar( page ).getByRole( 'button', { name: 'Bold' } )
		).toBeVisible();

		// Escape steps back to the section, still picked, its bar showing
		// with the pointer away, then Escape again un-picks it.
		await page.keyboard.press( 'Escape' );
		await expect( layer ).toHaveAttribute( 'data-level', 'section' );
		await page.mouse.move( 0, 0 );
		await expect( bar ).toBeVisible();
		await expect( page.locator( '.cnl-section-modes__tint' ) ).toHaveClass(
			/is-picked/
		);
		await page.keyboard.press( 'Escape' );
		await expect( bar ).toHaveCount( 0 );
	} );

	test( 'a row of cards opens on the second click, its words on the third', async ( {
		page,
		rest,
	} ) => {
		const card = ( words ) =>
			`<!-- wp:column --><div class="wp-block-column"><!-- wp:heading {"level":3} --><h3 class="wp-block-heading">${ words }</h3><!-- /wp:heading --><!-- wp:paragraph --><p>About ${ words }</p><!-- /wp:paragraph --></div><!-- /wp:column -->`;

		await openPage( page, rest, {
			content: `<!-- wp:group {"style":{"spacing":{"padding":{"top":"120px","bottom":"120px"}}},"layout":{"type":"constrained"}} --><div class="wp-block-group" style="padding-top:120px;padding-bottom:120px"><!-- wp:columns --><div class="wp-block-columns">${ [
				'Card one',
				'Card two',
				'Card three',
			]
				.map( card )
				.join(
					''
				) }</div><!-- /wp:columns --></div><!-- /wp:group -->`,
		} );
		await setCanvasMode( page, 'Edit' );

		const canvas = getCanvasEditor( page ).contentFrame();
		const words = canvas.getByText( 'Card two', { exact: true } );
		const layer = page.locator( '.cnl-section-modes' );
		// The page's own section, not the theme's header and footer.
		const getSection = () =>
			page.evaluate( () => {
				const store = window.wp.data.select( 'core/block-editor' );
				const [ root ] = store.getBlocksByName( 'core/post-content' );
				const [ section ] = store.getBlocks( root );
				const [ row ] = section.innerBlocks;

				return {
					columnCount: row.attributes.layout?.columnCount,
					count: row.innerBlocks.length,
					name: row.name,
				};
			} );

		// First the section, then the row of cards, with its tools.
		await expect( async () => {
			await words.click();
			await expect( layer ).toHaveAttribute( 'data-level', 'section', {
				timeout: 1000,
			} );
		} ).toPass( { timeout: 15000 } );
		await expect(
			page.locator( '.cnl-section-modes__per-row' )
		).toHaveCount( 0 );
		await words.click();
		await expect( layer ).toHaveAttribute( 'data-level', 'cards' );
		await expect(
			page.locator( '.cnl-section-modes__per-row' )
		).toBeVisible();

		// The row is full, so the + on the right of the last card adds a copy
		// of it beside it, the columns growing to four.
		await expect(
			page.getByRole( 'button', { name: 'Add card' } )
		).toHaveCount( 0 );
		await page.getByRole( 'button', { name: 'Add another card' } ).click();
		await expect.poll( getSection ).toEqual( {
			columnCount: undefined,
			count: 4,
			name: 'core/columns',
		} );
		await expect(
			canvas.getByText( 'Card three', { exact: true } )
		).toHaveCount( 2 );

		// Then the words, with the row still open.
		await words.click();
		await expect( layer ).toHaveAttribute( 'data-level', 'blocks' );
		await expect
			.poll( () => getSelection( page ) )
			.toBe( 'core/heading contentOnly' );
		await expect(
			page.locator( '.cnl-section-modes__per-row' )
		).toBeVisible();

		// Escape steps back a level at a time.
		await page.keyboard.press( 'Escape' );
		await expect( layer ).toHaveAttribute( 'data-level', 'cards' );
		await page.keyboard.press( 'Escape' );
		await expect( layer ).toHaveAttribute( 'data-level', 'section' );

		// Two per row puts two side by side, the rest wrapping.
		await words.click();
		await page.getByRole( 'button', { name: '2 per row' } ).click();
		await expect.poll( getSection ).toEqual( {
			columnCount: 2,
			count: 4,
			name: 'core/group',
		} );
		await expect( layer ).toHaveAttribute( 'data-level', 'cards' );

		// Three per row leaves a gap beside the last card, which a
		// placeholder fills.
		await page.getByRole( 'button', { name: '3 per row' } ).click();
		await page.getByRole( 'button', { name: 'Add card' } ).click();
		await expect.poll( getSection ).toEqual( {
			columnCount: 3,
			count: 5,
			name: 'core/group',
		} );
	} );

	test( 'a double click goes straight to the words, the caret there', async ( {
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
		await expect( page.locator( '.cnl-section-modes' ) ).toHaveAttribute(
			'data-level',
			'blocks'
		);
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

		// Straight into the section's blocks, the caret in the new heading.
		await expect( page.locator( '.cnl-section-modes' ) ).toHaveAttribute(
			'data-level',
			'blocks'
		);
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

		await pickSectionTemplate( page, 'Image left, text right' );

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

		await pickSectionTemplate( page, 'Image left, text right' );

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
		await expect( page.locator( '.cnl-section-modes' ) ).toHaveAttribute(
			'data-level',
			'blocks'
		);
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
