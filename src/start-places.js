/**
 * The places to start working on the site, as "Your site" and the chat both
 * offer them, so the two name, order and describe them the same way. Each
 * says what it leads to: "Your site" opens a screen, the chat asks for it.
 *
 * Imported package by package, as the chat is mounted from app init.
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import {
	brush as brushIcon,
	home as homeIcon,
	pages as pagesIcon,
	siteLogo as siteLogoIcon,
} from '@wordpress/icons';

/**
 * Internal dependencies
 */
import sitePartsIcon from './site-parts-icon';

/**
 * @return {Object[]} `{ description, icon, id, title }` for each place.
 */
export function getStartPlaces() {
	return [
		{
			description: __( 'Make the first page visitors see your own.' ),
			icon: homeIcon,
			id: 'home',
			title: __( 'Your homepage' ),
		},
		{
			description: __( 'Add pages like About and Contact.' ),
			icon: pagesIcon,
			id: 'pages',
			title: __( 'Pages & menu' ),
		},
		{
			description: __( 'Name your site and add a logo.' ),
			icon: siteLogoIcon,
			id: 'identity',
			title: __( 'Name & logo' ),
		},
		{
			// Design leads with whole-site looks and links on to Colors and
			// Fonts, so one place covers both without adding to the choices.
			description: __( 'Pick the look of your whole site.' ),
			icon: brushIcon,
			id: 'style',
			title: __( 'Colors & fonts' ),
		},
		{
			// One place for both, as they work the same way, and a screen
			// beyond it to pick which.
			description: __( 'Choose the top and bottom of every page.' ),
			icon: sitePartsIcon,
			id: 'siteParts',
			title: __( 'Header & footer' ),
		},
	];
}
