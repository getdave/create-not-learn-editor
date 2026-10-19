/**
 * Rows that lead on to related screens, each with an icon, a title and one
 * plain line about it, as on Design. They usually sit at the foot of a
 * screen; on "Your site" they are the screen. A link with an `href` leaves
 * the editor, to WP Admin, in a new tab.
 */

/**
 * WordPress dependencies
 */
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import {
	Button,
	chevronRightIcon,
	externalIcon,
	Icon,
	__,
} from './wordpress-packages';

/**
 * Links on to related screens.
 *
 * @param {Object}   props       Component props.
 * @param {string}   props.label Accessible name for the group of links.
 * @param {Object[]} props.links `{ description, href, icon, onSelect, search,
 *                               title, to }` for each. `onSelect`, run just
 *                               before the screen opens, and `search` are
 *                               optional. `href` opens a page outside the
 *                               editor in a new tab, in place of `to`.
 * @return {Element} The links.
 */
export default function ScreenLinks( { label, links } ) {
	const navigate = useNavigate();

	return (
		<nav aria-label={ label } className="cnl-screen-links">
			{ links.map(
				( {
					description,
					href,
					icon,
					onSelect,
					search,
					title,
					to,
				} ) => (
					<Button
						className="cnl-screen-links__link"
						key={ title }
						{ ...( href
							? {
									href,
									rel: 'noopener noreferrer',
									target: '_blank',
								}
							: {
									onClick: () => {
										onSelect?.();
										navigate( { search, to } );
									},
								} ) }
					>
						<Icon
							className="cnl-screen-links__icon"
							icon={ icon }
						/>
						<span className="cnl-screen-links__text">
							<span className="cnl-screen-links__title">
								{ title }
							</span>
							<span className="cnl-screen-links__description">
								{ description }
							</span>
						</span>
						<Icon
							className="cnl-screen-links__chevron"
							icon={ href ? externalIcon : chevronRightIcon }
						/>
						{ href && (
							<span className="screen-reader-text">
								{ __( '(opens in a new tab)' ) }
							</span>
						) }
					</Button>
				)
			) }
		</nav>
	);
}
