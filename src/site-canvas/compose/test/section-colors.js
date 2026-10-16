/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import {
	getAttributeUpdate,
	getColorOptions,
	getInnerTextColors,
	getReadableOptions,
	getSectionColor,
	hasOwnColors,
	withPartColor,
	withSectionColor,
} from '../section-colors';

const SUPPORTS = {
	background: true,
	button: true,
	heading: true,
	link: true,
	text: true,
};

const STYLE_OPTIONS = getColorOptions( {
	blockStyles: [
		{ isDefault: true, label: 'Default', name: 'default' },
		{ label: 'Dark', name: 'section-dark' },
	],
	colors: [ { slug: 'ink', color: '#000' } ],
	palette: [],
	supports: SUPPORTS,
	variations: {
		'section-dark': {
			color: { background: 'var:preset|color|ink', text: '#fff' },
		},
	},
} );

const PALETTE = [
	{ slug: 'base', name: 'Base', color: '#ffffff' },
	{ slug: 'contrast', name: 'Contrast', color: '#000000' },
	{ slug: 'primary', name: 'Primary', color: '#9DFF20' },
];

const PALETTE_OPTIONS = getColorOptions( {
	blockStyles: [],
	colors: PALETTE,
	palette: PALETTE,
	styles: {
		color: {
			background: 'var(--wp--preset--color--base)',
			text: 'var(--wp--preset--color--contrast)',
		},
		elements: {
			button: {
				color: { background: 'var(--wp--preset--color--primary)' },
			},
		},
	},
	supports: SUPPORTS,
	variations: undefined,
} );

function makeBlock( attributes = {}, innerBlocks = [] ) {
	return { attributes, innerBlocks, name: 'core/group' };
}

describe( 'getColorOptions', () => {
	it( 'offers the theme’s section styles, with swatches', () => {
		expect(
			STYLE_OPTIONS.map( ( { name, swatch } ) => [ name, swatch ] )
		).toEqual( [
			[ null, [] ],
			[ 'section-dark', [ '#000', '#fff' ] ],
		] );
	} );

	it( 'makes sets from the palette for a theme without any', () => {
		expect( PALETTE_OPTIONS.map( ( option ) => option.name ) ).toEqual( [
			null,
			'palette-inverse',
			'palette-accent-primary',
		] );
	} );

	it( 'offers no sets to a block that can’t take colours', () => {
		expect(
			getColorOptions( {
				blockStyles: [],
				colors: PALETTE,
				palette: PALETTE,
				styles: {},
				supports: { ...SUPPORTS, background: false },
			} )
		).toEqual( [] );
	} );
} );

describe( 'withSectionColor with section styles', () => {
	it( 'swaps the style class', () => {
		expect(
			withSectionColor( { align: 'full' }, STYLE_OPTIONS, 'section-dark' )
		).toEqual( { align: 'full', className: 'is-style-section-dark' } );
		expect(
			withSectionColor(
				{ className: 'is-style-section-dark' },
				STYLE_OPTIONS,
				null
			)
		).toEqual( {} );
	} );
} );

describe( 'withSectionColor with palette sets', () => {
	const accent = withSectionColor(
		{ align: 'full', style: { spacing: { padding: '1rem' } } },
		PALETTE_OPTIONS,
		'palette-accent-primary'
	);

	it( 'puts the set’s colours on with core’s own settings', () => {
		expect( accent ).toEqual( {
			align: 'full',
			backgroundColor: 'primary',
			style: {
				elements: {
					// The theme's lime buttons would vanish on lime.
					button: {
						color: {
							background: 'var:preset|color|contrast',
							text: 'var:preset|color|primary',
						},
					},
					heading: { color: { text: 'var:preset|color|contrast' } },
					link: { color: { text: 'var:preset|color|contrast' } },
				},
				spacing: { padding: '1rem' },
			},
			textColor: 'contrast',
		} );
	} );

	it( 'swaps one set for another', () => {
		const inverse = withSectionColor(
			accent,
			PALETTE_OPTIONS,
			'palette-inverse'
		);

		expect( inverse.backgroundColor ).toBe( 'contrast' );
		expect( inverse.textColor ).toBe( 'base' );
		expect( inverse.style.elements.button ).toBeUndefined();
		expect( inverse.style.elements.link.color.text ).toBe(
			'var:preset|color|base'
		);
	} );

	it( 'takes a set off, leaving everything else', () => {
		expect( withSectionColor( accent, PALETTE_OPTIONS, null ) ).toEqual( {
			align: 'full',
			style: { spacing: { padding: '1rem' } },
		} );
	} );

	it( 'keeps element settings that aren’t colours', () => {
		const withHover = {
			...accent,
			style: {
				...accent.style,
				elements: {
					...accent.style.elements,
					link: {
						...accent.style.elements.link,
						typography: { textDecoration: 'none' },
					},
				},
			},
		};

		expect(
			withSectionColor( withHover, PALETTE_OPTIONS, null ).style.elements
		).toEqual( { link: { typography: { textDecoration: 'none' } } } );
	} );
} );

