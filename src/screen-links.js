/**
 * Rows that lead on to related screens, each with an icon, a title and one
 * plain line about it, as on Design. They sit at the foot of a screen.
 */

/**
 * WordPress dependencies
 */
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { Button, chevronRightIcon, el, Icon } from './wordpress-packages';

/**
 * Links on to related screens.
 *
 * @param {Object}   props       Component props.
 * @param {string}   props.label Accessible name for the group of links.
 * @param {Object[]} props.links `{ description, icon, title, to }` for each.
 * @return {Element} The links.
 */
export default function ScreenLinks( { label, links } ) {
	const navigate = useNavigate();

	return el(
		'nav',
		{ 'aria-label': label, className: 'cnl-screen-links' },
		links.map( ( { description, icon, title, to } ) =>
			el(
				Button,
				{
					className: 'cnl-screen-links__link',
					key: to,
					onClick: () => navigate( { to } ),
				},
				el( Icon, { className: 'cnl-screen-links__icon', icon } ),
				el(
					'span',
					{ className: 'cnl-screen-links__text' },
					el(
						'span',
						{ className: 'cnl-screen-links__title' },
						title
					),
					el(
						'span',
						{ className: 'cnl-screen-links__description' },
						description
					)
				),
				el( Icon, {
					className: 'cnl-screen-links__chevron',
					icon: chevronRightIcon,
				} )
			)
		)
	);
}
