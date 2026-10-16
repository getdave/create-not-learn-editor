/**
 * Internal dependencies
 */
import { Button, __, minusIcon, plusIcon } from '../../wordpress-packages';

/**
 * @param {Object}   props
 * @param {boolean}  props.canZoomIn Whether the canvas can zoom in further.
 * @param {boolean}  props.isReset   Whether the whole site is on show, so
 *                                   there is nothing to reset.
 * @param {Function} props.onReset   Fits the whole site on screen again.
 * @param {Function} props.onZoom    Zooms in with 1, out with -1.
 * @param {number}   props.zoom      Zoom level, where 1 fits the site.
 * @return {Element} Zoom controls.
 */
export function ZoomControls( { canZoomIn, isReset, onReset, onZoom, zoom } ) {
	return (
		<div
			aria-label={ __( 'Zoom' ) }
			className="cnl-site-overview__zoom"
			role="group"
		>
			<Button
				accessibleWhenDisabled
				disabled={ isReset }
				icon={ minusIcon }
				label={ __( 'Zoom out' ) }
				onClick={ () => onZoom( -1 ) }
				shortcut="-"
				showTooltip
				size="compact"
			/>
			<span aria-live="polite" className="cnl-site-overview__zoom-level">
				{ `${ Math.round( zoom * 100 ) }%` }
			</span>
			<Button
				accessibleWhenDisabled
				disabled={ ! canZoomIn }
				icon={ plusIcon }
				label={ __( 'Zoom in' ) }
				onClick={ () => onZoom( 1 ) }
				shortcut="+"
				showTooltip
				size="compact"
			/>
			<Button
				accessibleWhenDisabled
				disabled={ isReset }
				label={ __( 'Show the whole site' ) }
				onClick={ onReset }
				shortcut="0"
				showTooltip
				size="compact"
				variant="secondary"
			>
				{ __( 'Reset' ) }
			</Button>
		</div>
	);
}
