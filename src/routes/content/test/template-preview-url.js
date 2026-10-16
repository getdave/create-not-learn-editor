/**
 * External dependencies
 */
import { describe, expect, test } from 'vitest';

/**
 * Internal dependencies
 */
import {
	getTemplatePreviewUrl,
	getTemplateSample,
	isSingularTemplate,
} from '../template-preview-url';

const ORIGIN = window.location.origin;
const HOME = `${ ORIGIN }/`;

const POSTS = [
	{ link: `${ ORIGIN }/draft/`, status: 'draft', template: '' },
	{ link: `${ ORIGIN }/wide/`, status: 'publish', template: 'wide' },
	{ link: `${ ORIGIN }/plain/`, status: 'publish', template: '' },
];

describe( 'template preview URLs', () => {
	test( 'tells layouts for one post from layouts of lists', () => {
		expect( isSingularTemplate( { slug: 'single' } ) ).toBe( true );
		expect( isSingularTemplate( { slug: 'single-post' } ) ).toBe( true );
		expect( isSingularTemplate( { slug: 'page-no-title' } ) ).toBe( true );
		expect( isSingularTemplate( { is_custom: true, slug: 'wide' } ) ).toBe(
			true
		);
		expect( isSingularTemplate( { slug: 'home' } ) ).toBe( false );
		expect( isSingularTemplate( { slug: 'archive' } ) ).toBe( false );
		expect( isSingularTemplate( { slug: 'pages-list' } ) ).toBe( false );
	} );

	test( 'shows a layout on a published post that uses it', () => {
		expect(
			getTemplateSample( { is_custom: true, slug: 'wide' }, POSTS ).link
		).toBe( `${ ORIGIN }/wide/` );
	} );

	test( 'otherwise on a published post that leaves it to the theme', () => {
		expect( getTemplateSample( { slug: 'single' }, POSTS ).link ).toBe(
			`${ ORIGIN }/plain/`
		);
	} );

	test( 'shows a layout for one post on it, in that layout', () => {
		expect(
			getTemplatePreviewUrl( {
				homeUrl: HOME,
				records: POSTS,
				template: { slug: 'single' },
			} )
		).toBe( `${ ORIGIN }/plain/?cnl-editor-layout=single` );
	} );

	test( 'shows a layout of lists at the site’s address, listing posts', () => {
		expect(
			getTemplatePreviewUrl( {
				homeUrl: HOME,
				records: POSTS,
				template: { slug: 'home' },
			} )
		).toBe(
			`${ ORIGIN }/?cnl-editor-show-on-front=posts&cnl-editor-layout=home`
		);
	} );

	test( 'shows the homepage’s layout on the homepage as it is', () => {
		expect(
			getTemplatePreviewUrl( {
				homeUrl: HOME,
				records: POSTS,
				template: { slug: 'front-page' },
			} )
		).toBe( `${ ORIGIN }/?cnl-editor-layout=front-page` );
	} );

	test( 'falls back to the site’s address with nothing published', () => {
		expect(
			getTemplatePreviewUrl( {
				homeUrl: HOME,
				records: [],
				template: { slug: 'single' },
			} )
		).toBe(
			`${ ORIGIN }/?cnl-editor-show-on-front=posts&cnl-editor-layout=single`
		);
	} );

	test( 'has nothing to show without a layout', () => {
		expect(
			getTemplatePreviewUrl( { homeUrl: HOME, records: POSTS } )
		).toBe( '' );
	} );
} );
