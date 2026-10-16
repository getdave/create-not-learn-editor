/**
 * WordPress dependencies
 */
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { withCanvasRecovery } from '../../canvas-recovery';
import { withUiTheme } from '../../theme';
import { settings } from '../../settings';
import { SiteCanvas, useSiteCanvas } from '../../site-canvas';
import { getHomepageDocumentIconStatus } from './preview';
import Stage from './stage';
import {
	Button,
	Dropdown,
	Icon,
	MenuGroup,
	MenuItem,
	__,
	chevronDownIcon,
	homeIcon,
	postListIcon,
	settingsIcon,
} from '../../wordpress-packages';

const DOCUMENT_ICON_BY_STATUS = {
	'home-latest-posts': homeIcon,
	'home-static': homeIcon,
	'posts-page': postListIcon,
};

function PageOptionsDropdown( {
	hasHomepageOptions,
	isBusy,
	onConfigureHomepage,
} ) {
	if ( ! hasHomepageOptions ) {
		return null;
	}

	return (
		<Dropdown
			className="cnl-editor-homepage-options"
			contentClassName="cnl-editor-homepage-options__content"
			popoverProps={ {
				placement: 'bottom',
			} }
			renderContent={ ( { onClose } ) => (
				<MenuGroup className="cnl-editor-homepage-options__menu">
					<MenuItem
						disabled={ isBusy }
						icon={ settingsIcon }
						onClick={ () => {
							onClose();
							onConfigureHomepage();
						} }
					>
						{ __( 'Manage homepage' ) }
					</MenuItem>
				</MenuGroup>
			) }
			renderToggle={ ( { isOpen, onToggle } ) => (
				<Button
					aria-expanded={ isOpen }
					className="cnl-editor-homepage-options__toggle"
					icon={ chevronDownIcon }
					label={ __( 'Page Options' ) }
					onClick={ onToggle }
					showTooltip
					variant="tertiary"
				/>
			) }
		/>
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
				{ __( 'Homepage preview unavailable' ) }
			</div>
			<p className="cnl-editor-canvas-placeholder__description">
				{ __(
					'Configure the site URL before previewing the homepage.'
				) }
			</p>
		</div>
	);
}

function PreviewDocument( { canvas } ) {
	const navigate = useNavigate();
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
			<PageOptionsDropdown
				hasHomepageOptions={
					previewContext?.previewStatus === 'homepage'
				}
				isBusy={ false }
				// The homepage opened up on the Pages screen.
				onConfigureHomepage={ () =>
					navigate( {
						search: { postId: 'home', previewId: 'home' },
						to: '/types/page/list/all',
					} )
				}
			/>
		</div>
	);
}

/*
 * The site, starting at the homepage. Following links in Preview moves it
 * around the site, and the editor follows it, so turning Preview off changes
 * whatever page is on show.
 */
function Canvas() {
	const canvas = useSiteCanvas( { url: settings.homeUrl } );

	return (
		<SiteCanvas
			canvas={ canvas }
			className="cnl-editor-homepage-preview"
			document={ <PreviewDocument canvas={ canvas } /> }
			emptyPreview={ <EmptyPreview /> }
		/>
	);
}

export const stage = withUiTheme( Stage );
export const canvas = withCanvasRecovery( withUiTheme( Canvas ) );
