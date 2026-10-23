/**
 * A container's primary actions: a "Layout" menu, and a button adding a
 * block inside it.
 *
 * Core gives a container its width and how its content lines up as separate
 * icon buttons. Here they are one labelled menu, each part showing what is
 * in use, as the block name button does for transforms. The "+" adds a block
 * as the container's last child, so something can go in a container without
 * selecting the right child first.
 */

/**
 * WordPress dependencies
 */
import { Inserter, store as blockEditorStore } from '@wordpress/block-editor';
import {
	getBlockSupport,
	getBlockType,
	hasBlockSupport,
} from '@wordpress/blocks';
import { ToolbarButton } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { Fragment } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import {
	justifyBottom,
	justifyCenter,
	justifyCenterVertical,
	justifyLeft,
	justifyRight,
	justifySpaceBetween,
	justifySpaceBetweenVertical,
	justifyStretch,
	justifyStretchVertical,
	justifyTop,
	plus,
} from '@wordpress/icons';
import { Menu } from '@wordpress/ui';

/**
 * Internal dependencies
 */
import { fromRadio, NONE, useBlockWidths } from './alignment';
import { ToolbarMenu } from './toolbar-menu';

const LEFT = { value: 'left', label: __( 'Left' ), icon: justifyLeft };
const CENTER = { value: 'center', label: __( 'Center' ), icon: justifyCenter };
const RIGHT = { value: 'right', label: __( 'Right' ), icon: justifyRight };

const TOP = { value: 'top', label: __( 'Top' ), icon: justifyTop };
const MIDDLE = {
	value: 'center',
	label: __( 'Middle' ),
	icon: justifyCenterVertical,
};
const BOTTOM = { value: 'bottom', label: __( 'Bottom' ), icon: justifyBottom };

/**
 * Whether a block lays out other blocks, and so gets a Layout menu.
 *
 * @param {string} name Block name.
 * @return {boolean} Whether it is a container.
 */
export function isContainerBlock( name ) {
	return (
		hasBlockSupport( name, 'layout' ) ||
		hasBlockSupport( name, '__experimentalLayout' )
	);
}

/**
 * The block's layout, its own or its type's default.
 *
 * @param {string} name       Block name.
 * @param {Object} attributes Block attributes.
 * @return {Object} The layout.
 */
function getLayout( name, attributes ) {
	const support =
		getBlockSupport( name, 'layout' ) ??
		getBlockSupport( name, '__experimentalLayout' );
	const layout = { ...support?.default, ...attributes.layout };

	if ( layout.inherit ) {
		return { ...layout, type: 'constrained' };
	}

	return { ...layout, type: layout.type ?? 'default' };
}

/**
 * The choices for how a layout's content lines up, by layout type, as
 * core's own toolbar controls for each offer them.
 *
 * @param {Object} layout The block's layout.
 * @return {Object[]} Groups, `{ key, label, options, fallback }`.
 */
function getContentGroups( layout ) {
	if ( layout.type === 'constrained' ) {
		return [
			{
				key: 'justifyContent',
				label: __( 'Content' ),
				options: [ LEFT, CENTER, RIGHT ],
				fallback: 'center',
			},
		];
	}

	if ( layout.type !== 'flex' ) {
		return [];
	}

	if ( layout.orientation === 'vertical' ) {
		return [
			{
				key: 'justifyContent',
				label: __( 'Content' ),
				options: [
					LEFT,
					CENTER,
					RIGHT,
					{
						value: 'stretch',
						label: __( 'Stretch' ),
						icon: justifyStretch,
					},
				],
				fallback: 'left',
			},
			{
				key: 'verticalAlignment',
				label: __( 'Vertical' ),
				options: [
					TOP,
					MIDDLE,
					BOTTOM,
					{
						value: 'space-between',
						label: __( 'Space between' ),
						icon: justifySpaceBetweenVertical,
					},
				],
				fallback: 'top',
			},
		];
	}

	return [
		{
			key: 'justifyContent',
			label: __( 'Content' ),
			options: [
				LEFT,
				CENTER,
				RIGHT,
				{
					value: 'space-between',
					label: __( 'Space between' ),
					icon: justifySpaceBetween,
				},
			],
			fallback: 'left',
		},
		{
			key: 'verticalAlignment',
			label: __( 'Vertical' ),
			options: [
				TOP,
				MIDDLE,
				BOTTOM,
				{
					value: 'stretch',
					label: __( 'Stretch' ),
					icon: justifyStretchVertical,
				},
			],
			fallback: 'center',
		},
	];
}

