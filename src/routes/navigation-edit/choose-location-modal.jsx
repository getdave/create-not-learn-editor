/**
 * WordPress dependencies
 */
import { _n } from '@wordpress/i18n';
import { Preview as LazyEditorPreview } from '@wordpress/lazy-editor';

/**
 * Internal dependencies
 */
import {
	Button,
	CheckboxControl,
	coreDataStore,
	Modal,
	sprintf,
	useMemo,
	useSelect,
	useState,
	__,
} from '../../wordpress-packages';
import {
	buildNavigationLocationsMap,
	compareTemplatePartsByArea,
	createEditedTemplatePartsCache,
	getLocationAreaLabel,
	getLocationLabel,
	getTemplatePartRawContent,
	templatePartHasNavigationBlock,
} from '../navigation/navigation-locations';
import { NavigationLocationsUnavailableEmptyState } from './empty-states';
import { EMPTY_ARRAY, NAVIGATION_POST_TYPE } from './shared';

const NAVIGATION_MENUS_QUERY = {
	context: 'edit',
	order: 'desc',
	orderby: 'date',
	per_page: 100,
	status: 'publish,draft',
	_fields: 'id,title,content,status',
};
const TEMPLATE_PARTS_QUERY = {
	context: 'edit',
	per_page: 100,
	_fields: 'id,slug,title,area,status,content',
};

export function useNavigationLocations( navigationId ) {
	const mergeEdits = useMemo( () => createEditedTemplatePartsCache(), [] );
	const { isResolvingTemplateParts, menus, templateParts } = useSelect(
		( select ) => {
			const store = select( coreDataStore );
			const menuArgs = [
				'postType',
				NAVIGATION_POST_TYPE,
				NAVIGATION_MENUS_QUERY,
			];
			const templatePartArgs = [
				'postType',
				'wp_template_part',
				TEMPLATE_PARTS_QUERY,
			];
			const rawTemplateParts =
				store.getEntityRecords( ...templatePartArgs ) || EMPTY_ARRAY;

			return {
				isResolvingTemplateParts:
					store.isResolving( 'getEntityRecords', templatePartArgs ) ||
					! store.hasFinishedResolution(
						'getEntityRecords',
						templatePartArgs
					),
				menus: store.getEntityRecords( ...menuArgs ) || EMPTY_ARRAY,
				templateParts: mergeEdits( rawTemplateParts, ( id ) =>
					store.getEditedEntityRecord(
						'postType',
						'wp_template_part',
						id
					)
				),
			};
		},
		[ mergeEdits ]
	);
	const fallbackMenuId = menus[ 0 ]?.id;
	const locationsMap = useMemo(
		() => buildNavigationLocationsMap( templateParts, fallbackMenuId ),
		[ fallbackMenuId, templateParts ]
	);

	return {
		isResolvingTemplateParts,
		locations: locationsMap[ navigationId ] || EMPTY_ARRAY,
		menu:
			menus.find( ( menu ) => Number( menu.id ) === navigationId ) ||
			null,
		templateParts,
	};
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

export default function ChooseLocationModal( {
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
			<p className="routes-navigation-edit__modal-description">
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
				<div className="routes-navigation-edit__modal-actions">
					<p className="routes-navigation-choose-location-modal__selection-summary">
						{ getLocationSelectionSummary(
							selectedCandidates.length,
							mode
						) }
					</p>
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
			) }
		</Modal>
	);
}
