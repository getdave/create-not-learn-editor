/**
 * WordPress dependencies
 */
import { useNavigate, useParams } from '@wordpress/route';
import {
	Preview as LazyEditorPreview,
	useEditorAssets,
} from '@wordpress/lazy-editor';

/**
 * Internal dependencies
 */
import { getErrorMessage } from '../../records';
import {
	Button,
	coreDataStore,
	desktopIcon,
	dispatch,
	DropdownMenu,
	Icon,
	layoutIcon,
	MenuItem,
	mobileIcon,
	moreVerticalIcon,
	noticesStore,
	parseBlocks,
	Spinner,
	sprintf,
	tabletIcon,
	ToggleControl,
	ToggleGroupControl,
	ToggleGroupControlOptionIcon,
	useDispatch,
	useEffect,
	useMemo,
	useState,
	__,
} from '../../wordpress-packages';
import {
	DEFAULT_CANVAS_VIEW_DEVICE,
	getCanvasViewDevice,
	getMenuLocationsSummary,
} from './canvas-view';
import {
	createEditorBlocksFromNavigationBlocks,
	getNavigationBlocksFromEditedRecord,
} from './navigation-blocks';
import {
	assignNavigationMenuToFirstBlock,
	getTemplatePartRawContent,
	removeNavigationMenuFromFirstBlock,
} from '../navigation/navigation-locations';
import {
	NavigationSitePreview,
	NavigationSitePreviewNotice,
} from '../navigation/site-preview';
import { ChooseLocationModal } from '../navigation/choose-location-modal';
import {
	NavigationLocationsEmptyState,
	NavigationNoMenuSelectedEmptyState,
} from './empty-states';
import { useNavigationLocations } from './use-navigation-locations';
import { EMPTY_ARRAY, getMenuTitle } from './shared';

function getBlockName( block ) {
	return block?.name || block?.blockName;
}

function getBlockAttributes( block ) {
	return block?.attributes || block?.attrs || {};
}

function injectNavigationMenuPreviewBlocks( blocks, navigationId, menuBlocks ) {
	return ( blocks || EMPTY_ARRAY ).map( ( block ) => {
		const innerBlocks = injectNavigationMenuPreviewBlocks(
			block.innerBlocks,
			navigationId,
			menuBlocks
		);

		if ( getBlockName( block ) !== 'core/navigation' ) {
			return {
				...block,
				innerBlocks,
			};
		}

		const attributes = { ...getBlockAttributes( block ) };
		const hasExplicitRef =
			attributes.ref !== undefined && attributes.ref !== null;

		if ( hasExplicitRef && Number( attributes.ref ) !== navigationId ) {
			return {
				...block,
				innerBlocks,
			};
		}

		delete attributes.ref;

		return {
			...block,
			attributes,
			innerBlocks: menuBlocks,
		};
	} );
}

function getTemplatePartPreviewBlocks( part, navigationId, menuBlocks ) {
	return injectNavigationMenuPreviewBlocks(
		parseBlocks( getTemplatePartRawContent( part ), {
			__unstableSkipMigrationLogs: true,
		} ),
		navigationId,
		menuBlocks
	);
}

function getCanvasViewDeviceOptions() {
	return [
		{ icon: desktopIcon, label: __( 'Desktop view' ), value: 'Desktop' },
		{ icon: tabletIcon, label: __( 'Tablet view' ), value: 'Tablet' },
		{ icon: mobileIcon, label: __( 'Mobile view' ), value: 'Mobile' },
	];
}

function CanvasDeviceSwitcher( { device, onChange } ) {
	return (
		<ToggleGroupControl
			__next40pxDefaultSize
			__nextHasNoMarginBottom
			className="routes-navigation-canvas-toolbar__devices"
			hideLabelFromVision
			label={ __( 'Preview device' ) }
			onChange={ onChange }
			value={ device }
		>
			{ getCanvasViewDeviceOptions().map( ( option ) => (
				<ToggleGroupControlOptionIcon
					icon={ option.icon }
					key={ option.value }
					label={ option.label }
					value={ option.value }
				/>
			) ) }
		</ToggleGroupControl>
	);
}

