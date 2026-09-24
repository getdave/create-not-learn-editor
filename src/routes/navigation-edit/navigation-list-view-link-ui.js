/**
 * Internal dependencies
 */
import {
	blockEditorStore,
	coreDataStore,
	el,
	LinkControl,
	Popover,
	useBlockBindingsUtils,
	useBlockEditingMode,
	useCallback,
	useDispatch,
	useMemo,
	useSelect,
} from '../../wordpress-packages';
import {
	buildNavigationLinkEntityBinding,
	getNavigationLinkControlValue,
	getSuggestionsQuery,
	updateNavigationLinkAttributes,
} from './navigation-link-attributes';

const BLOCKS_WITH_LINK_UI_SUPPORT = [
	'core/navigation-link',
	'core/navigation-submenu',
];

function useNavigationEntityBinding( { clientId, attributes = {} } ) {
	const { updateBlockBindings } = useBlockBindingsUtils( clientId );
	const blockEditingMode = useBlockEditingMode();
	const { metadata, id, kind, type } = attributes;
	const hasUrlBinding = !! metadata?.bindings?.url && !! id;
	const expectedSource =
		kind === 'taxonomy' ? 'core/term-data' : 'core/post-data';
	const hasCorrectBinding =
		hasUrlBinding && metadata?.bindings?.url?.source === expectedSource;

	const { entityRecord, isBoundEntityAvailable } = useSelect(
		( select ) => {
			if ( ! hasCorrectBinding || ! id ) {
				return {
					entityRecord: null,
					isBoundEntityAvailable: false,
				};
			}

			if ( kind !== 'post-type' && kind !== 'taxonomy' ) {
				return {
					entityRecord: null,
					isBoundEntityAvailable: false,
				};
			}

			if ( blockEditingMode === 'disabled' ) {
				return {
					entityRecord: null,
					isBoundEntityAvailable: true,
				};
			}

			const entityKind = kind === 'taxonomy' ? 'taxonomy' : 'postType';
			const entityName = type === 'tag' ? 'post_tag' : type;
			const store = select( coreDataStore );
			const record = store.getEntityRecord( entityKind, entityName, id );
			const hasResolved = store.hasFinishedResolution(
				'getEntityRecord',
				[ entityKind, entityName, id ]
			);

			return {
				entityRecord: record || null,
				isBoundEntityAvailable: hasResolved
					? record !== undefined
					: true,
			};
		},
		[ blockEditingMode, hasCorrectBinding, id, kind, type ]
	);

	const clearBinding = useCallback( () => {
		if ( hasUrlBinding ) {
			updateBlockBindings( { url: undefined } );
		}
	}, [ hasUrlBinding, updateBlockBindings ] );

	const createBinding = useCallback(
		( updatedAttributes ) => {
			const kindToUse = updatedAttributes?.kind ?? kind;

			if ( ! kindToUse ) {
				return;
			}

			try {
				updateBlockBindings(
					buildNavigationLinkEntityBinding( kindToUse )
				);
			} catch ( error ) {
				// eslint-disable-next-line no-console
				console.warn(
					'Failed to create navigation link entity binding:',
					error.message
				);
			}
		},
		[ kind, updateBlockBindings ]
	);

	return {
		clearBinding,
		createBinding,
		entityRecord,
		hasUrlBinding: hasCorrectBinding,
		isBoundEntityAvailable,
	};
}

export default function NavigationListViewLinkUI( {
	insertedBlockClientId,
	onComplete,
	setInsertedBlockClientId,
} ) {
	const { removeBlock, updateBlockAttributes } =
		useDispatch( blockEditorStore );
	const insertedBlock = useSelect(
		( select ) =>
			insertedBlockClientId
				? select( blockEditorStore ).getBlock( insertedBlockClientId )
				: null,
		[ insertedBlockClientId ]
	);
	const supportsLinkControls = BLOCKS_WITH_LINK_UI_SUPPORT.includes(
		insertedBlock?.name
	);
	const showLinkControls = !! insertedBlock && supportsLinkControls;
	const attributes = useMemo(
		() => insertedBlock?.attributes || {},
		[ insertedBlock?.attributes ]
	);
	const {
		clearBinding,
		createBinding,
		entityRecord,
		isBoundEntityAvailable,
	} = useNavigationEntityBinding( {
		attributes,
		clientId: insertedBlock?.clientId,
	} );
	const linkValue = useMemo(
		() => getNavigationLinkControlValue( attributes, entityRecord ),
		[ attributes, entityRecord ]
	);

	if ( ! showLinkControls ) {
		return null;
	}

	const cleanupInsertedBlock = () => {
		if ( ! insertedBlock?.attributes?.url && insertedBlock?.clientId ) {
			removeBlock( insertedBlock.clientId, false );
		}
		setInsertedBlockClientId( null );
	};

	const setInsertedBlockAttributes = ( updatedAttributes ) => {
		if ( ! insertedBlock?.clientId ) {
			return;
		}
		updateBlockAttributes( insertedBlock.clientId, updatedAttributes );
	};

	return el(
		Popover,
		{
			className: 'routes-navigation-edit-list-view__link-ui-popover',
			onClose: cleanupInsertedBlock,
			placement: 'bottom-start',
			shift: true,
		},
		el( LinkControl, {
			forceIsEditingLink: linkValue?.url ? false : undefined,
			handleEntities: isBoundEntityAvailable,
			hasRichPreviews: true,
			hasTextControl: true,
			key: insertedBlock.clientId,
			noDirectEntry: !! attributes.type,
			noURLSuggestion: !! attributes.type,
			onCancel: cleanupInsertedBlock,
			onChange: ( updatedValue ) => {
				const { attributes: updatedAttributes, isEntityLink } =
					updateNavigationLinkAttributes(
						updatedValue,
						setInsertedBlockAttributes,
						attributes
					);

				if ( isEntityLink ) {
					createBinding( updatedAttributes );
				} else {
					clearBinding();
				}

				onComplete?.( insertedBlock, updatedAttributes );
				setInsertedBlockClientId( null );
			},
			onRemove: cleanupInsertedBlock,
			showInitialSuggestions: true,
			suggestionsQuery: getSuggestionsQuery(
				attributes.type,
				attributes.kind
			),
			value: linkValue,
			withCreateSuggestion: false,
		} )
	);
}
