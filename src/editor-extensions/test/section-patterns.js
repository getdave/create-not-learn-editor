/**
 * WordPress dependencies
 */
import { parse } from '@wordpress/block-serialization-default-parser';

/**
 * Internal dependencies
 */
import { stampPatternName } from '../section-patterns';

const NAME = 'theme/event-details';

function getRootAttributes( content ) {
	return parse( content )
		.filter( ( block ) => block.blockName )
		.map( ( block ) => block.attrs );
}

describe( 'stampPatternName', () => {
	it( 'stamps every top-level block of a pattern with several', () => {
		const content = [
			'<!-- wp:heading {"level":3} -->',
			'<h3 class="wp-block-heading">Title</h3>',
			'<!-- /wp:heading -->',
			'',
			'<!-- wp:separator /-->',
			'',
			'<!-- wp:theme/card -->',
			'<div><!-- wp:paragraph --><p>Nested</p><!-- /wp:paragraph --></div>',
			'<!-- /wp:theme/card -->',
		].join( '\n' );

		const stamped = stampPatternName( content, NAME );

		expect( getRootAttributes( stamped ) ).toEqual( [
			{ level: 3, metadata: { patternName: NAME } },
			{ metadata: { patternName: NAME } },
			{ metadata: { patternName: NAME } },
		] );
		expect( parse( stamped )[ 4 ].blockName ).toBe( 'theme/card' );
		expect( parse( stamped )[ 4 ].innerBlocks[ 0 ].attrs ).toEqual( {} );
	} );

	it( 'keeps existing metadata', () => {
		const content =
			'<!-- wp:group {"metadata":{"name":"Intro"}} --><div></div><!-- /wp:group -->' +
			'<!-- wp:spacer /-->';

		expect(
			getRootAttributes( stampPatternName( content, NAME ) )[ 0 ]
		).toEqual( {
			metadata: { name: 'Intro', patternName: NAME },
		} );
	} );

	it( 'leaves the markup between delimiters untouched', () => {
		const content =
			'<!-- wp:preformatted --><pre>a\n\n\n  b</pre><!-- /wp:preformatted -->\n\n' +
			'<!-- wp:paragraph --><p>c</p><!-- /wp:paragraph -->';

		const stamped = stampPatternName( content, NAME );

		expect( stamped ).toContain( '<pre>a\n\n\n  b</pre>' );
		expect( stamped ).toContain( '<!-- /wp:preformatted -->\n\n<!--' );
	} );

	it( 'escapes the name so it cannot close the comment', () => {
		const content = '<!-- wp:spacer /--><!-- wp:spacer /-->';
		const stamped = stampPatternName( content, 'a-->b' );

		expect( stamped ).not.toContain( 'a-->b' );
		expect( getRootAttributes( stamped )[ 0 ].metadata.patternName ).toBe(
			'a-->b'
		);
	} );

	it( 'leaves a pattern with one top-level block to core', () => {
		const content =
			'<!-- wp:group --><div><!-- wp:paragraph --><p>a</p><!-- /wp:paragraph -->' +
			'<!-- wp:paragraph --><p>b</p><!-- /wp:paragraph --></div><!-- /wp:group -->';

		expect( stampPatternName( content, NAME ) ).toBe( content );
	} );

	it( 'leaves anything that is not pattern markup alone', () => {
		expect( stampPatternName( undefined, NAME ) ).toBeUndefined();
		expect( stampPatternName( '<p>Just HTML</p>', NAME ) ).toBe(
			'<p>Just HTML</p>'
		);
	} );
} );