function NavigationCanvasHeader( {
	device,
	isPreviewVisible,
	locationActions,
	locationsSummary,
	menuTitle,
	onChangeDevice,
	onTogglePreview,
} ) {
	return (
		<header className="cnl-editor-canvas__toolbar routes-navigation-canvas-toolbar">
			<div className="routes-navigation-canvas-toolbar__document">
				<h2 className="routes-navigation-canvas-toolbar__title">
					{ menuTitle }
				</h2>
				<p className="routes-navigation-canvas-toolbar__meta">
					{ locationsSummary }
				</p>
			</div>
			<div className="routes-navigation-canvas-toolbar__actions">
				{ isPreviewVisible && (
					<CanvasDeviceSwitcher
						device={ device }
						onChange={ onChangeDevice }
					/>
				) }
				{ locationActions }
				<ToggleControl
					__nextHasNoMarginBottom
					checked={ isPreviewVisible }
					className="routes-navigation-canvas-toolbar__preview-toggle"
					label={ __( 'Preview site' ) }
					onChange={ onTogglePreview }
				/>
			</div>
		</header>
	);
}

export default function NavigationEditCanvas() {
	const navigate = useNavigate();
	const params = useParams( { strict: false } );
	const navigationId = Number( params.id );
	const { editEntityRecord } = useDispatch( coreDataStore );
	const { createErrorNotice, createSuccessNotice } =
		useDispatch( noticesStore );
	const { isResolvingTemplateParts, locations, menu, templateParts } =
		useNavigationLocations( navigationId );
	const [ locationModalMode, setLocationModalMode ] = useState( null );
	const [ isSavingLocations, setIsSavingLocations ] = useState( false );
	const [ isPreviewVisible, setIsPreviewVisible ] = useState( true );
	const [ device, setDevice ] = useState( DEFAULT_CANVAS_VIEW_DEVICE );
	const selectedLocationIds = useMemo(
		() => locations.map( ( location ) => location.id ),
		[ locations ]
	);
	const menuTitle = menu ? getMenuTitle( menu ) : __( 'Navigation' );

	/*
	 * The editor store registers with the editor's own assets, which the preview
	 * loads lazily, so the store is absent until it has. The editor opens at the
	 * current device either way: it reads `initialViewport` on mount, and this
	 * carries every later change to it.
	 */
	useEffect( () => {
		if ( ! isPreviewVisible ) {
			return;
		}

		dispatch( 'core/editor' )?.setDeviceType?.( device );
	}, [ device, isPreviewVisible ] );
	/*
	 * The menu's blocks, for the location previews: built only while those
	 * are on show, and once the editor's assets have registered WordPress's
	 * blocks, which building them needs.
	 */
	const { isReady: hasBlockTypes } = useEditorAssets();
	const showsLocations = ! isPreviewVisible && hasBlockTypes;
	const menuBlocks = useMemo(
		() =>
			showsLocations
				? createEditorBlocksFromNavigationBlocks(
						getNavigationBlocksFromEditedRecord( menu )
					)
				: EMPTY_ARRAY,
		[ menu, showsLocations ]
	);

	// Each location's part, with this menu in it. Parsed only while the
	// locations are on show, and kept from render to render so the previews
	// aren't rebuilt each time.
	const locationPreviewBlocks = useMemo(
		() =>
			new Map(
				! showsLocations
					? []
					: locations.map( ( location ) => [
							location.id,
							getTemplatePartPreviewBlocks(
								location.part,
								navigationId,
								menuBlocks
							),
						] )
			),
		[ locations, menuBlocks, navigationId, showsLocations ]
	);

	const editTemplatePartContent = ( part, content ) =>
		editEntityRecord( 'postType', 'wp_template_part', part.id, {
			content,
		} );

	const applyLocationAssignments = async (
		selectedCandidates,
		candidates
	) => {
		setIsSavingLocations( true );

		try {
			const selectedIds = new Set(
				selectedCandidates.map( ( candidate ) => candidate.id )
			);
			const currentIds = new Set( selectedLocationIds );

			for ( const candidate of selectedCandidates ) {
				const content = assignNavigationMenuToFirstBlock(
					candidate.part,
					navigationId
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
						navigationId
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
		} catch ( error ) {
			createErrorNotice(
				sprintf(
					/* translators: %s: error message. */
					__( 'Unable to update menu locations (%s).' ),
					getErrorMessage( error )
				),
				{ type: 'snackbar' }
			);
		} finally {
			setIsSavingLocations( false );
		}
	};
	if ( ! navigationId ) {
		return (
			<section className="cnl-editor-canvas routes-navigation-locations-canvas-shell">
				<div className="routes-navigation-locations-canvas is-top-centered">
					<NavigationNoMenuSelectedEmptyState />
				</div>
			</section>
		);
	}

	const menuLocationActions = (
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
							locations.length > 0 ? 'update' : 'choose'
						);
						onClose();
					} }
				>
					{ locations.length > 0
						? __( 'Update locations' )
						: __( 'Choose location' ) }
				</MenuItem>
			) }
		</DropdownMenu>
	);

	const locationsView = ! isPreviewVisible && (
		<div className="routes-navigation-locations-canvas__content">
			{ isResolvingTemplateParts && (
				<div className="cnl-editor-spinner">
					<Spinner />
				</div>
			) }
			{ ! isResolvingTemplateParts && locations.length === 0 && (
				<NavigationLocationsEmptyState
					disabled={ isResolvingTemplateParts }
					onChooseLocation={ () => setLocationModalMode( 'choose' ) }
				/>
			) }
			{ ! isResolvingTemplateParts && locations.length > 0 && (
				<div className="routes-navigation-locations-canvas__previews">
					{ locations.map( ( location ) => (
						<section
							className="routes-navigation-locations-canvas__card"
							key={ location.id }
						>
							<div className="routes-navigation-locations-canvas__card-header">
								<div className="routes-navigation-locations-canvas__card-title">
									<Icon
										className="routes-navigation-locations-canvas__card-icon"
										icon={ layoutIcon }
									/>
									<span>{ location.label }</span>
								</div>
								<Button
									onClick={ () =>
										navigate( {
											to: `/wp_template_part?postId=${ encodeURIComponent(
												location.part.id
											) }`,
										} )
									}
									variant="link"
								>
									{ __( 'Edit' ) }
								</Button>
							</div>
							<div className="routes-navigation-locations-canvas__preview">
								<LazyEditorPreview
									blocks={
										locationPreviewBlocks.get(
											location.id
										) || EMPTY_ARRAY
									}
									description={ location.label }
								/>
							</div>
						</section>
					) ) }
				</div>
			) }
		</div>
	);

	return (
		<section className="cnl-editor-canvas routes-navigation-canvas">
			<NavigationCanvasHeader
				device={ device }
				isPreviewVisible={ isPreviewVisible }
				locationActions={ menuLocationActions }
				locationsSummary={ getMenuLocationsSummary( locations.length ) }
				menuTitle={ menuTitle }
				onChangeDevice={ ( value ) =>
					setDevice( getCanvasViewDevice( value ) )
				}
				onTogglePreview={ setIsPreviewVisible }
			/>
			{ isPreviewVisible &&
				! isResolvingTemplateParts &&
				locations.length === 0 && (
					<NavigationSitePreviewNotice
						onChooseLocation={ () =>
							setLocationModalMode( 'choose' )
						}
					/>
				) }
			<div className="routes-navigation-canvas__body">
				{ isPreviewVisible ? (
					<NavigationSitePreview device={ device } />
				) : (
					locationsView
				) }
			</div>
			{ locationModalMode && (
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
