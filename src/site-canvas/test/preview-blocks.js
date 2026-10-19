/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import {
	findPreviewSection,
	getPreviewPath,
	isInteractive,
	matchPreviewPath,
} from '../preview-blocks';

/**
 * A stand-in for `blockEditorStore`'s selectors over a tree of blocks.
 *
 * @param {Object[]} tree `{ clientId, name, innerBlocks }` at the top.
 * @return {Object} `getBlockOrder` and `getBlockName`.
 */
function storeOf( tree ) {
	const order = { '': tree.map( ( node ) => node.clientId ) };
	const names = {};
	const walk = ( nodes ) =>
		nodes.forEach( ( node ) => {
			names[ node.clientId ] = node.name;
			order[ node.clientId ] = node.innerBlocks.map(
				( inner ) => inner.clientId
			);
			walk( node.innerBlocks );
		} );

	walk( tree );

	return {
		getBlockName: ( clientId ) => names[ clientId ],
		getBlockOrder: ( clientId ) => order[ clientId ] || [],
	};
}

function block( clientId, name, innerBlocks = [] ) {
	return { clientId, innerBlocks, name };
}

// A page in its layout: a header, the page's content, and a footer.
const PAGE = `
	<header data-cnl-block="core/template-part">
		<div data-cnl-block="core/site-title">Fernhouse</div>
		<nav data-cnl-block="core/navigation"><a href="/about">About</a></nav>
	</header>
	<main data-cnl-block="core/group">
		<div data-cnl-block="core/post-content">
			<section data-cnl-block="core/group">
				<h2 data-cnl-block="core/heading" id="first">Hello</h2>
			</section>
			<section data-cnl-block="core/group">
				<p data-cnl-block="core/paragraph"><span id="second">Hi</span></p>
				<p data-cnl-block="core/paragraph" id="third">There</p>
			</section>
		</div>
	</main>
	<footer data-cnl-block="core/template-part"><p id="footer">Bye</p></footer>
`;

const TREE = [
	block( 'header', 'core/template-part', [
		block( 'title', 'core/site-title' ),
		block( 'nav', 'core/navigation' ),
	] ),
	block( 'main', 'core/group', [
		block( 'content', 'core/post-content', [
			block( 'one', 'core/group', [ block( 'h', 'core/heading' ) ] ),
			block( 'two', 'core/group', [
				block( 'p1', 'core/paragraph' ),
				block( 'p2', 'core/paragraph' ),
			] ),
		] ),
	] ),
	block( 'footer', 'core/template-part' ),
];

function load( html ) {
	document.body.innerHTML = html;
}

describe( 'getPreviewPath', () => {
	it( 'names each block from the top down, counting by name', () => {
		load( PAGE );

		const path = getPreviewPath( document.getElementById( 'third' ) );

		expect( path.map( ( step ) => [ step.name, step.index ] ) ).toEqual( [
			[ 'core/group', 0 ],
			[ 'core/post-content', 0 ],
			[ 'core/group', 1 ],
			[ 'core/paragraph', 1 ],
		] );
	} );

	it( 'starts from the block an element is inside', () => {
		load( PAGE );

		const path = getPreviewPath( document.getElementById( 'second' ) );

		expect( path.at( -1 ).name ).toBe( 'core/paragraph' );
		expect( path.at( -1 ).index ).toBe( 0 );
	} );

	it( 'is empty outside any block', () => {
		load( '<p id="loose">Loose</p>' );

		expect( getPreviewPath( document.getElementById( 'loose' ) ) ).toEqual(
			[]
		);
	} );
} );

describe( 'matchPreviewPath', () => {
	it( 'follows the path down the editor’s blocks', () => {
		load( PAGE );

		const path = getPreviewPath( document.getElementById( 'third' ) );

		expect( matchPreviewPath( storeOf( TREE ), path ) ).toEqual( [
			'main',
			'content',
			'two',
			'p2',
		] );
	} );

	it( 'stops where the editor has no such block', () => {
		load( PAGE );

		const path = getPreviewPath( document.getElementById( 'third' ) );
		const tree = [
			TREE[ 0 ],
			block( 'main', 'core/group', [
				block( 'content', 'core/post-content', [
					block( 'one', 'core/group' ),
				] ),
			] ),
		];

		expect( matchPreviewPath( storeOf( tree ), path ) ).toEqual( [
			'main',
			'content',
			null,
			null,
		] );
	} );

	it( 'looks through a synced pattern, which has no element of its own', () => {
		load( PAGE );

		const path = getPreviewPath( document.getElementById( 'third' ) );
		const tree = [
			TREE[ 0 ],
			block( 'main', 'core/group', [
				block( 'content', 'core/post-content', [
					block( 'one', 'core/group' ),
					block( 'synced', 'core/block', [
						block( 'two', 'core/group', [
							block( 'p1', 'core/paragraph' ),
							block( 'p2', 'core/paragraph' ),
						] ),
					] ),
				] ),
			] ),
		];

		expect( matchPreviewPath( storeOf( tree ), path ) ).toEqual( [
			'main',
			'content',
			'two',
			'p2',
		] );
	} );

	it( 'starts inside the page’s content when the editor shows only that', () => {
		load( PAGE );

		const path = getPreviewPath( document.getElementById( 'third' ) );
		const tree = TREE[ 1 ].innerBlocks[ 0 ].innerBlocks;

		expect( matchPreviewPath( storeOf( tree ), path ) ).toEqual( [
			null,
			null,
			'two',
			'p2',
		] );
	} );
} );

describe( 'findPreviewSection', () => {
	const targets = new Set( [ 'header', 'one', 'two', 'footer' ] );

	it( 'finds the section a spot is in, and its element', () => {
		load( PAGE );

		const section = findPreviewSection(
			storeOf( TREE ),
			document.getElementById( 'second' ),
			targets
		);

		expect( section.clientId ).toBe( 'two' );
		expect( section.element.tagName ).toBe( 'SECTION' );
	} );

	it( 'finds the header and footer', () => {
		load( PAGE );

		expect(
			findPreviewSection(
				storeOf( TREE ),
				document.getElementById( 'footer' ),
				targets
			).clientId
		).toBe( 'footer' );
	} );

	it( 'finds nothing between sections', () => {
		load( PAGE );

		expect(
			findPreviewSection(
				storeOf( TREE ),
				document.querySelector( 'main' ),
				targets
			)
		).toBeNull();
	} );
} );

describe( 'isInteractive', () => {
	it( 'is true inside links and buttons', () => {
		load(
			'<a href="/x"><span id="in-link">Go</span></a><button>B</button>'
		);

		expect( isInteractive( document.getElementById( 'in-link' ) ) ).toBe(
			true
		);
		expect( isInteractive( document.querySelector( 'button' ) ) ).toBe(
			true
		);
	} );

	it( 'is false for words and pictures', () => {
		load( '<p>Words</p><img alt="" /><a>No address</a>' );

		expect( isInteractive( document.querySelector( 'p' ) ) ).toBe( false );
		expect( isInteractive( document.querySelector( 'img' ) ) ).toBe(
			false
		);
		expect( isInteractive( document.querySelector( 'a' ) ) ).toBe( false );
	} );
} );
