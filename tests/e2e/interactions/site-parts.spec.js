/**
 * The Header and Footer screens: their part brought into view on the canvas,
 * and kept there while the page around it is still settling.
 */
const {
	expect,
	getCanvasEditor,
	getModeToggle,
	getSitePreview,
	test,
	visitEditor,
} = require( '../utils' );

/**
 * Whether the bottom of the part in the spotlight is at the bottom of the
 * canvas, as a footer is brought into view.
 *
 * @param {import('@playwright/test').Locator} frame The canvas's iframe.
 * @return {Promise<boolean>} Whether it is.
 */
function isPartInView( frame ) {
	return frame.evaluate( ( iframe ) => {
		const view = iframe.contentWindow;
		const part = view.document.querySelector( '[data-cnl-spotlight]' );

		return (
			Boolean( part ) &&
			Math.abs( part.getBoundingClientRect().bottom - view.innerHeight ) <
				2
		);
	} );
}

/**
 * Make the page above the part taller, as an image does when it finishes
 * loading after the canvas has scrolled to the part.
 *
 * @param {import('@playwright/test').Locator} frame The canvas's iframe.
 */
async function growPageAbovePart( frame ) {
	await frame.evaluate( ( iframe ) => {
		const { document } = iframe.contentWindow;
		const spacer = document.createElement( 'div' );

		spacer.style.height = '3000px';
		document.querySelector( '[data-cnl-spotlight]' ).before( spacer );
	} );
}

test.describe( 'Header and footer interactions', () => {
	for ( const [ mode, getFrame ] of [
		[ 'Browse', getSitePreview ],
		[ 'Edit', getCanvasEditor ],
	] ) {
		test( `${ mode } keeps the footer in view while the page above it grows`, async ( {
			page,
		} ) => {
			await visitEditor( page, '/design/footer' );

			// The screen has no Compose, so the mode is picked here rather
			// than with `setCanvasMode`, which looks for it.
			const radio = getModeToggle( page ).getByRole( 'radio', {
				name: mode,
			} );

			await expect( radio ).toBeEnabled( { timeout: 15000 } );
			await radio.click();

			const frame = getFrame( page );

			await expect( frame ).toBeVisible( { timeout: 15000 } );
			await expect
				.poll( () => isPartInView( frame ), { timeout: 15000 } )
				.toBe( true );

			await growPageAbovePart( frame );

			await expect
				.poll( () => isPartInView( frame ), { timeout: 5000 } )
				.toBe( true );
		} );
	}

	test( 'scrolling the canvas stops it following the footer', async ( {
		page,
	} ) => {
		await visitEditor( page, '/design/footer' );

		const frame = getSitePreview( page );

		await expect
			.poll( () => isPartInView( frame ), { timeout: 15000 } )
			.toBe( true );

		const box = await frame.boundingBox();

		await page.mouse.move( box.x + box.width / 2, box.y + box.height / 2 );
		await page.mouse.wheel( 0, -400 );
		await expect
			.poll( () => isPartInView( frame ), { timeout: 5000 } )
			.toBe( false );

		const scrollY = await frame.evaluate(
			( iframe ) => iframe.contentWindow.scrollY
		);

		await growPageAbovePart( frame );
		// Long enough for the canvas to have followed the footer, had it still
		// been following it.
		await page.waitForTimeout( 1000 );

		expect(
			await frame.evaluate( ( iframe ) => iframe.contentWindow.scrollY )
		).toBe( scrollY );
	} );
} );
