/**
 * A dropdown of a section's variations, each drawn as it would look, for
 * Compose's section toolbar: its layouts, its colours, or a header's designs.
 */

/**
 * WordPress dependencies
 */
import { BlockPreview } from '@wordpress/block-editor';
import { ToolbarItem } from '@wordpress/components';

/**
 * Internal dependencies
 */
import {
	Button,
	checkIcon,
	Dropdown,
	LegacyIcon,
} from '../../wordpress-packages';

/**
 * @param {Object}   props
 * @param {Object}   props.option    `{ blocks, label, name }`.
 * @param {boolean}  props.isCurrent Whether the section has it now.
 * @param {Function} props.onSelect  Called when picked.
 * @return {Element} The option.
 */
function VariationOption( { option, isCurrent, onSelect } ) {
	return (
		<button
			aria-pressed={ isCurrent }
			className={ `cnl-compose-variations__option${
				isCurrent ? ' is-current' : ''
			}` }
			onClick={ onSelect }
			type="button"
		>
			<span className="cnl-compose-variations__preview" aria-hidden>
				<BlockPreview.Async>
					<BlockPreview
						blocks={ option.blocks }
						viewportWidth={ 1200 }
					/>
				</BlockPreview.Async>
			</span>
			<span className="cnl-compose-variations__label">
				{ option.label }
				{ isCurrent && (
					<LegacyIcon
						className="cnl-compose-variations__check"
						icon={ checkIcon }
						size={ 20 }
					/>
				) }
			</span>
		</button>
	);
}

/**
 * @param {Object}   props
 * @param {Object}   props.icon     The toggle's icon.
 * @param {string}   props.label    What is being picked, like "Layout", for
 *                                  the toggle's tooltip.
 * @param {Object[]} props.options  `{ blocks, label, name }` for each
 *                                  variation, `blocks` being how it looks.
 * @param {?string}  props.current  The variation the section has now.
 * @param {Function} props.onSelect Called with the variation picked.
 * @return {Element} The dropdown, as an item of a toolbar.
 */
export function VariationMenu( { icon, label, options, current, onSelect } ) {
	return (
		<ToolbarItem>
			{ ( toggleProps ) => (
				<Dropdown
					className="cnl-compose-variations"
					contentClassName="cnl-compose-variations__content"
					popoverProps={ { placement: 'bottom-start' } }
					renderToggle={ ( { isOpen, onToggle } ) => (
						<Button
							{ ...toggleProps }
							aria-expanded={ isOpen }
							aria-haspopup="true"
							icon={ icon }
							label={ label }
							onClick={ onToggle }
							showTooltip
						/>
					) }
					renderContent={ ( { onClose } ) => (
						<div
							aria-label={ label }
							className="cnl-compose-variations__list"
							role="group"
						>
							{ options.map( ( option ) => (
								<VariationOption
									isCurrent={ option.name === current }
									key={ option.name ?? 'none' }
									onSelect={ () => {
										onClose();

										if ( option.name !== current ) {
											onSelect( option );
										}
									} }
									option={ option }
								/>
							) ) }
						</div>
					) }
				/>
			) }
		</ToolbarItem>
	);
}
