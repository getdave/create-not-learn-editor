/**
 * The site's main menu, edited with the same list the Header and Footer
 * screens show. Loaded by the chat on demand, through the chat-extras module.
 */

/**
 * Internal dependencies
 */
import useMainMenu from '../../routes/content/use-main-menu';
import { useMenuItemsEditor } from '../../routes/navigation-edit/menu-items-editor';
import {
	Spinner,
	Text,
	__,
	coreDataStore,
	useEffect,
	useMemo,
	useSelect,
} from '../../wordpress-packages';

/**
 * @param {Object}   props          Component props.
 * @param {Function} props.onEntity Called with the menu's record, `[ kind,
 *                                  name, key ]`, once it is known.
 * @param {Function} props.onPick   Called with the menu's name once it has
 *                                  unsaved changes.
 * @return {Element} The menu's items.
 */
export function MenuWidget( { onEntity, onPick } ) {
	const { isLoading, menuId, menuTitle } = useMainMenu();
	const { editor, isMenuReady } = useMenuItemsEditor( menuId );
	const entity = useMemo(
		() => ( menuId ? [ 'postType', 'wp_navigation', menuId ] : null ),
		[ menuId ]
	);
	const isChanged = useSelect(
		( select ) =>
			!! menuId &&
			select( coreDataStore ).hasEditsForEntityRecord(
				'postType',
				'wp_navigation',
				menuId
			),
		[ menuId ]
	);

	useEffect( () => {
		if ( entity ) {
			onEntity( entity );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ entity ] );

	useEffect( () => {
		if ( isChanged ) {
			onPick( menuTitle || __( 'Menu' ) );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ isChanged ] );

	if ( ! isLoading && ! menuId ) {
		return (
			<Text className="routes-styles__muted" variant="body-md">
				{ __( 'Your site doesn’t have a menu yet.' ) }
			</Text>
		);
	}

	if ( isLoading || ! isMenuReady ) {
		return (
			<div className="cnl-editor-spinner">
				<Spinner />
			</div>
		);
	}

	return <div className="cnl-site-part__menu">{ editor }</div>;
}
