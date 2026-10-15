/**
 * Internal dependencies
 */
import {
	Button,
	chevronRightIcon,
	DropdownMenu,
	Icon,
	InputControl,
	MenuItem,
	Modal,
	moreVerticalIcon,
	compassIcon,
	__,
	sprintf,
} from '../../wordpress-packages';
import { getMenuTitle } from './menu-helpers';

export function NavigationMenuRow( {
	description,
	isBusy,
	menu,
	onDelete,
	onDuplicate,
	onEdit,
	onRename,
} ) {
	const title = getMenuTitle( menu );

	return (
		<div className="routes-navigation-list__row">
			<Button
				className="routes-navigation-list__row-link cnl-screen-links__link"
				onClick={ () => onEdit( menu ) }
			>
				<Icon className="cnl-screen-links__icon" icon={ compassIcon } />
				<span className="cnl-screen-links__text">
					<span className="cnl-screen-links__title">{ title }</span>
					<span className="cnl-screen-links__description">
						{ description }
					</span>
				</span>
				<Icon
					className="cnl-screen-links__chevron"
					icon={ chevronRightIcon }
				/>
			</Button>
			<DropdownMenu
				className="routes-navigation-list__row-menu"
				disabled={ isBusy }
				icon={ moreVerticalIcon }
				label={ sprintf(
					/* translators: %s: navigation menu title. */
					__( '%s options' ),
					title
				) }
				popoverProps={ { placement: 'bottom-end' } }
				toggleProps={ {
					__next40pxDefaultSize: true,
					variant: 'tertiary',
				} }
			>
				{ ( { onClose } ) => (
					<>
						<MenuItem
							onClick={ () => {
								onRename( menu );
								onClose();
							} }
						>
							{ __( 'Rename' ) }
						</MenuItem>
						<MenuItem
							onClick={ () => {
								onDuplicate( menu );
								onClose();
							} }
						>
							{ __( 'Duplicate' ) }
						</MenuItem>
						<MenuItem
							isDestructive
							onClick={ () => {
								onDelete( menu );
								onClose();
							} }
						>
							{ __( 'Delete' ) }
						</MenuItem>
					</>
				) }
			</DropdownMenu>
		</div>
	);
}

export function RenameNavigationMenuModal( {
	isSaving,
	menuTitle,
	onChangeTitle,
	onClose,
	onSave,
	title,
} ) {
	return (
		<Modal
			className="routes-navigation-edit__item-modal"
			onRequestClose={ onClose }
			title={ __( 'Rename navigation menu' ) }
		>
			<InputControl
				disabled={ isSaving }
				label={ __( 'Name' ) }
				onValueChange={ onChangeTitle }
				value={ title }
			/>
			<div className="routes-navigation-edit__modal-actions">
				<Button
					disabled={ isSaving }
					onClick={ onClose }
					variant="tertiary"
				>
					{ __( 'Cancel' ) }
				</Button>
				<Button
					disabled={
						isSaving || ! title.trim() || title.trim() === menuTitle
					}
					isBusy={ isSaving }
					onClick={ onSave }
					variant="primary"
				>
					{ __( 'Save' ) }
				</Button>
			</div>
		</Modal>
	);
}

export function DeleteNavigationMenuModal( {
	isSaving,
	menuTitle,
	onClose,
	onDelete,
} ) {
	return (
		<Modal
			className="routes-navigation-edit__item-modal"
			onRequestClose={ onClose }
			title={ __( 'Delete navigation menu' ) }
		>
			<p>
				{ sprintf(
					/* translators: %s: navigation menu title. */
					__(
						'Are you sure you want to delete "%s"? This cannot be undone.'
					),
					menuTitle
				) }
			</p>
			<div className="routes-navigation-edit__modal-actions">
				<Button
					disabled={ isSaving }
					onClick={ onClose }
					variant="tertiary"
				>
					{ __( 'Cancel' ) }
				</Button>
				<Button
					disabled={ isSaving }
					isBusy={ isSaving }
					isDestructive
					onClick={ onDelete }
					variant="primary"
				>
					{ __( 'Delete' ) }
				</Button>
			</div>
		</Modal>
	);
}
