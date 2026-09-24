/**
 * WordPress dependencies
 */
import { store as bootStore } from '@wordpress/boot';
import { dispatch } from '@wordpress/data';
import { layout, navigation, symbol, symbolFilled } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { registerTemplatePartEditing } from '../../../src/editor-extensions/template-part-editing';

export async function init() {
	registerTemplatePartEditing();

	const menuIcons = {
		navigation,
		patterns: symbol,
		templateParts: symbolFilled,
		templates: layout,
	};

	Object.entries( menuIcons ).forEach( ( [ id, icon ] ) => {
		dispatch( bootStore ).updateMenuItem( id, { icon } );
	} );
}
