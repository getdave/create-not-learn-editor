const fs = require( 'node:fs/promises' );
const path = require( 'node:path' );
const { expect, test } = require( '@playwright/test' );

const ADMIN_USER = process.env.WP_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.WP_ADMIN_PASSWORD || 'password';
const HOMEPAGE_PARITY_DIR = path.join(
	process.cwd(),
	'.context',
	'homepage-parity'
);
const ADD_PAGE_PARITY_DIR = path.join(
	process.cwd(),
	'.context',
	'add-page-parity'
);

async function login( page ) {
	await page.request.get( '/wp-login.php' );
	await page.request.post( '/wp-login.php', {
		form: {
			log: ADMIN_USER,
			pwd: ADMIN_PASSWORD,
			redirect_to: '/wp-admin/',
			testcookie: '1',
			'wp-submit': 'Log In',
		},
	} );
	await page.goto( '/wp-admin/' );
	await expect( page ).toHaveURL( /\/wp-admin\// );
	await expect( page.locator( '#wpadminbar' ) ).toBeVisible();
}

async function getPreviewFrameTexts( page, selector ) {
	const frames = await page.locator( selector ).elementHandles();
	const texts = [];

	for ( const frameHandle of frames ) {
		const frame = await frameHandle.contentFrame();

		if ( frame ) {
			texts.push( await frame.locator( 'body' ).innerText() );
		}
	}

	return texts;
}

async function getNavigationLocationPreviewFrameTexts( page ) {
	return getPreviewFrameTexts(
		page,
		'.routes-navigation-locations-canvas__preview iframe'
	);
}

async function getAddPageFormPreviewFrameTexts( page ) {
	return getPreviewFrameTexts( page, '.cnl-add-page-form__preview iframe' );
}

async function getDesignGridColumnCount( page ) {
	return page
		.locator( '.cnl-add-page-layout-grid' )
		.first()
		.evaluate(
			( element ) =>
				window
					.getComputedStyle( element )
					.gridTemplateColumns.split( ' ' ).length
		);
}

async function getEditorCanvasFrame( page ) {
	const iframe = page.locator( 'iframe[name="editor-canvas"]' );
	await expect( iframe ).toBeVisible( { timeout: 15000 } );

	const frame = await ( await iframe.elementHandle() ).contentFrame();
	if ( ! frame ) {
		throw new Error( 'Editor canvas frame was not available.' );
	}

	return frame;
}

async function expectSnackbar( page, message ) {
	await expect(
		page.locator( '.components-snackbar' ).getByText( message )
	).toBeVisible( {
		timeout: 15000,
	} );
}

async function writeHomepageParityScreenshot( locator, name ) {
	await fs.mkdir( HOMEPAGE_PARITY_DIR, { recursive: true } );
	await locator.screenshot( {
		animations: 'disabled',
		path: path.join( HOMEPAGE_PARITY_DIR, name ),
	} );
}

async function writeAddPageParityScreenshot( locator, name ) {
	await fs.mkdir( ADD_PAGE_PARITY_DIR, { recursive: true } );
	await locator.screenshot( {
		animations: 'disabled',
		path: path.join( ADD_PAGE_PARITY_DIR, name ),
	} );
}

async function navigateToNavigationMenus( page ) {
	await page.getByRole( 'link', { name: 'Menus', exact: true } ).click();
}

async function createPreviewTestPage( page, options = {} ) {
	const timestamp = Date.now();
	const title = options.title || `Preview parity ${ timestamp }`;
	const body = options.body || `Preview parity body ${ timestamp }`;
	const content =
		options.content ||
		`<!-- wp:paragraph --><p>${ body }</p><!-- /wp:paragraph -->`;

	await page.waitForFunction( () =>
		Boolean( window.createNotLearnEditor?.nonce )
	);

	const createdPage = await page.evaluate(
		async ( { content: pageContent, title: pageTitle } ) => {
			const response = await window.fetch( '/wp-json/wp/v2/pages', {
				body: JSON.stringify( {
					content: pageContent,
					status: 'publish',
					title: pageTitle,
				} ),
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.createNotLearnEditor.nonce,
				},
				method: 'POST',
			} );

			if ( ! response.ok ) {
				throw new Error( await response.text() );
			}

			return response.json();
		},
		{ body, content, title }
	);

	return {
		body,
		id: createdPage.id,
		link: createdPage.link,
		title,
	};
}

async function createTestPattern( page ) {
	const timestamp = Date.now();
	const title = `Pattern parity ${ timestamp }`;
	const body = `Pattern parity body ${ timestamp }`;

	await page.waitForFunction( () =>
		Boolean( window.createNotLearnEditor?.nonce )
	);

	const createdPattern = await page.evaluate(
		async ( { body: patternBody, title: patternTitle } ) => {
			const response = await window.fetch( '/wp-json/wp/v2/blocks', {
				body: JSON.stringify( {
					content: `<!-- wp:paragraph --><p>${ patternBody }</p><!-- /wp:paragraph -->`,
					status: 'publish',
					title: patternTitle,
				} ),
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.createNotLearnEditor.nonce,
				},
				method: 'POST',
			} );

			if ( ! response.ok ) {
				throw new Error( await response.text() );
			}

			return response.json();
		},
		{ body, title }
	);

	return {
		body,
		id: createdPattern.id,
		title,
	};
}

async function getNavigationTemplatePartsSnapshot( page ) {
	await page.waitForFunction( () =>
		Boolean( window.createNotLearnEditor?.nonce )
	);

	return page.evaluate( async () => {
		const response = await window.fetch(
			'/wp-json/wp/v2/template-parts?context=edit&per_page=100&_fields=id,title,content',
			{
				headers: {
					'X-WP-Nonce': window.createNotLearnEditor.nonce,
				},
			}
		);

		if ( ! response.ok ) {
			throw new Error( await response.text() );
		}

		const templateParts = await response.json();

		return templateParts
			.map( ( part ) => ( {
				content:
					typeof part.content === 'string'
						? part.content
						: part.content?.raw || '',
				id: part.id,
				title:
					typeof part.title === 'string'
						? part.title
						: part.title?.rendered || part.title?.raw || '',
			} ) )
			.filter( ( part ) => part.content.includes( 'wp:navigation' ) );
	} );
}

async function getOrCreateUnusedNavigationMenuId( page ) {
	await page.waitForFunction( () =>
		Boolean( window.createNotLearnEditor?.nonce )
	);

	return page.evaluate( async () => {
		const navigationRestBase =
			window.createNotLearnEditor.navigationRestBase || 'navigation';
		const headers = {
			'Content-Type': 'application/json',
			'X-WP-Nonce': window.createNotLearnEditor.nonce,
		};
		const getMenuTitle = ( menu ) =>
			typeof menu.title === 'string'
				? menu.title
				: menu.title?.rendered || menu.title?.raw || 'Navigation';
		const getNavigationMenus = async () => {
			const response = await window.fetch(
				`/wp-json/wp/v2/${ navigationRestBase }?context=edit&per_page=100&status=publish,draft&_fields=id,content,title`,
				{
					headers: {
						'X-WP-Nonce': window.createNotLearnEditor.nonce,
					},
				}
			);

			if ( ! response.ok ) {
				throw new Error( await response.text() );
			}

			return response.json();
		};
		const getReferencedMenuIds = async ( fallbackMenuId ) => {
			const response = await window.fetch(
				'/wp-json/wp/v2/template-parts?context=edit&per_page=100&_fields=id,content',
				{
					headers: {
						'X-WP-Nonce': window.createNotLearnEditor.nonce,
					},
				}
			);

			if ( ! response.ok ) {
				throw new Error( await response.text() );
			}

			const refs = new Set();
			const templateParts = await response.json();

			for ( const part of templateParts ) {
				const content =
					typeof part.content === 'string'
						? part.content
						: part.content?.raw || '';

				if ( ! content.includes( 'wp:navigation' ) ) {
					continue;
				}

				const matches = content.matchAll( /"ref"\s*:\s*(\d+)/g );
				let hasExplicitRef = false;

				for ( const match of matches ) {
					hasExplicitRef = true;
					refs.add( Number( match[ 1 ] ) );
				}

				if ( ! hasExplicitRef && fallbackMenuId ) {
					refs.add( Number( fallbackMenuId ) );
				}
			}

			return refs;
		};
		const createMenu = async () => {
			const response = await window.fetch(
				`/wp-json/wp/v2/${ navigationRestBase }`,
				{
					body: JSON.stringify( {
						content: '<!-- wp:page-list /-->',
						status: 'publish',
						title: 'Main menu',
					} ),
					headers,
					method: 'POST',
				}
			);

			if ( ! response.ok ) {
				throw new Error( await response.text() );
			}

			return response.json();
		};
		let menus = await getNavigationMenus();
		let referencedMenuIds = await getReferencedMenuIds( menus[ 0 ]?.id );
		const unusedMenu = menus.find(
			( menu, index ) =>
				index > 0 && ! referencedMenuIds.has( Number( menu.id ) )
		);

		if ( unusedMenu ) {
			return {
				id: unusedMenu.id,
				title: getMenuTitle( unusedMenu ),
			};
		}

		const firstCreatedMenu = await createMenu();
		await createMenu();
		menus = await getNavigationMenus();
		referencedMenuIds = await getReferencedMenuIds( menus[ 0 ]?.id );

		if ( ! referencedMenuIds.has( Number( firstCreatedMenu.id ) ) ) {
			return {
				id: firstCreatedMenu.id,
				title: getMenuTitle( firstCreatedMenu ),
			};
		}

		const nextUnusedMenu = menus.find(
			( menu ) => ! referencedMenuIds.has( Number( menu.id ) )
		);

		if ( ! nextUnusedMenu ) {
			throw new Error( 'Unable to create an unused navigation menu.' );
		}

		return {
			id: nextUnusedMenu.id,
			title: getMenuTitle( nextUnusedMenu ),
		};
	} );
}

