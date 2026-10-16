/**
 * The site canvas's Compose mode: the page zoomed out, with the same section
 * controls as Edit. Sections are dragged to reorder them, and a section's
 * layout, colours and place on the page are changed without leaving.
 * Anything else, like Edit content, goes back to Edit to do it.
 */
const {
	expect,
	getCanvasEditor,
	expectCanvasMode,
	getStage,
	pointAtSection,
	setCanvasMode,
	test,
	visitEditor,
} = require( '../utils' );

// A page with no blocks. The REST helper fills in a paragraph for no content.
const EMPTY_PAGE = ' ';

/**
 * A section tall enough, zoomed out, for its bar to sit at its top, clear of
 * its words.
 *
 * @param {string} words What it says.
 * @return {string} Its markup.
 */
function tallSection( words ) {
	return `<!-- wp:group {"style":{"spacing":{"padding":{"top":"200px","bottom":"200px"}}},"layout":{"type":"constrained"}} --><div class="wp-block-group" style="padding-top:200px;padding-bottom:200px"><!-- wp:paragraph --><p>${ words }</p><!-- /wp:paragraph --></div><!-- /wp:group -->`;
}

/**
 * The words in each of the page's sections, top to bottom.
 *
 * @param {import('@playwright/test').Page} page
 * @return {Promise<string[]>} The words.
 */
function getSectionWords( page ) {
	return page.evaluate( () => {
		const store = window.wp.data.select( 'core/block-editor' );
		const [ root ] = store.getBlocksByName( 'core/post-content' );

		return store
			.getBlocks( root )
			.map( ( section ) =>
				(
					section.innerBlocks[ 0 ] || section
				).attributes.content?.toString()
			);
	} );
}

function getWords( page, words ) {
	return getCanvasEditor( page ).contentFrame().getByText( words );
}

/**
 * Where something is once Compose has finished zooming, so the pointer can be
 * moved to it.
 *
 * @param {import('@playwright/test').Locator} locator
 * @return {Promise<Object>} Its bounding box.
 */
async function getSettledBox( locator ) {
	let previous = null;

	await expect
		.poll( async () => {
			const box = await locator.boundingBox();
			const isSettled =
				!! box &&
				!! previous &&
				box.x === previous.x &&
				box.y === previous.y;

			previous = box;

			return isSettled;
		} )
		.toBe( true );

	return previous;
}

/**
 * Add one of the plugin's layouts from the section picker, already open.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string}                          name The layout's title.
 */
async function pickLayout( page, name ) {
	const picker = page.getByRole( 'dialog', { name: 'Add a section' } );

	await expect( picker ).toBeVisible();
	await picker.getByText( 'Layouts', { exact: true } ).click();
	await picker
		.getByRole( 'button', { name: `Add ${ name }`, exact: true } )
		.click();
	await expect( picker ).toBeHidden();
}

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

