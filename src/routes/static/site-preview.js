/**
 * Internal dependencies
 */
import { settings } from '../../settings';
import { SURFACE_EDIT, SiteCanvas, useSiteCanvas } from '../../site-canvas';
import { getHomepageDocumentIconStatus } from '../home/preview';
import { Icon, __, el, homeIcon, postListIcon } from '../../wordpress-packages';

const DOCUMENT_ICON_BY_STATUS = {
	'home-latest-posts': homeIcon,
	'home-static': homeIcon,
	'posts-page': postListIcon,
};

/**
 * The toolbar's centered document label: whatever page the preview is
 * showing, defaulting to the homepage before the preview has loaded or while
 * it is still resolving what is on show.
 *
 * @param {Object} props        Component props.
 * @param {Object} props.canvas Result of `useSiteCanvas`.
 * @return {Element} The document label.
 */
function PreviewDocument( { canvas } ) {
	const { isLoadingContext, previewContext } = canvas;
	const previewLabel = previewContext?.previewLabel || __( 'Home' );
	const previewStatusLabel = isLoadingContext
		? __( 'Loading preview details' )
		: previewContext?.previewStatusLabel || __( 'Preview' );
	const previewTypeLabel = previewContext?.previewTypeLabel || '';
	const previewMetaLabel = isLoadingContext
		? previewStatusLabel
		: [ previewTypeLabel, previewStatusLabel ]
				.filter( Boolean )
				.join( ' · ' );
	const documentIcon =
		DOCUMENT_ICON_BY_STATUS[
			getHomepageDocumentIconStatus(
				previewContext?.previewDocumentStatus
			)
		];

	return el(
		'div',
		{ className: 'cnl-editor-homepage-document' },
		el(
			'div',
			{ className: 'cnl-editor-homepage-document__text' },
			el(
				'div',
				{ className: 'cnl-editor-homepage-document__heading' },
				documentIcon &&
					el( Icon, {
						className: 'cnl-editor-homepage-document__icon',
						icon: documentIcon,
					} ),
				el(
					'h1',
					{ className: 'cnl-editor-homepage-document__title' },
					previewLabel
				)
			),
			previewMetaLabel &&
				el(
					'p',
					{ className: 'cnl-editor-homepage-document__meta' },
					previewMetaLabel
				)
		)
	);
}

function EmptyPreview() {
	return el(
		'div',
		{ className: 'cnl-editor-canvas-placeholder' },
		el( 'span', {
			'aria-hidden': true,
			className:
				'cnl-editor-canvas-placeholder__icon dashicons dashicons-admin-home',
		} ),
		el(
			'div',
			{ className: 'cnl-editor-canvas-placeholder__title' },
			__( 'Preview unavailable' )
		),
		el(
			'p',
			{ className: 'cnl-editor-canvas-placeholder__description' },
			__( 'Configure the site URL before previewing your site.' )
		)
	);
}

/**
 * The site's front page, live-previewed through the same site canvas Home
 * and Pages use, so the preview behaves and looks the same everywhere it
 * appears.
 *
 * It opens in Edit. The changes made here, to the site's look and identity,
 * stay unsaved until the user saves them, and only Edit shows those.
 *
 * @return {Element} The preview canvas.
 */
export default function SitePreviewCanvas() {
	const canvas = useSiteCanvas( {
		initialSurface: SURFACE_EDIT,
		url: settings.homeUrl,
	} );

	return el( SiteCanvas, {
		canvas,
		document: el( PreviewDocument, { canvas } ),
		emptyPreview: el( EmptyPreview ),
	} );
}