test.describe( 'Create Not Learn Editor', () => {
	test.beforeEach( async ( { page } ) => {
		await login( page );
	} );

	test( 'previews and configures the homepage before editing it in the block editor', async ( {
		page,
	} ) => {
		await page.setViewportSize( { height: 1003, width: 2048 } );
		await page.goto( '/' );
		await expect( page.locator( '#wpadminbar' ) ).toBeVisible();

		await page.goto( '/wp-admin/admin.php?page=create-not-learn-editor' );

		const previewCanvas = page.locator( '.cnl-editor-preview-canvas' );
		const previewFrame = previewCanvas.locator(
			'iframe[title="Homepage preview"]'
		);
		const frameWrap = previewCanvas.locator(
			'.cnl-editor-preview-canvas__frame-wrap'
		);
		const toolbar = previewCanvas.locator( '.cnl-editor-homepage-toolbar' );
		const documentBar = toolbar.locator( '.cnl-editor-homepage-document' );

		await expect( previewFrame ).toBeVisible();
		await expect( previewFrame ).toHaveAttribute(
			'src',
			/cnl-editor-preview=1/
		);
		const frameHandle = await previewFrame.elementHandle();
		const previewContentFrame = await frameHandle.contentFrame();
		await expect(
			previewContentFrame.locator( '#wpadminbar' )
		).toHaveCount( 0 );
		await expect(
			toolbar.getByRole( 'button', { name: 'Back in preview' } )
		).toBeDisabled();
		await expect(
			toolbar.getByRole( 'button', { name: 'Forward in preview' } )
		).toBeDisabled();
		await expect(
			toolbar.getByRole( 'link', { name: 'View site in new tab' } )
		).toHaveAttribute( 'target', '_blank' );
		await expect(
			documentBar.locator( '.cnl-editor-homepage-document__icon' )
		).toHaveCount( 1 );

		await writeHomepageParityScreenshot(
			page.locator( '.boot-layout' ),
			'plugin-homepage-full.png'
		);
		await writeHomepageParityScreenshot(
			toolbar.locator( '.cnl-editor-homepage-toolbar__left' ),
			'plugin-homepage-left-controls.png'
		);
		await writeHomepageParityScreenshot(
			toolbar.locator( '.cnl-editor-homepage-toolbar__right' ),
			'plugin-homepage-device-controls.png'
		);

		await previewCanvas
			.getByRole( 'button', { name: 'Mobile view' } )
			.click();
		await expect( frameWrap ).toHaveClass( /is-mobile/ );

		await previewCanvas
			.getByRole( 'button', { name: 'Page Options' } )
			.click();
		await expect(
			page.getByRole( 'menuitem', { name: 'Configure Homepage' } )
		).toBeVisible();
		await writeHomepageParityScreenshot(
			page.locator( '.cnl-editor-homepage-options__content' ),
			'plugin-homepage-page-options-open.png'
		);
		await writeHomepageParityScreenshot(
			toolbar.locator( '.cnl-editor-homepage-toolbar__center' ),
			'plugin-homepage-title-controls.png'
		);
		await page
			.getByRole( 'menuitem', { name: 'Configure Homepage' } )
			.click();

		const editPageButton = previewCanvas.getByRole( 'button', {
			name: 'Edit page',
		} );
		await expect( editPageButton ).toBeEnabled();
		await editPageButton.click();

		await expect( page ).toHaveURL( /p=.*%2Ftypes%2Fpage%2Fedit%2F\d+/ );
		await expect(
			page.locator(
				'iframe[src*="post-new.php"], iframe[src*="post.php"]'
			)
		).toHaveCount( 0 );
		await expect(
			page
				.locator(
					[
						'.interface-interface-skeleton',
						'.edit-post-layout',
						'.block-editor-writing-flow',
					].join( ', ' )
				)
				.first()
		).toBeVisible();
	} );

	test( 'updates homepage document details when the preview iframe navigates', async ( {
		page,
	} ) => {
		await page.goto( '/wp-admin/admin.php?page=create-not-learn-editor' );
		const targetPage = await createPreviewTestPage( page, {
			title: `Preview target ${ Date.now() }`,
		} );
		const previewPage = await createPreviewTestPage( page, {
			content: `<!-- wp:paragraph --><p><a href="${ targetPage.link }">Preview target link</a></p><!-- /wp:paragraph -->`,
			title: `Preview source ${ Date.now() }`,
		} );
		const previewCanvas = page.locator( '.cnl-editor-preview-canvas' );
		const previewFrame = previewCanvas.locator(
			'iframe[title="Homepage preview"]'
		);
		const documentBar = previewCanvas.locator(
			'.cnl-editor-homepage-document'
		);

		await expect( previewFrame ).toBeVisible();

		const previewUrl = new URL( previewPage.link );
		previewUrl.searchParams.set( 'cnl-editor-preview', '1' );
		previewUrl.searchParams.set( 'cnl-editor-preview-refresh', 'dynamic' );

		await previewFrame.evaluate( ( iframe, src ) => {
			iframe.src = src;
		}, previewUrl.href );

		await expect(
			documentBar.locator( '.cnl-editor-homepage-document__title' )
		).toHaveText( previewPage.title, { timeout: 15000 } );
		await expect(
			documentBar.locator( '.cnl-editor-homepage-document__status' )
		).toHaveAttribute( 'aria-label', 'Published' );
		await expect(
			documentBar.locator( '.cnl-editor-homepage-document__icon' )
		).toHaveCount( 0 );
		await expect(
			documentBar.getByRole( 'button', { name: 'Page Options' } )
		).toHaveCount( 0 );

		const frameHandle = await previewFrame.elementHandle();
		const previewContentFrame = await frameHandle.contentFrame();
		await previewContentFrame
			.getByRole( 'link', { name: 'Preview target link' } )
			.click();

		await page.waitForFunction(
			( iframe ) =>
				iframe.contentWindow.location.href.includes(
					'cnl-editor-preview=1'
				),
			await previewFrame.elementHandle(),
			{ timeout: 15000 }
		);
		await expect(
			documentBar.locator( '.cnl-editor-homepage-document__title' )
		).toHaveText( targetPage.title, { timeout: 15000 } );
		const navigatedFrame = await (
			await previewFrame.elementHandle()
		).contentFrame();
		await expect( navigatedFrame.locator( '#wpadminbar' ) ).toHaveCount(
			0
		);
	} );

	test( 'lists pages as a tree, opens one into its sections, and adds a page', async ( {
		page,
	} ) => {
		await page.goto( '/wp-admin/admin.php?page=create-not-learn-editor' );
		const previewPage = await createPreviewTestPage( page );

		await page.getByRole( 'button', { name: 'Content' } ).click();
		await page.getByRole( 'link', { name: 'Pages' } ).click();
		const pageRow = page.locator( '.cnl-pages-tree__link', {
			hasText: previewPage.title,
		} );
		await expect( pageRow ).toBeVisible( { timeout: 10000 } );
		// The preview canvas is there before any page is picked.
		await expect(
			page.locator( '.cnl-pages-canvas iframe[name="editor-canvas"]' )
		).toBeVisible( { timeout: 15000 } );

		await pageRow.click();
		await expect( page ).toHaveURL(
			new RegExp( `postId%3D${ previewPage.id }` )
		);
		await expect(
			page.locator( '.cnl-page-section:not(.is-site-part)' )
		).toHaveCount( 1, { timeout: 15000 } );
		const pageCanvas = page.frameLocator(
			'.cnl-pages-canvas iframe[name="editor-canvas"]'
		);
		await expect( pageCanvas.getByText( previewPage.body ) ).toBeVisible( {
			timeout: 15000,
		} );
		await expect(
			pageCanvas.getByText( 'This is the Content block' )
		).toHaveCount( 0 );

		await page
			.locator( '.cnl-pages-detail' )
			.getByRole( 'link', { name: 'Pages' } )
			.click();
		await page.getByRole( 'button', { name: 'Add Page' } ).click();
		const designDialog = page.getByRole( 'dialog', {
			name: 'Add a page',
		} );
		await expect( designDialog ).toBeVisible();
		const designDialogBox = await designDialog.boundingBox();
		expect( designDialogBox?.width ).toBeGreaterThan( 680 );
		await expect(
			designDialog.locator( '.cnl-add-page-layout-card' ).first()
		).toBeVisible( { timeout: 15000 } );
		await expect(
			designDialog.getByRole( 'button', { name: 'Add blank' } )
		).toBeVisible();
		const pageTypeTabs = designDialog
			.getByRole( 'tablist', { name: 'Page types' } )
			.getByRole( 'tab' );
		await expect( pageTypeTabs.first() ).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(
			designDialog.getByRole( 'tab', { name: /Other designs/ } )
		).toHaveCount( 0 );
		await expect(
			designDialog.getByRole( 'button', { name: 'Choose a page design' } )
		).toHaveCount( 0 );
		await expect(
			designDialog.getByRole( 'button', { name: 'Start from scratch' } )
		).toHaveCount( 0 );
		// Selecting a page type swaps the panel contents.
		await pageTypeTabs.nth( 1 ).click();
		await expect( pageTypeTabs.nth( 1 ) ).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await pageTypeTabs.first().click();
		// The card corner radius should come from the design system token.
		await expect
			.poll( () =>
				designDialog
					.locator( '.cnl-add-page-layout-card' )
					.first()
					.evaluate( ( element ) => {
						const styles = window.getComputedStyle( element );
						const token = styles
							/* eslint-disable-next-line @wordpress/no-unknown-ds-tokens -- Reading the token value at runtime, not authoring a style. */
							.getPropertyValue( '--wpds-border-radius-lg' )
							.trim();

						return !! token && styles.borderTopLeftRadius === token;
					} )
			)
			.toBe( true );
		// Every preview is framed with the design system stroke tokens.
		await expect
			.poll( () =>
				designDialog
					.locator( '.cnl-add-page-layout-card__preview' )
					.first()
					.evaluate( ( element ) => {
						const styles = window.getComputedStyle( element );
						/* eslint-disable @wordpress/no-unknown-ds-tokens -- Reading token values at runtime, not authoring styles. */
						const width = styles
							.getPropertyValue( '--wpds-border-width-xs' )
							.trim();
						const radius = styles
							.getPropertyValue( '--wpds-border-radius-md' )
							.trim();
						/* eslint-enable @wordpress/no-unknown-ds-tokens */

						return {
							hasBorder:
								!! width &&
								styles.borderTopWidth === width &&
								styles.borderRightWidth === width &&
								styles.borderBottomWidth === width &&
								styles.borderLeftWidth === width,
							hasRadius:
								!! radius &&
								styles.borderTopLeftRadius === radius,
							style: styles.borderTopStyle,
						};
					} )
			)
			.toEqual( { hasBorder: true, hasRadius: true, style: 'solid' } );
		await expect(
			designDialog.getByText( /No page designs are available/ )
		).toHaveCount( 0 );
		// The design preview is its own scroll region.
		const firstPreview = designDialog
			.locator( '.cnl-add-page-layout-preview-page' )
			.first();
		await expect
			.poll( () =>
				firstPreview.evaluate(
					( element ) => element.scrollHeight > element.clientHeight
				)
			)
			.toBe( true );
		await expect( firstPreview ).toHaveCSS( 'overflow-y', 'auto' );
		await firstPreview.evaluate( ( element ) => {
			element.scrollTop = 200;
		} );
		await expect
			.poll( () => firstPreview.evaluate( ( el ) => el.scrollTop ) )
			.toBeGreaterThan( 0 );

		await expect.poll( () => getDesignGridColumnCount( page ) ).toBe( 2 );
		await designDialog
			.getByRole( 'radio', { name: 'Large previews' } )
			.click();
		await expect.poll( () => getDesignGridColumnCount( page ) ).toBe( 1 );
		await expect(
			designDialog.locator( '.cnl-add-page-layout-card' )
		).toHaveCount( 1 );
		// Small previews lay out as a grid rather than full-height columns.
		await designDialog
			.getByRole( 'radio', { name: 'Small previews' } )
			.click();
		await expect.poll( () => getDesignGridColumnCount( page ) ).toBe( 3 );
		await designDialog
			.getByRole( 'radio', { name: 'Medium previews' } )
			.click();
		await expect.poll( () => getDesignGridColumnCount( page ) ).toBe( 2 );
		await writeAddPageParityScreenshot(
			designDialog,
			'choose-page-design-picker.png'
		);
		await designDialog
			.locator( '.cnl-add-page-layout-card' )
			.first()
			.getByRole( 'button', { name: 'Use design' } )
			.click();
		let addPageDialog = page.getByRole( 'dialog', {
			name: 'Name your page',
		} );
		await expect( addPageDialog ).toBeVisible();
		const addPageDialogBox = await addPageDialog.boundingBox();
		expect( addPageDialogBox?.width ).toBeGreaterThanOrEqual( 560 );
		expect( addPageDialogBox?.width ).toBeLessThanOrEqual( 680 );
		await expect(
			addPageDialog.getByText(
				'Your page will be visible to visitors immediately.'
			)
		).toBeVisible();
		const customPreviewTitle = `Preview title ${ Date.now() }`;
		await addPageDialog
			.getByLabel( 'Page title' )
			.fill( customPreviewTitle );
		await expect
			.poll(
				() =>
					getAddPageFormPreviewFrameTexts( page ).then( ( texts ) =>
						texts.some( ( text ) =>
							text.includes( customPreviewTitle )
						)
					),
				{ timeout: 20000 }
			)
			.toBe( true );
		await expect(
			addPageDialog.getByLabel( 'Layout', { exact: true } )
		).toBeVisible();
		const pageTemplateOptionLabels = await addPageDialog
			.getByLabel( 'Layout', { exact: true } )
			.locator( 'option' )
			.allTextContents();
		expect( pageTemplateOptionLabels ).not.toContain( 'Page' );
		await addPageDialog
			.getByLabel( 'Layout', { exact: true } )
			.selectOption( {
				index: 0,
			} );
		await expect(
			addPageDialog.getByLabel( 'Layout', { exact: true } )
		).toHaveValue( '' );
		await expect(
			addPageDialog.getByLabel( 'Layout', { exact: true } )
		).toContainText( 'Standard layout' );
		const backButtonBox = await addPageDialog
			.getByRole( 'button', { name: 'Back to designs' } )
			.boundingBox();
		const createButtonBox = await addPageDialog
			.getByRole( 'button', { name: 'Create page' } )
			.boundingBox();
		expect( createButtonBox.x ).toBeGreaterThan( backButtonBox.x );
		await writeAddPageParityScreenshot(
			addPageDialog,
			'add-page-design-form.png'
		);
		await addPageDialog
			.getByRole( 'button', { name: 'Back to designs' } )
			.click();
		await expect( designDialog ).toBeVisible();

		await designDialog.getByRole( 'button', { name: 'Add blank' } ).click();
		addPageDialog = page.getByRole( 'dialog', {
			name: 'Name your page',
		} );
		await expect( addPageDialog ).toBeVisible();
		await addPageDialog
			.getByLabel( 'Page title' )
			.fill( `Blank parity ${ Date.now() }` );

		// A new page opens in the Pages screen, ready for its first section.
		await Promise.all( [
			page.waitForURL( /p=.*%2Ftypes%2Fpage%2Flist%2Fall.*postId%3D\d+/ ),
			addPageDialog
				.getByRole( 'button', { name: 'Create page' } )
				.click(),
		] );
		await expect( page.locator( '.cnl-pages-detail' ) ).toBeVisible();
		await expect( page.locator( '.cnl-page-sections__empty' ) ).toBeVisible(
			{ timeout: 15000 }
		);
		await expect(
			page.locator( '.cnl-pages-canvas iframe[name="editor-canvas"]' )
		).toBeVisible( { timeout: 15000 } );
	} );

	test( 'opens a page template in the block editor canvas', async ( {
		page,
	} ) => {
		await page.goto( '/wp-admin/admin.php?page=create-not-learn-editor' );

		await page.getByRole( 'button', { name: 'Content' } ).click();
		await page.getByRole( 'link', { name: 'Pages' } ).click();

		const stage = page.locator( '.cnl-editor-stage' );
		const canvas = page.locator( '.cnl-editor-canvas' );

		await stage.getByRole( 'tab', { name: 'Layouts' } ).click();
		await expect( page ).toHaveURL( /content%3Dtemplates/ );
		await expect(
			stage.getByText( /Layouts decide how your pages are arranged/ )
		).toBeVisible();
		const firstTemplateCard = stage
			.locator( '.routes-post-list__template-card' )
			.first();
		await expect( firstTemplateCard ).toBeVisible( { timeout: 10000 } );
		await expect(
			stage.locator( '.routes-post-list__dataviews-toolbar' )
		).toHaveCount( 0 );

		const editTemplateButton = canvas.getByRole( 'button', {
			name: 'Edit template',
		} );
		await expect( editTemplateButton ).toBeEnabled( { timeout: 10000 } );
		await firstTemplateCard.click();
		const previewFrame = await getEditorCanvasFrame( page );
		await expect
			.poll(
				() =>
					previewFrame
						.locator( 'body' )
						.evaluate(
							( body ) =>
								window.getComputedStyle( body ).fontFamily
						),
				{ timeout: 15000 }
			)
			.not.toContain( 'Times New Roman' );

		const openTemplateEditor = page.getByRole( 'button', {
			name: 'Click to edit',
		} );
		await expect( openTemplateEditor ).toBeVisible();
		await Promise.all( [
			page.waitForURL( /p=.*%2Fwp_template%3FpostId%3D/ ),
			openTemplateEditor.click(),
		] );
		await expect(
			page.locator(
				'iframe[src*="post-new.php"], iframe[src*="post.php"]'
			)
		).toHaveCount( 0 );
		await expect(
			page
				.locator(
					[
						'.interface-interface-skeleton',
						'.edit-site-layout',
						'.block-editor-writing-flow',
					].join( ', ' )
				)
				.first()
		).toBeVisible( { timeout: 15000 } );
	} );

	test( 'loads page content and theme styles in the editor canvas', async ( {
		page,
	} ) => {
		await page.goto( '/wp-admin/admin.php?page=create-not-learn-editor' );
		const testPage = await createPreviewTestPage( page );

		await page.goto(
			`/wp-admin/admin.php?page=create-not-learn-editor&p=${ encodeURIComponent(
				`/types/page/edit/${ testPage.id }`
			) }`
		);

		const editorFrame = await getEditorCanvasFrame( page );
		await expect( editorFrame.getByText( testPage.body ) ).toBeVisible( {
			timeout: 15000,
		} );
		await expect
			.poll( () =>
				page.evaluate( ( postId ) => {
					return window.wp.data
						.select( window.wp.coreData.store )
						.hasEditsForEntityRecord( 'postType', 'page', postId );
				}, testPage.id )
			)
			.toBe( false );
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

	test( 'selects a navigation menu preview and opens explicit edit actions', async ( {
		page,
	} ) => {
		await page.goto(
			'/wp-admin/admin.php?page=create-not-learn-editor&p=%2Fnavigation'
		);

		const stage = page.locator( '.cnl-editor-stage' );
		const canvas = page.locator( '.cnl-editor-canvas' );
		const firstMenuTitleButton = stage
			.locator( '.routes-navigation-list__title' )
			.first();

		await expect(
			stage.locator( '.routes-navigation-list__dataviews-toolbar' )
		).toBeVisible( { timeout: 10000 } );
		await expect(
			page.getByRole( 'heading', { name: 'Menus', exact: true } )
		).toBeVisible();
		await expect(
			stage.getByText( /The links visitors use to get around your site/ )
		).toBeVisible();

		if (
			! ( await firstMenuTitleButton
				.isVisible( { timeout: 3000 } )
				.catch( () => false ) )
		) {
			await stage.getByRole( 'button', { name: 'Add menu' } ).click();
			const addNavigationDialog = page.getByRole( 'dialog', {
				name: 'Add a menu',
			} );
			await expect( addNavigationDialog ).toBeVisible();
			await addNavigationDialog
				.getByLabel( 'Name' )
				.fill( `Navigation edit action ${ Date.now() }` );
			await addNavigationDialog
				.getByLabel( 'List every page automatically' )
				.check();
			await addNavigationDialog
				.getByRole( 'button', { name: 'Create Menu' } )
				.click();
			await expect( page ).toHaveURL( /p=.*%2Fnavigation%2Fedit%2F\d+/, {
				timeout: 20000,
			} );
			await page.goto(
				'/wp-admin/admin.php?page=create-not-learn-editor&p=%2Fnavigation'
			);
			await expect(
				stage.locator( '.routes-navigation-list__dataviews-toolbar' )
			).toBeVisible( { timeout: 10000 } );
		}

		await expect( firstMenuTitleButton ).toBeVisible( { timeout: 10000 } );
		const selectedMenuTitle = (
			await firstMenuTitleButton.innerText()
		).trim();
		await firstMenuTitleButton.click();
		await expect( page ).toHaveURL( /p=.*%2Fnavigation.*menuId%3D\d+/ );
		const selectedRoute = new URL( page.url() ).searchParams.get( 'p' );
		const selectedMenuId = selectedRoute?.match( /menuId=(\d+)/ )?.[ 1 ];

		expect( selectedMenuId ).toBeTruthy();
		await expect(
			stage.locator( '.routes-navigation-list__dataviews-toolbar' )
		).toBeVisible();
		await expect( stage.getByText( /\d+ selected/ ) ).toHaveCount( 0 );
		await expect(
			canvas.getByRole( 'heading', {
				name: `Where “${ selectedMenuTitle }” appears`,
			} )
		).toBeVisible( { timeout: 15000 } );
		await expect( canvas ).toHaveCSS( 'padding', '0px' );
		await expect(
			canvas.locator( '.routes-navigation-locations-canvas' )
		).toHaveCSS( 'border-radius', '0px' );
		if (
			await canvas
				.getByRole( 'heading', {
					name: 'This menu is not shown on your site yet',
				} )
				.isVisible()
				.catch( () => false )
		) {
			await expect(
				canvas.locator(
					'.routes-navigation-locations-canvas .cnl-editor-canvas-placeholder'
				)
			).toHaveCount( 0 );
			await expect(
				canvas
					.locator(
						'.routes-navigation-locations-canvas__empty-state'
					)
					.getByText(
						'Choose where this menu should appear, such as your header or footer.'
					)
			).toBeVisible();
		}

		await canvas
			.getByRole( 'button', { name: 'Menu location options' } )
			.click();
		await expect(
			page.getByRole( 'menuitem', { name: 'Edit menu' } )
		).toHaveCount( 0 );
		await expect(
			page.getByRole( 'menuitem', {
				name: /^(Choose location|Update locations)$/,
			} )
		).toBeVisible();
		await page.keyboard.press( 'Escape' );

		await page.goto(
			`/wp-admin/admin.php?page=create-not-learn-editor&p=${ encodeURIComponent(
				`/navigation?menuId=${ selectedMenuId }`
			) }`
		);
		await expect(
			stage.locator( '.routes-navigation-list__dataviews-toolbar' )
		).toBeVisible( { timeout: 10000 } );
		await expect(
			stage.getByRole( 'button', { name: 'Edit' } ).first()
		).toBeVisible( { timeout: 10000 } );
		const rowActionsMenu = stage.getByRole( 'button', {
			name: 'Actions',
		} );
		await expect( rowActionsMenu.first() ).toBeVisible( {
			timeout: 10000,
		} );
		await rowActionsMenu.first().click();
		await expect(
			page.getByRole( 'menuitem', { name: 'Edit' } )
		).toBeVisible();
		await expect(
			page.getByRole( 'menuitem', { name: 'Rename' } )
		).toBeVisible();
		await expect(
			page.getByRole( 'menuitem', { name: 'Duplicate' } )
		).toBeVisible();
		await expect(
			page.getByRole( 'menuitem', { name: 'Delete' } )
		).toBeVisible();
		await Promise.all( [
			page.waitForURL( /p=.*%2Fnavigation%2Fedit%2F\d+/ ),
			page.getByRole( 'menuitem', { name: 'Edit' } ).click(),
		] );
		await expect(
			page.getByRole( 'heading', { name: 'Auto-menu' } )
		).toBeVisible( {
			timeout: 15000,
		} );
	} );

	test( 'opens navigation menus and edits a menu in the block editor canvas', async ( {
		page,
	} ) => {
		await page.goto( '/wp-admin/admin.php?page=create-not-learn-editor' );

		await navigateToNavigationMenus( page );

		await expect( page ).toHaveURL( /p=.*%2Fnavigation/ );
		await expect(
			page.getByRole( 'heading', { name: 'Menus', exact: true } ).first()
		).toBeVisible();

		const stage = page.locator( '.cnl-editor-stage' );
		const canvas = page.locator( '.cnl-editor-canvas' );

		await expect(
			stage.locator( '.routes-navigation-list__dataviews-toolbar' )
		).toBeVisible( { timeout: 10000 } );
		await expect(
			stage
				.locator(
					[
						'.dataviews-view-list',
						'.dataviews-view-table',
						'.dataviews-view-grid',
						'.cnl-editor-empty-state',
					].join( ', ' )
				)
				.first()
		).toBeVisible( { timeout: 10000 } );
		await expect( stage.getByText( /\d+ selected/ ) ).toHaveCount( 0 );

		const firstNavigationMenuButton = stage
			.locator( '.routes-navigation-list__title' )
			.first();
		let selectedNavigationMenuTitle = '';
		if (
			await firstNavigationMenuButton.isVisible().catch( () => false )
		) {
			selectedNavigationMenuTitle = (
				await firstNavigationMenuButton.innerText()
			).trim();
			await firstNavigationMenuButton.click();
			await expect( stage.getByText( /\d+ selected/ ) ).toHaveCount( 0 );
		}

		await expect( stage.getByText( 'Checking usage…' ) ).toHaveCount( 0, {
			timeout: 15000,
		} );
		await expect(
			canvas
				.locator(
					[
						'.routes-navigation-locations-canvas',
						'.cnl-editor-canvas-placeholder',
					].join( ', ' )
				)
				.first()
		).toBeVisible( { timeout: 15000 } );
		if ( selectedNavigationMenuTitle ) {
			await expect(
				canvas.getByRole( 'heading', {
					name: `Where “${ selectedNavigationMenuTitle }” appears`,
				} )
			).toBeVisible();
			await expect(
				canvas.locator( '.routes-navigation-locations-canvas' )
			).toHaveCSS( 'border-radius', '0px' );
			if (
				await canvas
					.locator( '.routes-navigation-locations-canvas__card' )
					.first()
					.isVisible()
					.catch( () => false )
			) {
				await expect(
					canvas
						.locator(
							'.routes-navigation-locations-canvas__preview'
						)
						.first()
				).toBeVisible();
				await expect(
					canvas.getByRole( 'button', { name: 'Edit' } ).first()
				).toBeVisible();
				await expect
					.poll(
						() =>
							getNavigationLocationPreviewFrameTexts( page ).then(
								( texts ) =>
									texts.some( ( text ) => text.trim().length )
							),
						{ timeout: 15000 }
					)
					.toBe( true );
			} else {
				await expect(
					canvas.getByRole( 'heading', {
						name: 'This menu is not shown on your site yet',
					} )
				).toBeVisible();
				await expect(
					canvas.locator(
						'.routes-navigation-locations-canvas .cnl-editor-canvas-placeholder'
					)
				).toHaveCount( 0 );
			}
		} else {
			await expect(
				canvas.getByRole( 'heading', { name: 'No menu selected' } )
			).toBeVisible();
		}

		const autoNavigationTitle = `Auto navigation ${ Date.now() }`;
		await Promise.all( [
			page.waitForURL( /p=.*%2Fnavigation%2Fedit%2F\d+/ ),
			( async () => {
				await stage.getByRole( 'button', { name: 'Add menu' } ).click();
				const addNavigationDialog = page.getByRole( 'dialog', {
					name: 'Add a menu',
				} );
				await expect( addNavigationDialog ).toBeVisible();
				await addNavigationDialog
					.getByLabel( 'Name' )
					.fill( autoNavigationTitle );
				await addNavigationDialog
					.getByLabel( 'List every page automatically' )
					.check();
				await addNavigationDialog
					.getByRole( 'button', { name: 'Create Menu' } )
					.click();
			} )(),
		] );
		await expect(
			page.getByRole( 'heading', { name: 'Auto-menu' } )
		).toBeVisible( {
			timeout: 15000,
		} );
		await expect(
			page.locator( '.routes-navigation-locations-canvas' )
		).toBeVisible( { timeout: 15000 } );
		await expect(
			page.getByRole( 'heading', {
				name: `Where “${ autoNavigationTitle }” appears`,
			} )
		).toBeVisible( { timeout: 15000 } );
		await expect(
			page.locator(
				'.routes-navigation-locations-canvas .cnl-editor-canvas-placeholder'
			)
		).toHaveCount( 0 );
		await expect(
			page.getByText(
				/This menu is kept in sync with your current Pages/
			)
		).toBeVisible();

		await page.getByRole( 'button', { name: 'Customize' } ).click();
		const customizeDialog = page.getByRole( 'dialog', {
			name: 'Customize this menu?',
		} );
		await expect( customizeDialog ).toBeVisible();
		await customizeDialog
			.getByRole( 'button', { name: 'Customize menu' } )
			.click();
		await expectSnackbar(
			page,
			'Navigation menu customized. Review and save changes when you are ready.'
		);
		await expect(
			page.getByRole( 'button', { name: /Review \d+ change/ } )
		).toBeVisible();
		const navigationTree = page.getByRole( 'treegrid', {
			name: 'Block navigation structure',
		} );
		await expect( navigationTree ).toBeVisible();
		const rootAppender = page.getByRole( 'button', {
			name: 'Add menu item',
		} );
		await expect(
			page.getByRole( 'button', { name: 'Add link to menu' } )
		).toHaveCount( 0 );
		await expect( rootAppender ).toBeVisible();

		await rootAppender.click();
		await expect(
			page.getByRole( 'menuitem', { name: 'Add existing page' } )
		).toBeVisible();
		await expect(
			page.getByRole( 'menuitem', { name: 'Custom link' } )
		).toBeVisible();
		await expect(
			page.getByRole( 'menuitem', { name: 'Submenu' } )
		).toBeVisible();
		await expect(
			page.getByRole( 'menuitem', { name: /More/ } )
		).toBeVisible();
		await page.getByRole( 'menuitem', { name: 'Submenu' } ).click();
		await expect(
			page.getByRole( 'menuitem', { name: 'Back' } )
		).toBeVisible();
		await expect(
			page.getByRole( 'menuitem', { name: 'Existing page' } )
		).toBeVisible();
		await expect(
			page.getByRole( 'menuitem', { name: 'Label only' } )
		).toBeVisible();
		await page.getByRole( 'menuitem', { name: 'Back' } ).click();
		await page
			.getByRole( 'menuitem', { name: 'Add existing page' } )
			.click();
		await expect(
			page.getByRole( 'combobox', { name: 'Search or type URL' } )
		).toBeVisible();
		await page.keyboard.press( 'Escape' );
		await expect(
			page.getByRole( 'combobox', { name: 'Search or type URL' } )
		).toHaveCount( 0 );

		await rootAppender.click();
		await page.getByRole( 'menuitem', { name: 'Custom link' } ).click();
		await expect(
			page.getByRole( 'combobox', { name: 'Search or type URL' } )
		).toBeVisible();
		await page.keyboard.press( 'Escape' );
		await expect(
			page.getByRole( 'combobox', { name: 'Search or type URL' } )
		).toHaveCount( 0 );

		const labelOnlySubmenuLabel = `Label submenu ${ Date.now() }`;
		await rootAppender.click();
		await page.getByRole( 'menuitem', { name: 'Submenu' } ).click();
		await page.getByRole( 'menuitem', { name: 'Label only' } ).click();
		await page.getByLabel( 'Submenu label' ).fill( labelOnlySubmenuLabel );
		await page.getByRole( 'button', { name: 'Add drop-down' } ).click();
		await expect(
			navigationTree.getByText( labelOnlySubmenuLabel ).first()
		).toBeVisible();
		await expect(
			navigationTree.getByText( 'This submenu is empty.' )
		).toBeVisible();
		const nestedAppender = page.getByRole( 'button', {
			name: 'Add to submenu',
		} );
		await expect( nestedAppender ).toBeVisible();
		await nestedAppender.click();
		await page.getByRole( 'menuitem', { name: 'Custom link' } ).click();
		await expect(
			page.getByRole( 'combobox', { name: 'Search or type URL' } )
		).toBeVisible();
		await page.keyboard.press( 'Escape' );
		await expect(
			page.getByRole( 'combobox', { name: 'Search or type URL' } )
		).toHaveCount( 0 );

		await nestedAppender.click();
		await page.getByRole( 'menuitem', { name: /More/ } ).click();
		const moreDialog = page.getByRole( 'dialog', {
			name: 'Add menu items',
		} );
		await expect( moreDialog ).toBeVisible();
		await expect(
			moreDialog.getByRole( 'tab', { name: 'Pages' } )
		).toBeVisible();
		await expect(
			moreDialog.locator( '.navigation-add-items-modal__picker-scroll' )
		).toBeVisible();
		await moreDialog.getByRole( 'button', { name: 'More' } ).click();
		await moreDialog.getByRole( 'tab', { name: 'Custom link' } ).click();
		const modalLinkLabel = `Modal nav ${ Date.now() }`;
		await moreDialog
			.getByLabel( 'URL' )
			.fill( 'https://example.com/modal-navigation-test/' );
		await moreDialog.getByLabel( 'Link text' ).fill( modalLinkLabel );
		await moreDialog.getByRole( 'button', { name: 'Add to menu' } ).click();
		await expectSnackbar(
			page,
			'Menu items added. Review and save changes when you are ready.'
		);
		await expect(
			navigationTree.getByText( modalLinkLabel )
		).toBeVisible();

		await page
			.getByRole( 'button', { name: 'Navigation menu options' } )
			.click();
		await Promise.all( [
			page.waitForURL( /p=.*%2Ftypes%2Fwp_navigation%2Fedit%2F\d+/ ),
			page.getByRole( 'menuitem', { name: 'Open block editor' } ).click(),
		] );
		await expect(
			page.locator(
				'iframe[src*="post-new.php"], iframe[src*="post.php"]'
			)
		).toHaveCount( 0 );
		await expect(
			page
				.locator(
					[
						'.interface-interface-skeleton',
						'.edit-site-layout',
						'.edit-navigation-layout',
						'.block-editor-writing-flow',
					].join( ', ' )
				)
				.first()
		).toBeVisible( { timeout: 15000 } );
	} );

	test( 'assigns a navigation menu to a site location from the navigation canvas', async ( {
		page,
	} ) => {
		await page.goto( '/wp-admin/admin.php?page=create-not-learn-editor' );
		const navigationTemplateParts =
			await getNavigationTemplatePartsSnapshot( page );
		const unusedMenu = await getOrCreateUnusedNavigationMenuId( page );

		test.skip(
			navigationTemplateParts.length === 0,
			'No navigation-bearing template parts are available.'
		);

		await navigateToNavigationMenus( page );
		await expect(
			page.getByRole( 'heading', { name: 'Menus', exact: true } ).first()
		).toBeVisible();

		const stage = page.locator( '.cnl-editor-stage' );
		const canvas = page.locator( '.cnl-editor-canvas' );

		await expect(
			stage.locator( '.routes-navigation-list__dataviews-toolbar' )
		).toBeVisible( { timeout: 10000 } );
		await expect( stage.getByText( /\d+ selected/ ) ).toHaveCount( 0 );

		await page.goto(
			`/wp-admin/admin.php?page=create-not-learn-editor&p=${ encodeURIComponent(
				`/navigation?menuId=${ unusedMenu.id }`
			) }`
		);
		await expect(
			page.getByRole( 'heading', { name: 'Menus', exact: true } ).first()
		).toBeVisible();
		await expect(
			canvas.getByRole( 'heading', {
				name: `Where “${ unusedMenu.title }” appears`,
			} )
		).toBeVisible( { timeout: 15000 } );
		await expect(
			canvas
				.getByText(
					'Choose where this menu should appear, such as your header or footer.'
				)
				.first()
		).toBeVisible();
		await expect(
			canvas.getByRole( 'heading', {
				name: 'This menu is not shown on your site yet',
			} )
		).toBeVisible();
		await expect(
			canvas.locator(
				'.routes-navigation-locations-canvas .cnl-editor-canvas-placeholder'
			)
		).toHaveCount( 0 );
		const chooseLocationButton = canvas.getByRole( 'button', {
			name: 'Choose location',
		} );
		await expect( chooseLocationButton ).toBeVisible( { timeout: 15000 } );
		const hasChooseLocation =
			( await chooseLocationButton.count() ) > 0 &&
			( await chooseLocationButton.isVisible() );
		let dialog;
		let applyButtonName;

		if ( hasChooseLocation ) {
			const placeholderDescription = canvas
				.locator( '.routes-navigation-locations-canvas__empty-state' )
				.getByText(
					'Choose where this menu should appear, such as your header or footer.'
				)
				.first();
			const [ descriptionBox, buttonBox ] = await Promise.all( [
				placeholderDescription.boundingBox(),
				chooseLocationButton.boundingBox(),
			] );

			expect(
				buttonBox.y - ( descriptionBox.y + descriptionBox.height )
			).toBeGreaterThan( 12 );
			await chooseLocationButton.click();
			dialog = page.getByRole( 'dialog', {
				name: 'Choose location',
			} );
			await expect( dialog ).toBeVisible();
			await dialog.getByRole( 'checkbox' ).first().check();
			applyButtonName = 'Add to location';
		} else {
			await canvas
				.getByRole( 'button', { name: 'Menu location options' } )
				.click();
			await page
				.getByRole( 'menuitem', { name: 'Update locations' } )
				.click();
			dialog = page.getByRole( 'dialog', {
				name: 'Update locations',
			} );
			applyButtonName = 'Update locations';
		}

		await expect( dialog ).toBeVisible();
		await dialog.getByRole( 'button', { name: applyButtonName } ).click();

		await expectSnackbar(
			page,
			'Menu locations updated. Review and save changes when you are ready.'
		);
		await expect(
			page.getByRole( 'button', { name: /Review \d+ change/ } )
		).toBeVisible();
		const persistedNavigationTemplateParts =
			await getNavigationTemplatePartsSnapshot( page );
		expect( persistedNavigationTemplateParts ).toEqual(
			navigationTemplateParts
		);
		await expect(
			canvas.getByRole( 'button', { name: 'Menu location options' } )
		).toBeVisible();
		await expect(
			canvas.getByRole( 'heading', {
				name: `Where “${ unusedMenu.title }” appears`,
			} )
		).toBeVisible();
		await expect(
			canvas.locator( '.routes-navigation-locations-canvas' )
		).toHaveCSS( 'border-radius', '0px' );
		await expect(
			canvas
				.locator( '.routes-navigation-locations-canvas__card' )
				.first()
		).toBeVisible( { timeout: 15000 } );
		await expect(
			canvas
				.locator( '.routes-navigation-locations-canvas__card-header' )
				.first()
		).toBeVisible();
		await expect
			.poll(
				async () => {
					const box = await canvas
						.locator(
							'.routes-navigation-locations-canvas__card-header'
						)
						.first()
						.boundingBox();

					return box?.height || 0;
				},
				{ timeout: 15000 }
			)
			.toBeLessThanOrEqual( 64 );
		await expect(
			canvas
				.locator( '.routes-navigation-locations-canvas__preview' )
				.first()
		).toBeVisible();
		await expect
			.poll(
				() =>
					getNavigationLocationPreviewFrameTexts( page ).then(
						( texts ) =>
							texts.some( ( text ) => text.trim().length )
					),
				{ timeout: 15000 }
			)
			.toBe( true );
	} );

	test( 'renames and deletes a navigation menu from the selected-menu route', async ( {
		page,
	} ) => {
		const renamedMenuTitle = `Renamed navigation ${ Date.now() }`;

		await page.goto( '/wp-admin/admin.php?page=create-not-learn-editor' );

		await navigateToNavigationMenus( page );
		await expect(
			page.getByRole( 'heading', { name: 'Menus', exact: true } ).first()
		).toBeVisible();

		const stage = page.locator( '.cnl-editor-stage' );
		await expect(
			stage.locator( '.routes-navigation-list__dataviews-toolbar' )
		).toBeVisible( { timeout: 10000 } );

		await Promise.all( [
			page.waitForURL( /p=.*%2Fnavigation%2Fedit%2F\d+/ ),
			( async () => {
				await stage.getByRole( 'button', { name: 'Add menu' } ).click();
				const addNavigationDialog = page.getByRole( 'dialog', {
					name: 'Add a menu',
				} );
				await expect( addNavigationDialog ).toBeVisible();
				await addNavigationDialog
					.getByLabel( 'Name' )
					.fill( `Manual navigation ${ Date.now() }` );
				await addNavigationDialog
					.getByRole( 'button', { name: 'Create Menu' } )
					.click();
			} )(),
		] );

		await page
			.getByRole( 'button', { name: 'Navigation menu options' } )
			.click();
		await page.getByRole( 'menuitem', { name: 'Rename' } ).click();
		const renameDialog = page.getByRole( 'dialog', {
			name: 'Rename navigation menu',
		} );
		await expect( renameDialog ).toBeVisible();
		await renameDialog.getByLabel( 'Name' ).fill( renamedMenuTitle );
		await renameDialog.getByRole( 'button', { name: 'Save' } ).click();
		await expectSnackbar(
			page,
			'Navigation menu renamed. Review and save changes when you are ready.'
		);
		await expect(
			page.getByRole( 'button', { name: /Review \d+ change/ } )
		).toBeVisible();
		await expect(
			page.getByRole( 'heading', { name: renamedMenuTitle } )
		).toBeVisible();

		await page
			.getByRole( 'button', { name: 'Navigation menu options' } )
			.click();
		await page.getByRole( 'menuitem', { name: 'Delete' } ).click();
		const deleteDialog = page.getByRole( 'dialog', {
			name: 'Delete navigation menu',
		} );
		await expect( deleteDialog ).toBeVisible();
		await expect(
			deleteDialog.getByText( renamedMenuTitle )
		).toBeVisible();
		await deleteDialog.getByRole( 'button', { name: 'Delete' } ).click();
		await expect
			.poll( () => new URL( page.url() ).searchParams.get( 'p' ), {
				timeout: 15000,
			} )
			.toBe( '/navigation' );
		await expect(
			page.getByRole( 'heading', { name: 'Menus', exact: true } ).first()
		).toBeVisible();
		await expect( page.getByText( renamedMenuTitle ) ).toHaveCount( 0 );
	} );

	test( 'opens Templates as a full-width list', async ( { page } ) => {
		await page.goto( '/wp-admin/admin.php?page=create-not-learn-editor' );

		await page.getByRole( 'button', { name: 'Advanced' } ).click();
		await page.getByRole( 'link', { name: 'Layouts' } ).click();

		await expect( page ).toHaveURL( /p=.*%2Ftemplates/ );

		const stage = page.locator( '.cnl-editor-stage' );

		await expect(
			stage.getByRole( 'heading', { name: 'Layouts' } )
		).toBeVisible();
		await expect( stage.locator( '.dataviews-search' ) ).toBeVisible( {
			timeout: 15000,
		} );
		await expect(
			stage.locator( '.dataviews-view-grid, .dataviews-view-list' )
		).toBeVisible( { timeout: 15000 } );
		await expect( page.locator( '.boot-layout__canvas' ) ).toHaveCount( 0 );
	} );

	test( 'creates a template from the Templates route in the plugin canvas', async ( {
		page,
	} ) => {
		const templateTitle = `Created template ${ Date.now() }`;

		await page.goto( '/wp-admin/admin.php?page=create-not-learn-editor' );
		await page.getByRole( 'button', { name: 'Advanced' } ).click();
		await page.getByRole( 'link', { name: 'Layouts' } ).click();
		await expect( page ).toHaveURL( /p=.*%2Ftemplates/ );

		const stage = page.locator( '.cnl-editor-stage' );

		await expect(
			stage.getByRole( 'button', { name: 'Add layout' } )
		).toBeVisible( { timeout: 15000 } );
		await stage.getByRole( 'button', { name: 'Add layout' } ).click();

		const dialog = page.getByRole( 'dialog', {
			name: 'Add a layout',
		} );
		await expect( dialog ).toBeVisible();
		await dialog.getByLabel( 'Name' ).fill( templateTitle );
		await dialog.getByRole( 'button', { name: 'Add' } ).click();

		await expect( page ).toHaveURL( /p=.*%2Fwp_template/, {
			timeout: 15000,
		} );
		await expect(
			page.locator(
				'iframe[src*="post-new.php"], iframe[src*="post.php"]'
			)
		).toHaveCount( 0 );
		await expect(
			page
				.locator(
					[
						'.interface-interface-skeleton',
						'.edit-site-layout',
						'.block-editor-writing-flow',
					].join( ', ' )
				)
				.first()
		).toBeVisible( { timeout: 15000 } );

		const urlParams = new URL( page.url() ).searchParams;
		const routePath = urlParams.get( 'p' ) || '';
		const routeSearch = routePath.includes( '?' )
			? new URLSearchParams( routePath.split( '?' )[ 1 ] )
			: new URLSearchParams();
		const createdTemplateId =
			urlParams.get( 'postId' ) || routeSearch.get( 'postId' );

		expect( createdTemplateId ).toBeTruthy();

		const createdTemplate = await page.evaluate(
			async ( { id, title } ) => {
				const response = await window.fetch(
					'/wp-json/wp/v2/templates?context=edit&per_page=100&_fields=id,title,slug',
					{
						headers: {
							'X-WP-Nonce': window.createNotLearnEditor.nonce,
						},
					}
				);

				if ( ! response.ok ) {
					throw new Error( await response.text() );
				}

				const templates = await response.json();

				return templates.find(
					( template ) =>
						String( template.id ) === String( id ) ||
						template.title?.raw === title ||
						template.title?.rendered === title
				);
			},
			{
				id: createdTemplateId,
				title: templateTitle,
			}
		);

		expect(
			createdTemplate?.title?.raw || createdTemplate?.title?.rendered
		).toBe( templateTitle );
	} );

	test( 'opens Template Parts as a full-width list', async ( { page } ) => {
		await page.goto( '/wp-admin/admin.php?page=create-not-learn-editor' );

		await page.getByRole( 'button', { name: 'Advanced' } ).click();
		await page.getByRole( 'link', { name: 'Site parts' } ).click();

		await expect( page ).toHaveURL( /p=.*%2Ftemplate-parts/ );

		const stage = page.locator( '.cnl-editor-stage' );

		await expect(
			stage.getByRole( 'heading', { name: 'Site parts' } )
		).toBeVisible();
		await expect(
			stage.getByRole( 'tab', { name: 'All', exact: true } )
		).toBeVisible();
		await expect(
			stage.getByRole( 'tab', { name: 'Headers' } )
		).toBeVisible();
		await expect( stage.locator( '.dataviews-search' ) ).toBeVisible( {
			timeout: 15000,
		} );
		await expect(
			stage.locator( '.dataviews-view-grid, .dataviews-view-list' )
		).toBeVisible( { timeout: 15000 } );
		await expect( page.locator( '.boot-layout__canvas' ) ).toHaveCount( 0 );
	} );

	test( 'creates a template part from the Template Parts route in the plugin canvas', async ( {
		page,
	} ) => {
		const templatePartTitle = `Created template part ${ Date.now() }`;

		await page.goto( '/wp-admin/admin.php?page=create-not-learn-editor' );
		await page.getByRole( 'button', { name: 'Advanced' } ).click();
		await page.getByRole( 'link', { name: 'Site parts' } ).click();
		await expect( page ).toHaveURL( /p=.*%2Ftemplate-parts/ );

		const stage = page.locator( '.cnl-editor-stage' );

		await expect(
			stage.getByRole( 'button', { name: 'Add site part' } )
		).toBeVisible( { timeout: 15000 } );
		await stage.getByRole( 'button', { name: 'Add site part' } ).click();

		const dialog = page.getByRole( 'dialog', {
			name: 'Add a site part',
		} );
		await expect( dialog ).toBeVisible();
		await dialog.getByLabel( 'Name' ).fill( templatePartTitle );
		await dialog.getByRole( 'combobox' ).selectOption( {
			label: 'Header',
		} );
		await dialog.getByRole( 'button', { name: 'Add' } ).click();

		await expect( page ).toHaveURL( /p=.*%2Fwp_template_part/, {
			timeout: 15000,
		} );
		await expect(
			page.locator(
				'iframe[src*="post-new.php"], iframe[src*="post.php"]'
			)
		).toHaveCount( 0 );
		await expect(
			page
				.locator(
					[
						'.interface-interface-skeleton',
						'.edit-site-layout',
						'.block-editor-writing-flow',
					].join( ', ' )
				)
				.first()
		).toBeVisible( { timeout: 15000 } );

		const urlParams = new URL( page.url() ).searchParams;
		const routePath = urlParams.get( 'p' ) || '';
		const routeSearch = routePath.includes( '?' )
			? new URLSearchParams( routePath.split( '?' )[ 1 ] )
			: new URLSearchParams();
		const createdTemplatePartId =
			urlParams.get( 'postId' ) || routeSearch.get( 'postId' );

		expect( createdTemplatePartId ).toBeTruthy();

		const createdTemplatePart = await page.evaluate(
			async ( { id, title } ) => {
				const response = await window.fetch(
					'/wp-json/wp/v2/template-parts?context=edit&per_page=100&_fields=id,title,area,slug',
					{
						headers: {
							'X-WP-Nonce': window.createNotLearnEditor.nonce,
						},
					}
				);

				if ( ! response.ok ) {
					throw new Error( await response.text() );
				}

				const templateParts = await response.json();

				return templateParts.find(
					( templatePart ) =>
						String( templatePart.id ) === String( id ) ||
						templatePart.title?.raw === title ||
						templatePart.title?.rendered === title
				);
			},
			{
				id: createdTemplatePartId,
				title: templatePartTitle,
			}
		);

		expect(
			createdTemplatePart?.title?.raw ||
				createdTemplatePart?.title?.rendered
		).toBe( templatePartTitle );
		expect( createdTemplatePart?.area ).toBe( 'header' );
	} );

	test( 'opens Patterns as a full-width list', async ( { page } ) => {
		await page.goto( '/wp-admin/admin.php?page=create-not-learn-editor' );
		const pattern = await createTestPattern( page );

		await page.getByRole( 'button', { name: 'Advanced' } ).click();
		await page.getByRole( 'link', { name: 'Sections' } ).click();

		await expect( page ).toHaveURL( /p=.*%2Fpatterns/ );

		const stage = page.locator( '.cnl-editor-stage' );

		await expect(
			stage.getByRole( 'heading', { name: 'Sections' } )
		).toBeVisible();
		await expect(
			stage.getByRole( 'tab', { name: 'All sections' } )
		).toBeVisible();
		await stage.getByRole( 'tab', { name: 'Saved by you' } ).click();
		await expect( page ).toHaveURL( /type(?:=|%3D)my-patterns/ );
		await expect( stage.locator( '.dataviews-search' ) ).toBeVisible( {
			timeout: 15000,
		} );
		await stage.locator( '.dataviews-search input' ).fill( pattern.title );
		await expect( stage.getByText( pattern.title ) ).toBeVisible( {
			timeout: 15000,
		} );
		await stage
			.getByRole( 'button' )
			.filter( { hasText: pattern.title } )
			.first()
			.click();
		await expect( page.locator( '.boot-layout__canvas' ) ).toHaveCount( 0 );
	} );

	test( 'creates a pattern from the Patterns route in the plugin canvas', async ( {
		page,
	} ) => {
		const patternTitle = `Created pattern ${ Date.now() }`;

		await page.goto( '/wp-admin/admin.php?page=create-not-learn-editor' );
		await page.getByRole( 'button', { name: 'Advanced' } ).click();
		await page.getByRole( 'link', { name: 'Sections' } ).click();
		await expect( page ).toHaveURL( /p=.*%2Fpatterns/ );

		const stage = page.locator( '.cnl-editor-stage' );

		await expect(
			stage.getByRole( 'button', { name: 'Add section' } )
		).toBeVisible( { timeout: 15000 } );
		await stage.getByRole( 'button', { name: 'Add section' } ).click();

		const dialog = page.getByRole( 'dialog', {
			name: 'Add a section',
		} );
		await expect( dialog ).toBeVisible();
		await dialog.getByLabel( 'Name' ).fill( patternTitle );
		await dialog.getByRole( 'combobox' ).selectOption( {
			label: 'Let each copy be changed on its own',
		} );
		await dialog.getByRole( 'button', { name: 'Add' } ).click();

		await expect( page ).toHaveURL(
			/p=.*%2Ftypes%2Fwp_block%2Fedit%2F\d+/,
			{
				timeout: 15000,
			}
		);
		await expect(
			page.locator(
				'iframe[src*="post-new.php"], iframe[src*="post.php"]'
			)
		).toHaveCount( 0 );
		await expect(
			page
				.locator(
					[
						'.interface-interface-skeleton',
						'.edit-site-layout',
						'.block-editor-writing-flow',
					].join( ', ' )
				)
				.first()
		).toBeVisible( { timeout: 15000 } );

		const routePath = new URL( page.url() ).searchParams.get( 'p' ) || '';
		const patternId = decodeURIComponent( routePath ).match(
			/\/types\/wp_block\/edit\/(\d+)/
		)?.[ 1 ];

		expect( patternId ).toBeTruthy();

		const createdPattern = await page.evaluate( async ( id ) => {
			const response = await window.fetch(
				`/wp-json/wp/v2/blocks/${ id }?context=edit`,
				{
					headers: {
						'X-WP-Nonce': window.createNotLearnEditor.nonce,
					},
				}
			);

			if ( ! response.ok ) {
				throw new Error( await response.text() );
			}

			return response.json();
		}, patternId );

		expect(
			createdPattern.title?.raw || createdPattern.title?.rendered
		).toBe( patternTitle );
	} );

	test( 'picks a look in Colors & fonts and previews it before saving', async ( {
		page,
	} ) => {
		await page.goto( '/wp-admin/admin.php?page=create-not-learn-editor' );

		await page.getByRole( 'button', { name: 'Design' } ).click();
		await page.getByRole( 'link', { name: 'Colors & fonts' } ).click();

		await expect( page ).toHaveURL( /p=.*%2Fstyles/ );

		const stage = page.locator( '.cnl-editor-stage' );
		const canvas = page.locator( '.cnl-editor-canvas' );

		await expect(
			stage.getByRole( 'heading', { name: 'Colors & fonts' } )
		).toBeVisible();
		await expect(
			stage.getByRole( 'heading', { name: 'Pick a look' } )
		).toBeVisible( { timeout: 15000 } );
		await expect(
			stage.getByRole( 'heading', { name: 'Fine-tune' } )
		).toBeVisible();
		await expect(
			canvas.locator( '.routes-navigation-canvas__preview' )
		).toBeVisible( { timeout: 15000 } );

		const looks = stage.locator( '.routes-styles__look' );
		await expect(
			stage.getByRole( 'button', { name: 'Theme default' } ).first()
		).toHaveAttribute( 'aria-pressed', 'true' );

		if ( ( await looks.count() ) > 1 ) {
			await looks.nth( 1 ).click();
			await expect( looks.nth( 1 ) ).toHaveAttribute(
				'aria-pressed',
				'true'
			);
			await expect(
				stage.getByText( /You are previewing changes/ )
			).toBeVisible();
			await expect(
				page.getByRole( 'button', { name: /Review \d+ change/ } )
			).toBeVisible();

			await stage.getByRole( 'button', { name: 'Undo changes' } ).click();
			await expect(
				stage.getByText( /You are previewing changes/ )
			).toHaveCount( 0 );
		}

		await stage.getByRole( 'radio', { name: 'Airy' } ).click();
		await expect(
			stage.getByText( /You are previewing changes/ )
		).toBeVisible();
		await stage.getByRole( 'button', { name: 'Undo changes' } ).click();
		await expect(
			stage.getByText( /You are previewing changes/ )
		).toHaveCount( 0 );
	} );

	test( 'updates site name and tagline from Name & logo with a live preview', async ( {
		page,
	} ) => {
		const timestamp = Date.now();
		const title = `Create Not Learn ${ timestamp }`;
		const tagline = `Prototype parity ${ timestamp }`;

		await page.goto( '/wp-admin/admin.php?page=create-not-learn-editor' );

		await page.getByRole( 'button', { name: 'Design' } ).click();
		await page.getByRole( 'link', { name: 'Name & logo' } ).click();

		await expect( page ).toHaveURL( /p=.*%2Fidentity/ );

		const stage = page.locator( '.cnl-editor-stage' );
		const preview = page.frameLocator(
			'.routes-navigation-canvas__preview iframe[name="editor-canvas"]'
		);

		await expect( stage.getByText( 'Logo', { exact: true } ) ).toBeVisible(
			{ timeout: 15000 }
		);
		await expect(
			stage.getByText( 'Browser icon', { exact: true } )
		).toBeVisible();
		await expect(
			stage.getByRole( 'button', { name: 'Choose image' } )
		).toHaveCount( 2 );

		await stage.getByLabel( 'Site name' ).fill( title );
		await stage.getByLabel( 'Tagline' ).fill( tagline );

		// The preview reads unsaved edits, so the header updates before saving.
		await expect( preview.getByText( title ).first() ).toBeVisible( {
			timeout: 15000,
		} );

		await stage.getByRole( 'button', { name: 'Save changes' } ).click();
		await expect(
			stage.getByText( /You are previewing changes/ )
		).toHaveCount( 0, { timeout: 15000 } );

		const savedSettings = await page.evaluate( async () => {
			const response = await window.fetch(
				'/wp-json/wp/v2/settings?_fields=title,description',
				{
					headers: {
						'X-WP-Nonce': window.createNotLearnEditor.nonce,
					},
				}
			);

			return response.json();
		} );

		expect( savedSettings.title ).toBe( title );
		expect( savedSettings.description ).toBe( tagline );
	} );
} );
