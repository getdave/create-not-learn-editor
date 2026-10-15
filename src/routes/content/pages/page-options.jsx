/**
 * The options menu of an opened page, and renaming it.
 */

/**
 * Internal dependencies
 */
import { getErrorMessage } from '../../../records';
import { isPageInMenu } from '../menu-status';
import useMainMenu, { useAddPageToMenu } from '../use-main-menu';
import { getPageTitle } from './data';
import { useHomepageState, useUseAsHomepage } from './homepage';
import {
	__,
	Button,
	coreDataStore,
	DropdownMenu,
	externalIcon,
	InputControl,
	MenuGroup,
	MenuItem,
	Modal,
	moreVerticalIcon,
	noticesStore,
	pencilIcon,
	sprintf,
	useDispatch,
	useSelect,
	useState,
} from '../../../wordpress-packages';

function RenamePageModal( { onClose, pageId, title } ) {
	const { editEntityRecord } = useDispatch( coreDataStore );
	// Unset until typed in, so a title that loads after opening still shows.
	const [ typed, setTyped ] = useState();
	const value = typed ?? title;
	const rename = ( event ) => {
		event.preventDefault();
		editEntityRecord( 'postType', 'page', pageId, {
			title: value.trim(),
		} );
		onClose();
	};

	return (
		<Modal
			className="routes-navigation-edit__item-modal"
			onRequestClose={ onClose }
			title={ __( 'Rename page' ) }
		>
			<form onSubmit={ rename }>
				<InputControl
					label={ __( 'Page title' ) }
					onValueChange={ ( next ) => setTyped( next ?? '' ) }
					value={ value }
				/>
				<div className="routes-navigation-edit__modal-actions">
					<Button
						onClick={ onClose }
						type="button"
						variant="tertiary"
					>
						{ __( 'Cancel' ) }
					</Button>
					<Button
						disabled={ ! value.trim() || value.trim() === title }
						type="submit"
						variant="primary"
					>
						{ __( 'Rename' ) }
					</Button>
				</div>
			</form>
		</Modal>
	);
}

/**
 * What can be done with an opened page, behind its options button.
 *
 * Adding to the menu is only offered for pages the menu does not already
 * reach, and using the page as the homepage for pages that aren't it.
 *
 * @param {Object}   props            Component props.
 * @param {boolean}  props.isHomepage Whether the page is the homepage.
 * @param {Object}   props.page       Page record.
 * @param {number}   props.pageId     Page ID.
 * @param {Function} props.onEdit     Opens the page in the full editor.
 * @return {Element} The options menu.
 */
export function PageOptions( { isHomepage, page, pageId, onEdit } ) {
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );
	const mainMenu = useMainMenu();
	const addPageToMenu = useAddPageToMenu();
	const homepage = useHomepageState();
	const useAsHomepage = useUseAsHomepage( homepage );
	const [ isRenaming, setIsRenaming ] = useState( false );
	const canUseAsHomepage =
		! isHomepage &&
		homepage.canSwitch &&
		homepage.shows !== 'theme' &&
		Boolean( page?.status ) &&
		page.status !== 'trash';
	const title = useSelect(
		( selectStore ) => {
			const { getEditedEntityRecord, getEntityRecord } =
				selectStore( coreDataStore );

			// Edited records aren't fetched on their own. Opened from a link,
			// nothing else may have asked for the page yet, and Rename would
			// open empty.
			getEntityRecord( 'postType', 'page', pageId );

			return (
				getEditedEntityRecord( 'postType', 'page', pageId )?.title ?? ''
			);
		},
		[ pageId ]
	);
	// A draft can go in the menu too; it shows there once published. The
	// homepage goes in as a Home link, from its row.
	const canAddToMenu =
		! isHomepage &&
		Boolean( page && mainMenu.menuId && mainMenu.menuPages ) &&
		! isPageInMenu( page, mainMenu.menuPages );

	const addToMenu = async () => {
		try {
			await addPageToMenu( mainMenu.menuId, page );
			createSuccessNotice(
				sprintf(
					/* translators: %s: page title. */
					__( '“%s” is now in your menu.' ),
					getPageTitle( page )
				),
				{ type: 'snackbar' }
			);
		} catch ( error ) {
			createErrorNotice( getErrorMessage( error ), {
				type: 'snackbar',
			} );
		}
	};

	return (
		<>
			<DropdownMenu
				icon={ moreVerticalIcon }
				label={ __( 'Page options' ) }
				popoverProps={ { placement: 'bottom-end' } }
				toggleProps={ { size: 'compact' } }
			>
				{ ( { onClose } ) => (
					<>
						<MenuGroup>
							<MenuItem
								onClick={ () => {
									onClose();
									setIsRenaming( true );
								} }
							>
								{ __( 'Rename' ) }
							</MenuItem>
							{ canAddToMenu && (
								<MenuItem
									onClick={ () => {
										onClose();
										addToMenu();
									} }
								>
									{ __( 'Add to menu' ) }
								</MenuItem>
							) }
							{ canUseAsHomepage && (
								<MenuItem
									onClick={ () => {
										onClose();
										useAsHomepage.request( {
											...page,
											id: pageId,
										} );
									} }
								>
									{ __( 'Use as homepage' ) }
								</MenuItem>
							) }
						</MenuGroup>
						<MenuGroup>
							<MenuItem
								icon={ pencilIcon }
								onClick={ () => {
									onClose();
									onEdit();
								} }
							>
								{ __( 'Open in full editor' ) }
							</MenuItem>
							{ page?.link && (
								<MenuItem
									icon={ externalIcon }
									onClick={ () => {
										onClose();
										window.open(
											page.link,
											'_blank',
											'noopener,noreferrer'
										);
									} }
								>
									{ __( 'View on your site' ) }
								</MenuItem>
							) }
						</MenuGroup>
					</>
				) }
			</DropdownMenu>
			{ isRenaming && (
				<RenamePageModal
					onClose={ () => setIsRenaming( false ) }
					pageId={ pageId }
					title={ typeof title === 'string' ? title : '' }
				/>
			) }
			{ useAsHomepage.modal }
		</>
	);
}
