jest.mock( '@wordpress/blocks', () => ( {
	createBlock: jest.fn(),
} ) );

/**
 * External dependencies
 */
import { describe, expect, test } from 'vitest';

/**
 * Internal dependencies
 */
import { getPagePreviewUrl } from '../preview-url';

const ORIGIN = window.location.origin;
const HOME_URL = `${ ORIGIN }/`;

const about = {
	id: 8,
	link: `${ ORIGIN }/about/`,
	status: 'publish',
	template: '',
};
const welcome = { ...about, id: 7, link: HOME_URL };
const onPage = { page_on_front: 7, show_on_front: 'page' };
const onPosts = { page_on_front: 7, show_on_front: 'posts' };

describe( 'getPagePreviewUrl', () => {
	test( 'shows a page at its own address', () => {
		expect( getPagePreviewUrl( { homeUrl: HOME_URL, page: about } ) ).toBe(
			`${ ORIGIN }/about/`
		);
	} );

	test( 'shows a page that is not published as a preview', () => {
		expect(
			getPagePreviewUrl( {
				homeUrl: HOME_URL,
				page: { ...about, status: 'draft' },
			} )
		).toBe( `${ ORIGIN }/about/?preview=true` );
	} );

	test( 'keeps showing a preview while publishing is unsaved', () => {
		expect(
			getPagePreviewUrl( {
				homeUrl: HOME_URL,
				page: about,
				savedStatus: 'draft',
			} )
		).toBe( `${ ORIGIN }/about/?preview=true` );
	} );

	test( 'passes an unsaved layout along', () => {
		expect(
			getPagePreviewUrl( {
				homeUrl: HOME_URL,
				page: { ...about, template: 'page-no-title' },
			} )
		).toBe( `${ ORIGIN }/about/?cnl-editor-template=page-no-title` );
		expect(
			getPagePreviewUrl( {
				homeUrl: HOME_URL,
				page: about,
				savedTemplate: 'page-no-title',
			} )
		).toBe( `${ ORIGIN }/about/?cnl-editor-template=default` );
	} );

	test( 'has nothing to show without a link', () => {
		expect( getPagePreviewUrl( { homeUrl: HOME_URL } ) ).toBe( '' );
		expect(
			getPagePreviewUrl( {
				homeUrl: HOME_URL,
				page: { status: 'publish' },
			} )
		).toBe( '' );
	} );

	test( 'shows the homepage at the site’s address', () => {
		expect(
			getPagePreviewUrl( {
				homeUrl: HOME_URL,
				isHomepage: true,
				page: welcome,
				site: onPage,
			} )
		).toBe( HOME_URL );
		expect(
			getPagePreviewUrl( {
				homeUrl: HOME_URL,
				isHomepage: true,
				site: onPosts,
			} )
		).toBe( HOME_URL );
	} );

	test( 'passes an unsaved switch to the latest posts along', () => {
		expect(
			getPagePreviewUrl( {
				homeUrl: HOME_URL,
				isHomepage: true,
				savedSite: onPage,
				site: onPosts,
			} )
		).toBe(
			`${ HOME_URL }?cnl-editor-show-on-front=posts&cnl-editor-page-on-front=7`
		);
	} );

	test( 'passes an unsaved switch to another page along', () => {
		expect(
			getPagePreviewUrl( {
				homeUrl: HOME_URL,
				isHomepage: true,
				page: { ...about, template: 'page-no-title' },
				savedSite: onPosts,
				site: { page_on_front: 8, show_on_front: 'page' },
			} )
		).toBe(
			`${ HOME_URL }?cnl-editor-show-on-front=page&cnl-editor-page-on-front=8&cnl-editor-template=page-no-title`
		);
	} );

	test( 'shows a page that stops being the homepage at an address of its own', () => {
		expect(
			getPagePreviewUrl( {
				homeUrl: HOME_URL,
				page: welcome,
				savedSite: onPage,
				site: onPosts,
			} )
		).toBe(
			`${ HOME_URL }?page_id=7&cnl-editor-show-on-front=posts&cnl-editor-page-on-front=7`
		);
	} );
} );
