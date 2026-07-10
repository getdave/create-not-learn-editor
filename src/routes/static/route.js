/**
 * Internal dependencies
 */
import { getCurrentEditorPath, getStaticScreen } from './screens';

export const route = {
	title: () => getStaticScreen().title,
	async canvas() {
		const path = getCurrentEditorPath();

		if (
			path === '/templates' ||
			path === '/template-parts' ||
			path === '/patterns'
		) {
			return undefined;
		}

		return null;
	},
};
