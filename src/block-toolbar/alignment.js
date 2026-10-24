/**
 * A block's text alignment and width, read and written as core's own toolbar
 * controls do, for the options and Layout menus that stand in for them.
 */

/**
 * WordPress dependencies
 */
import {
	store as blockEditorStore,
	useSettings,
} from '@wordpress/block-editor';
import {
	getBlockSupport,
	getBlockType,
	hasBlockSupport,
} from '@wordpress/blocks';
import { useSelect } from '@wordpress/data';
import { __, sprintf } from '@wordpress/i18n';
import {
	alignCenter,
	alignLeft,
	alignRight,
	positionCenter,
	stretchFullWidth,
	stretchWide,
} from '@wordpress/icons';

/**
 * A radio group's value for "nothing set", since an undefined value would
 * leave the group uncontrolled.
 */
export const NONE = 'none';

/**
 * The attribute value a radio group's value stands for.
 *
 * @param {string} value Radio value.
 * @return {?string} Attribute value.
 */
export const fromRadio = ( value ) => ( value === NONE ? undefined : value );

export const TEXT_ALIGNMENTS = [
	{ value: 'left', label: __( 'Left' ), icon: alignLeft },
	{ value: 'center', label: __( 'Center' ), icon: alignCenter },
	{ value: 'right', label: __( 'Right' ), icon: alignRight },
];

/**
 * How a block keeps its text alignment: core's newer `typography.textAlign`
 * support, in its style, or the `textAlign` attribute older blocks have.
 *
 * @param {string} name Block name.
 * @return {?string} `support`, `attribute` or null.
 */
function getTextAlignKind( name ) {
	if ( hasBlockSupport( name, 'typography.textAlign', false ) ) {
		return 'support';
	}

	return getBlockType( name )?.attributes?.textAlign ? 'attribute' : null;
}

/**
 * A block's text alignment, and how to change it.
 *
 * @param {string}   name          Block name.
 * @param {Object}   attributes    Block attributes.
 * @param {Function} setAttributes Block attribute setter.
 * @return {?Object} `{ value, options, onChange }`, or null for blocks without one.
 */
export function getTextAlignment( name, attributes, setAttributes ) {
	const kind = getTextAlignKind( name );

	if ( ! kind ) {
		return null;
	}

	if ( kind === 'attribute' ) {
		return {
			value: attributes.textAlign,
			options: TEXT_ALIGNMENTS,
			onChange: ( textAlign ) => setAttributes( { textAlign } ),
		};
	}

	const supported = getBlockSupport( name, 'typography.textAlign' );
	const options = Array.isArray( supported )
		? TEXT_ALIGNMENTS.filter( ( { value } ) => supported.includes( value ) )
		: TEXT_ALIGNMENTS;

	return {
		value: attributes.style?.typography?.textAlign,
		options,
		onChange: ( textAlign ) =>
			setAttributes( {
				style: {
					...attributes.style,
					typography: {
						...attributes.style?.typography,
						textAlign,
					},
				},
			} ),
	};
}

/**
 * A block's width choices: as wide as the content, wide, or the full width,
 * each with the size the theme sets, when the block and where it sits allow
 * them.
 *
 * Left, right and centre floats stay in the block's settings. They are rare
 * on a page built from sections, and a float is a different thing to a width.
 *
 * @param {string} clientId Block client ID.
 * @param {string} name     Block name.
 * @return {Object[]} Choices, `{ value, label, icon, hint }`, empty when there are none.
 */
export function useBlockWidths( clientId, name ) {
	const [ contentSize, wideSize ] = useSettings(
		'layout.contentSize',
		'layout.wideSize'
	);

	const parentAllowsWidths = useSelect(
		( select ) => {
			const { getBlockRootClientId, getBlockAttributes, getBlockName } =
				select( blockEditorStore );
			const parentId = getBlockRootClientId( clientId );

			// The page itself, which is laid out like a constrained group.
			if ( ! parentId ) {
				return true;
			}

			const layout =
				getBlockAttributes( parentId )?.layout ??
				getBlockSupport( getBlockName( parentId ), 'layout' )?.default;

			return layout?.type === 'constrained' || !! layout?.inherit;
		},
		[ clientId ]
	);

	const supported = getBlockSupport( name, 'align' );

	if ( ! supported || ! parentAllowsWidths ) {
		return [];
	}

	const allows = ( value ) =>
		supported === true ||
		( Array.isArray( supported ) && supported.includes( value ) );

	const hint = ( size ) =>
		size &&
		/* translators: %s: a width, like 645px. */
		sprintf( __( 'Max. %s' ), size );

	return [
		{
			value: NONE,
			label: __( 'None' ),
			icon: positionCenter,
			hint: hint( contentSize ),
		},
		allows( 'wide' ) &&
			wideSize && {
				value: 'wide',
				label: __( 'Wide width' ),
				icon: stretchWide,
				hint: hint( wideSize ),
			},
		allows( 'full' ) && {
			value: 'full',
			label: __( 'Full width' ),
			icon: stretchFullWidth,
		},
	].filter( Boolean );
}

/**
 * The label of the choice in use.
 *
 * @param {Object[]} options Choices.
 * @param {*}        value   The value in use.
 * @param {string}   [none]  What to say when nothing is set.
 * @return {string} Its label.
 */
export function getChoiceLabel( options, value, none = __( 'Default' ) ) {
	return options.find( ( option ) => option.value === value )?.label ?? none;
}
