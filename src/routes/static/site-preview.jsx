/**
 * Internal dependencies
 */
import { settings } from '../../settings';
import { SiteCanvas, useSiteCanvas } from '../../site-canvas';
import { getHomepageDocumentIconStatus } from '../home/preview';
import { Icon, __, homeIcon, postListIcon } from '../../wordpress-packages';

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

	return (
		<div className="cnl-editor-homepage-document">
			<div className="cnl-editor-homepage-document__text">
				<div className="cnl-editor-homepage-document__heading">
					{ documentIcon && (
						<Icon
							className="cnl-editor-homepage-document__icon"
							icon={ documentIcon }
						/>
					) }
					<h1 className="cnl-editor-homepage-document__title">
						{ previewLabel }
					</h1>
				</div>
				{ previewMetaLabel && (
					<p className="cnl-editor-homepage-document__meta">
						{ previewMetaLabel }
					</p>
				) }
			</div>
		</div>
	);
}

function EmptyPreview() {
	return (
		<div className="cnl-editor-canvas-placeholder">
			<span
				aria-hidden
				className="cnl-editor-canvas-placeholder__icon dashicons dashicons-admin-home"
			/>
			<div className="cnl-editor-canvas-placeholder__title">
				{ __( 'Preview unavailable' ) }
			</div>
			<p className="cnl-editor-canvas-placeholder__description">
				{ __( 'Configure the site URL before previewing your site.' ) }
			</p>
		</div>
	);
}

/**
 * The site's front page, live-previewed through the same site canvas Home
 * and Pages use, so the preview behaves and looks the same everywhere it
 * appears.
 *
 * The changes made here, to the site's look and identity, stay unsaved until
 * the user saves them, and only the editor shows those, not Browse.
 *
 * @param {Object}   props                  Component props.
 * @param {string}   props.url              Page to show, the front page unless
 *                                          given.
 * @param {?Object}  props.pinnedEntity     `{ postType, postId }` for Edit
 *                                          to change, rather than what `url`
 *                                          shows.
 * @param {Function} props.isShownInPreview See `useSiteCanvas`.
 * @param {boolean}  props.hasSections      See `SiteCanvas`.
 * @return {Element} The preview canvas.
 */
export default function SitePreviewCanvas( {
	hasSections,
	isShownInPreview,
	pinnedEntity = null,
	url = settings.homeUrl,
} ) {
	const canvas = useSiteCanvas( { isShownInPreview, pinnedEntity, url } );

	return (
		<SiteCanvas
			canvas={ canvas }
			document={ <PreviewDocument canvas={ canvas } /> }
			emptyPreview={ <EmptyPreview /> }
			hasSections={ hasSections }
		/>
	);
}
