/**
 * Internal dependencies
 */
import {
	OTHER_PAGE_LAYOUT_TYPE,
	getPageLayoutGroups,
	getPatternDescription,
	getPatternPreviewContent,
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
		).toBe( false );
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
} );