/**
 * One part of the Layout menu: a label, then its choices.
 *
 * @param {Object}   props
 * @param {string}   props.label    The part's name.
 * @param {Object[]} props.options  Choices, `{ value, label, icon, hint }`.
 * @param {string}   props.value    The choice in use.
 * @param {Function} props.onChange Called with the choice picked.
 * @return {Element} The part.
 */
function ChoiceGroup( { label, options, value, onChange } ) {
	return (
		<Menu.RadioGroup value={ value } onValueChange={ onChange }>
			<Menu.GroupLabel>{ label }</Menu.GroupLabel>
			{ options.map( ( option ) => (
				<Menu.RadioItem
					key={ option.value }
					value={ option.value }
					closeOnClick
					prefix={ <Menu.PrefixIcon icon={ option.icon } /> }
					suffix={ option.hint }
				>
					<Menu.ItemLabel>{ option.label }</Menu.ItemLabel>
				</Menu.RadioItem>
			) ) }
		</Menu.RadioGroup>
	);
}

/**
 * The Layout menu and the add button, on a container's toolbar.
 *
 * @param {Object}   props
 * @param {string}   props.clientId      Block client ID.
 * @param {string}   props.name          Block name.
 * @param {Object}   props.attributes    Block attributes.
 * @param {Function} props.setAttributes Block attribute setter.
 * @return {?Element} The controls.
 */
export function ContainerControls( {
	clientId,
	name,
	attributes,
	setAttributes,
} ) {
	const widths = useBlockWidths( clientId, name );
	const layout = getLayout( name, attributes );
	const contentGroups = getContentGroups( layout );
	const title = useSelect(
		( select ) =>
			select( blockEditorStore ).getBlockAttributes( clientId )?.metadata
				?.name ?? getBlockType( name )?.title,
		[ clientId, name ]
	);

	const showWidths = widths.length > 1;

	return (
		<>
			{ ( showWidths || contentGroups.length > 0 ) && (
				<ToolbarMenu
					buttonProps={ {
						className: 'cnl-block-layout__toggle',
						children: __( 'Layout' ),
					} }
					popupClassName="cnl-block-layout"
				>
					{ showWidths && (
						<ChoiceGroup
							label={ __( 'Block width' ) }
							options={ widths }
							value={ attributes.align ?? NONE }
							onChange={ ( value ) =>
								setAttributes( { align: fromRadio( value ) } )
							}
						/>
					) }
					{ contentGroups.map( ( group, index ) => (
						<Fragment key={ group.key }>
							{ ( showWidths || index > 0 ) && (
								<Menu.Separator />
							) }
							<ChoiceGroup
								label={ group.label }
								options={ group.options }
								value={ layout[ group.key ] ?? group.fallback }
								onChange={ ( value ) =>
									setAttributes( {
										layout: {
											...attributes.layout,
											type: layout.type,
											[ group.key ]: value,
										},
									} )
								}
							/>
						</Fragment>
					) ) }
				</ToolbarMenu>
			) }
			<Inserter
				rootClientId={ clientId }
				isAppender
				__experimentalIsQuick
				position="bottom center"
				renderToggle={ ( { onToggle, disabled, isOpen } ) => (
					<ToolbarButton
						className="cnl-block-toolbar__keep"
						icon={ plus }
						label={ sprintf(
							/* translators: %s: the container block's name, like Group. */
							__( 'Add block to %s' ),
							title
						) }
						onClick={ onToggle }
						aria-expanded={ isOpen }
						disabled={ disabled }
					/>
				) }
			/>
		</>
	);
}
