/**
 * "Edit section" and "Add section" at the top of a section's options menu on
 * a page.
 *
 * They stand in for core's "Detach" and "Manage patterns", which the editor
 * layer's stylesheet hides on pages. "Detach" asks a beginner to understand
 * that a section is linked to something, and "Manage patterns" leaves this
 * editor for core's pattern library. Editing a section and adding another are
 * what those menu entries are reached for.
 *
 * Only unsynced patterns count as sections here. Synced patterns keep core's
 * own controls.
 *
 * Imported package by package rather than through `src/wordpress-packages`,
 * for the same reason as `template-part-editing.js`.
 */

/**
 * WordPress dependencies
 */
import {
	/* eslint-disable @wordpress/no-unsafe-wp-apis -- The only slot at the top of the block options menu. */
	__unstableBlockSettingsMenuFirstItem as BlockSettingsMenuFirstItem,
	/* eslint-enable @wordpress/no-unsafe-wp-apis */
	store as blockEditorStore,
} from '@wordpress/block-editor';
import { MenuItem } from '@wordpress/components';
import { useRegistry, useSelect } from '@wordpress/data';
import { createElement as el, Fragment } from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { unlock } from '../lock-unlock';

/*
 * Named rather than imported, so the editor stays out of page boot. See
 * `src/editor-layer/settings-guard.js`.
 */
const EDITOR_STORE = 'core/editor';

/**
 * Whether a block is a section of the page being edited.
 *
 * `isSectionBlock` is false while the section is being edited, which is when
 * the toolbar offers "Exit section" instead.
 *
 * @param {string} clientId Block client ID.
 * @return {boolean} Whether it is a page section.
 */
function useIsPageSection( clientId ) {
	return useSelect(
		( select ) => {
			if ( select( EDITOR_STORE )?.getCurrentPostType() !== 'page' ) {
				return false;
			}

			const { getBlockAttributes, isSectionBlock } = unlock(
				select( blockEditorStore )
			);

			return (
				isSectionBlock( clientId ) &&
				!! getBlockAttributes( clientId )?.metadata?.patternName
			);
		},
		[ clientId ]
	);
}

/**
 * The menu items for a selected section.
 *
 * @param {Object} props          Component props.
 * @param {string} props.clientId Selected block's client ID.
 * @return {?Element} The menu items.
 */
function SectionMenuItems( { clientId } ) {
	const registry = useRegistry();
	const isPageSection = useIsPageSection( clientId );

	if ( ! isPageSection ) {
		return null;
	}

	const editSection = () =>
		unlock( registry.dispatch( blockEditorStore ) ).editContentOnlySection(
			clientId
		);

	/*
	 * Closed first, because the inserter only reads which tab to open on when
	 * it mounts.
	 */
	const addSection = () => {
		const { getBlockIndex, getBlockRootClientId } =
			registry.select( blockEditorStore );
		const { setIsInserterOpened } = registry.dispatch( EDITOR_STORE );

		setIsInserterOpened( false );
		setIsInserterOpened( {
			rootClientId: getBlockRootClientId( clientId ),
			insertionIndex: getBlockIndex( clientId ) + 1,
			tab: 'patterns',
		} );
	};

	return el( BlockSettingsMenuFirstItem, null, ( { onClose } ) =>
		el(
			Fragment,
			null,
			el(
				MenuItem,
				{
					onClick: () => {
						onClose();
						editSection();
					},
				},
				__( 'Edit section' )
			),
			el(
				MenuItem,
				{
					onClick: () => {
						onClose();
						addSection();
					},
				},
				__( 'Add section' )
			)
		)
	);
}

function withSectionMenuItems( BlockEdit ) {
	return function SectionMenuBlockEdit( props ) {
		if ( ! props.isSelected ) {
			return el( BlockEdit, props );
		}

		return el(
			Fragment,
			null,
			el( BlockEdit, props ),
			el( SectionMenuItems, { clientId: props.clientId } )
		);
	};
}

/**
 * Register the section menu items with the editor.
 */
export function registerSectionMenu() {
	addFilter(
		'editor.BlockEdit',
		'create-not-learn-editor/section-menu',
		withSectionMenuItems
	);
}
