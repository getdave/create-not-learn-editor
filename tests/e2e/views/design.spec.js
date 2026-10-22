const {
	expect,
	getSitePreview,
	getStage,
	test,
	visitEditor,
} = require( '../utils' );

test.describe( 'Design views', () => {
	test( 'Design shows the site looks and links to the rest', async ( {
		page,
	} ) => {
		await visitEditor( page, '/design' );

		const stage = getStage( page );

		await expect(
			stage.getByRole( 'heading', { level: 1, name: 'Design' } )
		).toBeVisible();
		await expect(
			stage
				.getByRole( 'region', { name: 'Site look' } )
				.getByRole( 'button', { name: 'Theme default' } )
		).toBeVisible();

		const links = stage.getByRole( 'navigation', {
			name: 'More design options',
		} );
		for ( const name of [ 'Colors', 'Fonts', 'Name & logo' ] ) {
			await expect(
				links.getByRole( 'button', {
					name: new RegExp( `^${ name }` ),
				} )
			).toBeVisible();
		}

		await expect(
			stage.getByRole( 'link', { name: 'full Styles editor' } )
		).toBeVisible();
		await expect( getSitePreview( page ) ).toBeVisible( {
			timeout: 15000,
		} );
	} );

	test( 'Colors shows only color palettes', async ( { page } ) => {
		await visitEditor( page, '/design/colors' );

		const stage = getStage( page );
		const themeColors = stage.getByRole( 'button', {
			name: 'Theme colors',
		} );

		await expect(
			stage.getByRole( 'heading', { name: 'Colors' } )
		).toBeVisible();
		await expect( themeColors ).toBeVisible( { timeout: 15000 } );
		await expect( themeColors ).toHaveAttribute( 'aria-pressed', 'true' );
		await expect(
			stage.getByRole( 'button', { name: 'Theme fonts' } )
		).toBeHidden();
	} );

	test( 'Fonts shows only font pairings', async ( { page } ) => {
		await visitEditor( page, '/design/fonts' );

		const stage = getStage( page );
		const themeFonts = stage.getByRole( 'button', { name: 'Theme fonts' } );

		await expect(
			stage.getByRole( 'heading', { name: 'Fonts' } )
		).toBeVisible();
		await expect( themeFonts ).toBeVisible( { timeout: 15000 } );
		await expect( themeFonts ).toHaveAttribute( 'aria-pressed', 'true' );
		await expect(
			stage.getByRole( 'button', { name: 'Theme colors' } )
		).toBeHidden();

		const previews = stage.locator( '.routes-styles__font-preview' );

		// Each pairing is shown in its own fonts, so the theme's font files
		// have to be on the page, not just in the canvas. System fonts have
		// no files.
		const missingFonts = await previews.evaluateAll( async ( nodes ) => {
			const missing = [];
			for ( const name of nodes.flatMap( ( node ) => [
				...node.children,
			] ) ) {
				const family = window
					.getComputedStyle( name )
					.fontFamily.split( ',' )[ 0 ]
					.trim();
				if (
					family.startsWith( '-' ) ||
					/^(system-ui|ui-[a-z-]+|serif|sans-serif|monospace)$/.test(
						family
					)
				) {
					continue;
				}
				const faces = await document.fonts.load( `16px ${ family }` );
				if ( ! faces.length ) {
					missing.push( family );
				}
			}
			return missing;
		} );
		expect( missingFonts ).toEqual( [] );

		// A pairing that uses one font for both names it once.
		const names = await previews.evaluateAll( ( nodes ) =>
			nodes.map( ( node ) =>
				[ ...node.children ].map( ( name ) => name.textContent )
			)
		);
		for ( const pairing of names ) {
			expect( new Set( pairing ).size ).toBe( pairing.length );
		}
	} );

	test( 'Name & logo shows the site identity fields', async ( { page } ) => {
		await visitEditor( page, '/design/identity' );

		const stage = getStage( page );

		await expect( stage.getByLabel( 'Site name' ) ).toBeEditable( {
			timeout: 15000,
		} );
		await expect( stage.getByLabel( 'Tagline' ) ).toBeEditable();
		await expect(
			stage.getByText( 'Logo', { exact: true } )
		).toBeVisible();
		await expect(
			stage.getByText( 'Browser icon', { exact: true } )
		).toBeVisible();
		await expect(
			stage.getByRole( 'button', { name: 'Choose image' } )
		).toHaveCount( 2 );
	} );
} );
