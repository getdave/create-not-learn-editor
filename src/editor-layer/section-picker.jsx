/**
 * The section picker in the editor, opened by "Add section" in a section's
 * options menu, or by "View all sections" in the site canvas's picker that
 * opens in place.
 *
 * The menu item unmounts as soon as the selection changes, so it only asks
 * for the picker here, and the layer renders it. The request says where the
 * new section goes: the section's parent and the index straight after it.
 */

/**
 * WordPress dependencies
 */
import {
	BlockPreview,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import { parse } from '@wordpress/blocks';
import {
	createReduxStore,
	dispatch,
	register,
	select,
	useDispatch,
	useRegistry,
	useSelect,
} from '@wordpress/data';
import { useMemo } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';

/**
 * Internal dependencies
 */
import { getPatternTitle } from '../routes/content/page-layouts';
import { getSectionTitle } from '../routes/content/pages/page-sections';
import {
	createBlankSection,
	getPatternSectionBlocks,
	getPlacementText,
	SectionPicker,
} from '../section-picker';

/*
 * Where the picker was asked to add a section, if it was. Kept in a data
 * store, registered once by name, so a request from a route, built separately
 * from app init, reaches the picker the layer renders.
 */
const STORE_NAME = 'create-not-learn-editor/section-picker';

if ( ! select( STORE_NAME ) ) {
	register(
		createReduxStore( STORE_NAME, {
			reducer( state = null, action ) {
				return action.type === 'SET_SECTION_PICKER_REQUEST'
					? action.request
					: state;
			},
			actions: {
				setRequest: ( request ) => ( {
					request,
					type: 'SET_SECTION_PICKER_REQUEST',
				} ),
			},
			selectors: {
				getRequest: ( state ) => state,
			},
		} )
	);
}

/**
 * Open the section picker to add a section at a place in the editor.
 *
 * @param {Object}  place              Where the section goes.
 * @param {?string} place.rootClientId Parent block's client ID.
 * @param {number}  place.index        Index among the parent's blocks.
 */
export function openSectionPicker( { rootClientId, index } ) {
	dispatch( STORE_NAME ).setRequest( { index, rootClientId } );
}

/**
 * Close the section picker, if it is open.
 */
export function closeSectionPicker() {
	if ( select( STORE_NAME ).getRequest() ) {
		dispatch( STORE_NAME ).setRequest( null );
	}
}

/**
 * A design's preview, rendered by the block editor already on screen, which
 * holds the editor's settings and theme styles.
 *
 * @param {Object} props         Component props.
 * @param {string} props.content Pattern markup.
 * @return {Element} The preview.
 */
export function EditorPreview( { content } ) {
	const blocks = useMemo(
		() => parse( content, { __unstableSkipMigrationLogs: true } ),
		[ content ]
	);

	return (
		<BlockPreview.Async>
			<BlockPreview blocks={ blocks } />
		</BlockPreview.Async>
	);
}

/**
 * Add a section from a pattern at a place in the editor, select it, and say
 * so.
 *
 * @param {Object}  registry           The data registry.
 * @param {Object}  pattern            Block pattern.
 * @param {Object}  place              Where the section goes.
 * @param {?string} place.rootClientId Parent block's client ID.
 * @param {number}  place.index        Index among the parent's blocks.
 */
export function addPatternSection(
	registry,
	pattern,
	{ rootClientId, index }
) {
	const blocks = getPatternSectionBlocks( pattern );

	if ( ! blocks.length ) {
		return;
	}

	const { insertBlocks, selectBlock } = registry.dispatch( blockEditorStore );

	insertBlocks( blocks, index, rootClientId );
	selectBlock( blocks[ 0 ].clientId );
	registry.dispatch( noticesStore ).createSuccessNotice(
		sprintf(
			/* translators: %s: section design name. */
			__( 'Added “%s”.' ),
			getPatternTitle( pattern )
		),
		{ id: 'cnl-editor-section-added', type: 'snackbar' }
	);
}

/**
 * The section picker, while a section menu has asked for it.
 *
 * @return {?Element} The picker.
 */
export function EditorSectionPicker() {
	const place = useSelect(
		( selectStore ) => selectStore( STORE_NAME ).getRequest(),
		[]
	);
	const registry = useRegistry();
	const { insertBlocks, selectBlock } = useDispatch( blockEditorStore );
	const placement = useSelect(
		( selectStore ) => {
			if ( ! place ) {
				return null;
			}

			const siblings = selectStore( blockEditorStore ).getBlocks(
				place.rootClientId
			);
			const previous = siblings[ place.index - 1 ];
			const next = siblings[ place.index ];

			return getPlacementText(
				previous && getSectionTitle( previous ),
				next && getSectionTitle( next )
			);
		},
		[ place ]
	);

	if ( ! place ) {
		return null;
	}

	const pickPattern = ( pattern ) => {
		closeSectionPicker();
		addPatternSection( registry, pattern, place );
	};
	const startFromScratch = () => {
		const section = createBlankSection();

		closeSectionPicker();
		insertBlocks( [ section ], place.index, place.rootClientId );
		selectBlock( section.innerBlocks[ 0 ].clientId, 0 );
	};

	return (
		<SectionPicker
			onClose={ closeSectionPicker }
			onPick={ pickPattern }
			onStartFromScratch={ startFromScratch }
			placement={ placement }
			Preview={ EditorPreview }
		/>
	);
}
