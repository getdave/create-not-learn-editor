/**
 * Boot keeps a screen's canvas mounted when the next screen's canvas comes
 * from the same module. Screens that share a module (see `AGENTS.md`) key
 * their canvas by screen, so moving between them mounts it afresh, as it did
 * when each screen had a module of its own.
 */

/**
 * Internal dependencies
 */
import { getCurrentEditorPath } from './routes/static/screens';

/**
 * @param {Function} Component      The canvas.
 * @param {Function} [getScreenKey] Names the screen on show. Defaults to the
 *                                  editor path.
 * @return {Function} The canvas, mounted afresh for each screen.
 */
export function withScreenKey(
	Component,
	getScreenKey = getCurrentEditorPath
) {
	return function ScreenKeyed( props ) {
		return <Component key={ getScreenKey() } { ...props } />;
	};
}
