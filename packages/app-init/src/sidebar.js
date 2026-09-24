/**
 * WordPress dependencies
 */
import { store as bootStore } from '@wordpress/boot';
import { Button } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { createElement as el, createRoot } from '@wordpress/element';
import { __, isRTL, sprintf } from '@wordpress/i18n';
import { chevronLeft, chevronRight, wordpress } from '@wordpress/icons';
import { Icon } from '@wordpress/ui';

/**
 * Link back to wp-admin: a back arrow followed by the WordPress logo.
 *
 * @return {Element} The Dashboard link.
 */
function DashboardLink() {
	const dashboardLink = useSelect(
		( select ) => select( bootStore ).getDashboardLink(),
		[]
	);

	return el(
		Button,
		{
			__next40pxDefaultSize: true,
			className: 'cnl-sidebar-dashboard__link',
			href: dashboardLink || '/',
			label: __( 'Go to WordPress Dashboard' ),
			showTooltip: true,
		},
		el( Icon, { icon: isRTL() ? chevronRight : chevronLeft } ),
		el( Icon, { icon: wordpress } )
	);
}

function createWelcome( name ) {
	const welcome = document.createElement( 'p' );
	welcome.className = 'cnl-sidebar-welcome';
	welcome.textContent = name
		? sprintf(
				/* translators: %s: The current user's first name or nickname. */
				__( 'Welcome, %s' ),
				name
			)
		: __( 'Welcome' );

	return welcome;
}

function createDashboardLink() {
	const container = document.createElement( 'div' );
	container.className = 'cnl-sidebar-dashboard';
	createRoot( container ).render( el( DashboardLink ) );

	return container;
}

/**
 * Add the plugin's own pieces to boot's sidebar.
 *
 * - A Dashboard link showing the WordPress logo, replacing boot's text link,
 *   which `src/style.scss` hides.
 * - A greeting above the main menu, hidden inside menu sections by CSS.
 *
 * Boot's sidebar has no slot for extra content, so both are placed around
 * boot's own Dashboard link. The sidebar can remount, on narrow screens for
 * example, so they are put back whenever they go missing.
 *
 * @param {Object} options          Options.
 * @param {string} options.userName The user's first name or nickname, if any.
 */
export function enhanceSidebar( { userName } = {} ) {
	const dashboardLink = createDashboardLink();
	const welcome = createWelcome( userName );

	let isScheduled = false;
	const place = () => {
		isScheduled = false;

		const backButton = document.querySelector(
			'[class*="__sidebar"] [class*="__back-button"]'
		);

		if ( ! backButton ) {
			return;
		}

		if ( backButton.previousElementSibling !== dashboardLink ) {
			backButton.before( dashboardLink );
		}

		if ( backButton.nextElementSibling !== welcome ) {
			backButton.after( welcome );
		}
	};

	new window.MutationObserver( () => {
		if ( ! isScheduled ) {
			isScheduled = true;
			window.requestAnimationFrame( place );
		}
	} ).observe( document.body, { childList: true, subtree: true } );

	place();
}
