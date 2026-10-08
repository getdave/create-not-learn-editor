/**
 * Internal dependencies
 */
import { getLayoutDescription, getLayoutOutline } from '../layout-outline';

const HEADER = '<!-- wp:template-part {"slug":"header"} /-->';
const FOOTER = '<!-- wp:template-part {"slug":"footer"} /-->';
const CONTENT = '<!-- wp:post-content {"layout":{"type":"constrained"}} /-->';

const main = ( ...inner ) =>
	`<!-- wp:group {"tagName":"main"} --><main class="wp-block-group">${ inner.join(
		''
	) }</main><!-- /wp:group -->`;

describe( 'getLayoutOutline', () => {
	it( 'finds what a layout puts around the page', () => {
		// Twenty Twenty-Five's Page template, trimmed.
		const outline = getLayoutOutline(
			[
				HEADER,
				main(
					'<!-- wp:group {"align":"full"} --><div class="wp-block-group alignfull">',
					'<!-- wp:post-featured-image /-->',
					'<!-- wp:post-title {"level":1} /-->',
					CONTENT,
					'</div><!-- /wp:group -->'
				),
				FOOTER,
			].join( '\n' )
		);

		expect( outline ).toEqual( {
			after: [ { kind: 'footer' } ],
			before: [
				{ kind: 'header' },
				{ kind: 'image', width: 'content' },
				{ align: 'left', kind: 'title' },
			],
			hasContent: true,
			sidebar: null,
		} );
	} );

	it( 'tells a layout without a title from one with', () => {
		const outline = getLayoutOutline(
			[ HEADER, main( CONTENT ), FOOTER ].join( '' )
		);

		expect( outline.before ).toEqual( [ { kind: 'header' } ] );
		expect( outline.after ).toEqual( [ { kind: 'footer' } ] );
	} );

	it( 'leaves out what only adds space', () => {
		const outline = getLayoutOutline(
			main(
				'<!-- wp:spacer --><div style="height:100px" class="wp-block-spacer"></div><!-- /wp:spacer -->',
				'<!-- wp:post-title {"textAlign":"center"} /-->',
				'<!-- wp:separator --><hr class="wp-block-separator"/><!-- /wp:separator -->',
				CONTENT
			)
		);

		expect( outline.before ).toEqual( [
			{ align: 'center', kind: 'title' },
		] );
	} );

	it( 'reads how wide the featured image is', () => {
		const outline = getLayoutOutline(
			'<!-- wp:post-featured-image {"align":"full"} /-->' + CONTENT
		);

		expect( outline.before ).toEqual( [
			{ kind: 'image', width: 'full' },
		] );
	} );

	it( 'knows header and footer parts by their area or tag too', () => {
		const outline = getLayoutOutline(
			[
				'<!-- wp:template-part {"slug":"top","area":"header"} /-->',
				'<!-- wp:template-part {"slug":"post-meta"} /-->',
				CONTENT,
				'<!-- wp:template-part {"slug":"bottom","tagName":"footer"} /-->',
			].join( '' )
		);

		expect( outline.before ).toEqual( [
			{ kind: 'header' },
			{ kind: 'part' },
		] );
		expect( outline.after ).toEqual( [ { kind: 'footer' } ] );
	} );

	it( 'finds a sidebar beside the content', () => {
		const columns = ( first, second ) =>
			`<!-- wp:columns --><div class="wp-block-columns"><!-- wp:column --><div class="wp-block-column">${ first }</div><!-- /wp:column --><!-- wp:column --><div class="wp-block-column">${ second }</div><!-- /wp:column --></div><!-- /wp:columns -->`;
		const widgets =
			'<!-- wp:heading --><h2>Elsewhere</h2><!-- /wp:heading -->';

		expect(
			getLayoutOutline( main( columns( CONTENT, widgets ) ) )
		).toMatchObject( { before: [], after: [], sidebar: 'end' } );
		expect(
			getLayoutOutline( main( columns( widgets, CONTENT ) ) ).sidebar
		).toBe( 'start' );
	} );

	it( 'names posts, comments and anything else it finds', () => {
		const outline = getLayoutOutline(
			[
				CONTENT,
				'<!-- wp:post-date /-->',
				'<!-- wp:post-terms {"term":"category"} /-->',
				'<!-- wp:comments --><div class="wp-block-comments"><!-- wp:post-comments-form /--></div><!-- /wp:comments -->',
				'<!-- wp:query --><div class="wp-block-query"></div><!-- /wp:query -->',
			].join( '' )
		);

		expect( outline.after ).toEqual( [
			{ kind: 'other' },
			{ kind: 'comments' },
			{ kind: 'posts' },
		] );
	} );

	it( 'looks inside patterns the layout uses', () => {
		const patterns = {
			'theme/comments':
				'<!-- wp:comments --><div class="wp-block-comments"></div><!-- /wp:comments -->',
			'theme/loop': '<!-- wp:pattern {"slug":"theme/loop"} /-->',
		};
		const outline = getLayoutOutline(
			[
				CONTENT,
				'<!-- wp:pattern {"slug":"theme/comments"} /-->',
				'<!-- wp:pattern {"slug":"theme/loop"} /-->',
				'<!-- wp:pattern {"slug":"theme/missing"} /-->',
			].join( '' ),
			{ resolvePattern: ( slug ) => patterns[ slug ] }
		);

		expect( outline.after ).toEqual( [
			{ kind: 'comments' },
			{ kind: 'other' },
		] );
	} );

	it( 'shows a layout without the page content as it is', () => {
		const outline = getLayoutOutline(
			HEADER + '<!-- wp:post-title /-->' + FOOTER
		);

		expect( outline ).toEqual( {
			after: [],
			before: [
				{ kind: 'header' },
				{ align: 'left', kind: 'title' },
				{ kind: 'footer' },
			],
			hasContent: false,
			sidebar: null,
		} );
	} );

	it( 'copes with no layout at all', () => {
		expect( getLayoutOutline( '' ) ).toEqual( {
			after: [],
			before: [],
			hasContent: false,
			sidebar: null,
		} );
	} );
} );

describe( 'getLayoutDescription', () => {
	it( 'lists what the layout shows, top to bottom', () => {
		expect(
			getLayoutDescription( {
				after: [ { kind: 'comments' }, { kind: 'footer' } ],
				before: [
					{ kind: 'header' },
					{ kind: 'other' },
					{ kind: 'image', width: 'full' },
					{ align: 'left', kind: 'title' },
				],
				hasContent: true,
				sidebar: 'end',
			} )
		).toBe(
			'Header, Featured image, Title, The page’s sections, Sidebar, Comments, Footer'
		);
	} );

	it( 'says when a layout leaves the page out', () => {
		expect(
			getLayoutDescription( {
				after: [],
				before: [ { kind: 'header' } ],
				hasContent: false,
				sidebar: null,
			} )
		).toBe( 'Header. Doesn’t show the page’s sections' );
	} );
} );
