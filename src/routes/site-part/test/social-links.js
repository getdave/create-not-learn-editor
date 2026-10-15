/**
 * External dependencies
 */
import { describe, expect, test, vi } from 'vitest';

/**
 * Internal dependencies
 */
import {
	getAddableServices,
	getService,
	getSocialLinks,
	getSocialLinksDescription,
	haveSameServices,
	isPlaceholderUrl,
	withSocialLinks,
} from '../social-links';

vi.mock( '@wordpress/blocks', () => ( { createBlock: vi.fn() } ) );

vi.mock( '../data', () => ( {
	getSiteParts: () => [],
	pickSitePart: () => null,
} ) );

vi.mock( '../../../wordpress-packages', () => ( {
	__: ( text ) => text,
	_n: ( single, plural, count ) => ( count === 1 ? single : plural ),
	blockEditorStore: {},
	blocksStore: {},
	coreDataStore: {},
	createBlock: ( name, attributes ) => ( {
		attributes,
		innerBlocks: [],
		name,
	} ),
	sprintf: ( format, value ) => format.replace( '%d', value ),
} ) );

const link = ( service, url ) => ( {
	attributes: { service, url },
	innerBlocks: [],
	name: 'core/social-link',
} );

const socialLinks = ( ...links ) => ( {
	attributes: { className: 'is-style-logos-only' },
	innerBlocks: links,
	name: 'core/social-links',
} );

const SERVICES = [
	{ icon: 'i', name: 'instagram', title: 'Instagram' },
	{ icon: 'f', name: 'facebook', title: 'Facebook' },
	{ icon: 't', name: 'tiktok', title: 'TikTok' },
];

describe( 'social links', () => {
	test( 'treats a missing address or # as one to fill in', () => {
		expect( isPlaceholderUrl( '' ) ).toBe( true );
		expect( isPlaceholderUrl( undefined ) ).toBe( true );
		expect( isPlaceholderUrl( ' # ' ) ).toBe( true );
		expect( isPlaceholderUrl( 'https://instagram.com/me' ) ).toBe( false );
	} );

	test( 'reads the links in a Social Icons block, editor or parsed', () => {
		expect(
			getSocialLinks( socialLinks( link( 'instagram', '#' ) ) )
		).toEqual( [ { label: undefined, service: 'instagram', url: '#' } ] );
		expect(
			getSocialLinks( {
				blockName: 'core/social-links',
				innerBlocks: [
					{
						attrs: { service: 'tiktok', url: 'x' },
						blockName: 'core/social-link',
					},
				],
			} )
		).toEqual( [ { label: undefined, service: 'tiktok', url: 'x' } ] );
		expect( getSocialLinks( null ) ).toEqual( [] );
	} );

	test( 'swaps the links in every Social Icons block, keeping the rest', () => {
		const blocks = [
			{
				attributes: {},
				innerBlocks: [
					socialLinks( link( 'facebook', '#' ) ),
					{ attributes: {}, innerBlocks: [], name: 'core/paragraph' },
				],
				name: 'core/group',
			},
		];
		const [ group ] = withSocialLinks( blocks, [
			{ service: 'instagram', url: 'https://instagram.com/me' },
		] );

		expect( group.innerBlocks[ 0 ].attributes ).toEqual( {
			className: 'is-style-logos-only',
		} );
		expect( getSocialLinks( group.innerBlocks[ 0 ] ) ).toEqual( [
			{
				label: undefined,
				service: 'instagram',
				url: 'https://instagram.com/me',
			},
		] );
		expect( group.innerBlocks[ 1 ] ).toBe( blocks[ 0 ].innerBlocks[ 1 ] );
	} );

	test( 'tells when only addresses differ', () => {
		const a = [ { service: 'instagram', url: '#' } ];

		expect(
			haveSameServices( a, [ { service: 'instagram', url: 'x' } ] )
		).toBe( true );
		expect(
			haveSameServices( a, [ { service: 'tiktok', url: '#' } ] )
		).toBe( false );
		expect( haveSameServices( a, [] ) ).toBe( false );
	} );

	test( 'offers the services not used yet, by name', () => {
		expect(
			getAddableServices( SERVICES, [ { service: 'facebook' } ] ).map(
				( service ) => service.name
			)
		).toEqual( [ 'instagram', 'tiktok' ] );
	} );

	test( 'names a service core doesn’t know by itself', () => {
		expect( getService( SERVICES, 'tiktok' ) ).toEqual( {
			icon: 't',
			title: 'TikTok',
		} );
		expect( getService( SERVICES, 'myspace' ).title ).toBe( 'myspace' );
	} );

	test( 'describes the links, or how many need an address', () => {
		expect(
			getSocialLinksDescription(
				[
					{ service: 'instagram', url: 'https://instagram.com/me' },
					{ service: 'tiktok', url: 'https://tiktok.com/@me' },
				],
				SERVICES
			)
		).toBe( 'Instagram, TikTok' );
		expect(
			getSocialLinksDescription(
				[
					{ service: 'instagram', url: '#' },
					{ service: 'tiktok', url: '' },
				],
				SERVICES
			)
		).toBe( '2 need an address' );
		expect( getSocialLinksDescription( [], SERVICES ) ).toBe( 'None yet' );
	} );
} );
