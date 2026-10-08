/**
 * Internal dependencies
 */
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
	el,
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

	return el( Dropdown, {
		className: 'cnl-editor-homepage-options',
		contentClassName: 'cnl-editor-homepage-options__content',
		popoverProps: {
			placement: 'bottom',
		},
		renderContent: ( { onClose } ) =>
			el(
				MenuGroup,
				{ className: 'cnl-editor-homepage-options__menu' },
				el(
					MenuItem,
					{
						disabled: isBusy,
						icon: settingsIcon,
						onClick: () => {
							onClose();
							onConfigureHomepage();
						},
					},
					__( 'Configure Homepage' )
				)
			),
		renderToggle: ( { isOpen, onToggle } ) =>
			el( Button, {
				'aria-expanded': isOpen,
				className: 'cnl-editor-homepage-options__toggle',
				icon: chevronDownIcon,
				label: __( 'Page Options' ),
				onClick: onToggle,
				showTooltip: true,
				variant: 'tertiary',
			} ),
	} );
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
			__( 'Homepage preview unavailable' )
		),
		el(
			'p',
			{ className: 'cnl-editor-canvas-placeholder__description' },
			__( 'Configure the site URL before previewing the homepage.' )
		)
	);
}

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
		),
		el( PageOptionsDropdown, {
			hasHomepageOptions: previewContext?.previewStatus === 'homepage',
			isBusy: false,
			onConfigureHomepage: () => {},
		} )
	);
}

/*
 * The site as visitors see it, starting at the homepage. Following links
 * moves the preview around the site, and the editor follows it, so Edit
 * changes whatever page is on show.
 */
function Canvas() {
	const canvas = useSiteCanvas( { url: settings.homeUrl } );

	return el( SiteCanvas, {
		canvas,
		className: 'cnl-editor-homepage-preview',
		document: el( PreviewDocument, { canvas } ),
		emptyPreview: el( EmptyPreview ),
	} );
}

export const stage = withUiTheme( Stage );
export const canvas = withUiTheme( Canvas );