test.describe( 'Compose', () => {
	test( 'zooms the page out with the same section controls as Edit', async ( {
		page,
		rest,
	} ) => {
		await openPage( page, rest, { content: tallSection( 'A section' ) } );
		await setCanvasMode( page, 'Compose' );

		const toolbar = page.locator( '.cnl-editor-homepage-toolbar' );
		const bar = page.locator( '.cnl-section-modes__bar' );

		await expect(
			toolbar.getByRole( 'radio', { name: 'Desktop view' } )
		).toHaveCount( 0 );

		await pointAtSection( page, getWords( page, 'A section' ) );
		await expect(
			bar.getByRole( 'button', { name: 'Edit design' } )
		).toBeVisible();
		await expect(
			bar.getByRole( 'button', { name: 'Edit content' } )
		).toBeVisible();
		await expect(
			bar.getByRole( 'button', { name: 'Delete section' } )
		).toBeVisible();

		await setCanvasMode( page, 'Edit' );
		await expect(
			toolbar.getByRole( 'radio', { name: 'Desktop view' } )
		).toBeVisible();
	} );

	test( 'adds sections from an empty page and after the last one', async ( {
		page,
		rest,
	} ) => {
		await openPage( page, rest, { content: EMPTY_PAGE } );
		await setCanvasMode( page, 'Compose' );

		const placeholder = page.locator( '.cnl-section-modes__empty' );

		await expect( placeholder ).toBeVisible( { timeout: 15000 } );
		await placeholder
			.getByRole( 'button', { name: 'Add a section' } )
			.click();
		await pickLayout( page, 'Hero' );
		await expect( placeholder ).toHaveCount( 0 );

		// Still composing, the new section picked, with "Add section" on its
		// bottom edge.
		await expectCanvasMode( page, 'Compose' );
		await page.locator( '.cnl-section-modes__add-section' ).last().click();
		await pickLayout( page, 'Image left, text right' );

		await expect
			.poll( () =>
				page.evaluate( () => {
					const store = window.wp.data.select( 'core/block-editor' );
					const [ root ] =
						store.getBlocksByName( 'core/post-content' );

					return store.getBlockOrder( root ).length;
				} )
			)
			.toBe( 2 );
		await expectCanvasMode( page, 'Compose' );
	} );

	test( 'drags a section to reorder the page', async ( { page, rest } ) => {
		await openPage( page, rest, {
			content: [ 'First', 'Second', 'Third' ]
				.map( ( words ) => tallSection( `${ words } section` ) )
				.join( '' ),
		} );
		await setCanvasMode( page, 'Compose' );

		const first = await getSettledBox( getWords( page, 'First section' ) );
		const third = await getSettledBox( getWords( page, 'Third section' ) );

		await pointAtSection( page, getWords( page, 'First section' ) );
		await page.mouse.move( first.x + 5, first.y + first.height / 2 );
		await page.mouse.down();
		await page.mouse.move( first.x + 5, first.y + 40, { steps: 5 } );
		await expect(
			page.locator( '.cnl-section-modes__drop-line' )
		).toBeVisible();
		await page.mouse.move( third.x + 5, third.y + third.height + 60, {
			steps: 10,
		} );
		await page.mouse.up();

		await expect
			.poll( () => getSectionWords( page ) )
			.toEqual( [ 'Second section', 'Third section', 'First section' ] );
		await expectCanvasMode( page, 'Compose' );
	} );

	test( 'moves and deletes sections without leaving', async ( {
		page,
		rest,
	} ) => {
		await openPage( page, rest, {
			content: [ 'First', 'Second' ]
				.map( ( words ) => tallSection( `${ words } section` ) )
				.join( '' ),
		} );
		await setCanvasMode( page, 'Compose' );

		const bar = page.locator( '.cnl-section-modes__bar' );

		await pointAtSection( page, getWords( page, 'Second section' ) );
		await bar.getByRole( 'button', { name: 'Move section up' } ).click();
		await expect
			.poll( () => getSectionWords( page ) )
			.toEqual( [ 'Second section', 'First section' ] );

		// Once the canvas has scrolled to the moved section, so nothing
		// slides under the pointer, and the bar is the right section's.
		await getSettledBox( getWords( page, 'First section' ) );
		await pointAtSection( page, getWords( page, 'First section' ) );
		await expect(
			page.locator( '.cnl-section-modes__hover .cnl-section-modes__tab' )
		).toHaveText( 'First section' );
		await bar.getByRole( 'button', { name: 'Delete section' } ).click();
		await expect
			.poll( () => getSectionWords( page ) )
			.toEqual( [ 'Second section' ] );
		await expectCanvasMode( page, 'Compose' );
	} );

	test( 'changes a section’s layout without leaving', async ( {
		page,
		rest,
	} ) => {
		await openPage( page, rest, { content: EMPTY_PAGE } );
		await setCanvasMode( page, 'Compose' );
		await page
			.locator( '.cnl-section-modes__empty' )
			.getByRole( 'button', { name: 'Add a section' } )
			.click();
		await pickLayout( page, 'Image left, text right' );

		await page
			.locator( '.cnl-section-modes__bar' )
			.getByRole( 'button', { name: 'Edit design' } )
			.click();

		const panel = page.locator( '.cnl-section-modes__panel' );
		const option = panel
			.locator( '.cnl-section-modes__option' )
			.filter( { hasText: 'Image on the right' } );

		await option.click();

		// Still composing, the section in its new arrangement.
		await expect( option ).toHaveAttribute( 'aria-pressed', 'true' );
		await expectCanvasMode( page, 'Compose' );
	} );

	test( 'Edit content goes back to Edit, in Edit content', async ( {
		page,
		rest,
	} ) => {
		await openPage( page, rest, {
			content: tallSection( 'Only section' ),
		} );
		await setCanvasMode( page, 'Compose' );
		await pointAtSection( page, getWords( page, 'Only section' ) );
		await page
			.locator( '.cnl-section-modes__bar' )
			.getByRole( 'button', { name: 'Edit content' } )
			.click();

		await expectCanvasMode( page, 'Edit' );
		await expect(
			page.locator( '.cnl-section-modes__mode-bar' )
		).toContainText( 'Edit content' );
	} );

	test( 'double-clicking a block goes back to Edit with it selected', async ( {
		page,
		rest,
	} ) => {
		await openPage( page, rest, {
			content: tallSection( 'Some words inside a section' ),
		} );
		await setCanvasMode( page, 'Compose' );

		const words = getWords( page, 'Some words inside a section' );

		await pointAtSection( page, words );

		const box = await getSettledBox( words );

		await page.mouse.dblclick( box.x + 10, box.y + box.height / 2 );

		await expectCanvasMode( page, 'Edit' );
		await expect
			.poll( () =>
				page.evaluate( () => {
					const store = window.wp.data.select( 'core/block-editor' );
					const clientId = store.getSelectedBlockClientId();

					return clientId
						? store
								.getBlockAttributes( clientId )
								.content?.toString()
						: null;
				} )
			)
			.toBe( 'Some words inside a section' );
	} );

	test( 'Escape with nothing picked goes back to Edit', async ( {
		page,
		rest,
	} ) => {
		await openPage( page, rest, { content: tallSection( 'A section' ) } );
		await setCanvasMode( page, 'Compose' );
		await page.keyboard.press( 'Escape' );
		await expectCanvasMode( page, 'Edit' );
	} );

	test( 'lists the page’s sections in the sidebar only while composing', async ( {
		page,
		rest,
	} ) => {
		const testPage = await rest.createPage();

		await visitEditor(
			page,
			`/types/page/list/all?previewId=${ testPage.id }&postId=${ testPage.id }`
		);

		const onThisPage = getStage( page ).getByRole( 'heading', {
			name: 'On this page',
		} );

		await expect(
			getStage( page ).getByRole( 'heading', { name: 'Layout' } )
		).toBeVisible( { timeout: 15000 } );
		await expect( onThisPage ).toHaveCount( 0 );

		await setCanvasMode( page, 'Compose' );
		await expect( onThisPage ).toBeVisible();

		await setCanvasMode( page, 'Edit' );
		await expect( onThisPage ).toHaveCount( 0 );
	} );
} );
