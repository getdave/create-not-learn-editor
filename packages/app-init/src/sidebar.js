/**
 * WordPress dependencies
 */
import { store as bootStore } from '@wordpress/boot';
import { Button, Dropdown, MenuGroup, MenuItem } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { createElement as el, createRoot } from '@wordpress/element';
import { __, isRTL, sprintf } from '@wordpress/i18n';
import {
	category,
	check,
	chevronLeft,
	chevronRight,
	chevronUpDown,
	wordpress,
} from '@wordpress/icons';
import { Icon } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import {
	WORKSPACES,
	getActiveWorkspace,
	resetRouteToHome,
	setActiveWorkspace,
} from '../../../src/workspaces';

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

/**
 * Switch between workspaces: a quiet button showing the active workspace,
 * opening a menu of all of them above it.
 *
 * @return {Element} The workspace switcher.
 */
function WorkspaceSwitcher() {
	const workspace = useSelect(
		( select ) => getActiveWorkspace( select ),
		[]
	);

	return el( Dropdown, {
		popoverProps: { placement: 'top-start' },
		renderToggle: ( { isOpen, onToggle } ) =>
			el(
				Button,
				{
					size: 'compact',
					className: 'cnl-sidebar-workspace__toggle',
					onClick: onToggle,
					'aria-expanded': isOpen,
					'aria-haspopup': 'true',
					// The visible text is only the workspace's name.
					'aria-label': sprintf(
						/* translators: %s: The active workspace's name. */
						__( 'Workspace: %s' ),
						workspace.label
					),
				},
				el( Icon, { icon: category, size: 16 } ),
				el(
					'span',
					{ className: 'cnl-sidebar-workspace__value' },
					workspace.label
				),
				el( Icon, { icon: chevronUpDown, size: 16 } )
			),
		renderContent: ( { onClose } ) =>
			el(
				MenuGroup,
				{ label: __( 'Workspace' ) },
				WORKSPACES.map( ( { id, label, icon } ) =>
					el(
						MenuItem,
						{
							key: id,
							role: 'menuitemradio',
							isSelected: id === workspace.id,
							icon,
							iconPosition: 'left',
							suffix:
								id === workspace.id &&
								el( Icon, { icon: check } ),
							className: 'cnl-sidebar-workspace__option',
							onClick: () => {
								if ( id !== workspace.id ) {
									resetRouteToHome();
								}
								setActiveWorkspace( id );
								onClose();
							},
						},
						label
					)
				)
			),
	} );
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

function createWorkspaceSwitcher() {
	const container = document.createElement( 'div' );
	container.className = 'cnl-sidebar-workspace';
	createRoot( container ).render( el( WorkspaceSwitcher ) );

	return container;
}

/**
 * Add the plugin's own pieces to boot's sidebar.
 *
 * - A Dashboard link showing the WordPress logo, replacing boot's text link,
 *   which `src/style.scss` hides.
 * - A greeting above the main menu, hidden inside menu sections by CSS.
 * - A workspace switcher in its own section below the menu, outside boot's
 *   navigation screens so it stays put when drilling in and out.
 *
 * Boot's sidebar has no slot for extra content, so these are placed relative
 * to boot's own Dashboard link and the menu that follows it. The sidebar can remount, on narrow screens for
 * example, so they are put back whenever they go missing.
 *
 * @param {Object} options          Options.
 * @param {string} options.userName The user's first name or nickname, if any.
 */
export function enhanceSidebar( { userName } = {} ) {
	const dashboardLink = createDashboardLink();
	const welcome = createWelcome( userName );
	const workspaceSwitcher = createWorkspaceSwitcher();

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

		const menu = backButton.parentElement.querySelector(
			':scope > [class*="__content"]'
		);

		if ( menu && menu.nextElementSibling !== workspaceSwitcher ) {
			menu.after( workspaceSwitcher );
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
