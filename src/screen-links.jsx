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
import { Button, chevronRightIcon, Icon } from './wordpress-packages';

/**
 * Links on to related screens.
 *
 * @param {Object}   props       Component props.
 * @param {string}   props.label Accessible name for the group of links.
 * @param {Object[]} props.links `{ description, icon, search, title, to }` for
 *                               each. `search` is optional.
 * @return {Element} The links.
 */
export default function ScreenLinks( { label, links } ) {
	const navigate = useNavigate();

	return (
		<nav aria-label={ label } className="cnl-screen-links">
			{ links.map( ( { description, icon, search, title, to } ) => (
				<Button
					className="cnl-screen-links__link"
					key={ to }
					onClick={ () => navigate( { search, to } ) }
				>
					<Icon className="cnl-screen-links__icon" icon={ icon } />
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
			) ) }
		</nav>
	);
}
