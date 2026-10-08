/**
 * The section picker in the editor, opened by "Add section" in a section's
 * options menu.
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
import { useDispatch, useSelect } from '@wordpress/data';
import {
	createElement as el,
	useMemo,
	useSyncExternalStore,
} from '@wordpress/element';
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

let request = null;
const listeners = new Set();

function setRequest( next ) {
	request = next;
	listeners.forEach( ( listener ) => listener() );
}

function subscribe( listener ) {
	listeners.add( listener );

	return () => listeners.delete( listener );
}

/**
 * Open the section picker to add a section at a place in the editor.
 *
 * @param {Object}  place              Where the section goes.
 * @param {?string} place.rootClientId Parent block's client ID.
 * @param {number}  place.index        Index among the parent's blocks.
 */
export function openSectionPicker( { rootClientId, index } ) {
	setRequest( { index, rootClientId } );
}

/**
 * Close the section picker, if it is open.
 */
export function closeSectionPicker() {
	if ( request ) {
		setRequest( null );
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
function EditorPreview( { content } ) {
	const blocks = useMemo(
		() => parse( content, { __unstableSkipMigrationLogs: true } ),
		[ content ]
	);

	return el( BlockPreview.Async, null, el( BlockPreview, { blocks } ) );
}

/**
 * The section picker, while a section menu has asked for it.
 *
 * @return {?Element} The picker.
 */
export function EditorSectionPicker() {
	const place = useSyncExternalStore( subscribe, () => request );
	const { insertBlocks, selectBlock } = useDispatch( blockEditorStore );
	const { createSuccessNotice } = useDispatch( noticesStore );
	const placement = useSelect(
		( select ) => {
			if ( ! place ) {
				return null;
			}

			const siblings = select( blockEditorStore ).getBlocks(
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
		const blocks = getPatternSectionBlocks( pattern );

		closeSectionPicker();

		if ( ! blocks.length ) {
			return;
		}

		insertBlocks( blocks, place.index, place.rootClientId );
		selectBlock( blocks[ 0 ].clientId );
		createSuccessNotice(
			sprintf(
				/* translators: %s: section design name. */
				__( 'Added “%s”.' ),
				getPatternTitle( pattern )
			),
			{ id: 'cnl-editor-section-added', type: 'snackbar' }
		);
	};
	const startFromScratch = () => {
		const section = createBlankSection();

		closeSectionPicker();
		insertBlocks( [ section ], place.index, place.rootClientId );
		selectBlock( section.innerBlocks[ 0 ].clientId, 0 );
	};

	return el( SectionPicker, {
		onClose: closeSectionPicker,
		onPick: pickPattern,
		onStartFromScratch: startFromScratch,
		placement,
		Preview: EditorPreview,
	} );
}
