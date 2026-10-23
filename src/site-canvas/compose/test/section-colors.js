/**
 * External dependencies
 */
import { describe, expect, it } from 'vitest';

/**
 * Internal dependencies
 */
import {
	CUSTOM_COLOR,
	getAttributeUpdate,
	getButtonTextValue,
	getColorOptions,
	getCustomColors,
	getInnerTextColors,
	getReadableOptions,
	getSectionColor,
	hasOwnColors,
	withCustomColors,
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

describe( 'getCustomColors', () => {
	it( 'reads a background, text and button set on the block', () => {
		expect(
			getCustomColors( {
				backgroundColor: 'primary',
				style: {
					color: { text: '#123456' },
					elements: {
						button: {
							color: { background: '#ff0000', text: '#fff' },
						},
						heading: { color: { text: '#123456' } },
						link: { color: { text: '#123456' } },
					},
				},
			} )
		).toEqual( {
			background: 'var:preset|color|primary',
			button: '#ff0000',
			text: '#123456',
		} );
	} );

	it( 'needs a background', () => {
		expect( getCustomColors( { textColor: 'contrast' } ) ).toBeNull();
	} );

	it( 'leaves out colours of other kinds', () => {
		expect(
			getCustomColors( {
				backgroundColor: 'primary',
				style: { color: { gradient: 'linear-gradient(red, blue)' } },
			} )
		).toBeNull();
		expect(
			getCustomColors( {
				backgroundColor: 'primary',
				textColor: 'contrast',
				style: {
					elements: { link: { color: { text: '#ff0000' } } },
				},
			} )
		).toBeNull();
		expect(
			getCustomColors( {
				backgroundColor: 'primary',
				style: {
					elements: { caption: { color: { text: '#ff0000' } } },
				},
			} )
		).toBeNull();
	} );
} );

describe( 'withCustomColors', () => {
	const context = { colors: PALETTE, supports: SUPPORTS };
	const values = {
		background: '#102030',
		button: 'var:preset|color|primary',
		text: 'var:preset|color|base',
	};

	it( 'saves presets by name and other colours as CSS', () => {
		expect(
			withCustomColors(
				{ align: 'full' },
				PALETTE_OPTIONS,
				values,
				context
			)
		).toEqual( {
			align: 'full',
			style: {
				color: { background: '#102030' },
				elements: {
					button: {
						color: {
							background: 'var:preset|color|primary',
							// Black reads better than white on the green.
							text: '#102030',
						},
					},
					heading: { color: { text: 'var:preset|color|base' } },
					link: { color: { text: 'var:preset|color|base' } },
				},
			},
			textColor: 'base',
		} );
	} );

	it( 'takes the place of an option, and an option takes its place', () => {
		const custom = withCustomColors(
			withSectionColor( {}, PALETTE_OPTIONS, 'palette-inverse' ),
			PALETTE_OPTIONS,
			values,
			context
		);

		expect( custom.backgroundColor ).toBeUndefined();
		expect( getSectionColor( makeBlock( custom ), PALETTE_OPTIONS ) ).toBe(
			undefined
		);
		expect( getCustomColors( custom ) ).toEqual( values );
		expect(
			withSectionColor( custom, PALETTE_OPTIONS, 'palette-inverse' )
		).toEqual( withSectionColor( {}, PALETTE_OPTIONS, 'palette-inverse' ) );
		expect( withSectionColor( custom, PALETTE_OPTIONS, null ) ).toEqual(
			{}
		);
	} );

	it( 'takes the place of a section style', () => {
		const custom = withCustomColors(
			{ className: 'is-style-section-dark' },
			STYLE_OPTIONS,
			values,
			context
		);

		expect( custom.className ).toBeUndefined();
		expect( custom.style.color.background ).toBe( '#102030' );
	} );

	it( 'keeps a background that is the page’s own', () => {
		const custom = withCustomColors(
			{},
			PALETTE_OPTIONS,
			{ ...values, background: 'var:preset|color|base', text: '#333' },
			context
		);

		expect( custom.backgroundColor ).toBe( 'base' );
		expect( getSectionColor( makeBlock( custom ), PALETTE_OPTIONS ) ).toBe(
			undefined
		);
		expect( withSectionColor( custom, PALETTE_OPTIONS, null ) ).toEqual(
			{}
		);
	} );
} );

describe( 'getButtonTextValue', () => {
	it( 'picks whichever of the section’s colours reads on the button', () => {
		expect(
			getButtonTextValue(
				{ background: '#ffffff', button: '#000080', text: '#000000' },
				[]
			)
		).toBe( '#ffffff' );
		expect(
			getButtonTextValue(
				{ background: '#000000', button: '#ffff00', text: '#ffffff' },
				[]
			)
		).toBe( '#000000' );
	} );

	it( 'looks to the palette when neither reads on the button', () => {
		expect(
			getButtonTextValue(
				{
					background: '#2e6b4f',
					button: '#f2c14e',
					text: '#fbfbf8',
				},
				[
					{ slug: 'base', color: '#fbfbf8' },
					{ slug: 'ink', color: '#1b2a22' },
				]
			)
		).toBe( 'var:preset|color|ink' );
	} );
} );

describe( 'withPartColor with custom colours', () => {
	it( 'puts them on the outermost blocks', () => {
		const [ block ] = withPartColor(
			[ makeBlock() ],
			'core/group',
			PALETTE_OPTIONS,
			PALETTE,
			CUSTOM_COLOR,
			{
				supports: SUPPORTS,
				values: {
					background: '#102030',
					button: null,
					text: '#ffffff',
				},
			}
		);

		expect( block.attributes.style.color ).toEqual( {
			background: '#102030',
			text: '#ffffff',
		} );
	} );
} );

describe( 'getColorOptions values', () => {
	it( 'gives each option the colours to start custom colours from', () => {
		expect( PALETTE_OPTIONS.map( ( option ) => option.values ) ).toEqual( [
			{
				background: 'var:preset|color|base',
				button: 'var:preset|color|primary',
				text: 'var:preset|color|contrast',
			},
			{
				background: 'var:preset|color|contrast',
				button: 'var:preset|color|primary',
				text: 'var:preset|color|base',
			},
			{
				background: 'var:preset|color|primary',
				button: 'var:preset|color|contrast',
				text: 'var:preset|color|contrast',
			},
		] );
	} );
} );
