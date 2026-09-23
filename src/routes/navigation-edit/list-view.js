/**
 * Internal dependencies
 */
import { PrivateListView } from '../../list-view';
import {
	blockEditorStore,
	BlockEditorProvider,
	BlockList,
	Button,
	el,
	fetchLinkSuggestions,
	Popover,
	sprintf,
	Spinner,
	TextControl,
	useCallback,
	useEditorAssets,
	useEditorSettings,
	useDispatch,
	useEffect,
	useEntityBlockEditor,
	useMemo,
	useRef,
	useSelect,
	useState,
	__,
} from '../../wordpress-packages';
import NavigationListViewAppender from './navigation-list-view-appender';
import { getLabelOnlyNavigationSubmenuAttributes } from './navigation-list-view-insertions';
import NavigationListViewLinkUI from './navigation-list-view-link-ui';
import NavigationListViewMoreMenu from './navigation-list-view-more-menu';

const EMPTY_ARRAY = [];

function getListViewBlockPopoverAnchorElement( listViewElement, clientId ) {
	const rowElement = listViewElement.querySelector(
		`[role="row"][data-block="${ clientId }"]`
	);

	if ( ! rowElement ) {
		return null;
	}

	return (
		rowElement.querySelector( '.block-editor-list-view-block-contents' ) ||
		rowElement.querySelector(
			'.block-editor-list-view-block__contents-container'
		) ||
		rowElement
	);
}

function getLabelOnlySubmenuPopoverAnchor( listViewElement, clientId ) {
	const anchorElement = getListViewBlockPopoverAnchorElement(
		listViewElement,
		clientId
	);

	if ( ! anchorElement ) {
		return null;
	}

	return {
		ownerDocument: anchorElement.ownerDocument,
		getBoundingClientRect() {
			const rect = anchorElement.getBoundingClientRect();
			const ViewDOMRect =
				anchorElement.ownerDocument.defaultView?.DOMRect;

			return ViewDOMRect
				? new ViewDOMRect(
						rect.left,
						rect.top,
						Math.min( rect.width, 240 ),
						rect.height
					)
				: rect;
		},
	};
}

