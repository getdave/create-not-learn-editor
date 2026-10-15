/**
 * Internal dependencies
 */
import {
	Button,
	__,
	fullscreenIcon,
	minusIcon,
	plusIcon,
} from '../../wordpress-packages';

export function ZoomControls( { onFit, onReset, onZoom, zoom } ) {
	return (
		<div
			aria-label={ __( 'Zoom' ) }
			className="cnl-site-overview__zoom"
			role="group"
		>
			<Button
				icon={ minusIcon }
				label={ __( 'Zoom out' ) }
				onClick={ () => onZoom( -1 ) }
				shortcut="-"
				showTooltip
				size="compact"
			/>
			<Button
				className="cnl-site-overview__zoom-level"
				label={ __( 'Zoom to 100%' ) }
				onClick={ onReset }
				showTooltip
				size="compact"
			>{ `${ Math.round( zoom * 100 ) }%` }</Button>
			<Button
				icon={ plusIcon }
				label={ __( 'Zoom in' ) }
				onClick={ () => onZoom( 1 ) }
				shortcut="+"
				showTooltip
				size="compact"
			/>
			<Button
				icon={ fullscreenIcon }
				label={ __( 'Fit everything on screen' ) }
				onClick={ onFit }
				shortcut="0"
				showTooltip
				size="compact"
			/>
		</div>
	);
}