describe( 'hasOwnColors', () => {
	it( 'finds colours set on the section', () => {
		expect(
			hasOwnColors( makeBlock( { backgroundColor: 'black' } ) )
		).toBe( true );
		expect( hasOwnColors( makeBlock( { textColor: 'contrast' } ) ) ).toBe(
			true
		);
		expect(
			hasOwnColors(
				makeBlock( {
					style: {
						elements: { link: { color: { text: '#000' } } },
					},
				} )
			)
		).toBe( true );
		expect(
			hasOwnColors( makeBlock( { className: 'has-background-color' } ) )
		).toBe( true );
		expect( hasOwnColors( makeBlock( { align: 'full' } ) ) ).toBe( false );
	} );

	it( 'leaves text colours inside to `getInnerTextColors`', () => {
		expect(
			hasOwnColors(
				makeBlock( {}, [ makeBlock( { textColor: 'contrast' } ) ] )
			)
		).toBe( false );
	} );
} );

describe( 'getInnerTextColors', () => {
	it( 'finds text colours set inside, however deep', () => {
		const title = {
			attributes: {
				style: {
					elements: {
						link: { color: { text: 'var:preset|color|contrast' } },
					},
				},
			},
			innerBlocks: [],
			name: 'core/site-title',
		};

		expect(
			getInnerTextColors(
				makeBlock( {}, [
					makeBlock( { textColor: 'grey' }, [ title ] ),
				] )
			)
		).toEqual( [ 'var:preset|color|grey', 'var:preset|color|contrast' ] );
	} );

	it( 'leaves out blocks inside with a background of their own', () => {
		const words = makeBlock( { textColor: 'base' } );

		expect(
			getInnerTextColors(
				makeBlock( {}, [
					makeBlock( { backgroundColor: 'accent' }, [ words ] ),
					{
						attributes: { url: 'a.jpg' },
						innerBlocks: [ words ],
						name: 'core/cover',
					},
					makeBlock( { className: 'is-style-section-dark' }, [
						words,
					] ),
				] )
			)
		).toEqual( [] );
	} );
} );

describe( 'getReadableOptions', () => {
	const COLORS = [
		...PALETTE,
		{ slug: 'grey', name: 'Grey', color: '#707070' },
	];
	const names = ( block ) =>
		getReadableOptions( block, PALETTE_OPTIONS, COLORS ).map(
			( option ) => option.name
		);

	it( 'offers every colour to a section without text colours', () => {
		expect( names( makeBlock() ) ).toEqual( [
			null,
			'palette-inverse',
			'palette-accent-primary',
		] );
	} );

	it( 'offers only the colours its text can be read on', () => {
		// Black text vanishes on the dark set, not on lime.
		expect(
			names( makeBlock( {}, [ makeBlock( { textColor: 'contrast' } ) ] ) )
		).toEqual( [ null, 'palette-accent-primary' ] );
		// Grey reads on neither.
		expect(
			names( makeBlock( {}, [ makeBlock( { textColor: 'grey' } ) ] ) )
		).toEqual( [ null ] );
	} );

	it( 'offers none for text colours it can’t work out', () => {
		expect(
			names(
				makeBlock( {}, [
					makeBlock( { style: { color: { text: 'tomato' } } } ),
				] )
			)
		).toEqual( [ null ] );
	} );

	it( 'checks the theme’s colours too', () => {
		const dark = makeBlock(
			withSectionColor( {}, PALETTE_OPTIONS, 'palette-inverse' ),
			[ makeBlock( { textColor: 'base' } ) ]
		);

		// White text would vanish on the white page.
		expect( names( dark ) ).toEqual( [ 'palette-inverse' ] );
	} );

	it( 'keeps the colour the section has', () => {
		const dark = makeBlock(
			withSectionColor( {}, PALETTE_OPTIONS, 'palette-inverse' ),
			[ makeBlock( { textColor: 'contrast' } ) ]
		);

		expect( names( dark ) ).toContain( 'palette-inverse' );
	} );
} );

