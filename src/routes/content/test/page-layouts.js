/**
 * Internal dependencies
 */
import {
	OTHER_PAGE_LAYOUT_TYPE,
	getPageLayoutGroups,
	getPatternContent,
	getPatternDescription,
	getPatternTermSlugs,
	getPatternPreviewContent,
	getPatternPreviewContentWithTitle,
	getPatternTitle,
	getPreviewContent,
	getPreviewTemplateForPost,
	getSelectedTemplateContent,
	isPageLayoutPattern,
} from '../page-layouts';

const pageTemplate = {
	content: {
		raw: [
			'<!-- wp:template-part {"slug":"header"} /-->',
			'<!-- wp:post-content /-->',
			'<!-- wp:template-part {"slug":"footer"} /-->',
		].join( '' ),
	},
	id: 'theme//page',
	slug: 'page',
};

const frontPageTemplate = {
	content: {
		raw: '<!-- wp:post-content /-->',
	},
	id: 'theme//front-page',
	slug: 'front-page',
};

const customTemplate = {
	content: {
		raw: '<!-- wp:group --><!-- wp:post-content /--><!-- /wp:group -->',
	},
	id: 'theme//page-no-title',
	slug: 'page-no-title',
};

describe( 'page layout helpers', () => {
	test( 'detects eligible page layout patterns', () => {
		expect(
			isPageLayoutPattern( {
				content:
					'<!-- wp:paragraph --><p>Page</p><!-- /wp:paragraph -->',
				postTypes: [ 'page' ],
			} )
		).toBe( true );
		expect(
			isPageLayoutPattern( {
				blockTypes: [ 'core/post-content' ],
				content: '<!-- wp:post-content /-->',
			} )
		).toBe( true );
		expect(
			isPageLayoutPattern( {
				categories: [ 'page' ],
				content:
					'<!-- wp:paragraph --><p>Page</p><!-- /wp:paragraph -->',
			} )
		).toBe( true );
		expect(
			isPageLayoutPattern( {
				content:
					'<!-- wp:paragraph --><p>Hidden</p><!-- /wp:paragraph -->',
				inserter: false,
				postTypes: [ 'page' ],
			} )
		).toBe( false );
		expect(
			isPageLayoutPattern( {
				postTypes: [ 'page' ],
			} )
		).toBe( true );
	} );

	test( 'normalizes page pattern terms across theme data shapes', () => {
		expect(
			getPatternTermSlugs( [
				'Page',
				{ slug: 'pages', label: 'Pages' },
				{ name: 'ollie/page', title: { rendered: 'Page' } },
			] )
		).toEqual(
			expect.arrayContaining( [ 'page', 'pages', 'ollie/page' ] )
		);

		expect(
			isPageLayoutPattern( {
				categories: [ { slug: 'Page', label: 'Page' } ],
				content:
					'<!-- wp:paragraph --><p>Page</p><!-- /wp:paragraph -->',
			} )
		).toBe( true );
		expect(
			isPageLayoutPattern( {
				categories: [ { name: 'ollie/pages', label: 'Pages' } ],
			} )
		).toBe( true );
		expect(
			isPageLayoutPattern( {
				blockTypes: [ { name: 'core/post-content' } ],
			} )
		).toBe( true );
	} );

	test( 'groups page designs using explicit metadata and inferred titles', () => {
		const homepagePattern = {
			content: '<!-- wp:paragraph --><p>Home</p><!-- /wp:paragraph -->',
			name: 'theme/business-home',
			title: 'Business homepage',
		};
		const eventPattern = {
			content: '<!-- wp:paragraph --><p>Event</p><!-- /wp:paragraph -->',
			pageTypes: [ 'event' ],
			title: 'Conference',
		};
		const linkInBioPattern = {
			categories: [ 'link-in-bio' ],
			content: '<!-- wp:paragraph --><p>Links</p><!-- /wp:paragraph -->',
			title: 'Profile links',
		};
		const otherPattern = {
			content: '<!-- wp:paragraph --><p>Other</p><!-- /wp:paragraph -->',
			title: 'Unexpected layout',
		};

		const groups = getPageLayoutGroups( [
			homepagePattern,
			eventPattern,
			linkInBioPattern,
			otherPattern,
		] );
		const groupBySlug = Object.fromEntries(
			groups.map( ( group ) => [ group.slug, group ] )
		);

		expect( groupBySlug.homepage.patterns ).toEqual( [ homepagePattern ] );
		expect( groupBySlug.event.patterns ).toEqual( [ eventPattern ] );
		expect( groupBySlug[ 'link-in-bio' ].patterns ).toEqual( [
			linkInBioPattern,
		] );
		expect( groupBySlug[ OTHER_PAGE_LAYOUT_TYPE ].patterns ).toEqual( [
			otherPattern,
		] );
	} );

	test( 'decodes pattern titles and descriptions', () => {
		expect(
			getPatternTitle( {
				title: 'Business &amp; portfolio homepage',
			} )
		).toBe( 'Business & portfolio homepage' );
		expect(
			getPatternDescription( {
				description: 'A clean &amp; flexible page.',
			} )
		).toBe( 'A clean & flexible page.' );
	} );

	test( 'reads pattern content from string and object records', () => {
		expect(
			getPatternContent( {
				content:
					'<!-- wp:paragraph --><p>String body</p><!-- /wp:paragraph -->',
			} )
		).toContain( 'String body' );
		expect(
			getPatternContent( {
				content: {
					raw: '<!-- wp:paragraph --><p>Raw body</p><!-- /wp:paragraph -->',
				},
			} )
		).toContain( 'Raw body' );
		expect(
			getPatternContent( {
				content: {
					rendered:
						'<!-- wp:paragraph --><p>Rendered body</p><!-- /wp:paragraph -->',
				},
			} )
		).toContain( 'Rendered body' );
	} );
} );

