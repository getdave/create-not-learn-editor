/**
 * WordPress dependencies
 */
import { store as bootStore } from '@wordpress/boot';
import { dispatch } from '@wordpress/data';
import { layout, navigation, symbol, symbolFilled } from '@wordpress/icons';

export async function init() {
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
