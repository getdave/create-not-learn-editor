/**
 * Internal dependencies
 */
import { PrivateListView } from '../../list-view';
import {
	blockEditorStore,
	BlockEditorProvider,
	blocksStore,
	Button,
	coreDataStore,
	createBlock,
	fetchLinkSuggestions,
	InputControl,
	noticesStore,
	Popover,
	select as selectFromRegistry,
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
	useState,
	__,
} from '../../wordpress-packages';
import NavigationListViewAppender from './navigation-list-view-appender';
import { getLabelOnlyNavigationSubmenuAttributes } from './navigation-list-view-insertions';
import NavigationListViewLinkUI from './navigation-list-view-link-ui';
import NavigationListViewMoreMenu from './navigation-list-view-more-menu';
import {
	expandPageListBlocks,
	getNavigationContentFromEditedRecord,
	hasPageListBlock,
	normalizeMenuItems,
	serializeNavigationBlocks,
} from './navigation-blocks';

const EMPTY_ARRAY = [];

/**
 * The pages a menu that lists every page shows. Shared with the Menus screen's
 * page picker so both use one cached request.
 */
export const MENU_PAGES_QUERY = {
	context: 'edit',
	order: 'asc',
	orderby: 'menu_order',
	per_page: 100,
	status: 'publish',
	_fields: 'id,link,menu_order,parent,title,type',
};

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

const SUBMENU_ALLOWED_BLOCKS = [
	'core/navigation-link',
	'core/navigation-submenu',
	'core/page-list',
];
const FALLBACK_MENU_ALLOWED_BLOCKS = [
	'core/home-link',
	...SUBMENU_ALLOWED_BLOCKS,
];

/**
 * The block the menu's items sit in, inside a menu's block editor.
 *
 * @return {string} Client ID to insert top-level menu items into.
 */
export function useMenuRootClientId() {
	return useSelect(
		( select ) => select( blockEditorStore ).getBlockOrder()[ 0 ] || '',
		[]
	);
}