describe( 'content preview helpers', () => {
	test( 'selects custom, front-page, and default templates', () => {
		const templates = [ pageTemplate, frontPageTemplate, customTemplate ];

		expect(
			getPreviewTemplateForPost(
				{
					id: 7,
					template: 'page-no-title',
					type: 'page',
				},
				templates,
				{ pageOnFront: 11 }
			)
		).toBe( customTemplate );
		expect(
			getPreviewTemplateForPost(
				{
					id: 11,
					type: 'page',
				},
				templates,
				{ pageOnFront: 11 }
			)
		).toBe( frontPageTemplate );
		expect(
			getPreviewTemplateForPost(
				{
					id: 9,
					type: 'page',
				},
				templates,
				{ pageOnFront: 11 }
			)
		).toBe( pageTemplate );
	} );

	test( 'replaces self-closing post-content blocks with page content', () => {
		const result = getPreviewContent(
			{
				content: {
					raw: '<!-- wp:paragraph --><p>Page body</p><!-- /wp:paragraph -->',
				},
			},
			pageTemplate
		);

		expect( result ).toContain( 'template-part {"slug":"header"}' );
		expect( result ).toContain( '<p>Page body</p>' );
		expect( result ).toContain( 'template-part {"slug":"footer"}' );
		expect( result ).not.toContain( 'wp:post-content' );
	} );

	test( 'replaces paired post-content blocks with page content', () => {
		const result = getPreviewContent(
			{
				content: {
					raw: '<!-- wp:paragraph --><p>Page body</p><!-- /wp:paragraph -->',
				},
			},
			{
				content: {
					raw: '<!-- wp:post-content --><p>Old</p><!-- /wp:post-content -->',
				},
			}
		);

		expect( result ).toBe(
			'<!-- wp:paragraph --><p>Page body</p><!-- /wp:paragraph -->'
		);
	} );

	test( 'keeps template content when no post-content block exists', () => {
		expect(
			getPreviewContent(
				{
					content: {
						raw: '<!-- wp:paragraph --><p>Page body</p><!-- /wp:paragraph -->',
					},
				},
				{
					content: {
						raw: '<!-- wp:paragraph --><p>Template only</p><!-- /wp:paragraph -->',
					},
				}
			)
		).toBe(
			'<!-- wp:paragraph --><p>Template only</p><!-- /wp:paragraph -->'
		);
	} );

	test( 'uses selected template content or falls back to the page template', () => {
		expect(
			getSelectedTemplateContent(
				[ pageTemplate, customTemplate ],
				'page-no-title'
			)
		).toBe( customTemplate.content.raw );
		expect(
			getSelectedTemplateContent( [ pageTemplate, customTemplate ], '' )
		).toBe( pageTemplate.content.raw );
	} );

	test( 'renders pattern previews inside the selected template context', () => {
		const result = getPatternPreviewContent(
			{
				content:
					'<!-- wp:paragraph --><p>Pattern body</p><!-- /wp:paragraph -->',
			},
			customTemplate.content.raw
		);

		expect( result ).toContain( '<!-- wp:group -->' );
		expect( result ).toContain( '<p>Pattern body</p>' );
		expect( result ).not.toContain( 'wp:post-content' );
	} );

	test( 'updates heading text in pattern preview content from the page title', () => {
		const result = getPatternPreviewContentWithTitle(
			{
				content:
					'<!-- wp:heading --><h2>Pattern title</h2><!-- /wp:heading --><!-- wp:paragraph --><p>Body</p><!-- /wp:paragraph -->',
			},
			'',
			'My custom page',
			{
				parseBlocks: () => [
					{
						attributes: { content: 'Pattern title' },
						innerBlocks: [],
						name: 'core/heading',
					},
					{
						attributes: { content: 'Body' },
						innerBlocks: [],
						name: 'core/paragraph',
					},
				],
				serialize: ( blocks ) =>
					blocks
						.map( ( block ) => block.attributes.content )
						.join( '|' ),
			}
		);

		expect( result ).toBe( 'My custom page|Body' );
	} );

	test( 'updates post title template blocks from the page title', () => {
		const result = getPatternPreviewContentWithTitle(
			{
				content:
					'<!-- wp:paragraph --><p>Pattern body</p><!-- /wp:paragraph -->',
			},
			'<!-- wp:post-title {"level":1,"textAlign":"center"} /--><!-- wp:post-content /-->',
			'Template title',
			{
				parseBlocks: () => [
					{
						attributes: { level: 1, textAlign: 'center' },
						innerBlocks: [],
						name: 'core/post-title',
					},
					{
						attributes: { content: 'Pattern body' },
						innerBlocks: [],
						name: 'core/paragraph',
					},
				],
				serialize: ( blocks ) =>
					blocks
						.map(
							( block ) =>
								`${ block.name }:${ block.attributes.content }:${ block.attributes.level }:${ block.attributes.align }`
						)
						.join( '|' ),
			}
		);

		expect( result ).toBe(
			'core/heading:Template title:1:center|core/paragraph:Pattern body:undefined:undefined'
		);
	} );

	test( 'falls back to the first paragraph when a preview has no heading', () => {
		const result = getPatternPreviewContentWithTitle(
			{
				content:
					'<!-- wp:paragraph --><p>Pattern intro</p><!-- /wp:paragraph -->',
			},
			'',
			'Fallback page title',
			{
				parseBlocks: () => [
					{
						attributes: { content: 'Pattern intro' },
						innerBlocks: [],
						name: 'core/paragraph',
					},
				],
				serialize: ( blocks ) => blocks[ 0 ].attributes.content,
			}
		);

		expect( result ).toBe( 'Fallback page title' );
	} );
} );
