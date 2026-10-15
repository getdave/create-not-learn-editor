/**
 * Internal dependencies
 */
import {
	Button,
	InputControl,
	Modal,
	useState,
	__,
} from '../../wordpress-packages';

export default function LabelOnlySubmenuModal( {
	isSaving,
	onAddSubmenu,
	onClose,
} ) {
	const [ label, setLabel ] = useState( '' );
	const canSave = label.trim();

	const submit = ( event ) => {
		event.preventDefault();

		if ( canSave ) {
			onAddSubmenu( label.trim() );
		}
	};

	return (
		<Modal
			className="routes-navigation-edit__item-modal"
			onRequestClose={ onClose }
			title={ __( 'Label only submenu' ) }
		>
			<form
				className="routes-navigation-edit__item-form"
				onSubmit={ submit }
			>
				<InputControl
					label={ __( 'Submenu label' ) }
					onValueChange={ setLabel }
					value={ label }
				/>
				<div className="routes-navigation-edit__modal-actions">
					<Button
						disabled={ isSaving }
						onClick={ onClose }
						type="button"
						variant="tertiary"
					>
						{ __( 'Cancel' ) }
					</Button>
					<Button
						disabled={ ! canSave || isSaving }
						isBusy={ isSaving }
						type="submit"
						variant="primary"
					>
						{ __( 'Add drop-down' ) }
					</Button>
				</div>
			</form>
		</Modal>
	);
}
