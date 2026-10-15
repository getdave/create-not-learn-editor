/**
 * Internal dependencies
 */
import {
	__,
	Button,
	InputControl,
	Modal,
	useState,
} from '../../wordpress-packages';

export default function CustomLinkModal( {
	isSaving,
	isSubmenu = false,
	onAddLink,
	onClose,
	title,
} ) {
	const [ label, setLabel ] = useState( '' );
	const [ url, setUrl ] = useState( '' );
	const canSave = label.trim() && url.trim();

	const submit = ( event ) => {
		event.preventDefault();

		if ( canSave ) {
			onAddLink( { isSubmenu, label: label.trim(), url: url.trim() } );
		}
	};

	return (
		<Modal
			className="routes-navigation-edit__item-modal"
			onRequestClose={ onClose }
			title={ title }
		>
			<form
				className="routes-navigation-edit__item-form"
				onSubmit={ submit }
			>
				<InputControl
					label={ __( 'Label' ) }
					onValueChange={ setLabel }
					value={ label }
				/>
				<InputControl
					label={ __( 'URL' ) }
					onValueChange={ setUrl }
					type="url"
					value={ url }
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
						{ isSubmenu ? __( 'Add submenu' ) : __( 'Add link' ) }
					</Button>
				</div>
			</form>
		</Modal>
	);
}
