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

async function getPagePreviewFrameTexts( page ) {
	return getPreviewFrameTexts( page, '.cnl-editor-dataviews-preview iframe' );
}

async function getNavigationLocationPreviewFrameTexts( page ) {
	return getPreviewFrameTexts(
		page,
		'.routes-navigation-locations-canvas__preview iframe'
	);
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

async function navigateToNavigationMenus( page ) {
	await page.getByRole( 'link', { name: 'Navigation Menus' } ).click();
}

async function createPreviewTestPage( page ) {
	const timestamp = Date.now();
	const title = `Preview parity ${ timestamp }`;
	const body = `Preview parity body ${ timestamp }`;

	await page.waitForFunction( () =>
		Boolean( window.createNotLearnEditor?.nonce )
	);

	const createdPage = await page.evaluate(
		async ( { body: pageBody, title: pageTitle } ) => {
			const response = await window.fetch( '/wp-json/wp/v2/pages', {
				body: JSON.stringify( {
					content: `<!-- wp:paragraph --><p>${ pageBody }</p><!-- /wp:paragraph -->`,
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
		{ body, title }
	);

	return {
		body,
		id: createdPage.id,
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
		await page.goto( '/wp-admin/admin.php?page=create-not-learn-editor' );

		const previewCanvas = page.locator( '.cnl-editor-preview-canvas' );
		const previewFrame = previewCanvas.locator(
			'iframe[title="Homepage preview"]'
		);
		const frameWrap = previewCanvas.locator(
			'.cnl-editor-preview-canvas__frame-wrap'
		);
		const toolbar = previewCanvas.locator( '.cnl-editor-homepage-toolbar' );

		await expect( previewFrame ).toBeVisible();
		await expect( previewFrame ).toHaveAttribute(
			'src',
			/cnl-editor-preview=1/
		);
		await expect(
			toolbar.getByRole( 'button', { name: 'Back in preview' } )
		).toBeDisabled();
		await expect(
			toolbar.getByRole( 'button', { name: 'Forward in preview' } )
		).toBeDisabled();
		await expect(
			toolbar.getByRole( 'link', { name: 'View site in new tab' } )
		).toHaveAttribute( 'target', '_blank' );

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

	test( 'opens the Add Page flow and creates a blank page in the block editor canvas', async ( {
		page,
	} ) => {
		await page.goto( '/wp-admin/admin.php?page=create-not-learn-editor' );
		const previewPage = await createPreviewTestPage( page );

		await page.getByRole( 'button', { name: 'Content' } ).click();
		await page.getByRole( 'link', { name: 'Pages' } ).click();
		await expect(
			page.locator( '.routes-post-list__dataviews-toolbar' )
		).toBeVisible();
		await expect(
			page
				.locator(
					[
						'.dataviews-view-grid',
						'.dataviews-view-table',
						'.dataviews-view-list',
					].join( ', ' )
				)
				.first()
		).toBeVisible( { timeout: 10000 } );
		const pagePreview = page
			.locator( '.cnl-editor-dataviews-preview' )
			.first();
		await expect( pagePreview ).toBeVisible( { timeout: 15000 } );
		await expect(
			pagePreview.locator( '.lazy-editor-block-preview__container' )
		).toBeVisible( { timeout: 15000 } );
		await expect(
			pagePreview.locator( '.dashicons-admin-page' )
		).toHaveCount( 0 );
		await expect
			.poll(
				() =>
					getPagePreviewFrameTexts( page ).then( ( texts ) =>
						texts.some( ( text ) =>
							text.includes( previewPage.body )
						)
					),
				{ timeout: 15000 }
			)
			.toBe( true );
		await expect
			.poll(
				() =>
					getPagePreviewFrameTexts( page ).then( ( texts ) =>
						texts.some( ( text ) =>
							text.includes( 'This is the Content block' )
						)
					),
				{ timeout: 15000 }
			)
			.toBe( false );
		await page.getByRole( 'button', { name: 'Add Page' } ).click();
		let addPageDialog = page.getByRole( 'dialog', {
			name: 'Add a new page',
		} );
		await expect( addPageDialog ).toBeVisible();
		await expect(
			addPageDialog.getByRole( 'button', {
				name: /Choose a page design/,
			} )
		).toBeVisible();
		await expect(
			addPageDialog.getByRole( 'button', {
				name: /Start from scratch/,
			} )
		).toBeVisible();

		await addPageDialog
			.getByRole( 'button', { name: /Choose a page design/ } )
			.click();
		const designDialog = page.getByRole( 'dialog', {
			name: 'Choose a page design',
		} );
		await expect( designDialog ).toBeVisible();
		await expect(
			designDialog.getByRole( 'button', { name: 'Start blank' } )
		).toBeVisible();
		await expect(
			designDialog.getByRole( 'button', { name: 'Back to options' } )
		).toBeVisible();
		await designDialog
			.getByRole( 'button', { name: 'Back to options' } )
			.click();

		addPageDialog = page.getByRole( 'dialog', {
			name: 'Add a new page',
		} );
		await addPageDialog
			.getByRole( 'button', { name: /Start from scratch/ } )
			.click();
		await addPageDialog
			.getByLabel( 'Page title' )
			.fill( `Blank parity ${ Date.now() }` );

		await Promise.all( [
			page.waitForURL( /p=.*%2Ftypes%2Fpage%2Fedit%2F\d+/ ),
			addPageDialog
				.getByRole( 'button', { name: 'Create and edit' } )
				.click(),
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
						'.edit-post-layout',
						'.block-editor-writing-flow',
					].join( ', ' )
				)
				.first()
		).toBeVisible();
	} );

	test( 'opens a page template in the block editor canvas', async ( {
		page,
	} ) => {
		await page.goto( '/wp-admin/admin.php?page=create-not-learn-editor' );

		await page.getByRole( 'button', { name: 'Content' } ).click();
		await page.getByRole( 'link', { name: 'Pages' } ).click();

		const stage = page.locator( '.cnl-editor-stage' );
		const canvas = page.locator( '.cnl-editor-canvas' );

		await stage.getByRole( 'tab', { name: 'Templates' } ).click();
		await expect( page ).toHaveURL( /content%3Dtemplates/ );
		await expect(
			stage.getByText( /Templates control the layout used by pages/ )
		).toBeVisible();
		await expect(
			stage.locator( '.routes-post-list__template-card' ).first()
		).toBeVisible( { timeout: 10000 } );
		await expect(
			stage.locator( '.routes-post-list__dataviews-toolbar' )
		).toHaveCount( 0 );

		const editTemplateButton = canvas.getByRole( 'button', {
			name: 'Edit template',
		} );
		await expect( editTemplateButton ).toBeEnabled( { timeout: 10000 } );

		await Promise.all( [
			page.waitForURL( /p=.*%2Fwp_template%3FpostId%3D/ ),
			editTemplateButton.click(),
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
			page.getByRole( 'heading', { name: 'Navigation Menus' } )
		).toBeVisible();
		await expect(
			stage.getByText( 'Manage menus for the site.' )
		).toBeVisible();

		if (
			! ( await firstMenuTitleButton
				.isVisible( { timeout: 3000 } )
				.catch( () => false ) )
		) {
			await stage.getByRole( 'button', { name: 'Add New' } ).click();
			const addNavigationDialog = page.getByRole( 'dialog', {
				name: 'Add New Navigation Menu',
			} );
			await expect( addNavigationDialog ).toBeVisible();
			await addNavigationDialog
				.getByLabel( 'Name' )
				.fill( `Navigation edit action ${ Date.now() }` );
			await addNavigationDialog
				.getByLabel( 'Auto sync with site pages' )
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
				name: `${ selectedMenuTitle } menu locations`,
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
			page.getByRole( 'heading', { name: 'Navigation Menus' } ).first()
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
					name: `${ selectedNavigationMenuTitle } menu locations`,
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
				await stage.getByRole( 'button', { name: 'Add New' } ).click();
				const addNavigationDialog = page.getByRole( 'dialog', {
					name: 'Add New Navigation Menu',
				} );
				await expect( addNavigationDialog ).toBeVisible();
				await addNavigationDialog
					.getByLabel( 'Name' )
					.fill( autoNavigationTitle );
				await addNavigationDialog
					.getByLabel( 'Auto sync with site pages' )
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
				name: `${ autoNavigationTitle } menu locations`,
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
			page.getByRole( 'heading', { name: 'Navigation Menus' } ).first()
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
			page.getByRole( 'heading', { name: 'Navigation Menus' } ).first()
		).toBeVisible();
		await expect(
			canvas.getByRole( 'heading', {
				name: `${ unusedMenu.title } menu locations`,
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
				name: `${ unusedMenu.title } menu locations`,
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
			page.getByRole( 'heading', { name: 'Navigation Menus' } ).first()
		).toBeVisible();

		const stage = page.locator( '.cnl-editor-stage' );
		await expect(
			stage.locator( '.routes-navigation-list__dataviews-toolbar' )
		).toBeVisible( { timeout: 10000 } );

		await Promise.all( [
			page.waitForURL( /p=.*%2Fnavigation%2Fedit%2F\d+/ ),
			( async () => {
				await stage.getByRole( 'button', { name: 'Add New' } ).click();
				const addNavigationDialog = page.getByRole( 'dialog', {
					name: 'Add New Navigation Menu',
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
			page.getByRole( 'heading', { name: 'Navigation Menus' } ).first()
		).toBeVisible();
		await expect( page.getByText( renamedMenuTitle ) ).toHaveCount( 0 );
	} );

	test( 'opens Templates as a full-width list', async ( { page } ) => {
		await page.goto( '/wp-admin/admin.php?page=create-not-learn-editor' );

		await page.getByRole( 'button', { name: 'Advanced' } ).click();
		await page.getByRole( 'link', { name: 'Templates' } ).click();

		await expect( page ).toHaveURL( /p=.*%2Ftemplates/ );

		const stage = page.locator( '.cnl-editor-stage' );

		await expect(
			stage.getByRole( 'heading', { name: 'Templates' } )
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
		await page.getByRole( 'link', { name: 'Templates' } ).click();
		await expect( page ).toHaveURL( /p=.*%2Ftemplates/ );

		const stage = page.locator( '.cnl-editor-stage' );

		await expect(
			stage.getByRole( 'button', { name: 'Add New Template' } )
		).toBeVisible( { timeout: 15000 } );
		await stage.getByRole( 'button', { name: 'Add New Template' } ).click();

		const dialog = page.getByRole( 'dialog', {
			name: 'Add new template',
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
		await page.getByRole( 'link', { name: 'Template Parts' } ).click();

		await expect( page ).toHaveURL( /p=.*%2Ftemplate-parts/ );

		const stage = page.locator( '.cnl-editor-stage' );

		await expect(
			stage.getByRole( 'heading', { name: 'Template Parts' } )
		).toBeVisible();
		await expect(
			stage.getByRole( 'tab', { name: 'All Template Parts' } )
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
		await page.getByRole( 'link', { name: 'Template Parts' } ).click();
		await expect( page ).toHaveURL( /p=.*%2Ftemplate-parts/ );

		const stage = page.locator( '.cnl-editor-stage' );

		await expect(
			stage.getByRole( 'button', { name: 'Add New Template Part' } )
		).toBeVisible( { timeout: 15000 } );
		await stage
			.getByRole( 'button', { name: 'Add New Template Part' } )
			.click();

		const dialog = page.getByRole( 'dialog', {
			name: 'Add new template part',
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
		await page.getByRole( 'link', { name: 'Patterns' } ).click();

		await expect( page ).toHaveURL( /p=.*%2Fpatterns/ );

		const stage = page.locator( '.cnl-editor-stage' );

		await expect(
			stage.getByRole( 'heading', { name: 'Patterns' } )
		).toBeVisible();
		await expect(
			stage.getByRole( 'tab', { name: 'All patterns' } )
		).toBeVisible();
		await stage.getByRole( 'tab', { name: 'My patterns' } ).click();
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
		await page.getByRole( 'link', { name: 'Patterns' } ).click();
		await expect( page ).toHaveURL( /p=.*%2Fpatterns/ );

		const stage = page.locator( '.cnl-editor-stage' );

		await expect(
			stage.getByRole( 'button', { name: 'Add New Pattern' } )
		).toBeVisible( { timeout: 15000 } );
		await stage.getByRole( 'button', { name: 'Add New Pattern' } ).click();

		const dialog = page.getByRole( 'dialog', {
			name: 'Add new pattern',
		} );
		await expect( dialog ).toBeVisible();
		await dialog.getByLabel( 'Name' ).fill( patternTitle );
		await dialog.getByRole( 'combobox' ).selectOption( {
			label: 'Not synced',
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

	test( 'opens Styles and stages style variation changes', async ( {
		page,
	} ) => {
		await page.goto( '/wp-admin/admin.php?page=create-not-learn-editor' );

		await page.getByRole( 'button', { name: 'Design' } ).click();
		await page.getByRole( 'link', { name: 'Styles' } ).click();

		await expect( page ).toHaveURL( /p=.*%2Fstyles/ );

		const stage = page.locator( '.cnl-editor-stage' );
		const canvas = page.locator( '.cnl-editor-canvas' );

		await expect(
			stage.getByRole( 'heading', { name: 'Styles' } )
		).toBeVisible();
		await expect(
			stage.getByRole( 'heading', { name: 'Style variations' } )
		).toBeVisible( { timeout: 15000 } );
		await expect(
			canvas.locator( 'iframe[title="Site preview"]' )
		).toBeVisible( {
			timeout: 15000,
		} );

		await stage.getByRole( 'button', { name: 'Style Book' } ).click();
		await expect(
			canvas.locator( '.routes-styles-preview' ).getByText( 'Style Book' )
		).toBeVisible();
		await expect(
			canvas.getByText( 'Typography, colors, and blocks' )
		).toBeVisible();

		const applyButtons = stage.getByRole( 'button', {
			name: 'Apply styles',
		} );

		if ( ( await applyButtons.count() ) > 0 ) {
			await applyButtons.first().click();
			await expect(
				stage.getByText( /Review and save changes/ )
			).toBeVisible();
			await expect(
				page.getByRole( 'button', { name: /Review \d+ change/ } )
			).toBeVisible();
		} else {
			await expect(
				stage.getByText(
					'No style variations are available for this theme.'
				)
			).toBeVisible();
		}
	} );

	test( 'updates site title and tagline from Site Identity', async ( {
		page,
	} ) => {
		const timestamp = Date.now();
		const title = `Create Not Learn ${ timestamp }`;
		const tagline = `Prototype parity ${ timestamp }`;

		await page.goto( '/wp-admin/admin.php?page=create-not-learn-editor' );

		await page.getByRole( 'button', { name: 'Design' } ).click();
		await page.getByRole( 'link', { name: 'Site Identity' } ).click();

		await expect( page ).toHaveURL( /p=.*%2Fidentity/ );

		const stage = page.locator( '.cnl-editor-stage' );
		const canvas = page.locator( '.cnl-editor-canvas' );

		await expect( stage.getByText( 'Site Logo' ) ).toBeVisible();
		await expect( stage.getByText( 'Site Icon' ) ).toBeVisible();
		await expect(
			stage.getByRole( 'button', { name: 'Choose image' } )
		).toHaveCount( 2 );

		await stage.getByLabel( 'Site Title' ).fill( title );
		await stage.getByLabel( 'Site Tagline' ).fill( tagline );
		await stage.getByRole( 'button', { name: 'Save identity' } ).click();

		await expect( stage.getByText( 'Site identity saved.' ) ).toBeVisible();
		await expect( canvas.getByText( title ) ).toBeVisible( {
			timeout: 10000,
		} );
		await expect( canvas.getByText( tagline ) ).toBeVisible();
	} );
} );
