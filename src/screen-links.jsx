/**
 * Rows that lead on to related screens, each with an icon, a title and one
 * plain line about it, as on Design. They usually sit at the foot of a
 * screen; on "My site" they are the screen.
 */

/**
 * WordPress dependencies
 */
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { Button, chevronRightIcon, Icon } from './wordpress-packages';

/**
 * Links on to related screens.
 *
 * @param {Object}   props       Component props.
 * @param {string}   props.label Accessible name for the group of links.
 * @param {Object[]} props.links `{ description, icon, onSelect, search, title,
 *                               to }` for each. `onSelect`, run just before the
 *                               screen opens, and `search` are optional.
 * @return {Element} The links.
 */
export default function ScreenLinks( { label, links } ) {
	const navigate = useNavigate();

	return (
		<nav aria-label={ label } className="cnl-screen-links">
			{ links.map(
				( { description, icon, onSelect, search, title, to } ) => (
					<Button
						className="cnl-screen-links__link"
						key={ title }
						onClick={ () => {
							onSelect?.();
							navigate( { search, to } );
						} }
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
							icon={ chevronRightIcon }
						/>
					</Button>
				)
			) }
		</nav>
	);
}
