/**
 * WordPress dependencies
 */
import { store as bootStore } from '@wordpress/boot';
import { dispatch } from '@wordpress/data';
import {
	layout,
	navigation,
	siteLogo,
	styles,
	symbol,
	symbolFilled,
} from '@wordpress/icons';

export async function init() {
	const menuIcons = {
		identity: siteLogo,
		navigation,
		patterns: symbol,
		styles,
		templateParts: symbolFilled,
		templates: layout,
	};

	Object.entries( menuIcons ).forEach( ( [ id, icon ] ) => {
		dispatch( bootStore ).updateMenuItem( id, { icon } );
	} );
}
