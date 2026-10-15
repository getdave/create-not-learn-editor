/**
 * Internal dependencies
 */
import SitePreviewCanvas from './site-preview';
import { DesignScreenHeading } from './design-heading';
import { SiteIdentityFields } from '../../pickers/identity';
import { __ } from '../../wordpress-packages';

export function SiteIdentityStage() {
	return (
		<div className="cnl-editor-stage cnl-drilldown-stage routes-styles cnl-editor-identity">
			<DesignScreenHeading
				description={ __(
					'How your site introduces itself. Shown in your header, browser tabs, and search results.'
				) }
				title={ __( 'Name & logo' ) }
			/>
			<SiteIdentityFields />
		</div>
	);
}

export function SiteIdentityCanvas() {
	return <SitePreviewCanvas />;
}
