/**
 * WordPress dependencies
 */
import { useNavigate } from '@wordpress/route';

/**
 * Internal dependencies
 */
import { getFromNavigationSearch } from '../../site-trail';
import { cnlEditorStore, getErrorMessage } from '../../records';
import {
	Button,
	CheckboxControl,
	coreDataStore,
	InputControl,
	Modal,
	noticesStore,
	Stack,
	__,
	sprintf,
	useDispatch,
	useState,
} from '../../wordpress-packages';
import {
	NAVIGATION_MENUS_CHANGED_EVENT,
	NAVIGATION_POST_TYPE,
} from './menu-helpers';

const PAGE_LIST_BLOCK_CONTENT = '<!-- wp:page-list /-->';

export function AddNavigationModal( { onClose } ) {
	const navigate = useNavigate();
	const [ autoSyncWithPages, setAutoSyncWithPages ] = useState( false );
	const [ isBusy, setIsBusy ] = useState( false );
	const [ menuTitle, setMenuTitle ] = useState( '' );
	const { saveEntityRecord } = useDispatch( coreDataStore );
	const { invalidateNavigationMenus } = useDispatch( cnlEditorStore );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );

	const closeModal = () => {
		if ( ! isBusy ) {
			onClose();
		}
	};

	const submit = async ( event ) => {
		event.preventDefault();

		const trimmedTitle = menuTitle.trim();
		if ( ! trimmedTitle ) {
			return;
		}

		setIsBusy( true );

		try {
			const savedRecord = await saveEntityRecord(
				'postType',
				NAVIGATION_POST_TYPE,
				{
					...( autoSyncWithPages
						? { content: PAGE_LIST_BLOCK_CONTENT }
						: {} ),
					status: 'publish',
					title: trimmedTitle,
				},
				{ throwOnError: true }
			);

			invalidateNavigationMenus();
			window.dispatchEvent(
				new CustomEvent( NAVIGATION_MENUS_CHANGED_EVENT )
			);
			createSuccessNotice(
				__( 'Navigation menu created successfully.' ),
				{
					type: 'snackbar',
				}
			);

			if ( savedRecord?.id ) {
				navigate( {
					search: getFromNavigationSearch(),
					to: `/navigation/edit/${ encodeURIComponent(
						savedRecord.id
					) }`,
				} );
			}

			onClose();
		} catch ( error ) {
			createErrorNotice(
				sprintf(
					/* translators: %s: error message. */
					__( 'Unable to create navigation menu: %s' ),
					getErrorMessage( error )
				),
				{ type: 'snackbar' }
			);
		} finally {
			setIsBusy( false );
		}
	};

	return (
		<Modal
			focusOnMount="firstContentElement"
			onRequestClose={ closeModal }
			size="small"
			title={ __( 'Add a menu' ) }
		>
			<form onSubmit={ submit }>
				<Stack direction="column" gap="lg">
					<InputControl
						autoComplete="off"
						disabled={ isBusy }
						label={ __( 'Name' ) }
						onValueChange={ setMenuTitle }
						placeholder={ __( 'Enter menu name' ) }
						value={ menuTitle }
					/>
					<CheckboxControl
						aria-label={ __( 'List every page automatically' ) }
						checked={ autoSyncWithPages }
						disabled={ isBusy }
						help={ __(
							'This menu will update automatically when you add, rename, or remove pages, until you choose to customize it manually.'
						) }
						label={ __( 'List every page automatically' ) }
						onChange={ setAutoSyncWithPages }
					/>
					<Stack align="center" gap="sm" justify="flex-end">
						<Button
							__next40pxDefaultSize
							accessibleWhenDisabled
							disabled={ isBusy }
							onClick={ closeModal }
							type="button"
							variant="tertiary"
						>
							{ __( 'Cancel' ) }
						</Button>
						<Button
							__next40pxDefaultSize
							accessibleWhenDisabled
							aria-busy={ isBusy }
							disabled={ isBusy || ! menuTitle.trim() }
							type="submit"
							variant="primary"
						>
							{ __( 'Create menu' ) }
						</Button>
					</Stack>
				</Stack>
			</form>
		</Modal>
	);
}
