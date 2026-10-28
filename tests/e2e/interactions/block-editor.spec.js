/**
 * Core's "Choose a pattern" modal, which the editor layer allows only for a
 * new page in the full-screen editor and closes anywhere else.
 */
const {
	expect,
	expectBlockEditor,
	expectCanvasMode,
	test,
	visitEditor,
} = require( '../utils' );

const START_PATTERNS_MODAL = '.editor-start-page-options__modal';

/**
 * Record, from before the editor loads, each time core's modal is added to
 * the page and whether it could be seen then, so a test can tell a modal that
 * was closed from one core never opened.
 *
 * @param {import('@playwright/test').Page} page
 */
async function watchStartPatterns( page ) {
	await page.addInitScript( ( selector ) => {
		window.__cnlStartPatterns = [];

		new window.MutationObserver( () => {
			const modal = document.querySelector( selector );
			const overlay = modal?.closest(
				'.components-modal__screen-overlay'
			);

			if ( overlay && ! overlay.dataset.cnlSeen ) {
				overlay.dataset.cnlSeen = 'true';
				window.__cnlStartPatterns.push( {
					visible: overlay.checkVisibility(),
				} );
			}
		} ).observe( document, { childList: true, subtree: true } );
	}, START_PATTERNS_MODAL );
}

/**
 * Make a published page with no content at all, which core takes for one
 * just made. `rest.createPage()` fills in a paragraph for no content.
 *
 * @param {import('./../utils/rest').RestClient} rest
 * @return {Promise<number>} The page's ID.
 */
async function createEmptyPage( rest ) {
	const { id } = await rest.fetch( '/wp/v2/pages', {
		data: { content: '', status: 'publish', title: 'Empty page' },
		method: 'POST',
	} );

	rest.deleteLater( `/wp/v2/pages/${ id }` );

	return id;
}

function getStartPatternsOpenings( page ) {
	return page.evaluate( () => window.__cnlStartPatterns );
}

/**
 * Check core opened the modal and the layer closed it unseen, leaving no
 * modal lock on the page and the user's preference as it was.
 *
 * @param {import('@playwright/test').Page} page
 */
async function expectStartPatternsClosed( page ) {
	await expect
		.poll( () => getStartPatternsOpenings( page ), { timeout: 15000 } )
		.not.toHaveLength( 0 );
	expect( await getStartPatternsOpenings( page ) ).toEqual(
		expect.not.arrayContaining( [ { visible: true } ] )
	);

	await expect( page.locator( START_PATTERNS_MODAL ) ).toHaveCount( 0 );
	await expect( page.locator( 'body' ) ).not.toHaveClass( /\bmodal-open\b/ );
	expect(
		await page.evaluate( () =>
			window.wp.data
				.select( 'core/preferences' )
				.get( 'core', 'enableChoosePatternModal' )
		)
	).toBe( true );
}

/**
 * Save core's preference for the modal as on, as wp-admin's editor does when
 * it is closed with "Always show starter patterns" ticked, then put the
 * preferences back when the test ends. This editor doesn't default it on, so
 * without it core never opens the modal.
 *
 * @param {import('./../utils/rest').RestClient} rest
 */
async function enableStartPatterns( rest ) {
	const user = await rest.fetch( '/wp/v2/users/me', {
		params: { context: 'edit' },
	} );
	const saved = user.meta?.persisted_preferences || {};
	const save = ( preferences ) =>
		rest.fetch( '/wp/v2/users/me', {
			data: { meta: { persisted_preferences: preferences } },
			method: 'POST',
		} );

	rest.onCleanup( () => save( saved ) );
	await save( {
		...saved,
		core: { ...saved.core, enableChoosePatternModal: true },
		_modified: new Date().toISOString(),
	} );
}

test.describe( 'Choose a pattern', () => {
	test.beforeEach( async ( { page, rest } ) => {
		await enableStartPatterns( rest );
		await watchStartPatterns( page );
	} );

	test( 'opens for a new page in the full editor', async ( {
		page,
		rest,
	} ) => {
		await visitEditor( page, '/types/page/new' );
		await expectBlockEditor( page );

		const id = await page.evaluate( () =>
			window.wp.data.select( 'core/editor' ).getCurrentPostId()
		);
		rest.deleteLater( `/wp/v2/pages/${ id }` );

		await expect(
			page.getByRole( 'dialog', { name: 'Choose a pattern' } )
		).toBeVisible( { timeout: 15000 } );
	} );

	test( 'stays closed for a saved empty page in the full editor', async ( {
		page,
		rest,
	} ) => {
		const id = await createEmptyPage( rest );

		await visitEditor( page, `/types/page/edit/${ id }` );
		await expectBlockEditor( page );

		await expectStartPatternsClosed( page );
	} );

	test( 'stays closed for an empty page on the site canvas', async ( {
		page,
		rest,
	} ) => {
		const id = await createEmptyPage( rest );

		await visitEditor( page, `/types/page/list/all?previewId=${ id }` );
		await expectCanvasMode( page, 'Browse' );

		await expectStartPatternsClosed( page );
	} );
} );
