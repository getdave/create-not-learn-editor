/**
 * Internal dependencies
 */
import { __ } from '../../wordpress-packages';

const screens = {
	'/styles': {
		description: __( 'Manage the visual language of the site.' ),
		icon: 'dashicons-admin-appearance',
		section: __( 'Design' ),
		status: __( 'Styles' ),
		title: __( 'Styles' ),
	},
	'/identity': {
		description: __(
			'Manage the name, logo, and basic identity of the site.'
		),
		icon: 'dashicons-id',
		section: __( 'Design' ),
		status: __( 'Site identity' ),
		title: __( 'Site Identity' ),
	},
	'/patterns': {
		description: __( 'Manage reusable patterns for the site.' ),
		icon: 'dashicons-layout',
		section: __( 'Advanced' ),
		status: __( 'Patterns' ),
		title: __( 'Patterns' ),
	},
	'/template-parts': {
		description: __( 'Manage reusable structural areas of the site.' ),
		icon: 'dashicons-schedule',
		section: __( 'Advanced' ),
		status: __( 'Template parts' ),
		title: __( 'Template Parts' ),
	},
	'/templates': {
		description: __( 'Manage the templates that control site structure.' ),
		icon: 'dashicons-media-document',
		section: __( 'Advanced' ),
		status: __( 'Templates' ),
		title: __( 'Templates' ),
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
