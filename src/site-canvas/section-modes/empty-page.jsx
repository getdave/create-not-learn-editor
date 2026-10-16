/**
 * What Edit shows in a page with nothing in it yet: the design system's
 * empty state, across the canvas in a dotted box, with the two ways to
 * start. A section from the picker, or a blank one to type straight into.
 */

/**
 * Internal dependencies
 */
import { __, EmptyState, UiButton } from '../../wordpress-packages';
import { sectionsIcon } from '../icons';

/**
 * @param {Object}   props
 * @param {Object}   props.style        Where it sits.
 * @param {Function} props.onAddSection Opens the section picker.
 * @param {Function} props.onStartBlank Adds a blank section, to type in.
 * @return {Element} The placeholder.
 */
export function EmptyPage( { onAddSection, onStartBlank, style } ) {
	return (
		<div className="cnl-section-modes__empty" style={ style }>
			<EmptyState.Root>
				<EmptyState.Icon icon={ sectionsIcon } />
				<EmptyState.Title>
					{ __( 'This page has nothing on it yet' ) }
				</EmptyState.Title>
				<EmptyState.Description>
					{ __(
						'Add a ready-made section, like a banner or a few columns, or start with a blank one and type.'
					) }
				</EmptyState.Description>
				<EmptyState.Actions>
					<UiButton onClick={ onStartBlank } variant="outline">
						{ __( 'Start blank' ) }
					</UiButton>
					<UiButton onClick={ onAddSection }>
						{ __( 'Add a section' ) }
					</UiButton>
				</EmptyState.Actions>
			</EmptyState.Root>
		</div>
	);
}
