/**
 * Internal dependencies
 */
import {
	Button,
	Modal,
	SelectControl,
	useEffect,
	useMemo,
	useState,
	__,
} from '../../wordpress-packages';
import { getPageTitle } from './shared';

export default function PageSelectModal( {
	isSaving,
	mode,
	onAddPage,
	onClose,
	pages,
	title,
} ) {
	const [ selectedPageId, setSelectedPageId ] = useState(
		pages[ 0 ]?.id ? String( pages[ 0 ].id ) : ''
	);
	const selectedPage = useMemo(
		() =>
			pages.find(
				( page ) => String( page.id ) === String( selectedPageId )
			),
		[ pages, selectedPageId ]
	);

	useEffect( () => {
		if ( ! selectedPageId && pages[ 0 ]?.id ) {
			setSelectedPageId( String( pages[ 0 ].id ) );
		}
	}, [ pages, selectedPageId ] );

	return (
		<Modal
			className="routes-navigation-edit__item-modal"
			onRequestClose={ onClose }
			title={ title }
		>
			{ pages.length === 0 && (
				<p>
					{ __( 'There are no published pages available to add.' ) }
				</p>
			) }
			{ pages.length > 0 && (
				<SelectControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					label={ __( 'Page' ) }
					onChange={ setSelectedPageId }
					options={ pages.map( ( page ) => ( {
						label: getPageTitle( page ),
						value: String( page.id ),
					} ) ) }
					value={ selectedPageId }
				/>
			) }
			<div className="routes-navigation-edit__modal-actions">
				<Button
					disabled={ isSaving }
					onClick={ onClose }
					variant="tertiary"
				>
					{ __( 'Cancel' ) }
				</Button>
				<Button
					disabled={ ! selectedPage || isSaving }
					isBusy={ isSaving }
					onClick={ () => onAddPage( selectedPage, mode ) }
					variant="primary"
				>
					{ mode === 'submenu-page'
						? __( 'Add submenu' )
						: __( 'Add page' ) }
				</Button>
			</div>
		</Modal>
	);
}
