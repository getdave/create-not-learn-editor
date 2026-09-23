import { __ } from '@wordpress/i18n';
import { desktop, tablet, mobile } from '@wordpress/icons';

export const BLOCK_VISIBILITY_VIEWPORTS = {
	desktop: {
		label: __( 'Desktop' ),
		icon: desktop,
		key: 'desktop',
	},
	tablet: {
		label: __( 'Tablet' ),
		icon: tablet,
		key: 'tablet',
	},
	mobile: {
		label: __( 'Mobile' ),
		icon: mobile,
		key: 'mobile',
	},
};

export const BLOCK_VISIBILITY_VIEWPORT_ENTRIES = Object.entries(
	BLOCK_VISIBILITY_VIEWPORTS
);
