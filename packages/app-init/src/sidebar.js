/**
 * WordPress dependencies
 */
import { store as bootStore } from '@wordpress/boot';
import { Button, Dropdown, MenuGroup, MenuItem } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import {
	createElement as el,
	createRoot,
	useEffect,
	useState,
	useSyncExternalStore,
} from '@wordpress/element';
import { __, isRTL, sprintf } from '@wordpress/i18n';
import {
	category,
	check,
	chevronLeft,
	chevronRight,
	chevronUpDown,
	drawerLeft,
	wordpress,
} from '@wordpress/icons';
import { Icon, Tooltip } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import {
	WORKSPACES,
	getActiveWorkspace,
	resetRouteToHome,
	setActiveWorkspace,
} from '../../../src/workspaces';

/*
 * What can be pointed at in the sidebar while it is a strip of icons, a
 * drilled-in screen being open and the sidebar not expanded again. Matches
 * the rule in `src/style.scss`.
 */
const STRIP_ITEM_SELECTOR =
	'body:not(.cnl-sidebar-is-expanded) #create-not-learn-editor-app [class*="__layout"]:has(.cnl-drilldown-stage) > [class*="__sidebar"] :is([class*="__item-wrapper"] > *, .cnl-sidebar-workspace__toggle)';

const EXPANDED_CLASS = 'cnl-sidebar-is-expanded';

/*
 * Whether the sidebar has been expanded again on a drilled-in screen. Held
 * as a class on <body>, which the strip's rule keys off, and lasts until the
 * drilled-in screen is left.
 */
const expansion = {
	listeners: new Set(),
	get: () => document.body.classList.contains( EXPANDED_CLASS ),
	set( isExpanded ) {
		if ( isExpanded !== expansion.get() ) {
			document.body.classList.toggle( EXPANDED_CLASS, isExpanded );
			expansion.listeners.forEach( ( listener ) => listener() );
		}
	},
	subscribe( listener ) {
		expansion.listeners.add( listener );
		return () => expansion.listeners.delete( listener );
	},
};

/**
 * Expand the sidebar from its strip of icons, or fold it back. Sits where
 * the greeting does, and only shows on drilled-in screens.
 *
 * @return {Element} The toggle.
 */
function SidebarToggle() {
	const isExpanded = useSyncExternalStore(
		expansion.subscribe,
		expansion.get
	);

	return el( Button, {
		__next40pxDefaultSize: true,
		'aria-expanded': isExpanded,
		className: 'cnl-sidebar-toggle__button',
		icon: drawerLeft,
		label: isExpanded ? __( 'Collapse sidebar' ) : __( 'Expand sidebar' ),
		onClick: () => expansion.set( ! isExpanded ),
		showTooltip: true,
		tooltipPosition: 'middle right',
	} );
}

/**
 * Name the icon pointed at, or focused, in the sidebar's strip of icons.
 *
 * Boot's menu items aren't ours to wrap in a tooltip, so one tooltip follows
 * whichever item is under the pointer or has focus. The Dashboard link and
 * boot's Back button already show their own.
 *
 * @return {?Element} The tooltip.
 */
function StripTooltip() {
	const [ item, setItem ] = useState( null );

	useEffect( () => {
		const follow = ( event ) => {
			setItem(
				window.matchMedia( '(min-width: 782px)' ).matches
					? event.target.closest?.( STRIP_ITEM_SELECTOR ) || null
					: null
			);
		};
		const hide = () => setItem( null );

		document.addEventListener( 'pointerover', follow );
		document.addEventListener( 'focusin', follow );
		document.addEventListener( 'click', hide );

		return () => {
			document.removeEventListener( 'pointerover', follow );
			document.removeEventListener( 'focusin', follow );
			document.removeEventListener( 'click', hide );
		};
	}, [] );

	if ( ! item ) {
		return null;
	}

	return el(
		Tooltip.Root,
		{ open: true },
		el(
			Tooltip.Popup,
			{
				positioner: el( Tooltip.Positioner, {
					anchor: item,
					side: 'right',
				} ),
			},
			item.getAttribute( 'aria-label' ) || item.textContent.trim()
		)
	);
}

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

function mountStripTooltip() {
	const container = document.createElement( 'div' );
	document.body.append( container );
	createRoot( container ).render( el( StripTooltip ) );
}

function createSidebarToggle() {
	const container = document.createElement( 'div' );
	container.className = 'cnl-sidebar-toggle';
	createRoot( container ).render( el( SidebarToggle ) );

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
 * - A toggle in the greeting's row, on drilled-in screens, to expand the
 *   sidebar from its strip of icons and fold it back.
 * - A workspace switcher in its own section below the menu, outside boot's
 *   navigation screens so it stays put when drilling in and out.
 * - A tooltip naming each icon while the sidebar is a strip of icons.
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
	const sidebarToggle = createSidebarToggle();
	const workspaceSwitcher = createWorkspaceSwitcher();

	mountStripTooltip();

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

		if ( welcome.nextElementSibling !== sidebarToggle ) {
			welcome.after( sidebarToggle );
		}

		// Leaving the drilled-in screen folds the sidebar again next time.
		if ( ! document.querySelector( '.cnl-drilldown-stage' ) ) {
			expansion.set( false );
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