function NavigationListViewContent( {
	isAutoMenu,
	menuTitle,
	onAddMenuItems,
	onInsertionTargetChange,
	onPendingInsertionComplete,
	onReadyChange,
	pendingInsertion,
} ) {
	const {
		removeBlock,
		replaceInnerBlocks,
		selectBlock,
		updateBlockAttributes,
	} = useDispatch( blockEditorStore );
	const handledInsertionId = useRef( null );
	const listViewRef = useRef( null );
	const [ labelOnlySubmenuClientId, setLabelOnlySubmenuClientId ] =
		useState( null );
	const [ labelOnlySubmenuLabel, setLabelOnlySubmenuLabel ] = useState( '' );
	const [ labelOnlyAnchorElement, setLabelOnlyAnchorElement ] =
		useState( null );
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
				onAddLabelOnlySubmenu: ( block ) => {
					setLabelOnlySubmenuClientId( block.clientId );
					setLabelOnlySubmenuLabel( '' );
				},
				onAddMenuItems,
			} ),
		[ onAddMenuItems ]
	);
	const selectInsertedSubmenu = useCallback(
		( block ) => {
			if ( block?.name !== 'core/navigation-submenu' ) {
				return;
			}

			selectBlock( block.clientId, null );
		},
		[ selectBlock ]
	);
	const renderAdditionalBlockContent = useCallback(
		( props ) =>
			el( NavigationListViewLinkUI, {
				...props,
				onComplete: selectInsertedSubmenu,
			} ),
		[ selectInsertedSubmenu ]
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

	useEffect( () => {
		if ( ! labelOnlySubmenuClientId || ! listViewRef.current ) {
			setLabelOnlyAnchorElement( null );
			return undefined;
		}

		const updateAnchor = () => {
			setLabelOnlyAnchorElement(
				getLabelOnlySubmenuPopoverAnchor(
					listViewRef.current,
					labelOnlySubmenuClientId
				)
			);
		};

		if ( typeof window === 'undefined' || ! window.requestAnimationFrame ) {
			updateAnchor();
			return undefined;
		}

		const frame = window.requestAnimationFrame( updateAnchor );
		return () => window.cancelAnimationFrame( frame );
	}, [ labelOnlySubmenuClientId ] );

	const cancelLabelOnlySubmenu = useCallback( () => {
		if ( labelOnlySubmenuClientId ) {
			removeBlock( labelOnlySubmenuClientId, false );
		}

		setLabelOnlySubmenuClientId( null );
		setLabelOnlySubmenuLabel( '' );
	}, [ labelOnlySubmenuClientId, removeBlock ] );

	const saveLabelOnlySubmenu = useCallback( () => {
		const label = labelOnlySubmenuLabel.trim();

		if ( ! label || ! labelOnlySubmenuClientId ) {
			return;
		}

		updateBlockAttributes(
			labelOnlySubmenuClientId,
			getLabelOnlyNavigationSubmenuAttributes( label )
		);
		selectBlock( labelOnlySubmenuClientId, null );
		setLabelOnlySubmenuClientId( null );
		setLabelOnlySubmenuLabel( '' );
	}, [
		labelOnlySubmenuClientId,
		labelOnlySubmenuLabel,
		selectBlock,
		updateBlockAttributes,
	] );

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
		{ className: 'routes-navigation-edit-list-view', ref: listViewRef },
		el( PrivateListView, {
			additionalBlockContent: isAutoMenu
				? null
				: renderAdditionalBlockContent,
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
		),
		labelOnlySubmenuClientId &&
			labelOnlyAnchorElement &&
			el(
				Popover,
				{
					anchor: labelOnlyAnchorElement,
					className:
						'routes-navigation-edit-list-view__label-only-submenu-popover',
					onClose: cancelLabelOnlySubmenu,
					placement: 'bottom-start',
				},
				el(
					'form',
					{
						className:
							'routes-navigation-edit-list-view__label-only-submenu-form',
						onSubmit: ( event ) => {
							event.preventDefault();
							saveLabelOnlySubmenu();
						},
					},
					el( TextControl, {
						__next40pxDefaultSize: true,
						autoComplete: 'off',
						label: __( 'Submenu label' ),
						onChange: setLabelOnlySubmenuLabel,
						value: labelOnlySubmenuLabel,
					} ),
					el(
						'div',
						{
							className:
								'routes-navigation-edit-list-view__label-only-submenu-actions',
						},
						el(
							Button,
							{
								__next40pxDefaultSize: true,
								onClick: cancelLabelOnlySubmenu,
								type: 'button',
								variant: 'tertiary',
							},
							__( 'Cancel' )
						),
						el(
							Button,
							{
								__next40pxDefaultSize: true,
								accessibleWhenDisabled: true,
								disabled: ! labelOnlySubmenuLabel.trim(),
								type: 'submit',
								variant: 'primary',
							},
							__( 'Add drop-down' )
						)
					)
				)
			)
	);
}

export default function NavigationEditListView( {
	isAutoMenu,
	menuTitle,
	navigationId,
	onAddMenuItems,
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
	const settings = useMemo( () => {
		const nextSettings = {
			...editorSettings,
			hasFixedToolbar: false,
		};

		if (
			! nextSettings.__experimentalFetchLinkSuggestions &&
			fetchLinkSuggestions
		) {
			nextSettings.__experimentalFetchLinkSuggestions = (
				search,
				searchOptions
			) => fetchLinkSuggestions( search, searchOptions, nextSettings );
		}

		return nextSettings;
	}, [ editorSettings ] );
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
			onAddMenuItems,
			onInsertionTargetChange,
			onPendingInsertionComplete,
			onReadyChange,
			pendingInsertion,
		} )
	);
}
