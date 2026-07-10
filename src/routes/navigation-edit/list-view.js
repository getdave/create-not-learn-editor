/**
 * Internal dependencies
 */
import { PrivateListView } from '../../list-view';
import {
	blockEditorStore,
	BlockEditorProvider,
	BlockList,
	el,
	sprintf,
	Spinner,
	useCallback,
	useEditorAssets,
	useEditorSettings,
	useDispatch,
	useEffect,
	useEntityBlockEditor,
	useMemo,
	useRef,
	useSelect,
	__,
} from '../../wordpress-packages';
import NavigationListViewAppender from './navigation-list-view-appender';
import NavigationListViewLinkUI from './navigation-list-view-link-ui';
import NavigationListViewMoreMenu from './navigation-list-view-more-menu';

const EMPTY_ARRAY = [];

function NavigationListViewContent( {
	isAutoMenu,
	menuTitle,
	onInsertionTargetChange,
	onPendingInsertionComplete,
	onReadyChange,
	pendingInsertion,
} ) {
	const { replaceInnerBlocks } = useDispatch( blockEditorStore );
	const handledInsertionId = useRef( null );
	const pendingInsertionRootClientId = pendingInsertion?.parentClientId || '';
	const { appenderParentClientId, listViewRootClientId } = useSelect(
		( select ) => {
			const store = select( blockEditorStore );
			const rootBlockOrder = store.getBlockOrder();
			const firstRootBlockClientId = rootBlockOrder[ 0 ];
			const hasOnlyPageListBlock =
				rootBlockOrder.length === 1 &&
				store.getBlockName( firstRootBlockClientId ) ===
					'core/page-list';
			const pageListHasBlocks =
				hasOnlyPageListBlock &&
				store.getBlockCount( firstRootBlockClientId ) > 0;
			const selectedClientId = store.getSelectedBlockClientId();
			const selectedBlockName = selectedClientId
				? store.getBlockName( selectedClientId )
				: null;
			const selectedRootClientId = selectedClientId
				? store.getBlockRootClientId( selectedClientId )
				: null;
			const selectedRootBlockName = selectedRootClientId
				? store.getBlockName( selectedRootClientId )
				: null;
			let nextAppenderParentClientId = null;

			if ( ! isAutoMenu ) {
				if ( selectedBlockName === 'core/navigation-submenu' ) {
					nextAppenderParentClientId = selectedClientId;
				} else if (
					selectedRootBlockName === 'core/navigation-submenu'
				) {
					nextAppenderParentClientId = selectedRootClientId;
				}
			}

			return {
				appenderParentClientId: nextAppenderParentClientId,
				listViewRootClientId:
					isAutoMenu && pageListHasBlocks
						? firstRootBlockClientId
						: null,
			};
		},
		[ isAutoMenu ]
	);
	const pendingInsertionBlocks = useSelect(
		( select ) =>
			pendingInsertion
				? select( blockEditorStore ).getBlocks(
						pendingInsertionRootClientId
				  )
				: EMPTY_ARRAY,
		[ pendingInsertion, pendingInsertionRootClientId ]
	);
	const renderAppender = useCallback(
		( { ref, ...props } ) =>
			el( NavigationListViewAppender, {
				...props,
				forwardedRef: ref,
			} ),
		[]
	);

	useEffect( () => {
		onInsertionTargetChange?.( appenderParentClientId );
	}, [ appenderParentClientId, onInsertionTargetChange ] );

	useEffect( () => {
		if ( ! pendingInsertion || isAutoMenu ) {
			return;
		}

		if ( handledInsertionId.current === pendingInsertion.id ) {
			return;
		}

		handledInsertionId.current = pendingInsertion.id;

		try {
			replaceInnerBlocks(
				pendingInsertionRootClientId,
				[ ...pendingInsertionBlocks, ...pendingInsertion.blocks ],
				false
			);
			onPendingInsertionComplete?.( pendingInsertion );
		} catch ( error ) {
			onPendingInsertionComplete?.( pendingInsertion, error );
		}
	}, [
		isAutoMenu,
		onPendingInsertionComplete,
		pendingInsertion,
		pendingInsertionBlocks,
		pendingInsertionRootClientId,
		replaceInnerBlocks,
	] );

	useEffect( () => {
		onReadyChange?.( true );
	}, [ onReadyChange ] );

	const description = isAutoMenu
		? sprintf(
				/* translators: %s: Navigation menu title. */
				__( 'Auto-generated structure for Navigation Menu: %s' ),
				menuTitle
		  )
		: sprintf(
				/* translators: %s: Navigation menu title. */
				__( 'Structure for Navigation Menu: %s' ),
				menuTitle
		  );

	return el(
		'div',
		{ className: 'routes-navigation-edit-list-view' },
		el( PrivateListView, {
			additionalBlockContent: isAutoMenu
				? null
				: NavigationListViewLinkUI,
			appenderParentClientId: isAutoMenu
				? undefined
				: appenderParentClientId,
			blockSettingsMenu: isAutoMenu ? null : NavigationListViewMoreMenu,
			description,
			isExpanded: true,
			key: listViewRootClientId || 'root',
			renderAppender: isAutoMenu ? undefined : renderAppender,
			rootClientId: listViewRootClientId,
			showAppender: ! isAutoMenu,
		} ),
		el(
			'div',
			{
				'aria-hidden': true,
				className:
					'routes-navigation-edit-list-view__helper-block-editor',
			},
			el( BlockList )
		)
	);
}

export default function NavigationEditListView( {
	isAutoMenu,
	menuTitle,
	navigationId,
	onBlocksChange,
	onInsertionTargetChange,
	onPendingInsertionComplete,
	onReadyChange,
	pendingInsertion,
} ) {
	const [ blocks, onInput, onChange ] = useEntityBlockEditor(
		'postType',
		'wp_navigation',
		{ id: navigationId }
	);
	const { isReady: settingsReady, editorSettings } = useEditorSettings( {} );
	const { isReady: assetsReady } = useEditorAssets();
	const settings = useMemo(
		() => ( {
			...editorSettings,
			hasFixedToolbar: false,
		} ),
		[ editorSettings ]
	);
	const handleInput = useCallback(
		( nextBlocks, options ) => {
			onBlocksChange?.( nextBlocks );
			onInput( nextBlocks, options );
		},
		[ onBlocksChange, onInput ]
	);
	const handleChange = useCallback(
		( nextBlocks, options ) => {
			onBlocksChange?.( nextBlocks );
			onChange( nextBlocks, options );
		},
		[ onBlocksChange, onChange ]
	);

	useEffect( () => {
		onReadyChange?.( settingsReady && assetsReady && !! blocks );
	}, [ assetsReady, blocks, onReadyChange, settingsReady ] );

	useEffect( () => {
		if ( blocks ) {
			onBlocksChange?.( blocks );
		}
	}, [ blocks, onBlocksChange ] );

	if ( ! settingsReady || ! assetsReady || ! blocks ) {
		return el(
			'div',
			{ className: 'routes-navigation-edit-list-view__loading' },
			el( Spinner )
		);
	}

	return el(
		BlockEditorProvider,
		{
			onChange: handleChange,
			onInput: handleInput,
			settings,
			value: blocks || EMPTY_ARRAY,
		},
		el( NavigationListViewContent, {
			isAutoMenu,
			menuTitle,
			onInsertionTargetChange,
			onPendingInsertionComplete,
			onReadyChange,
			pendingInsertion,
		} )
	);
}
