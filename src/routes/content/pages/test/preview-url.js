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
	link: `${ ORIGIN }/about/`,
	status: 'publish',
	template: '',
};

describe( 'getPagePreviewUrl', () => {
	test( 'shows a page at its own address', () => {
		expect( getPagePreviewUrl( about, '' ) ).toBe( `${ ORIGIN }/about/` );
	} );

	test( 'shows a page that is not published as a preview', () => {
		expect( getPagePreviewUrl( { ...about, status: 'draft' }, '' ) ).toBe(
			`${ ORIGIN }/about/?preview=true`
		);
	} );

	test( 'passes an unsaved layout along', () => {
		expect(
			getPagePreviewUrl( { ...about, template: 'page-no-title' }, '' )
		).toBe( `${ ORIGIN }/about/?cnl-editor-template=page-no-title` );
		expect(
			getPagePreviewUrl( { ...about, template: '' }, 'page-no-title' )
		).toBe( `${ ORIGIN }/about/?cnl-editor-template=default` );
	} );

	test( 'has nothing to show without a link', () => {
		expect( getPagePreviewUrl( null, '' ) ).toBe( '' );
		expect( getPagePreviewUrl( { status: 'publish' }, '' ) ).toBe( '' );
	} );

	test( 'shows the homepage as it is when nothing about it changed', () => {
		expect(
			getPagePreviewUrl( { ...about, link: HOME_URL }, '', {
				homeUrl: HOME_URL,
				savedShowOnFront: 'page',
				showOnFront: 'page',
			} )
		).toBe( HOME_URL );
	} );

	test( 'shows the latest posts on the homepage when it lists them', () => {
		expect(
			getPagePreviewUrl( about, '', {
				homeUrl: HOME_URL,
				savedShowOnFront: 'posts',
				showOnFront: 'posts',
			} )
		).toBe( HOME_URL );
	} );

	test( 'passes an unsaved switch to the latest posts along', () => {
		expect(
			getPagePreviewUrl(
				{ ...about, link: HOME_URL, template: 'page-no-title' },
				'',
				{
					homeUrl: HOME_URL,
					savedShowOnFront: 'page',
					showOnFront: 'posts',
				}
			)
		).toBe( `${ HOME_URL }?cnl-editor-show-on-front=posts` );
	} );

	test( 'passes an unsaved switch back to the page along', () => {
		expect(
			getPagePreviewUrl( { ...about, template: 'page-no-title' }, '', {
				homeUrl: HOME_URL,
				savedShowOnFront: 'posts',
				showOnFront: 'page',
			} )
		).toBe(
			`${ HOME_URL }?cnl-editor-show-on-front=page&cnl-editor-template=page-no-title`
		);
	} );
} );
