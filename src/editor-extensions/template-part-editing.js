/**
 * WordPress dependencies
 *
 * Imported package by package rather than through `src/wordpress-packages`.
 * That barrel reaches `@wordpress/lazy-editor`, and this module is registered
 * from app init, so going through it would make the editor a static dependency
 * of page boot and stop it loading lazily.
 */
import {
	/* eslint-disable @wordpress/no-unsafe-wp-apis -- The slot core's own template part toolbar buttons use, and the only one left once the "other" group is hidden. */
	__unstableBlockToolbarLastItem as BlockToolbarLastItem,
	/* eslint-enable @wordpress/no-unsafe-wp-apis */
	privateApis as blockEditorPrivateApis,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import { ToolbarButton, ToolbarGroup } from '@wordpress/components';
import { store as coreDataStore } from '@wordpress/core-data';
import { useRegistry, useSelect } from '@wordpress/data';
import {
	createElement as el,
	Fragment,
	useEffect,
	useRef,
} from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import { pencil as pencilIcon } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { unlock } from '../lock-unlock';
import {
	getTemplatePartAreaLabel,
	getTemplatePartEditLabel,
	getTemplatePartId,
} from './template-part-details';

const { useBlockElement } = unlock( blockEditorPrivateApis );

const TEMPLATE_PART_BLOCK_NAME = 'core/template-part';

const EMPTY_ARRAY = [];

const NOT_EDITABLE = {
	areaLabel: undefined,
	canEdit: false,
	title: undefined,
};

/**
 * Unlock a template part's blocks for as long as it is the edited section.
 *
 * `editContentOnlySection` disables everything outside the part, which is what
 * constrains editing to it and gives Escape and clicking away their meaning.
 * On a page the editor also locks the part itself and its children outright, so
 * those locks are lifted here and put back on the way out.
 *
 * The locks are re-read on every change because the editor re-applies them
 * whenever a block is added to or removed from the part, which would otherwise
 * strand the author mid-edit.
 *
 * @param {string}           clientId The template part's client ID.
 * @param {HTMLElement|null} element  The part's DOM element.
 * @return {boolean} Whether the part is currently being edited.
 */
function useUnlockedTemplatePart( clientId, element ) {
	const registry = useRegistry();
	const hasLiftedLocks = useRef( false );

	const isEditing = useSelect(
		( select ) =>
			unlock(
				select( blockEditorStore )
			).getEditedContentOnlySection() === clientId,
		[ clientId ]
	);

	const lockedModes = useSelect(
		( select ) => {
			if ( ! isEditing ) {
				return EMPTY_ARRAY;
			}

			const { getBlockEditingMode, getBlockOrder } =
				select( blockEditorStore );

			return [ clientId, ...getBlockOrder( clientId ) ].map(
				( id ) => `${ id }:${ getBlockEditingMode( id ) }`
			);
		},
		[ clientId, isEditing ]
	);

	useEffect( () => {
		if ( ! isEditing ) {
			return;
		}

		const locked = lockedModes
			.filter( ( entry ) => ! entry.endsWith( ':default' ) )
			.map( ( entry ) => entry.slice( 0, entry.lastIndexOf( ':' ) ) );

		if ( ! locked.length ) {
			return;
		}

		hasLiftedLocks.current = true;

		const { setBlockEditingMode, __unstableMarkNextChangeAsNotPersistent } =
			registry.dispatch( blockEditorStore );

		registry.batch( () => {
			for ( const id of locked ) {
				__unstableMarkNextChangeAsNotPersistent();
				setBlockEditingMode( id, 'default' );
			}
		} );
	}, [ isEditing, lockedModes, registry ] );

	useEffect( () => {
		if ( ! isEditing ) {
			return;
		}

		return () => {
			if ( ! hasLiftedLocks.current ) {
				return;
			}

			hasLiftedLocks.current = false;

			const { getBlockOrder } = registry.select( blockEditorStore );
			const {
				setBlockEditingMode,
				__unstableMarkNextChangeAsNotPersistent,
			} = registry.dispatch( blockEditorStore );

			registry.batch( () => {
				__unstableMarkNextChangeAsNotPersistent();
				setBlockEditingMode( clientId, 'contentOnly' );

				for ( const child of getBlockOrder( clientId ) ) {
					__unstableMarkNextChangeAsNotPersistent();
					setBlockEditingMode( child, 'disabled' );
				}
			} );
		};
	}, [ clientId, isEditing, registry ] );

	/*
	 * Leaving by clicking away.
	 *
	 * The editor has a handler of its own for this, but everything outside the
	 * edited section is inert, so a click aimed at a block out there never
	 * reaches it and the handler never runs. Listening on the canvas document
	 * catches the click wherever it actually lands. Popovers are excluded
	 * because in-canvas UI such as the link editor sits outside the part's
	 * element while still belonging to it.
	 */
	useEffect( () => {
		if ( ! isEditing || ! element ) {
			return;
		}

		const { ownerDocument } = element;

		function onClick( event ) {
			if (
				element.contains( event.target ) ||
				event.target.closest?.( '.components-popover' )
			) {
				return;
			}

			unlock(
				registry.dispatch( blockEditorStore )
			).stopEditingContentOnlySection();
		}

		ownerDocument.addEventListener( 'click', onClick );

		return () => ownerDocument.removeEventListener( 'click', onClick );
	}, [ element, isEditing, registry ] );

	return isEditing;
}

/**
 * Enter editing when an already selected template part is clicked again.
 *
 * Listening in the capture phase on the canvas document is what makes "already
 * selected" mean the state before this click: the editor selects the part on
 * its own handler, which runs later, so the first click only ever selects.
 *
 * @param {string}           clientId The template part's client ID.
 * @param {HTMLElement|null} element  The part's DOM element.
 * @param {boolean}          canEnter Whether the part can be entered at all.
 */
function useSecondClickToEdit( clientId, element, canEnter ) {
	const registry = useRegistry();

	useEffect( () => {
		if ( ! canEnter || ! element ) {
			return;
		}

		const { ownerDocument } = element;

		function onMouseDown( event ) {
			if ( ! element.contains( event.target ) ) {
				return;
			}

			const { isBlockSelected } = registry.select( blockEditorStore );

			if ( ! isBlockSelected( clientId ) ) {
				return;
			}

			unlock(
				registry.dispatch( blockEditorStore )
			).editContentOnlySection( clientId );
		}

		ownerDocument.addEventListener( 'mousedown', onMouseDown, true );

		return () =>
			ownerDocument.removeEventListener( 'mousedown', onMouseDown, true );
	}, [ canEnter, clientId, element, registry ] );
}

/**
 * Read everything the toolbar button needs about a template part block.
 *
 * @param {string} clientId   The block's client ID.
 * @param {Object} attributes The block's attributes.
 * @return {{areaLabel: ?string, canEdit: boolean, title: ?string}} Button state.
 */
function useTemplatePartEditState( clientId, attributes ) {
	const { area, slug, theme } = attributes;

	return useSelect(
		( select ) => {
			const { canUser, getCurrentTheme, getEditedEntityRecord } =
				select( coreDataStore );
			const { getBlockEditingMode, getSettings } =
				select( blockEditorStore );
			const { isZoomOut } = unlock( select( blockEditorStore ) );

			/*
			 * `contentOnly` is the one state there is anything to offer: the
			 * part is locked but available to unlock. An unlocked part is
			 * already editable where it stands, and a disabled one sits outside
			 * the part being edited.
			 */
			if (
				getSettings().isPreviewMode ||
				isZoomOut() ||
				getBlockEditingMode( clientId ) !== 'contentOnly'
			) {
				return NOT_EDITABLE;
			}

			const currentTheme = getCurrentTheme();
			const id = getTemplatePartId(
				{ slug, theme },
				currentTheme?.stylesheet
			);

			if ( ! id ) {
				return NOT_EDITABLE;
			}

			const record = getEditedEntityRecord(
				'postType',
				'wp_template_part',
				id
			);

			return {
				areaLabel: getTemplatePartAreaLabel(
					currentTheme?.default_template_part_areas,
					record?.area || area
				),
				canEdit: !! canUser( 'update', {
					kind: 'postType',
					name: 'wp_template_part',
					id,
				} ),
				title: record?.title,
			};
		},
		[ area, clientId, slug, theme ]
	);
}

/**
 * Toolbar button that edits a template part's blocks in place.
 *
 * It replaces core's "Edit original", which the editor layer's stylesheet
 * hides whenever a template part is selected. See src/editor-layer/style.scss.
 *
 * @param {Object}  props            Component props.
 * @param {Object}  props.attributes Template part block attributes.
 * @param {string}  props.clientId   Template part block client ID.
 * @param {boolean} props.isSelected Whether the template part is the selected block.
 * @return {?Element} The toolbar button, or null when the part cannot be edited here.
 */
function TemplatePartEditButton( { attributes, clientId, isSelected } ) {
	const { areaLabel, canEdit, title } = useTemplatePartEditState(
		clientId,
		attributes
	);
	const element = useBlockElement( clientId );
	const isEditing = useUnlockedTemplatePart( clientId, element );
	const registry = useRegistry();

	useSecondClickToEdit( clientId, element, canEdit && ! isEditing );

	if ( ! isSelected || ! canEdit || isEditing ) {
		return null;
	}

	const label = getTemplatePartEditLabel( areaLabel, title );

	return el(
		BlockToolbarLastItem,
		null,
		el(
			ToolbarGroup,
			null,
			el(
				ToolbarButton,
				{
					icon: pencilIcon,
					label,
					onClick: () =>
						unlock(
							registry.dispatch( blockEditorStore )
						).editContentOnlySection( clientId ),
				},
				label
			)
		)
	);
}

/**
 * Add the edit affordances to every template part block.
 *
 * @param {Function} BlockEdit The block's edit component.
 * @return {Function} Wrapped edit component.
 */
function withTemplatePartEditButton( BlockEdit ) {
	return function TemplatePartBlockEdit( props ) {
		if ( props.name !== TEMPLATE_PART_BLOCK_NAME ) {
			return el( BlockEdit, props );
		}

		return el(
			Fragment,
			null,
			el( BlockEdit, props ),
			el( TemplatePartEditButton, {
				attributes: props.attributes,
				clientId: props.clientId,
				isSelected: props.isSelected,
			} )
		);
	};
}

/**
 * Register the template part edit affordances with the editor.
 */
export function registerTemplatePartEditing() {
	addFilter(
		'editor.BlockEdit',
		'create-not-learn-editor/template-part-editing',
		withTemplatePartEditButton
	);
}