describe( 'getSectionColor', () => {
	it( 'is the option the section has on', () => {
		expect(
			getSectionColor(
				makeBlock( { className: 'is-style-section-dark' } ),
				STYLE_OPTIONS
			)
		).toBe( 'section-dark' );
		expect(
			getSectionColor(
				makeBlock(
					withSectionColor( {}, PALETTE_OPTIONS, 'palette-inverse' )
				),
				PALETTE_OPTIONS
			)
		).toBe( 'palette-inverse' );
	} );

	it( 'is the theme’s for a section without colours', () => {
		expect( getSectionColor( makeBlock(), PALETTE_OPTIONS ) ).toBeNull();
	} );

	it( 'is none for a section with colours of its own', () => {
		expect(
			getSectionColor(
				makeBlock( { backgroundColor: 'black', textColor: 'white' } ),
				PALETTE_OPTIONS
			)
		).toBeUndefined();
		expect(
			getSectionColor(
				makeBlock( {
					className: 'is-style-section-dark',
					textColor: 'white',
				} ),
				STYLE_OPTIONS
			)
		).toBeUndefined();
	} );
} );

describe( 'the page’s own colours', () => {
	const header = makeBlock( {
		backgroundColor: 'base',
		style: {
			elements: {
				link: { color: { text: 'var:preset|color|contrast' } },
			},
		},
		textColor: 'contrast',
	} );

	it( 'count as the theme’s', () => {
		expect( getSectionColor( header, PALETTE_OPTIONS ) ).toBeNull();
	} );

	it( 'are replaced by a picked colour', () => {
		expect(
			withSectionColor(
				header.attributes,
				PALETTE_OPTIONS,
				'palette-inverse'
			)
		).toEqual( withSectionColor( {}, PALETTE_OPTIONS, 'palette-inverse' ) );
	} );

	it( 'count as a set when a block has its background', () => {
		expect(
			getSectionColor(
				makeBlock( { backgroundColor: 'primary' } ),
				getColorOptions( {
					blockStyles: [],
					colors: PALETTE,
					palette: [
						...PALETTE,
						{ slug: 'pale', name: 'Pale', color: '#eeeeee' },
					],
					styles: {
						color: {
							background: 'var:preset|color|base',
							text: 'var:preset|color|contrast',
						},
					},
					supports: SUPPORTS,
				} )
			)
		).toBe( 'palette-accent-primary' );
	} );
} );

describe( 'withPartColor', () => {
	it( 'colours the outermost blocks without colours of their own', () => {
		const plain = makeBlock();
		const dark = makeBlock( { backgroundColor: 'black' } );
		const other = { attributes: {}, innerBlocks: [], name: 'core/spacer' };
		const [ a, b, c ] = withPartColor(
			[ plain, dark, other ],
			'core/group',
			STYLE_OPTIONS,
			[],
			'section-dark'
		);

		expect( a.attributes.className ).toBe( 'is-style-section-dark' );
		expect( b ).toBe( dark );
		expect( c ).toBe( other );
	} );
} );

describe( 'withPartColor and text inside', () => {
	it( 'leaves a design whose text wouldn’t read on the colour', () => {
		const design = makeBlock( {}, [
			makeBlock( { textColor: 'contrast' } ),
		] );

		expect(
			withPartColor(
				[ design ],
				'core/group',
				PALETTE_OPTIONS,
				PALETTE,
				'palette-inverse'
			)[ 0 ]
		).toBe( design );
		expect(
			withPartColor(
				[ design ],
				'core/group',
				PALETTE_OPTIONS,
				PALETTE,
				'palette-accent-primary'
			)[ 0 ].attributes.backgroundColor
		).toBe( 'primary' );
	} );
} );

describe( 'getAttributeUpdate', () => {
	it( 'lists attributes taken away as undefined', () => {
		expect(
			getAttributeUpdate(
				{ align: 'full', backgroundColor: 'a' },
				{ align: 'full', className: 'x' }
			)
		).toEqual( {
			align: 'full',
			backgroundColor: undefined,
			className: 'x',
		} );
	} );
} );