export function NavigationListViewContent( {
	blockSettingsMenu = NavigationListViewMoreMenu,
	menuTitle,
	onAddMenuItems,
	onInsertionTargetChange,
	onPendingInsertionComplete,
	onReadyChange,
	onSelect,
	pendingInsertion,
	showAppender = true,
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
	const rootClientId = useMenuRootClientId();
	const pendingInsertionRootClientId =
		pendingInsertion?.parentClientId || rootClientId;
	const appenderParentClientId = useSelect( ( select ) => {
		const store = select( blockEditorStore );
		const selectedClientId = store.getSelectedBlockClientId();

		if ( ! selectedClientId ) {
			return null;
		}

		if (
			store.getBlockName( selectedClientId ) === 'core/navigation-submenu'
		) {
			return selectedClientId;
		}

		const selectedRootClientId =
			store.getBlockRootClientId( selectedClientId );

		return selectedRootClientId &&
			store.getBlockName( selectedRootClientId ) ===
				'core/navigation-submenu'
			? selectedRootClientId
			: null;
	}, [] );
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
		( { ref, ...props } ) => (
			<NavigationListViewAppender
				{ ...props }
				forwardedRef={ ref }
				onAddLabelOnlySubmenu={ ( block ) => {
					setLabelOnlySubmenuClientId( block.clientId );
					setLabelOnlySubmenuLabel( '' );
				} }
				onAddMenuItems={ onAddMenuItems }
			/>
		),
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
		( props ) => (
			<NavigationListViewLinkUI
				{ ...props }
				onComplete={ selectInsertedSubmenu }
			/>
		),
		[ selectInsertedSubmenu ]
	);

	useEffect( () => {
		onInsertionTargetChange?.( appenderParentClientId );
	}, [ appenderParentClientId, onInsertionTargetChange ] );

	useEffect( () => {
		if ( ! pendingInsertion ) {
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

	const description = sprintf(
		/* translators: %s: Navigation menu title. */
		__( 'Structure for Navigation Menu: %s' ),
		menuTitle
	);

	return (
		<div className="routes-navigation-edit-list-view" ref={ listViewRef }>
			<PrivateListView
				additionalBlockContent={ renderAdditionalBlockContent }
				appenderParentClientId={
					showAppender ? appenderParentClientId : undefined
				}
				blockSettingsMenu={ blockSettingsMenu }
				description={ description }
				isExpanded
				onSelect={ onSelect }
				renderAppender={ showAppender ? renderAppender : undefined }
				rootClientId={ rootClientId }
				showAppender={ showAppender }
			/>
			{ labelOnlySubmenuClientId && labelOnlyAnchorElement && (
				<Popover
					anchor={ labelOnlyAnchorElement }
					className="routes-navigation-edit-list-view__label-only-submenu-popover"
					onClose={ cancelLabelOnlySubmenu }
					placement="bottom-start"
				>
					<form
						className="routes-navigation-edit-list-view__label-only-submenu-form"
						onSubmit={ ( event ) => {
							event.preventDefault();
							saveLabelOnlySubmenu();
						} }
					>
						<InputControl
							autoComplete="off"
							label={ __( 'Submenu label' ) }
							onValueChange={ setLabelOnlySubmenuLabel }
							value={ labelOnlySubmenuLabel }
						/>
						<div className="routes-navigation-edit-list-view__label-only-submenu-actions">
							<Button
								__next40pxDefaultSize
								onClick={ cancelLabelOnlySubmenu }
								type="button"
								variant="tertiary"
							>
								{ __( 'Cancel' ) }
							</Button>
							<Button
								__next40pxDefaultSize
								accessibleWhenDisabled
								disabled={ ! labelOnlySubmenuLabel.trim() }
								type="submit"
								variant="primary"
							>
								{ __( 'Add drop-down' ) }
							</Button>
						</div>
					</form>
				</Popover>
			) }
		</div>
	);
}

/**
 * Tell the user a menu that listed every page now only has what is in it, with
 * a way back.
 *
 * @param {Object}   args                     Arguments.
 * @param {Function} args.createSuccessNotice Notices store action.
 * @param {Function} args.editEntityRecord    Core data store action.
 * @param {number}   args.navigationId        Menu ID.
 * @param {string}   args.previousContent     Menu content before the change.
 */
export function showMenuSetByHandNotice( {
	createSuccessNotice,
	editEntityRecord,
	navigationId,
	previousContent,
} ) {
	createSuccessNotice(
		__(
			'Your menu is now set by hand. New pages won’t be added to it automatically.'
		),
		{
			actions: [
				{
					label: __( 'Undo' ),
					onClick: () =>
						editEntityRecord(
							'postType',
							'wp_navigation',
							navigationId,
							{
								blocks: undefined,
								content: previousContent,
								selection: undefined,
							}
						),
				},
			],
			id: 'cnl-menu-set-by-hand',
			type: 'snackbar',
		}
	);
}

/**
 * A navigation menu's blocks, in a block editor of their own.
 *
 * A menu that lists every page (a Page List block) is shown as the pages it
 * lists, as ordinary links, so it reads and edits like any other menu. Nothing
 * is written until the first change, which turns the menu into those links
 * plus the change, as one pending edit that can be undone.
 *
 * @param {Object}   props                Component props.
 * @param {Element}  props.children       What renders inside the editor.
 * @param {number}   props.navigationId   Menu ID.
 * @param {Function} props.onBlocksChange Called with the blocks shown.
 * @param {Function} props.onReadyChange  Called once the menu can be shown.
 * @return {Element} The block editor.
 */
export function NavigationMenuEditorProvider( props ) {
	// Parsing before the menu's block types are registered loses blocks.
	const hasBlockTypes = useSelect(
		( select ) =>
			!! select( blocksStore ).getBlockType( 'core/navigation-link' ) &&
			!! select( blocksStore ).getBlockType( 'core/page-list' ),
		[]
	);

	if ( ! hasBlockTypes ) {
		return (
			<div className="routes-navigation-edit-list-view__loading">
				<Spinner />
			</div>
		);
	}

	return <NavigationMenuEditor { ...props } />;
}

/**
 * Say which blocks the menu and its items take. A link can take items too, and
 * becomes a submenu when it does (see `normalizeMenuItems`).
 *
 * The block editor works out what goes where as blocks render, but the menu's
 * blocks are only ever shown as a list, so nothing would otherwise allow
 * anything to be added, moved or dropped into them.
 *
 * @return {null} Nothing.
 */
function NavigationMenuBlockListSettings() {
	const { updateBlockListSettings } = useDispatch( blockEditorStore );
	const { menuAllowedBlocks, parentClientIds, rootClientId } = useSelect(
		( select ) => {
			const store = select( blockEditorStore );

			return {
				menuAllowedBlocks:
					select( blocksStore ).getBlockType( 'core/navigation' )
						?.allowedBlocks || FALLBACK_MENU_ALLOWED_BLOCKS,
				parentClientIds: [
					...store.getBlocksByName( 'core/navigation-link' ),
					...store.getBlocksByName( 'core/navigation-submenu' ),
				].join( ',' ),
				rootClientId: store.getBlockOrder()[ 0 ],
			};
		},
		[]
	);

	useEffect( () => {
		if ( ! rootClientId ) {
			return;
		}

		updateBlockListSettings( {
			[ rootClientId ]: { allowedBlocks: menuAllowedBlocks },
			...Object.fromEntries(
				parentClientIds
					.split( ',' )
					.filter( Boolean )
					.map( ( clientId ) => [
						clientId,
						{ allowedBlocks: SUBMENU_ALLOWED_BLOCKS },
					] )
			),
		} );
	}, [
		menuAllowedBlocks,
		parentClientIds,
		rootClientId,
		updateBlockListSettings,
	] );

	return null;
}

function NavigationMenuEditor( {
	children,
	navigationId,
	onBlocksChange,
	onReadyChange,
} ) {
	const [ entityBlocks, onInput, onChange ] = useEntityBlockEditor(
		'postType',
		'wp_navigation',
		{ id: navigationId }
	);
	const isAutomatic = useMemo(
		() => hasPageListBlock( entityBlocks ),
		[ entityBlocks ]
	);
	const { hasPages, pages } = useSelect(
		( select ) => {
			if ( ! isAutomatic ) {
				return { hasPages: true, pages: EMPTY_ARRAY };
			}

			const store = select( coreDataStore );
			const args = [ 'postType', 'page', MENU_PAGES_QUERY ];

			return {
				hasPages: store.hasFinishedResolution(
					'getEntityRecords',
					args
				),
				pages: store.getEntityRecords( ...args ) || EMPTY_ARRAY,
			};
		},
		[ isAutomatic ]
	);
	const blocks = useMemo( () => {
		if ( ! entityBlocks || ! isAutomatic ) {
			return entityBlocks;
		}

		return hasPages ? expandPageListBlocks( entityBlocks, pages ) : null;
	}, [ entityBlocks, hasPages, isAutomatic, pages ] );
	// Menu items only go inside a Navigation block, so they sit in one here.
	// It is never rendered, so it does nothing a Navigation block would do.
	const menuBlock = useMemo( () => createBlock( 'core/navigation' ), [] );
	const lastValue = useRef();
	const value = useMemo( () => {
		if ( ! blocks ) {
			return null;
		}

		// Hand back what the editor last sent, so it isn't reset.
		if ( lastValue.current?.[ 0 ]?.innerBlocks === blocks ) {
			return lastValue.current;
		}

		return [ { ...menuBlock, innerBlocks: blocks } ];
	}, [ blocks, menuBlock ] );
	const { editEntityRecord } = useDispatch( coreDataStore );
	const { createSuccessNotice } = useDispatch( noticesStore );
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
	const setByHand = useCallback(
		( nextBlocks, options ) => {
			// The editor tidying up what it was given isn't a change.
			if (
				serializeNavigationBlocks( nextBlocks ) ===
				serializeNavigationBlocks( blocks )
			) {
				return;
			}

			const previousContent = getNavigationContentFromEditedRecord(
				selectFromRegistry( coreDataStore ).getEditedEntityRecord(
					'postType',
					'wp_navigation',
					navigationId
				)
			);

			onChange( nextBlocks, options );
			showMenuSetByHandNotice( {
				createSuccessNotice,
				editEntityRecord,
				navigationId,
				previousContent,
			} );
		},
		[
			blocks,
			createSuccessNotice,
			editEntityRecord,
			navigationId,
			onChange,
		]
	);
	// The menu items from the editor, made the right kind before anything
	// else sees them. If that changed them, the editor is given them back.
	const takeMenuItems = useCallback(
		( nextValue ) => {
			const items = nextValue[ 0 ]?.innerBlocks || EMPTY_ARRAY;
			const nextBlocks = normalizeMenuItems( items, blocks );

			lastValue.current = nextBlocks === items ? nextValue : null;
			onBlocksChange?.( nextBlocks );

			return nextBlocks;
		},
		[ blocks, onBlocksChange ]
	);
	const handleInput = useCallback(
		( nextValue, options ) => {
			const nextBlocks = takeMenuItems( nextValue );

			if ( isAutomatic ) {
				setByHand( nextBlocks, options );
				return;
			}

			onInput( nextBlocks, options );
		},
		[ isAutomatic, onInput, setByHand, takeMenuItems ]
	);
	const handleChange = useCallback(
		( nextValue, options ) => {
			const nextBlocks = takeMenuItems( nextValue );

			if ( isAutomatic ) {
				setByHand( nextBlocks, options );
				return;
			}

			onChange( nextBlocks, options );
		},
		[ isAutomatic, onChange, setByHand, takeMenuItems ]
	);
	const isReady = settingsReady && assetsReady && !! blocks;

	useEffect( () => {
		onReadyChange?.( isReady );
	}, [ isReady, onReadyChange ] );

	useEffect( () => {
		if ( blocks ) {
			onBlocksChange?.( blocks );
		}
	}, [ blocks, onBlocksChange ] );

	if ( ! isReady ) {
		return (
			<div className="routes-navigation-edit-list-view__loading">
				<Spinner />
			</div>
		);
	}

	return (
		<BlockEditorProvider
			onChange={ handleChange }
			onInput={ handleInput }
			settings={ settings }
			value={ value }
		>
			<NavigationMenuBlockListSettings />
			{ children }
		</BlockEditorProvider>
	);
}

export default function NavigationEditListView( {
	menuTitle,
	navigationId,
	onAddMenuItems,
	onBlocksChange,
	onInsertionTargetChange,
	onPendingInsertionComplete,
	onReadyChange,
	pendingInsertion,
} ) {
	return (
		<NavigationMenuEditorProvider
			navigationId={ navigationId }
			onBlocksChange={ onBlocksChange }
			onReadyChange={ onReadyChange }
		>
			<NavigationListViewContent
				menuTitle={ menuTitle }
				onAddMenuItems={ onAddMenuItems }
				onInsertionTargetChange={ onInsertionTargetChange }
				onPendingInsertionComplete={ onPendingInsertionComplete }
				onReadyChange={ onReadyChange }
				pendingInsertion={ pendingInsertion }
			/>
		</NavigationMenuEditorProvider>
	);
}
