/**
 * Internal dependencies
 */
import { useSiteTrail } from '../../site-trail';
import { Breadcrumbs, Stack, Text, __, el } from '../../wordpress-packages';

/**
 * The title of a screen under Design. Screens linked from Design lead with a
 * breadcrumb back to it, as there is no sidebar item to return by. Opened
 * from the "Your site" checklist, or the Header or Footer screen, they lead
 * back there instead.
 *
 * @param {Object}  props             Component props.
 * @param {string}  props.description Sentence under the title.
 * @param {boolean} props.isTopLevel  Whether this is the Design screen itself.
 * @param {string}  props.title       Screen title.
 * @return {Node} The heading.
 */
export function DesignScreenHeading( { description, isTopLevel, title } ) {
	const trail = useSiteTrail();

	return el(
		Stack,
		{ direction: 'column', gap: 'xs' },
		isTopLevel
			? el( Text, { render: el( 'h1' ), variant: 'heading-lg' }, title )
			: el( Breadcrumbs, {
					items: [
						...( trail.length
							? trail
							: [ { label: __( 'Design' ), to: '/design' } ] ),
						{ label: title },
					],
				} ),
		el(
			Text,
			{ className: 'routes-styles__muted', variant: 'body-md' },
			description
		)
	);
}
