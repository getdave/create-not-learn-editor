/**
 * The stage, folded to a strip while Edit has taken over its room.
 *
 * Rather than leaving altogether, the stage stays in sight as a narrow strip
 * beside the canvas, stacked with the sidebar's strip of icons when that is
 * folded too. Its one button puts everything back: Preview, with the stage
 * open beside it.
 */

/**
 * Internal dependencies
 */
import { usePortalHost } from '../editor-layer/portal-host';
import {
	__,
	Button,
	createPortal,
	drawerLeftIcon,
	el,
} from '../wordpress-packages';

// Boot's stage beside a site canvas. Its class names are CSS-module hashed.
const STAGE_SELECTOR =
	'#create-not-learn-editor-app [class*="__stage"]:has(~ [class*="__canvas"] .cnl-site-canvas)';

/**
 * @param {Object}   props
 * @param {Function} props.onExpand Called to go back to Preview.
 * @return {?Element} The strip's button, portalled into the stage.
 */
export function StageStrip( { onExpand } ) {
	const host = usePortalHost( STAGE_SELECTOR, 'cnl-stage-strip' );

	return (
		host &&
		createPortal(
			el( Button, {
				__next40pxDefaultSize: true,
				className: 'cnl-stage-strip__expand',
				icon: drawerLeftIcon,
				label: __( 'Back to Preview' ),
				onClick: onExpand,
				showTooltip: true,
				tooltipPosition: 'middle right',
			} ),
			host
		)
	);
}
