/**
 * Internal dependencies
 */
import { __ } from '../../wordpress-packages';

const screens = {
	'/styles': {
		description: __(
			'Pick a look for your whole site. Each look sets colors, fonts, and spacing together.'
		),
		icon: 'dashicons-admin-appearance',
		section: __( 'Design' ),
		status: __( 'Site look' ),
		title: __( 'Site look' ),
	},
	'/colors': {
		description: __(
			'The colors your whole site uses. Your theme provides these palettes.'
		),
		icon: 'dashicons-art',
		section: __( 'Design' ),
		status: __( 'Colors' ),
		title: __( 'Colors' ),
	},
	'/fonts': {
		description: __(
			'The fonts your whole site uses. Your theme provides these pairings.'
		),
		icon: 'dashicons-editor-textcolor',
		section: __( 'Design' ),
		status: __( 'Fonts' ),
		title: __( 'Fonts' ),
	},
	'/identity': {
		description: __(
			'Your site’s name, tagline, and logo. Shown in your header, browser tabs, and search results.'
		),
		icon: 'dashicons-id',
		section: __( 'Design' ),
		status: __( 'Site identity' ),
		title: __( 'Name & logo' ),
	},
	'/patterns': {
		description: __(
			'Ready-made pieces you can drop into any page, like a row of reviews or a contact block. WordPress calls these patterns.'
		),
		icon: 'dashicons-layout',
		section: __( 'Advanced' ),
		status: __( 'Patterns' ),
		title: __( 'Sections' ),
	},
	'/template-parts': {
		description: __(
			'The pieces that repeat on every page, like your header and footer. Change one and it updates everywhere. WordPress calls these template parts.'
		),
		icon: 'dashicons-schedule',
		section: __( 'Advanced' ),
		status: __( 'Template parts' ),
		title: __( 'Site parts' ),
	},
	'/templates': {
		description: __(
			'Layouts decide how each kind of page is arranged. Changing one changes every page that uses it. WordPress calls these templates.'
		),
		icon: 'dashicons-media-document',
		section: __( 'Advanced' ),
		status: __( 'Templates' ),
		title: __( 'Layouts' ),
	},
};

export function getCurrentEditorPath() {
	const path =
		new URLSearchParams( window.location.search ).get( 'p' ) || '/';

	return path.split( '?' )[ 0 ];
}

export function getStaticScreen() {
	return (
		screens[ getCurrentEditorPath() ] || {
			description: __( 'Manage site editor resources.' ),
			icon: 'dashicons-admin-generic',
			section: __( 'Editor' ),
			status: __( 'Ready' ),
			title: __( 'Editor' ),
		}
	);
}
