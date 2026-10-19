vi.mock( '@wordpress/block-editor', () => ( { store: {} } ) );
vi.mock( '@wordpress/data', () => ( {
	useDispatch: () => ( {} ),
	useSelect: () => null,
} ) );
vi.mock( '@wordpress/element', () => ( { useMemo: ( fn ) => fn() } ) );
vi.mock( '@wordpress/blocks', () => {
	const supports = {
		'core/buttons': { align: [ 'wide', 'full' ] },
		'core/columns': { align: [ 'wide', 'full' ] },
		'core/cover': { align: true },
		'core/group': {
			align: [ 'wide', 'full' ],
			layout: { default: { type: 'flow' } },
		},
		'core/heading': { align: [ 'wide', 'full' ] },
		'core/paragraph': {},
	};

	return {
		getBlockSupport: ( name, feature ) => supports[ name ]?.[ feature ],
	};
} );

/**
 * External dependencies
 */
import { describe, expect, it, vi } from 'vitest';

/**
 * Internal dependencies
 */
import { getSectionWidth, getWidthChange } from '../section-width';

let id = 0;

function block( name, attributes = {}, innerBlocks = [] ) {
	return { attributes, clientId: `b${ ++id }`, innerBlocks, name };
}

function section( innerBlocks, attributes = {} ) {
	return block(
		'core/group',
		{ align: 'full', layout: { type: 'constrained' }, ...attributes },
		innerBlocks
	);
}

describe( 'getSectionWidth', () => {
	it( 'reads a full section’s width from its widest blocks', () => {
		const heading = block( 'core/heading', { align: 'wide' } );
		const text = block( 'core/paragraph' );
		const columns = block( 'core/columns', { align: 'wide' } );
		const width = getSectionWidth( section( [ heading, text, columns ] ) );

		expect( width.current ).toBe( 'wide' );
		expect( width.isInner ).toBe( true );
		expect( width.options ).toEqual( [ 'narrow', 'wide', 'full' ] );
		expect( width.targets ).toEqual( [
			heading.clientId,
			columns.clientId,
		] );
	} );

	it( 'is narrow when nothing in the section is aligned', () => {
		const width = getSectionWidth(
			section( [ block( 'core/heading' ), block( 'core/columns' ) ] )
		);

		expect( width.current ).toBe( 'narrow' );
	} );

	it( 'uses the section’s own alignment when its blocks can’t align', () => {
		const statement = section( [ block( 'core/paragraph' ) ] );
		const width = getSectionWidth( statement );

		expect( width.isInner ).toBe( false );
		expect( width.current ).toBe( 'full' );
		expect( width.targets ).toEqual( [ statement.clientId ] );
	} );

	it( 'uses a cover’s own alignment', () => {
		const width = getSectionWidth(
			block( 'core/cover', { align: 'wide' }, [
				block( 'core/heading' ),
			] )
		);

		expect( width.current ).toBe( 'wide' );
		expect( width.isInner ).toBe( false );
	} );

	it( 'reads a header from the one block in its part', () => {
		const inner = block( 'core/group', { align: 'wide' } );
		const part = block( 'core/template-part', {}, [
			section( [ inner ] ),
		] );

		expect( getSectionWidth( part ).targets ).toEqual( [ inner.clientId ] );
	} );

	it( 'leaves out a part it can’t measure', () => {
		const part = block( 'core/template-part', {}, [
			section( [ block( 'core/paragraph' ) ] ),
		] );

		expect( getSectionWidth( part ) ).toBe( null );
	} );

	it( 'has no width for a block that can’t align', () => {
		expect( getSectionWidth( block( 'core/paragraph' ) ) ).toBe( null );
	} );
} );

describe( 'getWidthChange', () => {
	it( 'moves only the wider blocks, keeping narrow ones narrow', () => {
		const heading = block( 'core/heading', { align: 'wide' } );
		const buttons = block( 'core/buttons' );
		const columns = block( 'core/columns', { align: 'wide' } );

		expect(
			getWidthChange( section( [ heading, buttons, columns ] ), 'full' )
		).toEqual( {
			attributes: { align: 'full' },
			clientIds: [ heading.clientId, columns.clientId ],
		} );
	} );

	it( 'moves every block that can when none is wider', () => {
		const heading = block( 'core/heading' );
		const text = block( 'core/paragraph' );
		const columns = block( 'core/columns' );

		expect(
			getWidthChange( section( [ heading, text, columns ] ), 'wide' )
				.clientIds
		).toEqual( [ heading.clientId, columns.clientId ] );
	} );

	it( 'takes aligned blocks back to the content size for Narrow', () => {
		const heading = block( 'core/heading', { align: 'wide' } );
		const buttons = block( 'core/buttons' );

		expect(
			getWidthChange( section( [ heading, buttons ] ), 'narrow' )
		).toEqual( {
			attributes: { align: undefined },
			clientIds: [ heading.clientId ],
		} );
	} );

	it( 'changes the section itself when that is what sets its width', () => {
		const cover = block( 'core/cover', { align: 'full' } );

		expect( getWidthChange( cover, 'wide' ) ).toEqual( {
			attributes: { align: 'wide' },
			clientIds: [ cover.clientId ],
		} );
	} );
} );
