/**
 * Internal dependencies
 */
import {
	hasLayoutMarker,
	isEmptyBlock,
	LAYOUT_MARKER as MARKER,
	shouldWireframe,
} from '../should-wireframe';

const inLayout = [ 'something-else', `foo ${ MARKER }` ];

describe( 'isEmptyBlock', () => {
	it( 'treats text blocks with no content as empty', () => {
		expect( isEmptyBlock( 'core/heading', {} ) ).toBe( true );
		expect( isEmptyBlock( 'core/paragraph', { content: '' } ) ).toBe(
			true
		);
		expect( isEmptyBlock( 'core/button', { text: '  ' } ) ).toBe( true );
	} );
	it( 'treats text blocks with content as filled', () => {
		expect( isEmptyBlock( 'core/heading', { content: 'Hi' } ) ).toBe(
			false
		);
	} );
	it( 'reads the button label from text, not content', () => {
		expect( isEmptyBlock( 'core/button', { text: 'Go' } ) ).toBe( false );
	} );
	it( 'handles RichTextData-like content objects', () => {
		expect(
			isEmptyBlock( 'core/paragraph', {
				content: { toString: () => '' },
			} )
		).toBe( true );
		expect(
			isEmptyBlock( 'core/paragraph', {
				content: { toString: () => 'x' },
			} )
		).toBe( false );
	} );
	it( 'treats media blocks without a url as empty', () => {
		expect( isEmptyBlock( 'core/image', {} ) ).toBe( true );
		expect( isEmptyBlock( 'core/cover', { url: 'a.jpg' } ) ).toBe( false );
	} );
	it( 'treats covers using the featured image as filled', () => {
		expect( isEmptyBlock( 'core/cover', { useFeaturedImage: true } ) ).toBe(
			false
		);
	} );
	it( 'returns false for unsupported blocks', () => {
		expect( isEmptyBlock( 'core/list', {} ) ).toBe( false );
	} );
} );

describe( 'shouldWireframe', () => {
	const base = {
		name: 'core/heading',
		attributes: {},
		isPreviewMode: true,
		ancestorClassNames: inLayout,
	};
	it( 'is true for an empty supported block in a layout preview', () => {
		expect( shouldWireframe( base ) ).toBe( true );
	} );
	it( 'is false outside preview mode', () => {
		expect( shouldWireframe( { ...base, isPreviewMode: false } ) ).toBe(
			false
		);
	} );
	it( 'is false when the block has content', () => {
		expect(
			shouldWireframe( { ...base, attributes: { content: 'Hi' } } )
		).toBe( false );
	} );
	it( 'is false when no ancestor has the marker class', () => {
		expect(
			shouldWireframe( {
				...base,
				ancestorClassNames: [ 'x', undefined ],
			} )
		).toBe( false );
	} );
	it( 'is true when the block itself has the marker class', () => {
		expect(
			shouldWireframe( {
				name: 'core/cover',
				attributes: { className: `is-style-x ${ MARKER }` },
				isPreviewMode: true,
				ancestorClassNames: [],
			} )
		).toBe( true );
	} );
	it( 'does not match marker substrings', () => {
		expect(
			shouldWireframe( {
				...base,
				ancestorClassNames: [ `${ MARKER }-x` ],
			} )
		).toBe( false );
	} );
} );

describe( 'hasLayoutMarker', () => {
	it( 'finds the marker among other classes', () => {
		expect( hasLayoutMarker( `is-style-x ${ MARKER } foo` ) ).toBe( true );
		expect( hasLayoutMarker( MARKER ) ).toBe( true );
	} );
	it( 'is false for missing classes and substrings', () => {
		expect( hasLayoutMarker( undefined ) ).toBe( false );
		expect( hasLayoutMarker( '' ) ).toBe( false );
		expect( hasLayoutMarker( `${ MARKER }-x x${ MARKER }` ) ).toBe( false );
	} );
} );
