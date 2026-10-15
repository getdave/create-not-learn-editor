/**
 * Internal dependencies
 */
import {
	Button,
	compassIcon,
	EmptyState,
	layoutIcon,
	__,
} from '../../wordpress-packages';

export function NavigationLocationsEmptyState( {
	disabled,
	onChooseLocation,
} ) {
	return (
		<EmptyState.Root className="routes-navigation-locations-canvas__empty-state">
			<EmptyState.Icon icon={ compassIcon } />
			<EmptyState.Title>
				{ __( 'This menu is not shown on your site yet' ) }
			</EmptyState.Title>
			<EmptyState.Description>
				{ __(
					'Choose where this menu should appear, such as your header or footer.'
				) }
			</EmptyState.Description>
			<EmptyState.Actions>
				<Button
					__next40pxDefaultSize
					disabled={ disabled }
					onClick={ onChooseLocation }
					variant="primary"
				>
					{ __( 'Choose location' ) }
				</Button>
			</EmptyState.Actions>
		</EmptyState.Root>
	);
}

export function NavigationNoMenuSelectedEmptyState() {
	return (
		<EmptyState.Root className="routes-navigation-locations-canvas__empty-state">
			<EmptyState.Icon icon={ compassIcon } />
			<EmptyState.Title>{ __( 'No menu selected' ) }</EmptyState.Title>
		</EmptyState.Root>
	);
}

export function NavigationLocationsUnavailableEmptyState() {
	return (
		<EmptyState.Root className="routes-navigation-choose-location-modal__empty-state">
			<EmptyState.Icon icon={ layoutIcon } />
			<EmptyState.Title>
				{ __( 'No menu locations found' ) }
			</EmptyState.Title>
			<EmptyState.Description>
				{ __(
					'Add a menu space to a header, footer, or other site area before choosing a location here.'
				) }
			</EmptyState.Description>
		</EmptyState.Root>
	);
}
