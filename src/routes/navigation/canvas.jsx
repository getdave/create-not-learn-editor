/**
 * Internal dependencies
 */
import { getErrorMessage } from '../../records';
import {
	coreDataStore,
	DropdownMenu,
	MenuItem,
	moreVerticalIcon,
	noticesStore,
	Notice,
	Spinner,
	__,
	sprintf,
	useDispatch,
	useState,
} from '../../wordpress-packages';
import {
	assignNavigationMenuToFirstBlock,
	removeNavigationMenuFromFirstBlock,
} from './navigation-locations';
import SitePreviewCanvas from '../static/site-preview';
import {
	NavigationSitePreview,
	NavigationSitePreviewNotice,
} from './site-preview';
import {
	EMPTY_ARRAY,
	getMenuLocationsDescription,
	getMenuTitle,
} from './menu-helpers';
import { useNavigationMenus } from './use-navigation-menus';
import { ChooseLocationModal } from './choose-location-modal';

export function Canvas() {
	const { editEntityRecord } = useDispatch( coreDataStore );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );
	const {
		error,
		isLoading,
		isResolvingLocations,
		locationsError,
		locationsMap,
		selectedMenu,
		templateParts,
	} = useNavigationMenus();
	const [ locationModalMode, setLocationModalMode ] = useState( null );
	const [ isSavingLocations, setIsSavingLocations ] = useState( false );

	if ( isLoading ) {
		return (
			<section className="cnl-editor-canvas">
				<div className="cnl-editor-spinner">
					<Spinner />
				</div>
			</section>
		);
	}

	// Nothing to edit yet, so show the homepage in the standard site canvas,
	// the same fallback Design and its screens use.
	if ( ! selectedMenu ) {
		return <SitePreviewCanvas />;
	}

	const selectedLocations = selectedMenu
		? locationsMap[ selectedMenu.id ] || EMPTY_ARRAY
		: EMPTY_ARRAY;
	const selectedLocationIds = selectedLocations.map(
		( location ) => location.id
	);
	const editTemplatePartContent = ( part, content ) =>
		editEntityRecord( 'postType', 'wp_template_part', part.id, {
			content,
		} );
	const applyLocationAssignments = async (
		selectedCandidates,
		candidates
	) => {
		if ( ! selectedMenu?.id ) {
			return;
		}

		setIsSavingLocations( true );

		try {
			const selectedIds = new Set(
				selectedCandidates.map( ( candidate ) => candidate.id )
			);
			const currentIds = new Set( selectedLocationIds );

			for ( const candidate of selectedCandidates ) {
				const content = assignNavigationMenuToFirstBlock(
					candidate.part,
					selectedMenu.id
				);

				if ( ! content ) {
					throw new Error(
						sprintf(
							/* translators: %s: location label. */
							__( 'Could not update %s.' ),
							candidate.label
						)
					);
				}

				editTemplatePartContent( candidate.part, content );
			}

			if ( locationModalMode === 'update' ) {
				for ( const candidate of candidates ) {
					if (
						! currentIds.has( candidate.id ) ||
						selectedIds.has( candidate.id )
					) {
						continue;
					}

					const content = removeNavigationMenuFromFirstBlock(
						candidate.part,
						selectedMenu.id
					);

					if ( ! content ) {
						throw new Error(
							sprintf(
								/* translators: %s: location label. */
								__( 'Could not update %s.' ),
								candidate.label
							)
						);
					}

					editTemplatePartContent( candidate.part, content );
				}
			}

			setLocationModalMode( null );
			createSuccessNotice(
				__(
					'Menu locations updated. Review and save changes when you are ready.'
				),
				{ type: 'snackbar' }
			);
		} catch ( saveError ) {
			createErrorNotice(
				sprintf(
					/* translators: %s: error message. */
					__( 'Unable to update menu locations (%s).' ),
					getErrorMessage( saveError )
				),
				{ type: 'snackbar' }
			);
		} finally {
			setIsSavingLocations( false );
		}
	};
	const selectedMenuTitle = selectedMenu ? getMenuTitle( selectedMenu ) : '';
	const selectedMenuActions = selectedMenu && (
		<DropdownMenu
			icon={ moreVerticalIcon }
			label={ __( 'Menu location options' ) }
			popoverProps={ { placement: 'bottom-end' } }
			toggleProps={ {
				__next40pxDefaultSize: true,
				variant: 'tertiary',
			} }
		>
			{ ( { onClose } ) => (
				<MenuItem
					onClick={ () => {
						setLocationModalMode(
							selectedLocations.length > 0 ? 'update' : 'choose'
						);
						onClose();
					} }
				>
					{ selectedLocations.length > 0
						? __( 'Update locations' )
						: __( 'Choose location' ) }
				</MenuItem>
			) }
		</DropdownMenu>
	);

	return (
		<section className="cnl-editor-canvas routes-navigation-canvas">
			{ ( error || locationsError ) && (
				<Notice
					className="cnl-editor-preview-canvas__notice"
					isDismissible={ false }
					status="error"
				>
					{ error || locationsError }
				</Notice>
			) }
			{ selectedMenu && (
				<header className="cnl-editor-canvas__toolbar routes-navigation-canvas-toolbar">
					<div className="routes-navigation-canvas-toolbar__document">
						<h2 className="routes-navigation-canvas-toolbar__title">
							{ selectedMenuTitle }
						</h2>
						<p className="routes-navigation-canvas-toolbar__meta">
							{ getMenuLocationsDescription(
								selectedLocations.length
							) }
						</p>
					</div>
					<div className="routes-navigation-canvas-toolbar__actions">
						{ selectedMenuActions }
					</div>
				</header>
			) }
			{ selectedMenu &&
				! isResolvingLocations &&
				selectedLocations.length === 0 && (
					<NavigationSitePreviewNotice
						onChooseLocation={ () =>
							setLocationModalMode( 'choose' )
						}
					/>
				) }
			<div className="routes-navigation-canvas__body">
				<NavigationSitePreview />
			</div>
			{ locationModalMode && selectedMenu?.id && (
				<ChooseLocationModal
					/*
					 * Seeded once, when it opens. Re-seeding as the locations
					 * change would undo what has been ticked since.
					 */
					key={ locationModalMode }
					initialSelectedLocationIds={
						locationModalMode === 'update'
							? selectedLocationIds
							: EMPTY_ARRAY
					}
					isSaving={ isSavingLocations }
					mode={ locationModalMode }
					onApply={ applyLocationAssignments }
					onClose={ () => {
						if ( ! isSavingLocations ) {
							setLocationModalMode( null );
						}
					} }
					templateParts={ templateParts }
				/>
			) }
		</section>
	);
}
