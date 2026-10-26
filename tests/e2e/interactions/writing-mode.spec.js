/**
 * Writing mode, for posts: written rather than designed. Edit has no section
 * layer, so a click reaches the words. Zoom out is only offered once a post
 * has a container to arrange, and then each run of text between containers
 * is one section.
 */
const {
	expect,
	getCanvasEditor,
	getComposeButton,
	getModeToggle,
	getSitePreview,
	pointAtSection,
	setCanvasMode,
	test,
	visitEditor,
} = require( '../utils' );

function paragraph( words ) {
	return `<!-- wp:paragraph --><p>${ words }</p><!-- /wp:paragraph -->`;
}

const GROUP = `<!-- wp:group {"style":{"spacing":{"padding":{"top":"200px","bottom":"200px"}}},"layout":{"type":"constrained"}} --><div class="wp-block-group" style="padding-top:200px;padding-bottom:200px">${ paragraph(
	'In a group'
) }</div><!-- /wp:group -->`;

/**
 * Open a post on the Home screen's site canvas, which follows the preview
 * around the site.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object}                          rest    The REST helper.
 * @param {string}                          content The post's block markup.
 */
async function openPost( page, rest, content ) {
	const post = await rest.createPost( { content } );
	const title = page.locator( '.cnl-editor-homepage-document__title' );

	await visitEditor( page );
	await expect( getSitePreview( page ) ).toBeVisible( { timeout: 15000 } );
	await expect(
		page.locator( '.cnl-editor-preview-canvas__spinner' )
	).toHaveCount( 0, { timeout: 15000 } );

	const preview = await (
		await getSitePreview( page ).elementHandle()
	).contentFrame();

	await preview.evaluate( ( link ) => {
		const url = new URL( window.location.href );

		url.pathname = new URL( link ).pathname;
		window.location.href = url.toString();
	}, post.link );
	await expect( title ).toHaveText( post.title, { timeout: 15000 } );
}

/**
 * The selected block's name and editing mode.
 *
 * @param {import('@playwright/test').Page} page
 * @return {Promise<string>} `name mode`, or nothing.
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

/**
 * The first words of each of the post's blocks, top to bottom.
 *
 * @param {import('@playwright/test').Page} page
 * @return {Promise<string[]>} The words, or a block's name without any.
 */
function getBlockWords( page ) {
	return page.evaluate( () => {
		const store = window.wp.data.select( 'core/block-editor' );
		const [ root ] = store.getBlocksByName( 'core/post-content' );

		return store
			.getBlocks( root )
			.map( ( block ) =>
				(
					block.innerBlocks[ 0 ] || block
				).attributes.content?.toString()
			);
	} );
}

test.describe( 'Writing mode', () => {
	test( 'a post is edited without sections, and has nothing to zoom out to', async ( {
		page,
		rest,
	} ) => {
		await openPost(
			page,
			rest,
			paragraph( 'The first paragraph' ) +
				paragraph( 'The second paragraph' )
		);
		// Without Zoom out to read the mode from, Edit is waited for by its
		// editor.
		await getModeToggle( page )
			.getByRole( 'radio', { name: 'Edit' } )
			.click();
		await expect( getCanvasEditor( page ) ).toBeVisible( {
			timeout: 15000,
		} );
		await expect(
			getCanvasEditor( page )
				.contentFrame()
				.getByText( 'The second paragraph' )
		).toBeVisible();

		await expect( page.locator( '.cnl-section-modes' ) ).toHaveCount( 0 );
		await expect( getComposeButton( page ) ).toHaveCount( 0 );
		await expect(
			page.locator( '.cnl-site-canvas__zoom-controls' )
		).toHaveCount( 0 );

		// The first click reaches the words, with all their tools, tried
		// again until the editor takes clicks.
		await expect( async () => {
			await getCanvasEditor( page )
				.contentFrame()
				.getByText( 'The second paragraph' )
				.click();
			expect( await getSelection( page ) ).toBe(
				'core/paragraph default'
			);
		} ).toPass( { timeout: 15000 } );
		await expect(
			getCanvasEditor( page )
				.contentFrame()
				.locator( '.block-editor-warning' )
		).toHaveCount( 0 );
	} );

	test( 'zoomed out, a post’s containers and runs of text are its sections', async ( {
		page,
		rest,
	} ) => {
		await openPost(
			page,
			rest,
			paragraph( 'Opening words' ) +
				paragraph( 'More opening words' ) +
				GROUP +
				paragraph( 'Closing words' )
		);
		await setCanvasMode( page, 'Compose' );

		const canvas = getCanvasEditor( page ).contentFrame();
		const bar = page.locator( '.cnl-section-modes__bar' );
		// Pointed at again while the page settles from zooming out, which
		// can move another section under the pointer.
		const pointAt = ( words, name ) =>
			expect( async () => {
				await pointAtSection( page, canvas.getByText( words ) );
				await expect(
					page.locator( '.cnl-section-modes__tab' )
				).toHaveText( name, { timeout: 1000 } );
			} ).toPass( { timeout: 15000 } );

		// The opening run of text is one section, with no design of its own.
		await pointAt( 'More opening words', 'Text' );
		await expect(
			bar.getByRole( 'button', { name: 'Edit design' } )
		).toHaveCount( 0 );

		// The group is a section, designed as on a page, and moves up past
		// the whole run of text at once.
		await pointAt( 'In a group', 'In a group' );
		await expect(
			bar.getByRole( 'button', { name: 'Edit design' } )
		).toBeVisible();
		/*
		 * Pressed without moving the pointer: zoomed out, the sections are
		 * small, and the pointer would cross others on its way to the bar.
		 */
		await bar
			.getByRole( 'button', { name: 'Move section up' } )
			.evaluate( ( button ) => button.click() );
		await expect
			.poll( () => getBlockWords( page ) )
			.toEqual( [
				'In a group',
				'Opening words',
				'More opening words',
				'Closing words',
			] );
	} );
} );
