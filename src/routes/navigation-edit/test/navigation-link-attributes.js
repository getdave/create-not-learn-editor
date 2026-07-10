/**
 * Internal dependencies
 */
import {
	buildNavigationLinkEntityBinding,
	getSuggestionsQuery,
	shouldSeverEntityLink,
	updateNavigationLinkAttributes,
} from '../navigation-link-attributes';

describe( 'navigation link attribute helpers', () => {
	test( 'updates custom links without creating an entity link', () => {
		const setAttributes = jest.fn();
		const result = updateNavigationLinkAttributes(
			{
				label: 'External',
				url: 'https://example.com/',
			},
			setAttributes,
			{}
		);

		expect( setAttributes ).toHaveBeenCalledWith( {
			kind: 'custom',
			label: 'External',
			url: 'https://example.com/',
		} );
		expect( result.isEntityLink ).toBe( false );
	} );

	test( 'keeps entity metadata for post type suggestions', () => {
		const setAttributes = jest.fn();
		const result = updateNavigationLinkAttributes(
			{
				id: 42,
				kind: 'post-type',
				title: 'About',
				type: 'page',
				url: 'https://example.com/about/',
			},
			setAttributes,
			{}
		);

		expect( setAttributes ).toHaveBeenCalledWith( {
			id: 42,
			kind: 'post-type',
			label: 'About',
			type: 'page',
			url: 'https://example.com/about/',
		} );
		expect( result.isEntityLink ).toBe( true );
		expect( buildNavigationLinkEntityBinding( 'post-type' ) ).toEqual( {
			url: {
				args: {
					field: 'link',
				},
				source: 'core/post-data',
			},
		} );
	} );

	test( 'severs an entity link when the URL points to a different path', () => {
		const setAttributes = jest.fn();
		const result = updateNavigationLinkAttributes(
			{
				url: 'https://example.com/contact/',
			},
			setAttributes,
			{
				id: 42,
				kind: 'post-type',
				label: 'About',
				type: 'page',
				url: 'https://example.com/about/',
			}
		);

		expect( setAttributes ).toHaveBeenCalledWith( {
			id: undefined,
			kind: 'custom',
			label: 'About',
			type: 'custom',
			url: 'https://example.com/contact/',
		} );
		expect( result.isEntityLink ).toBe( false );
		expect(
			shouldSeverEntityLink(
				'https://example.com/about/',
				'https://example.com/about/?preview=true'
			)
		).toBe( false );
	} );

	test( 'uses page suggestions for custom link controls', () => {
		expect( getSuggestionsQuery( undefined, undefined ) ).toEqual( {
			initialSuggestionsSearchOptions: {
				perPage: 20,
				subtype: 'page',
				type: 'post',
			},
		} );
		expect( getSuggestionsQuery( 'category', 'taxonomy' ) ).toEqual( {
			perPage: 20,
			subtype: 'category',
			type: 'term',
		} );
	} );
} );
