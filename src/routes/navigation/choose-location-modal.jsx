/**
 * WordPress dependencies
 */
import { Preview as LazyEditorPreview } from '@wordpress/lazy-editor';

/**
 * Internal dependencies
 */
import {
	Button,
	CheckboxControl,
	EmptyState,
	layoutIcon,
	Modal,
	__,
	_n,
	sprintf,
	useMemo,
	useState,
} from '../../wordpress-packages';
import {
	compareTemplatePartsByArea,
	getLocationAreaLabel,
	getLocationLabel,
	getTemplatePartRawContent,
	templatePartHasNavigationBlock,
} from './navigation-locations';
import { EMPTY_ARRAY } from './menu-helpers';

function NavigationLocationsUnavailableEmptyState() {
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

function getLocationCandidates( templateParts ) {
	return ( templateParts || EMPTY_ARRAY )
		.filter( ( part ) => templatePartHasNavigationBlock( part ) )
		.sort( compareTemplatePartsByArea )
		.map( ( part ) => ( {
			areaLabel: getLocationAreaLabel( part ),
			id: String( part.id ),
			label: getLocationLabel( part ),
			part,
		} ) );
}

function getLocationSelectionSummary( count, mode ) {
	if ( count > 0 ) {
		return sprintf(
			/* translators: %d: Number of selected locations. */
			_n( '%d location selected', '%d locations selected', count ),
			count
		);
	}

	if ( mode === 'update' ) {
		return __( 'No locations selected.' );
	}

	return __( 'Select one or more locations for this menu.' );
}

function getLocationActionLabel( count, mode ) {
	if ( mode === 'update' ) {
		return __( 'Update locations' );
	}

	if ( count === 1 ) {
		return __( 'Add to location' );
	}

	return sprintf(
		/* translators: %d: Number of selected locations. */
		__( 'Add to %d locations' ),
		count
	);
}

export function ChooseLocationModal( {
	initialSelectedLocationIds = EMPTY_ARRAY,
	isSaving,
	mode,
	onApply,
	onClose,
	templateParts,
} ) {
	const candidates = useMemo(
		() => getLocationCandidates( templateParts ),
		[ templateParts ]
	);
	const [ selectedIds, setSelectedIds ] = useState(
		initialSelectedLocationIds
	);
	const [ error, setError ] = useState( '' );

	const toggleLocation = ( id, isChecked ) => {
		setError( '' );
		setSelectedIds( ( currentIds ) =>
			isChecked
				? [ ...new Set( [ ...currentIds, id ] ) ]
				: currentIds.filter( ( currentId ) => currentId !== id )
		);
	};

	const selectedCandidates = candidates.filter( ( candidate ) =>
		selectedIds.includes( candidate.id )
	);
	const applyLocations = () => {
		if ( mode === 'choose' && selectedCandidates.length === 0 ) {
			setError(
				__( 'Select at least one location before applying this menu.' )
			);
			return;
		}

		onApply( selectedCandidates, candidates );
	};

	return (
		<Modal
			className="routes-navigation-choose-location-modal"
			onRequestClose={ onClose }
			title={
				mode === 'update'
					? __( 'Update locations' )
					: __( 'Choose location' )
			}
		>
			<p className="routes-navigation-choose-location-modal__intro">
				{ __(
					'Choose where this navigation menu should be shown on your site.'
				) }
			</p>
			{ !! error && (
				<div className="routes-navigation-edit__notice is-error">
					{ error }
				</div>
			) }
			{ candidates.length === 0 && (
				<NavigationLocationsUnavailableEmptyState />
			) }
			{ candidates.length > 0 && (
				<div className="routes-navigation-choose-location-modal__grid">
					{ candidates.map( ( candidate ) => (
						<section
							className="routes-navigation-choose-location-modal__card"
							key={ candidate.id }
						>
							<div className="routes-navigation-choose-location-modal__card-header">
								<CheckboxControl
									__nextHasNoMarginBottom
									checked={ selectedIds.includes(
										candidate.id
									) }
									label={ candidate.label }
									onChange={ ( isChecked ) =>
										toggleLocation(
											candidate.id,
											isChecked
										)
									}
								/>
								<span className="routes-navigation-choose-location-modal__area">
									{ candidate.areaLabel }
								</span>
							</div>
							<div className="routes-navigation-choose-location-modal__preview">
								<LazyEditorPreview
									content={ getTemplatePartRawContent(
										candidate.part
									) }
									description={ candidate.label }
								/>
							</div>
						</section>
					) ) }
				</div>
			) }
			{ candidates.length > 0 && (
				<div className="routes-navigation-choose-location-modal__footer">
					<p className="routes-navigation-choose-location-modal__selection-summary">
						{ getLocationSelectionSummary(
							selectedCandidates.length,
							mode
						) }
					</p>
					<div className="routes-navigation-choose-location-modal__actions">
						<Button
							disabled={ isSaving }
							onClick={ onClose }
							variant="tertiary"
						>
							{ __( 'Cancel' ) }
						</Button>
						<Button
							disabled={
								isSaving ||
								( mode === 'choose' &&
									selectedCandidates.length === 0 )
							}
							isBusy={ isSaving }
							onClick={ applyLocations }
							variant="primary"
						>
							{ getLocationActionLabel(
								selectedCandidates.length,
								mode
							) }
						</Button>
					</div>
				</div>
			) }
		</Modal>
	);
}
