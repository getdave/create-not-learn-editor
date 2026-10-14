/**
 * The site canvas's Compose mode: the page zoomed out, with sections to add,
 * move, remove and rearrange, and a way into Edit.
 */
const {
	expect,
	getCanvasEditor,
	expectCanvasMode,
	getStage,
	setCanvasMode,
	test,
	visitEditor,
} = require( '../utils' );

// A page with no blocks. The REST helper fills in a paragraph for no content.
const EMPTY_PAGE = ' ';

// The page's own sections, rather than what the template adds around them.
function getTargets( page ) {
	return page.locator( '.cnl-compose-layer__target:not(.is-template)' );
}

/**
 * Pick a section from the keyboard, as the "+" between sections can sit over
 * the middle of a short one.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string}                          name The section's name.
 */
async function pickSection( page, name ) {
	const target = getTargets( page ).and(
		page.getByRole( 'button', { name, exact: true } )
	);

	await target.focus();
	await page.keyboard.press( 'Enter' );
	await expect( target ).toHaveAttribute( 'aria-pressed', 'true' );
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

async function getTargetNames( page ) {
	return getTargets( page ).evaluateAll( ( targets ) =>
		targets.map( ( target ) => target.getAttribute( 'aria-label' ) )
	);
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
	test( 'zooms the page out and hides the device switcher', async ( {
		page,
		rest,
	} ) => {
		await openPage( page, rest );
		await setCanvasMode( page, 'Compose' );

		const toolbar = page.locator( '.cnl-editor-homepage-toolbar' );

		await expect(
			toolbar.getByRole( 'radio', { name: 'Desktop view' } )
		).toHaveCount( 0 );
		await expect
			.poll( () =>
				getCanvasEditor( page )
					.contentFrame()
					.locator( 'html' )
					.getAttribute( 'class' )
			)
			.toContain( 'is-zoomed-out' );
		await expect( getTargets( page ).first() ).toBeAttached();

		// What the template adds is marked apart from the page's content, and
		// only its header and footer can be picked.
		await expect(
			page.getByRole( 'button', { name: 'Header, same on every page' } )
		).toHaveClass( /is-template/ );
		await expect(
			page.getByRole( 'button', { name: 'Footer, same on every page' } )
		).toHaveClass( /is-template/ );

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

		await expect(
			page.getByText( 'This page has no sections yet' )
		).toBeVisible();
		await page
			.locator( '.cnl-compose-layer__add' )
			.getByRole( 'button', { name: 'Add a section' } )
			.click();
		await pickLayout( page, 'Hero' );

		await expect(
			page.getByText( 'This page has no sections yet' )
		).toBeHidden();
		await page
			.locator( '.cnl-compose-layer__add' )
			.getByRole( 'button', { name: 'Add a section' } )
			.click();
		await pickLayout( page, 'Image left, text right' );

		await expect
			.poll( () => getTargetNames( page ) )
			.toEqual( [ 'Hero', 'Image left, text right' ] );
	} );

	test( 'the "+" between sections stays while the pointer moves to it', async ( {
		page,
		rest,
	} ) => {
		await openPage( page, rest, {
			content: [ 'First', 'Second' ]
				.map(
					( text ) =>
						`<!-- wp:paragraph --><p>${ text } section</p><!-- /wp:paragraph -->`
				)
				.join( '' ),
		} );
		await setCanvasMode( page, 'Compose' );

		const second = page.getByRole( 'button', {
			name: 'Second section',
			exact: true,
		} );
		const box = await getSettledBox( second );

		await page.mouse.move( box.x + 20, box.y + box.height / 2 );

		const add = page.locator(
			'.cnl-compose-layer__gap.is-visible .cnl-compose-layer__gap-button'
		);

		await expect( add.first() ).toBeVisible();

		const target = await getSettledBox( add.first() );

		await page.mouse.move(
			target.x + target.width / 2,
			target.y + target.height / 2,
			{ steps: 20 }
		);
		await page.mouse.down();
		await page.mouse.up();

		await expect(
			page.getByRole( 'dialog', { name: 'Add a section' } )
		).toBeVisible();
	} );

	test( 'double-clicking a block opens it in Edit, selected', async ( {
		page,
		rest,
	} ) => {
		await openPage( page, rest, {
			content:
				'<!-- wp:group {"layout":{"type":"constrained"}} --><div class="wp-block-group"><!-- wp:heading --><h2 class="wp-block-heading">A heading</h2><!-- /wp:heading --><!-- wp:paragraph --><p>Some words inside a section</p><!-- /wp:paragraph --></div><!-- /wp:group -->',
		} );
		await setCanvasMode( page, 'Compose' );

		const words = getCanvasEditor( page )
			.contentFrame()
			.getByText( 'Some words inside a section' );
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

	test( 'moves and deletes sections', async ( { page, rest } ) => {
		await openPage( page, rest, {
			content: [ 'First', 'Second', 'Third' ]
				.map(
					( text ) =>
						`<!-- wp:paragraph --><p>${ text } section</p><!-- /wp:paragraph -->`
				)
				.join( '' ),
		} );
		await setCanvasMode( page, 'Compose' );

		await pickSection( page, 'Second section' );

		const sectionToolbar = page.locator( '.cnl-compose-toolbar' );

		await sectionToolbar.getByRole( 'button', { name: 'Move up' } ).click();
		await expect
			.poll( () => getTargetNames( page ) )
			.toEqual( [ 'Second section', 'First section', 'Third section' ] );

		// Deleting is under Options, as on core's block toolbar.
		await sectionToolbar
			.getByRole( 'button', { name: 'Options', exact: true } )
			.click();
		await page.getByRole( 'menuitem', { name: 'Delete' } ).click();
		await expect
			.poll( () => getTargetNames( page ) )
			.toEqual( [ 'First section', 'Third section' ] );
	} );

	test( 'changes a section’s layout', async ( { page, rest } ) => {
		await openPage( page, rest, { content: EMPTY_PAGE } );
		await setCanvasMode( page, 'Compose' );
		await page
			.locator( '.cnl-compose-layer__add' )
			.getByRole( 'button', { name: 'Add a section' } )
			.click();
		await pickLayout( page, 'Image left, text right' );

		const sectionToolbar = page.locator( '.cnl-compose-toolbar' );

		await sectionToolbar.getByRole( 'button', { name: /^Layout/ } ).click();
		await page
			.locator( '.cnl-compose-variations__option' )
			.filter( { hasText: 'Image on the right' } )
			.click();

		// The section stays picked, now in its new arrangement.
		await sectionToolbar.getByRole( 'button', { name: /^Layout/ } ).click();
		await expect(
			page
				.locator( '.cnl-compose-variations__option.is-current' )
				.filter( { hasText: 'Image on the right' } )
		).toBeVisible();
	} );

	test( 'Edit opens the picked section in Edit', async ( { page, rest } ) => {
		await openPage( page, rest, {
			content:
				'<!-- wp:paragraph --><p>Only section</p><!-- /wp:paragraph -->',
		} );
		await setCanvasMode( page, 'Compose' );
		await pickSection( page, 'Only section' );
		await page
			.locator( '.cnl-compose-toolbar' )
			.getByRole( 'button', { name: 'Edit', exact: true } )
			.click();

		await expectCanvasMode( page, 'Edit' );
		await expect
			.poll( () =>
				page.evaluate( () => {
					const store = window.wp.data.select( 'core/block-editor' );

					return store.getBlockName(
						store.getSelectedBlockClientId()
					);
				} )
			)
			.toBe( 'core/paragraph' );
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
