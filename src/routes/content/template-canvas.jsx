/**
 * The canvas beside a Layouts tab: the layout picked there, as a site canvas.
 *
 * Browse shows the layout on the site, on a post or page that would use it,
 * or at the site's address for a layout of lists like Posts Listing. Edit and
 * Compose change the layout itself, in place, as the Pages canvas does for
 * the homepage's latest posts.
 */

/**
 * Internal dependencies
 */
import { settings } from '../../settings';
import { SiteCanvas, useSiteCanvas } from '../../site-canvas';
import { getTemplateIcon, getTemplateTitle } from './helpers';
import { getTemplatePreviewUrl } from './template-preview-url';
import { __, Icon, useMemo } from '../../wordpress-packages';

/**
 * @param {Object} props
 * @param {Object} props.template Template record.
 * @return {Element} The layout's name, for the canvas toolbar.
 */
function TemplateDocument( { template } ) {
	return (
		<div className="cnl-editor-homepage-document">
			<div className="cnl-editor-homepage-document__text">
				<div className="cnl-editor-homepage-document__heading">
					<Icon
						className="cnl-editor-homepage-document__icon"
						icon={ getTemplateIcon( template ) }
					/>
					<h1 className="cnl-editor-homepage-document__title">
						{ getTemplateTitle( template ) }
					</h1>
				</div>
				<p className="cnl-editor-homepage-document__meta">
					{ __( 'Layout · Changes everywhere it is used' ) }
				</p>
			</div>
		</div>
	);
}

/**
 * @param {Object}   props
 * @param {Object[]} props.records  Posts or pages of the screen's type, to
 *                                  show a layout for one of them on.
 * @param {Object}   props.template Template record.
 * @return {Element} The canvas.
 */
export default function TemplateCanvas( { records, template } ) {
	const templateId = template.id;
	const pinnedEntity = useMemo(
		() => ( { postId: templateId, postType: 'wp_template' } ),
		[ templateId ]
	);
	const canvas = useSiteCanvas( {
		pinnedEntity,
		url: getTemplatePreviewUrl( {
			homeUrl: settings.homeUrl,
			records,
			template,
		} ),
	} );

	return (
		<SiteCanvas
			canvas={ canvas }
			className="cnl-template-canvas"
			document={ <TemplateDocument template={ template } /> }
		/>
	);
}
